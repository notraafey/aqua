/**
 * Operational Response & Recommendation Service
 * Conforms to Phase 4 PRD Sections 10, 15, 16, 17, 18, 26, 27.
 * 
 * Closes the DATA -> INSIGHT -> DECISION -> ACTION loop.
 * Subscribes to EvidenceUpdated events, classifies incidents, evaluates operational severity,
 * matches and ranks catalogue measures, enforces safety gates, manages human approval,
 * coordinates operational tasks, and publishes FHIR R4 Task resources.
 */

import {
  EvidenceAssessment,
  EvidenceUpdatedEvent,
  Incident,
  Recommendation,
  Task,
  TaskAuditEvent,
  RecommendationGeneratedEvent,
  RecommendationReviewedEvent,
  TaskCreatedEvent,
  TaskStatusUpdatedEvent,
  VerificationSubmittedEvent,
  VerificationCompletedEvent,
  IncidentConfirmedEvent,
  IncidentNotConfirmedEvent,
  IncidentEscalatedEvent,
  IncidentResolvedEvent,
  AdditionalVerificationRequiredEvent,
  GeoJsonPoint,
  Verification,
  VerificationStatusType,
  FieldActor,
  IncidentOutcome,
  OperationalOutcomeType,
  StructuredFieldObservations,
  Observation,
  PhotoEvidence,
  SampleEvidence,
  VerificationLocation,
} from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { getEventBus } from '../../events/index.js';
import { getFhirAdapter } from '../../adapters/fhir/index.js';
import { logger } from '../../logging/logger.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';
import { NotFoundError, ValidationError } from '../../api/middleware/error-handler.js';
import { incidentClassifier } from '../../domain/response/incident-classifier.js';
import { severityCalculator } from '../../domain/response/severity-calculator.js';
import { recommendationEngine } from '../../domain/response/recommendation-engine.js';
import { SEED_CATALOGUE_MEASURES } from '../../domain/catalogue/seed-measures.js';
import { FhirMapper } from '../../adapters/fhir/mapper.js';
import { GeofenceValidator } from '../../domain/response/geofence.js';
import { OutcomeEngine } from '../../domain/response/outcome-engine.js';
import { evidenceFusionService } from '../evidence/evidence-fusion-service.js';
import { createProvenanceRecord } from '../../domain/provenance.js';

export interface ApproveOptions {
  actor?: string;
  notes?: string;
  assignedTo?: string;
}

export interface RejectOptions {
  actor?: string;
  reason: string;
}

export interface SubmitVerificationInput {
  taskId: string;
  inspector: FieldActor | { name: string; organization?: string; role?: string; contact?: string; actorId?: string };
  location: GeoJsonPoint & { accuracyMeters?: number; latitude?: number; longitude?: number };
  status: VerificationStatusType;
  observations: StructuredFieldObservations;
  notes: string;
  photos?: PhotoEvidence[];
  samples?: SampleEvidence[];
  clientSubmissionId?: string;
  actor?: string;
}

export interface RequestMoreEvidenceOptions {
  actor?: string;
  notes?: string;
  missingData?: string[];
  assignedTo?: string;
}

export class OperationalResponseService {
  private isSubscribed = false;

  /**
   * Initializes event subscription to EvidenceUpdated on the event bus.
   */
  public initialize(): void {
    if (this.isSubscribed) return;

    const eventBus = getEventBus();
    eventBus.subscribe<EvidenceUpdatedEvent>('EvidenceUpdated', async (event) => {
      try {
        await this.handleEvidenceUpdated(event.payload.assessment, event.payload.streamReachId);
      } catch (err: any) {
        logger.error('[OperationalResponseService] Error handling EvidenceUpdated event:', {
          error: err.message,
          assessmentId: event.payload.assessment?.id,
          streamReachId: event.payload.streamReachId,
        });
      }
    });

    this.isSubscribed = true;
    logger.info('[OperationalResponseService] Subscribed to EvidenceUpdated event.');
  }

  /**
   * Processes an updated evidence assessment into an operational response package.
   */
  public async handleEvidenceUpdated(
    assessment: EvidenceAssessment,
    streamReachId: string
  ): Promise<Recommendation[]> {
    logger.info('[OperationalResponseService] Processing EvidenceUpdated event', {
      assessmentId: assessment.id,
      streamReachId,
      score: assessment.score,
      confidenceBand: assessment.confidenceBand,
    });

    const repos = getRepositories();
    const reach = await repos.streamReaches.findById(streamReachId);
    if (!reach) {
      logger.warn('[OperationalResponseService] Stream reach not found for assessment:', { streamReachId });
      return [];
    }

    // 1. Locate or create correlated Incident
    let incident = await this.resolveOrCreateIncident(reach, assessment);

    // 2. Classify Incident
    const classification = incidentClassifier.classify(assessment);

    // 3. Compute Operational Severity
    const severity = severityCalculator.calculate({
      assessment,
      classification,
      reach,
    });

    // Update Incident with classification, confidence, and severity
    const updatedStatus =
      assessment.confidenceBand === 'PRIORITIZE'
        ? 'ACTION_RECOMMENDED'
        : assessment.confidenceBand === 'INVESTIGATE'
        ? 'ASSESSED'
        : assessment.confidenceBand === 'VERIFY'
        ? 'FIELD_VERIFICATION_PENDING'
        : 'DETECTED';

    await repos.incidents.update(incident.id, {
      hazardType: this.mapClassificationToHazard(classification.type),
      evidenceConfidence: assessment.score,
      severity: severity.level === 'MODERATE' ? 'MEDIUM' : severity.level,
      status: updatedStatus,
    });

    // 4. Fetch Catalogue Measures
    let catalogue = await repos.catalogue.findAll();
    if (!catalogue || catalogue.length === 0) {
      catalogue = SEED_CATALOGUE_MEASURES;
    }

    // 5. Generate deterministic recommendations through the engine
    const candidates = recommendationEngine.evaluate({
      incidentId: incident.id,
      assessment,
      classification,
      severity,
      reach,
      catalogue,
    });

    const savedRecommendations: Recommendation[] = [];
    const eventBus = getEventBus();

    // 6. Persist with Idempotency Protection (PRD Section 26)
    for (const rec of candidates) {
      const existing = await repos.recommendations.findByIdempotencyKey(rec.idempotencyKey);
      if (existing) {
        logger.debug('[OperationalResponseService] Idempotency match: Recommendation already exists', {
          idempotencyKey: rec.idempotencyKey,
          existingId: existing.id,
        });
        savedRecommendations.push(existing);
        continue;
      }

      const saved = await repos.recommendations.create(rec);
      savedRecommendations.push(saved);

      // Record in audit log
      await repos.auditLogs.log({
        id: generateId(),
        recommendationId: saved.id,
        incidentId: incident.id,
        eventType: 'RECOMMENDATION_GENERATED',
        timestamp: nowUtc(),
        actor: 'system:recommendation_engine',
        newStatus: saved.status,
        reason: saved.rationale,
        metadata: {
          measureId: saved.measureId,
          suitabilityScore: saved.suitabilityScore,
          rank: saved.rank,
        },
      });
    }

    // 7. Publish RecommendationGeneratedEvent
    if (savedRecommendations.length > 0) {
      const genEvent: RecommendationGeneratedEvent = {
        eventId: generateId(),
        eventType: 'RecommendationGenerated',
        timestamp: nowUtc(),
        actor: 'service:operational_response',
        payload: {
          incidentId: incident.id,
          assessmentId: assessment.id,
          streamReachId,
          recommendations: savedRecommendations,
        },
      };
      await eventBus.publish(genEvent);
    }

    return savedRecommendations;
  }

  /**
   * Human Approval Workflow: Approves recommendation, creates operational task, and publishes FHIR Task.
   */
  public async approveRecommendation(
    recommendationId: string,
    optionsOrActor?: ApproveOptions | string,
    role?: string,
    notesArg?: string
  ): Promise<{ recommendation: Recommendation; task: Task; fhirTask?: any }> {
    const repos = getRepositories();
    const rec = await repos.recommendations.findById(recommendationId);
    if (!rec) {
      throw new NotFoundError(`Recommendation with id '${recommendationId}' not found.`);
    }

    let options: ApproveOptions;
    if (typeof optionsOrActor === 'string') {
      options = {
        actor: optionsOrActor,
        assignedTo: role,
        notes: notesArg,
      };
    } else {
      options = optionsOrActor || {};
    }

    const actor = options.actor || 'Human Operator';
    const notes = options.notes || 'Approved for operational execution';

    // If already approved with generated task, return existing (Idempotent)
    if (rec.status === 'APPROVED' && rec.generatedTaskId) {
      const existingTask = await repos.tasks.findById(rec.generatedTaskId);
      if (existingTask) {
        return {
          recommendation: rec,
          task: existingTask,
          fhirTask: FhirMapper.toFhirTask(existingTask),
        };
      }
    }

    const incident = await repos.incidents.findById(rec.incidentId);
    let location: GeoJsonPoint = { type: 'Point', coordinates: [22.7535, 39.1812] };
    if (incident) {
      const reach = await repos.streamReaches.findById(incident.streamReachId);
      if (reach && reach.geometry.type === 'LineString' && reach.geometry.coordinates.length > 0) {
        const mid = reach.geometry.coordinates[Math.floor(reach.geometry.coordinates.length / 2)];
        location = { type: 'Point', coordinates: [mid[0], mid[1]] };
      }
    }

    // 1. Create Operational Task
    const now = nowUtc();
    const task: Task = {
      id: generateId(),
      incidentId: rec.incidentId,
      recommendationId: rec.id,
      assessmentId: rec.assessmentId,
      taskType: rec.actionType,
      title: rec.title,
      instructions: `${rec.title}: ${rec.description}. Operator instructions: ${notes}`,
      assignedRole: rec.responsibleRole,
      assignedTo: options.assignedTo || `${rec.responsibleRole} On-Duty Team`,
      location,
      priority: rec.priority,
      status: 'REQUESTED',
      requiredEvidence: rec.requiredVerification,
      provenance: {
        id: generateId(),
        entityId: rec.id,
        entityType: 'TASK',
        source: 'RECOMMENDATION_DISPATCH',
        sourceIdentifier: rec.sourceRule || rec.id,
        acquisitionTimestamp: now,
        ingestionTimestamp: now,
        processingTimestamp: now,
        processingMethod: 'HUMAN_SUPERVISED_TASK_CREATION',
        qualityStatus: 'VALIDATED',
      },
      createdAt: now,
    };

    const savedTask = await repos.tasks.create(task);

    // 2. Publish to FHIR Adapter
    const fhir = getFhirAdapter();
    try {
      const fhirId = await fhir.publishTask(savedTask);
      savedTask.fhirTaskId = fhirId;
      savedTask.fhirTaskIdentifier = `https://aquasentinel.org/tasks/${savedTask.id}`;
      await repos.tasks.update(savedTask.id, {
        fhirTaskId: fhirId,
        fhirTaskIdentifier: savedTask.fhirTaskIdentifier,
      });
      logger.info(`[OperationalResponseService] Synchronized Task ${savedTask.id} to FHIR (FHIR ID: ${fhirId})`);
    } catch (err: any) {
      logger.warn(`[OperationalResponseService] Could not publish Task to FHIR adapter: ${err.message}`);
    }

    // 3. Update Recommendation
    const updatedRec = await repos.recommendations.update(rec.id, {
      status: 'APPROVED',
      reviewedAt: now,
      reviewedBy: actor,
      reviewNotes: notes,
      generatedTaskId: savedTask.id,
    });

    // 4. Update Incident status
    if (incident) {
      await repos.incidents.update(incident.id, {
        status: 'ACTION_APPROVED',
      });
    }

    // 5. Audit Logging
    await repos.auditLogs.log({
      id: generateId(),
      taskId: savedTask.id,
      recommendationId: rec.id,
      incidentId: rec.incidentId,
      eventType: 'RECOMMENDATION_APPROVED',
      timestamp: now,
      actor,
      previousStatus: rec.status,
      newStatus: 'APPROVED',
      reason: notes,
      metadata: { taskId: savedTask.id, fhirTaskId: savedTask.fhirTaskId },
    });

    await repos.auditLogs.log({
      id: generateId(),
      taskId: savedTask.id,
      recommendationId: rec.id,
      incidentId: rec.incidentId,
      eventType: 'TASK_CREATED',
      timestamp: now,
      actor,
      newStatus: 'REQUESTED',
      reason: 'Created via recommendation approval',
    });

    // 6. Domain Events
    const eventBus = getEventBus();
    const revEvent: RecommendationReviewedEvent = {
      eventId: generateId(),
      eventType: 'RecommendationReviewed',
      timestamp: now,
      actor,
      payload: {
        recommendationId: rec.id,
        incidentId: rec.incidentId,
        action: 'APPROVED',
        actor,
        notes,
        generatedTaskId: savedTask.id,
      },
    };
    await eventBus.publish(revEvent);

    const taskEvent: TaskCreatedEvent = {
      eventId: generateId(),
      eventType: 'TaskCreated',
      timestamp: now,
      actor,
      payload: { task: savedTask },
    };
    await eventBus.publish(taskEvent);

    const fhirTask = FhirMapper.toFhirTask(savedTask);
    return { recommendation: updatedRec!, task: savedTask, fhirTask };
  }

  /**
   * Human Rejection Workflow: Rejects recommendation with mandatory explanation.
   */
  public async rejectRecommendation(
    recommendationId: string,
    options: RejectOptions
  ): Promise<Recommendation> {
    const repos = getRepositories();
    const rec = await repos.recommendations.findById(recommendationId);
    if (!rec) {
      throw new NotFoundError(`Recommendation with id '${recommendationId}' not found.`);
    }

    if (!options.reason || options.reason.trim().length === 0) {
      throw new ValidationError('A detailed reason is required to reject an operational recommendation.');
    }

    const actor = options.actor || 'Human Operator';
    const now = nowUtc();

    const updated = await repos.recommendations.update(rec.id, {
      status: 'REJECTED',
      rejectionReason: options.reason,
      reviewedBy: actor,
      reviewedAt: now,
    });

    await repos.auditLogs.log({
      id: generateId(),
      recommendationId: rec.id,
      incidentId: rec.incidentId,
      eventType: 'RECOMMENDATION_REJECTED',
      timestamp: now,
      actor,
      previousStatus: rec.status,
      newStatus: 'REJECTED',
      reason: options.reason,
    });

    const eventBus = getEventBus();
    const event: RecommendationReviewedEvent = {
      eventId: generateId(),
      eventType: 'RecommendationReviewed',
      timestamp: now,
      actor,
      payload: {
        recommendationId: rec.id,
        incidentId: rec.incidentId,
        action: 'REJECTED',
        actor,
        notes: options.reason,
      },
    };
    await eventBus.publish(event);

    return updated!;
  }

  /**
   * Human Request More Evidence Workflow: Creates targeted verification task without executing physical intervention.
   */
  public async requestMoreEvidence(
    recommendationId: string,
    options: RequestMoreEvidenceOptions = {}
  ): Promise<{ recommendation: Recommendation; task: Task }> {
    const repos = getRepositories();
    const rec = await repos.recommendations.findById(recommendationId);
    if (!rec) {
      throw new NotFoundError(`Recommendation with id '${recommendationId}' not found.`);
    }

    const actor = options.actor || 'Human Operator';
    const notes = options.notes || 'Additional ground verification requested before action decision';
    const now = nowUtc();

    // Create targeted verification task
    const task: Task = {
      id: generateId(),
      incidentId: rec.incidentId,
      recommendationId: rec.id,
      assessmentId: rec.assessmentId,
      taskType: 'FIELD_VERIFY',
      title: `Field Verification: Additional Evidence for ${rec.title}`,
      instructions: `Conduct targeted verification. Specific missing evidence required: ${(options.missingData || rec.requiredVerification).join(', ')}. Review notes: ${notes}`,
      assignedRole: 'ENVIRONMENTAL_INSPECTOR',
      assignedTo: options.assignedTo || 'Rapid Verification Inspector',
      location: { type: 'Point', coordinates: [22.7535, 39.1812] },
      priority: 'HIGH',
      status: 'REQUESTED',
      requiredEvidence: options.missingData || rec.requiredVerification,
      createdAt: now,
    };

    const savedTask = await repos.tasks.create(task);

    // Sync with FHIR
    const fhir = getFhirAdapter();
    try {
      const fhirId = await fhir.publishTask(savedTask);
      savedTask.fhirTaskId = fhirId;
      await repos.tasks.update(savedTask.id, { fhirTaskId: fhirId });
    } catch {}

    const updatedRec = await repos.recommendations.update(rec.id, {
      status: 'PENDING_REVIEW',
      reviewNotes: `More evidence requested: ${notes}`,
      reviewedBy: actor,
      reviewedAt: now,
      generatedTaskId: savedTask.id,
    });

    await repos.auditLogs.log({
      id: generateId(),
      taskId: savedTask.id,
      recommendationId: rec.id,
      incidentId: rec.incidentId,
      eventType: 'RECOMMENDATION_MORE_EVIDENCE_REQUESTED',
      timestamp: now,
      actor,
      previousStatus: rec.status,
      newStatus: 'PENDING_REVIEW',
      reason: notes,
      metadata: { missingData: options.missingData, taskId: savedTask.id },
    });

    const eventBus = getEventBus();
    await eventBus.publish({
      eventId: generateId(),
      eventType: 'RecommendationReviewed',
      timestamp: now,
      actor,
      payload: {
        recommendationId: rec.id,
        incidentId: rec.incidentId,
        action: 'MORE_EVIDENCE_REQUESTED',
        actor,
        notes,
        generatedTaskId: savedTask.id,
      },
    });

    return { recommendation: updatedRec!, task: savedTask };
  }

  /**
   * Operational Task Lifecycle Management: State transitions with full audit trail and FHIR sync.
   * PRD Sections 4, 5
   */
  public async transitionTaskStatus(
    taskId: string,
    newStatus: Task['status'],
    actor = 'Human Operator',
    notes?: string
  ): Promise<Task> {
    const repos = getRepositories();
    const task = await repos.tasks.findById(taskId);
    if (!task) {
      throw new NotFoundError(`Task with id '${taskId}' not found.`);
    }

    const previousStatus = task.status;
    if (previousStatus === newStatus) {
      return task;
    }

    // Explicit state transition verification (PRD Section 5)
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['APPROVED', 'ASSIGNED', 'CANCELLED'],
      APPROVED: ['ASSIGNED', 'ACCEPTED', 'CANCELLED'],
      ASSIGNED: ['ACCEPTED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS'],
      ACCEPTED: ['IN_PROGRESS', 'CANCELLED', 'COMPLETED'],
      IN_PROGRESS: ['AWAITING_VERIFICATION', 'COMPLETED', 'CANCELLED'],
      AWAITING_VERIFICATION: ['COMPLETED', 'VERIFIED', 'REJECTED', 'CANCELLED'],
      COMPLETED: ['VERIFIED', 'REJECTED', 'AWAITING_VERIFICATION'],
      VERIFIED: ['REJECTED'],
      REJECTED: ['ASSIGNED', 'DRAFT', 'CANCELLED'],
      CANCELLED: [],
      // Compatibility with Phase 4 legacy status:
      REQUESTED: ['ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'VERIFIED'],
    };

    const allowed = validTransitions[previousStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new ValidationError(
        `Invalid task state transition from '${previousStatus}' to '${newStatus}'. Allowed: [${allowed.join(', ')}]`
      );
    }

    const now = nowUtc();
    const updates: Partial<Task> = { status: newStatus };

    if (newStatus === 'ACCEPTED') {
      updates.acceptedAt = now;
    } else if (newStatus === 'IN_PROGRESS') {
      updates.inProgressAt = now;
      if (!task.startedAt) updates.startedAt = now;
    } else if (newStatus === 'COMPLETED') {
      updates.completedAt = now;
      if (notes) updates.notes = notes;
    } else if (newStatus === 'VERIFIED') {
      updates.verifiedAt = now;
      if (notes) updates.notes = notes;
    }

    const updated = await repos.tasks.update(taskId, updates);

    // Sync with FHIR Adapter
    const fhir = getFhirAdapter();
    try {
      await fhir.updateTask(updated!);
    } catch (err: any) {
      logger.warn(`[OperationalResponseService] Could not update Task in FHIR: ${err.message}`);
    }

    // Audit Log
    await repos.auditLogs.log({
      id: generateId(),
      taskId: task.id,
      recommendationId: task.recommendationId,
      incidentId: task.incidentId,
      eventType: 'TASK_STATUS_UPDATED',
      timestamp: now,
      actor,
      previousStatus,
      newStatus,
      reason: notes || `Task transitioned to ${newStatus}`,
    });

    // Domain Event
    const eventBus = getEventBus();
    const event: TaskStatusUpdatedEvent = {
      eventId: generateId(),
      eventType: 'TaskStatusUpdated',
      timestamp: now,
      actor,
      payload: {
        taskId: task.id,
        incidentId: task.incidentId,
        previousStatus,
        newStatus,
        actor,
        reason: notes,
        task: updated!,
      },
    };
    await eventBus.publish(event);

    return updated!;
  }

  /**
   * Assigns an operational task to a field actor or municipal response team.
   * PRD Sections 6, 7
   */
  public async assignTask(
    taskId: string,
    actorIdOrName: string,
    assignedBy = 'Human Operator',
    notes?: string
  ): Promise<Task> {
    const repos = getRepositories();
    const task = await repos.tasks.findById(taskId);
    if (!task) {
      throw new NotFoundError(`Task with id '${taskId}' not found.`);
    }

    const now = nowUtc();
    const actorRecord = await repos.fieldActors.findById(actorIdOrName);
    const assignedTo = actorRecord ? actorRecord.name : actorIdOrName;
    const assignedOrganization = actorRecord ? actorRecord.organization : 'Municipal Response Unit';
    const assignedActorId = actorRecord ? actorRecord.actorId : undefined;

    const previousStatus = task.status;
    const updates: Partial<Task> = {
      assignedTo,
      assignedOrganization,
      assignedActorId,
      status: 'ASSIGNED',
    };

    const updated = await repos.tasks.update(taskId, updates);

    await repos.auditLogs.log({
      id: generateId(),
      taskId: task.id,
      incidentId: task.incidentId,
      eventType: 'TASK_ASSIGNED',
      timestamp: now,
      actor: assignedBy,
      previousStatus,
      newStatus: 'ASSIGNED',
      reason: notes || `Task assigned to ${assignedTo} (${assignedOrganization})`,
      metadata: { assignedTo, assignedOrganization, assignedActorId },
    });

    const eventBus = getEventBus();
    await eventBus.publish<TaskStatusUpdatedEvent>({
      eventId: generateId(),
      eventType: 'TaskStatusUpdated',
      timestamp: now,
      actor: assignedBy,
      payload: {
        taskId: task.id,
        incidentId: task.incidentId,
        previousStatus,
        newStatus: 'ASSIGNED',
        actor: assignedBy,
        reason: notes,
        task: updated!,
      },
    });

    return updated!;
  }

  /**
   * Submits a structured field verification, validates geofence, ingests ground observation,
   * triggers evidence reassessment, evaluates proposed outcome, and closes the response loop.
   * PRD Sections 8-26, 38
   */
  public async submitVerification(input: SubmitVerificationInput): Promise<{
    verification: Verification;
    assessment: EvidenceAssessment;
    outcome: IncidentOutcome;
    task: Task;
    duplicate?: boolean;
  }> {
    const repos = getRepositories();

    // 1. Duplicate / Idempotency Check (PRD Section 24)
    if (input.clientSubmissionId) {
      const existing = await repos.verifications.findByClientSubmissionId(input.clientSubmissionId);
      if (existing) {
        logger.info(`[OperationalResponseService] Duplicate verification submission ignored for clientSubmissionId: ${input.clientSubmissionId}`);
        const incident = await repos.incidents.findById(existing.incidentId);
        const latestOutcome = (await repos.incidentOutcomes.findLatestByIncidentId(existing.incidentId))!;
        const latestAssessment = (await repos.evidenceAssessments.findLatestByStreamReach(incident?.streamReachId || ''))!;
        const task = (await repos.tasks.findById(existing.taskId))!;
        return {
          verification: existing,
          assessment: latestAssessment,
          outcome: latestOutcome,
          task,
          duplicate: true,
        };
      }
    }

    const task = await repos.tasks.findById(input.taskId);
    if (!task) {
      throw new NotFoundError(`Task with id '${input.taskId}' not found.`);
    }

    const incident = await repos.incidents.findById(task.incidentId);
    if (!incident) {
      throw new NotFoundError(`Incident with id '${task.incidentId}' not found for task.`);
    }

    const now = nowUtc();

    // 2. Geofence & Location Validation (PRD Sections 19, 20, 21)
    const geofence = GeofenceValidator.validate(task.location, input.location);
    const validatedLocation: VerificationLocation = {
      type: 'Point',
      coordinates: input.location.coordinates,
      latitude: input.location.latitude ?? input.location.coordinates[1],
      longitude: input.location.longitude ?? input.location.coordinates[0],
      accuracyMeters: input.location.accuracyMeters ?? 10,
      timestamp: now,
      validationStatus: geofence.status,
      distanceMeters: geofence.distanceMeters,
      isWithinGeofence: geofence.isWithinGeofence,
    };

    // 3. Build & Persist First-Class Verification Entity (PRD Section 9, 10, 11)
    const verificationId = generateId();
    const verification: Verification = {
      id: verificationId,
      verificationId,
      taskId: task.id,
      incidentId: incident.id,
      observer: (input.inspector as any)?.name || 'Field Inspector',
      inspector: input.inspector,
      timestamp: now,
      location: validatedLocation,
      status: input.status,
      result: input.status === 'NOT_CONFIRMED' ? 'NOT_CONFIRMED' : input.status === 'UNCERTAIN' ? 'UNCERTAIN' : 'CONFIRMED',
      observations: input.observations,
      notes: input.notes,
      evidence: {
        photos: input.photos || [],
        samples: input.samples || [],
      },
      photos: (input.photos || []).map((p) => p.filename || p.evidenceId),
      sampleCollected: (input.samples || []).length > 0,
      assessment: `Field inspection result: ${input.status}. Water appearance: ${input.observations.waterColour || 'unspecified'}. Odour: ${input.observations.odour || 'none'}.`,
      submittedAt: now,
      syncStatus: 'SYNCED',
      conflictStatus: 'NONE',
      clientSubmissionId: input.clientSubmissionId,
      createdAt: now,
    };

    const savedVerification = await repos.verifications.create(verification);
    await repos.incidents.addVerification(savedVerification);

    // 4. Ingest Ground Observation into Evidence Repository (PRD Section 25)
    const obsId = generateId();
    const primaryIndicator = input.observations.waterColour
      ? 'WATER_COLOR'
      : input.observations.odour
      ? 'ODOR'
      : input.observations.foam
      ? 'FOAM'
      : 'FIELD_GROUND_TRUTH';

    const obsValue =
      input.status === 'NOT_CONFIRMED'
        ? 'NOT_CONFIRMED'
        : input.status === 'UNCERTAIN'
        ? 'UNCERTAIN'
        : input.observations.waterColour || 'CONFIRMED';

    const fieldObservation: Observation = {
      id: obsId,
      source: 'FIELD_INSPECTION',
      timestamp: now,
      location: task.location,
      streamReachId: incident.streamReachId,
      indicator: primaryIndicator,
      value: obsValue,
      unit: 'category',
      quality: 'VALIDATED',
      provenance: createProvenanceRecord({
        entityId: obsId,
        entityType: 'OBSERVATION',
        source: 'FIELD_INSPECTION',
        sourceIdentifier: savedVerification.id,
        acquisitionTimestamp: now,
        processingMethod: 'FIELD_INSPECTION_VERIFICATION_V1',
        qualityStatus: 'VALIDATED',
      }),
      metadata: {
        verificationId: savedVerification.id,
        taskId: task.id,
        status: input.status,
        observations: input.observations,
        photoCount: (input.photos || []).length,
        sampleCount: (input.samples || []).length,
      },
      createdAt: now,
    };
    await repos.observations.create(fieldObservation);

    // 5. Trigger Evidence Reassessment (PRD Section 26, 27)
    const reassessment = await evidenceFusionService.reassess(incident.streamReachId, incident.id);
    const updatedAssessment = reassessment.assessment;

    // 6. Propose Operational Outcome via OutcomeEngine (PRD Sections 29, 30)
    const proposedOutcome = OutcomeEngine.evaluate({
      incident,
      verification: savedVerification,
      assessment: updatedAssessment,
    });
    const savedOutcome = await repos.incidentOutcomes.create(proposedOutcome);

    // 7. Update Task Status to COMPLETED (PRD Section 5)
    const updatedTask = await repos.tasks.update(task.id, {
      status: 'COMPLETED',
      completedAt: now,
      verificationStatus: input.status === 'NOT_CONFIRMED' ? 'NOT_CONFIRMED' : input.status === 'UNCERTAIN' ? 'UNCERTAIN' : 'CONFIRMED',
      notes: `${task.notes ? task.notes + '\n' : ''}Field verification: ${input.status}. ${input.notes}`,
    });

    // 8. Log Audit Trail
    const inspectorName = (input.inspector as any)?.name || 'Field Inspector';
    await repos.auditLogs.log({
      id: generateId(),
      taskId: task.id,
      incidentId: incident.id,
      eventType: 'VERIFICATION_COMPLETED',
      timestamp: now,
      actor: inspectorName,
      previousStatus: task.status,
      newStatus: 'COMPLETED',
      reason: `Verification completed with result ${input.status}. Proposed outcome: ${proposedOutcome.proposedOutcome}`,
      metadata: {
        verificationId: savedVerification.id,
        geofenceStatus: geofence.status,
        distanceMeters: geofence.distanceMeters,
        proposedOutcome: proposedOutcome.proposedOutcome,
      },
    });

    // 9. Emit Domain Events (PRD Section 38)
    const eventBus = getEventBus();
    await eventBus.publish<VerificationSubmittedEvent>({
      eventId: generateId(),
      eventType: 'VerificationSubmitted',
      timestamp: now,
      actor: inspectorName,
      payload: { verification: savedVerification },
    });

    await eventBus.publish<VerificationCompletedEvent>({
      eventId: generateId(),
      eventType: 'VerificationCompleted',
      timestamp: now,
      actor: inspectorName,
      payload: {
        verification: savedVerification,
        task: updatedTask!,
        incidentId: incident.id,
        reassessmentTriggered: true,
      },
    });

    return {
      verification: savedVerification,
      assessment: updatedAssessment,
      outcome: savedOutcome,
      task: updatedTask!,
    };
  }

  /**
   * Human operator confirms, adjusts, or finalizes the incident outcome.
   * PRD Sections 31, 32, 33, 34, 35, 37
   */
  public async confirmIncidentOutcome(
    incidentId: string,
    outcome: OperationalOutcomeType,
    confirmedBy = 'Human Supervisor',
    notes?: string
  ): Promise<{ incident: Incident; outcome: IncidentOutcome }> {
    const repos = getRepositories();
    const incident = await repos.incidents.findById(incidentId);
    if (!incident) {
      throw new NotFoundError(`Incident with id '${incidentId}' not found.`);
    }

    const now = nowUtc();
    const latestOutcome = await repos.incidentOutcomes.findLatestByIncidentId(incidentId);
    let outcomeRecord: IncidentOutcome;

    if (latestOutcome) {
      outcomeRecord = (await repos.incidentOutcomes.update(latestOutcome.id, {
        confirmedOutcome: outcome,
        confirmedAt: now,
        confirmedBy,
        notes: notes || `Outcome confirmed as ${outcome}`,
      }))!;
    } else {
      outcomeRecord = await repos.incidentOutcomes.create({
        id: generateId(),
        incidentId,
        proposedOutcome: outcome,
        confirmedOutcome: outcome,
        reason: notes || `Direct human confirmation of outcome ${outcome}`,
        supportingEvidence: [],
        confidence: incident.evidenceConfidence,
        determinedAt: now,
        determinedBy: confirmedBy,
        confirmedAt: now,
        confirmedBy,
        ruleVersion: OutcomeEngine.RULE_VERSION,
        notes,
      });
    }

    // Update Incident State based on outcome
    const incidentUpdates: Partial<Incident> = {
      verificationStatus: outcome === 'NOT_CONFIRMED' ? 'NOT_CONFIRMED' : outcome === 'UNCERTAIN' ? 'UNCERTAIN' : 'CONFIRMED',
      updatedAt: now,
    };

    if (outcome === 'RESOLVED') {
      incidentUpdates.status = 'RESOLVED';
      incidentUpdates.resolution = notes || 'Incident resolved following verified field intervention.';
    } else if (outcome === 'ESCALATE') {
      incidentUpdates.severity = 'CRITICAL';
      incidentUpdates.status = 'ACTION_IN_PROGRESS';
    } else if (outcome === 'CONFIRMED') {
      incidentUpdates.status = 'ACTION_IN_PROGRESS';
    }

    const updatedIncident = (await repos.incidents.update(incidentId, incidentUpdates))!;

    // Log Audit Entry
    await repos.auditLogs.log({
      id: generateId(),
      incidentId,
      eventType: 'OUTCOME_CONFIRMED',
      timestamp: now,
      actor: confirmedBy,
      previousStatus: incident.status,
      newStatus: updatedIncident.status,
      reason: notes || `Outcome confirmed as ${outcome}`,
      metadata: { outcome, verificationStatus: updatedIncident.verificationStatus },
    });

    // Emit Domain Events
    const eventBus = getEventBus();
    if (outcome === 'CONFIRMED') {
      await eventBus.publish<IncidentConfirmedEvent>({
        eventId: generateId(),
        eventType: 'IncidentConfirmed',
        timestamp: now,
        actor: confirmedBy,
        payload: {
          incidentId,
          verificationId: outcomeRecord.verificationId || '',
          confidence: updatedIncident.evidenceConfidence,
          reason: notes || 'Incident confirmed by supervisor following ground truth verification.',
          actor: confirmedBy,
        },
      });
    } else if (outcome === 'NOT_CONFIRMED') {
      await eventBus.publish<IncidentNotConfirmedEvent>({
        eventId: generateId(),
        eventType: 'IncidentNotConfirmed',
        timestamp: now,
        actor: confirmedBy,
        payload: {
          incidentId,
          verificationId: outcomeRecord.verificationId || '',
          reason: notes || 'Field inspection refuted anomaly proxy. Classified as false positive.',
          actor: confirmedBy,
        },
      });
    } else if (outcome === 'RESOLVED') {
      await eventBus.publish<IncidentResolvedEvent>({
        eventId: generateId(),
        eventType: 'IncidentResolved',
        timestamp: now,
        actor: confirmedBy,
        payload: {
          incidentId,
          resolution: notes || 'Incident resolved following verified field response.',
          actor: confirmedBy,
        },
      });
    } else if (outcome === 'ESCALATE') {
      await eventBus.publish<IncidentEscalatedEvent>({
        eventId: generateId(),
        eventType: 'IncidentEscalated',
        timestamp: now,
        actor: confirmedBy,
        payload: {
          incidentId,
          previousSeverity: incident.severity,
          newSeverity: 'CRITICAL',
          reason: notes || 'Escalated by supervisor due to critical field corroboration.',
          actor: confirmedBy,
        },
      });
    } else if (outcome === 'ADDITIONAL_VERIFICATION_REQUIRED') {
      await eventBus.publish<AdditionalVerificationRequiredEvent>({
        eventId: generateId(),
        eventType: 'AdditionalVerificationRequired',
        timestamp: now,
        actor: confirmedBy,
        payload: {
          incidentId,
          verificationId: outcomeRecord.verificationId,
          reason: notes || 'Inconclusive field evidence requires secondary inspection.',
          actor: confirmedBy,
        },
      });
    }

    return { incident: updatedIncident, outcome: outcomeRecord };
  }

  /**
   * Generates a secondary or follow-up operational task linked to an incident.
   * PRD Section 36
   */
  public async createFollowUpTask(
    incidentId: string,
    options: {
      title?: string;
      instructions: string;
      assignedTo?: string;
      assignedRole?: string;
      priority?: Task['priority'];
      requiredEvidence?: string[];
      actor?: string;
    }
  ): Promise<Task> {
    const repos = getRepositories();
    const incident = await repos.incidents.findById(incidentId);
    if (!incident) {
      throw new NotFoundError(`Incident with id '${incidentId}' not found.`);
    }

    const reach = await repos.streamReaches.findById(incident.streamReachId);
    const now = nowUtc();

    const pointLocation: GeoJsonPoint = reach?.geometry?.type === 'Point'
      ? (reach.geometry as GeoJsonPoint)
      : reach?.geometry?.type === 'LineString'
      ? { type: 'Point', coordinates: (reach.geometry as any).coordinates[0] as [number, number] }
      : { type: 'Point', coordinates: [22.944, 39.362] };

    const task: Task = {
      id: generateId(),
      incidentId,
      taskType: 'FIELD_INSPECTION',
      title: options.title || 'Follow-up secondary sampling & reach investigation',
      assignedRole: options.assignedRole || 'ENVIRONMENTAL_SPECIALIST',
      assignedTo: options.assignedTo || 'Inspector Alex Rivera',
      location: pointLocation,
      priority: options.priority || 'HIGH',
      instructions: options.instructions,
      requiredEvidence: options.requiredEvidence || ['Grab sample ID', 'Field photo', 'Multi-parameter probe telemetry'],
      status: 'APPROVED',
      verificationStatus: 'UNVERIFIED',
      createdAt: now,
    };

    const saved = await repos.tasks.create(task);

    const eventBus = getEventBus();
    await eventBus.publish<TaskCreatedEvent>({
      eventId: generateId(),
      eventType: 'TaskCreated',
      timestamp: now,
      actor: options.actor || 'Human Operator',
      payload: { task: saved },
    });

    return saved;
  }

  private async resolveOrCreateIncident(
    reach: any,
    assessment: EvidenceAssessment
  ): Promise<Incident> {
    const repos = getRepositories();
    const existingIncidents = await repos.incidents.findAll();
    const active = existingIncidents.find(
      (inc) =>
        inc.streamReachId === reach.id &&
        inc.status !== 'RESOLVED' &&
        inc.status !== 'DISMISSED'
    );

    if (active) {
      return active;
    }

    const now = nowUtc();
    const newIncident: Incident = {
      id: generateId(),
      streamReachId: reach.id,
      createdAt: now,
      updatedAt: now,
      status: 'DETECTED',
      hazardType: 'UNKNOWN',
      evidenceConfidence: assessment.score,
      severity: 'MEDIUM',
      verificationStatus: 'UNVERIFIED',
    };

    return repos.incidents.create(newIncident);
  }

  private mapClassificationToHazard(type: string): Incident['hazardType'] {
    if (type === 'POSSIBLE_CYANOBLOOM') return 'ALGAL_BLOOM';
    if (type === 'POSSIBLE_EUTROPHICATION') return 'EUTROPHICATION';
    if (type === 'POSSIBLE_SEWAGE_CONTAMINATION') return 'SEWAGE_OVERFLOW';
    if (type === 'POSSIBLE_INDUSTRIAL_DISCHARGE') return 'CHEMICAL_SPILL';
    return 'UNKNOWN';
  }
}

// Global Singleton
let activeOperationalResponseService: OperationalResponseService | null = null;

export function getOperationalResponseService(): OperationalResponseService {
  if (!activeOperationalResponseService) {
    activeOperationalResponseService = new OperationalResponseService();
    activeOperationalResponseService.initialize();
  }
  return activeOperationalResponseService;
}
