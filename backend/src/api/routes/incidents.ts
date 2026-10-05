import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Incident, EvidenceItem, Recommendation, Verification, OperationalOutcomeType } from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { getOperationalResponseService } from '../../services/response/operational-response-service.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';
import { createProvenanceRecord } from '../../domain/provenance.js';
import { getEventBus } from '../../events/index.js';

export const incidentsRouter = Router();

incidentsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const incidents = await repos.incidents.findAll();
    res.json({
      success: true,
      data: incidents,
      meta: {
        total: incidents.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

incidentsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const incident = await repos.incidents.findById(req.params.id);
    if (!incident) {
      throw new NotFoundError(`Incident with id '${req.params.id}' not found`);
    }
    res.json({
      success: true,
      data: incident,
    });
  } catch (err) {
    next(err);
  }
});

incidentsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const createSchema = z.object({
      streamReachId: z.string().min(1),
      hazardType: z.enum(['ALGAL_BLOOM', 'CHEMICAL_SPILL', 'SEWAGE_OVERFLOW', 'EUTROPHICATION', 'UNKNOWN']),
      evidenceConfidence: z.number().min(0).max(100).default(50),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
      status: z.enum([
        'DETECTED',
        'CORROBORATED',
        'ASSESSED',
        'ACTION_RECOMMENDED',
        'PENDING_APPROVAL',
        'ACTION_APPROVED',
        'ACTION_IN_PROGRESS',
        'FIELD_VERIFICATION_PENDING',
        'RESOLVED',
        'DISMISSED',
      ]).default('DETECTED'),
    });

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid incident payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const repos = getRepositories();
    const now = nowUtc();
    const incident: Incident = {
      id: generateId(),
      streamReachId: parsed.data.streamReachId,
      createdAt: now,
      updatedAt: now,
      status: parsed.data.status,
      hazardType: parsed.data.hazardType,
      evidenceConfidence: parsed.data.evidenceConfidence,
      severity: parsed.data.severity,
      verificationStatus: 'UNVERIFIED',
    };

    const saved = await repos.incidents.create(incident);

    const eventBus = getEventBus();
    await eventBus.publish({
      eventId: generateId(),
      eventType: 'IncidentCreated',
      timestamp: now,
      actor: 'system:incident_engine',
      payload: { incident: saved },
    });

    res.status(201).json({
      success: true,
      data: saved,
    });
  } catch (err) {
    next(err);
  }
});

incidentsRouter.get('/:id/evidence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const incident = await repos.incidents.findById(req.params.id);
    if (!incident) {
      throw new NotFoundError(`Incident with id '${req.params.id}' not found`);
    }

    const directEvidence = await repos.incidents.findEvidenceByIncidentId(req.params.id);
    const assessment = await repos.evidenceAssessments.findLatestByStreamReach(incident.streamReachId);

    const combinedEvidence = [...directEvidence];
    if (assessment) {
      if (assessment.supportingEvidence) {
        for (const item of assessment.supportingEvidence) {
          if (!combinedEvidence.some((e) => e.id === item.id || (e.observationId && e.observationId === item.observationId))) {
            combinedEvidence.push(item);
          }
        }
      }
      if (assessment.contradictingEvidence) {
        for (const item of assessment.contradictingEvidence) {
          if (!combinedEvidence.some((e) => e.id === item.id || (e.observationId && e.observationId === item.observationId))) {
            combinedEvidence.push(item);
          }
        }
      }
    }

    res.json({
      success: true,
      data: combinedEvidence,
      assessment: assessment || undefined,
      meta: {
        total: combinedEvidence.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

incidentsRouter.post('/:id/evidence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const incident = await repos.incidents.findById(req.params.id);
    if (!incident) {
      throw new NotFoundError(`Incident with id '${req.params.id}' not found`);
    }

    const schema = z.object({
      source: z.enum(['SATELLITE_SENTINEL2', 'CITIZEN_REPORT', 'WEATHER_STATION', 'IN_SITU_SENSOR', 'HISTORICAL_BASELINE']),
      observationId: z.string().min(1),
      relevance: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      spatialMatch: z.object({ isMatch: z.boolean(), distanceMeters: z.number() }),
      temporalMatch: z.object({ isMatch: z.boolean(), deltaMinutes: z.number() }),
      qualityScore: z.number().min(0).max(1).default(1),
      contribution: z.enum(['SUPPORTING', 'CONTRADICTING', 'NEUTRAL']),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid evidence payload', parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
    }

    const id = generateId();
    const now = nowUtc();
    const provenance = createProvenanceRecord({
      entityId: id,
      entityType: 'EVIDENCE_ITEM',
      source: parsed.data.source,
      sourceIdentifier: parsed.data.observationId,
      acquisitionTimestamp: now,
      processingMethod: 'EVIDENCE_FUSION_CORRELATOR',
    });

    const evidenceItem: EvidenceItem = {
      id,
      incidentId: req.params.id,
      source: parsed.data.source,
      observationId: parsed.data.observationId,
      relevance: parsed.data.relevance,
      spatialMatch: parsed.data.spatialMatch,
      temporalMatch: parsed.data.temporalMatch,
      qualityScore: parsed.data.qualityScore,
      contribution: parsed.data.contribution,
      provenance,
      createdAt: now,
    };

    const saved = await repos.incidents.addEvidence(evidenceItem);
    res.status(201).json({
      success: true,
      data: saved,
    });
  } catch (err) {
    next(err);
  }
});

incidentsRouter.get('/:id/recommendations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const incident = await repos.incidents.findById(req.params.id);
    if (!incident) {
      throw new NotFoundError(`Incident with id '${req.params.id}' not found`);
    }

    const recs1 = await repos.incidents.findRecommendationsByIncidentId(req.params.id);
    const recs2 = await repos.recommendations.findByIncidentId(req.params.id);
    const combined = [...recs2];
    for (const r of recs1) {
      if (!combined.some((c) => c.id === r.id)) {
        combined.push(r);
      }
    }
    combined.sort((a, b) => (a.rank || 0) - (b.rank || 0));

    res.json({
      success: true,
      data: combined,
      meta: {
        total: combined.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

incidentsRouter.get('/:id/verification', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const incident = await repos.incidents.findById(req.params.id);
    if (!incident) {
      throw new NotFoundError(`Incident with id '${req.params.id}' not found`);
    }

    const verification = await repos.incidents.findVerificationByIncidentId(req.params.id);
    res.json({
      success: true,
      data: verification,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/incidents/:id/timeline - Chronological Incident Event History
incidentsRouter.get('/:id/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const incident = await repos.incidents.findById(req.params.id);
    if (!incident) {
      throw new NotFoundError(`Incident with id '${req.params.id}' not found`);
    }

    const timelineItems: Array<{
      id: string;
      timestamp: string;
      eventType: string;
      title: string;
      description: string;
      actor: string;
      category: 'OBSERVATION' | 'EVIDENCE' | 'INCIDENT' | 'RECOMMENDATION' | 'TASK' | 'VERIFICATION' | 'FHIR';
      status?: string;
      metadata?: Record<string, unknown>;
    }> = [];

    // 1. Incident Creation Event
    timelineItems.push({
      id: `incident-created-${incident.id}`,
      timestamp: incident.createdAt,
      eventType: 'IncidentCreated',
      title: `Incident Detected: ${incident.hazardType.replace(/_/g, ' ')}`,
      description: `Initial operational anomaly flagged with severity ${incident.severity} (Confidence: ${incident.evidenceConfidence}%)`,
      actor: 'system:incident_classifier',
      category: 'INCIDENT',
      status: incident.status,
    });

    // 2. Correlated Observations
    const observations = await repos.observations.findByStreamReach(incident.streamReachId);
    for (const obs of observations) {
      timelineItems.push({
        id: `obs-${obs.id}`,
        timestamp: obs.timestamp,
        eventType: 'ObservationReceived',
        title: `${obs.source.replace(/_/g, ' ')} Observation Received`,
        description: `Indicator ${obs.indicator} recorded value ${obs.value} ${obs.unit} (Quality: ${obs.quality})`,
        actor: obs.source,
        category: 'OBSERVATION',
        metadata: { indicator: obs.indicator, value: obs.value, quality: obs.quality },
      });
    }

    // 3. Evidence Assessment
    const assessment = await repos.evidenceAssessments.findLatestByStreamReach(incident.streamReachId);
    if (assessment) {
      timelineItems.push({
        id: `assessment-${assessment.id}`,
        timestamp: assessment.createdAt,
        eventType: 'EvidenceAssessmentUpdated',
        title: `Evidence Fusion Assessment: Score ${assessment.score}/100`,
        description: `Confidence band set to ${assessment.confidenceBand}. Supporting sources: ${assessment.supportingEvidence?.length || 0}, Contradicting: ${assessment.contradictingEvidence?.length || 0}.`,
        actor: 'service:evidence_fusion',
        category: 'EVIDENCE',
        status: assessment.confidenceBand,
        metadata: { score: assessment.score, confidenceBand: assessment.confidenceBand },
      });
    }

    // 4. Audit Log Records for Incident & Recommendations
    const incidentAudit = await repos.auditLogs.findByIncidentId(incident.id);
    for (const audit of incidentAudit) {
      let category: 'RECOMMENDATION' | 'TASK' | 'INCIDENT' = 'INCIDENT';
      let title = audit.eventType.replace(/_/g, ' ');

      if (audit.eventType.includes('RECOMMENDATION')) {
        category = 'RECOMMENDATION';
        title = audit.eventType === 'RECOMMENDATION_GENERATED'
          ? 'Recommendation Formulated'
          : audit.eventType === 'RECOMMENDATION_APPROVED'
          ? 'Recommendation Approved by Operator'
          : 'Recommendation Reviewed';
      } else if (audit.eventType.includes('TASK')) {
        category = 'TASK';
      }

      timelineItems.push({
        id: `audit-${audit.id}`,
        timestamp: audit.timestamp,
        eventType: audit.eventType,
        title,
        description: audit.reason || `Transitioned from ${audit.previousStatus || 'N/A'} to ${audit.newStatus || 'N/A'}`,
        actor: audit.actor || 'Human Operator',
        category,
        status: audit.newStatus,
        metadata: audit.metadata,
      });
    }

    // 5. Operational Tasks for this Incident
    const tasks = await repos.tasks.findByIncidentId(incident.id);
    for (const task of tasks) {
      timelineItems.push({
        id: `task-created-${task.id}`,
        timestamp: task.createdAt,
        eventType: 'TaskCreated',
        title: `Operational Task Dispatched: ${task.title}`,
        description: `Assigned to ${task.assignedTo} (${task.assignedRole || 'Field Operator'}). Status: ${task.status}. Priority: ${task.priority}.`,
        actor: 'service:response_orchestrator',
        category: 'TASK',
        status: task.status,
        metadata: { taskId: task.id, priority: task.priority },
      });

      if (task.fhirTaskId) {
        timelineItems.push({
          id: `fhir-sync-${task.id}`,
          timestamp: task.createdAt,
          eventType: 'FhirTaskSynchronized',
          title: `FHIR R4 Task Synchronized: ${task.fhirTaskId}`,
          description: `HL7 FHIR R4 Task resource mirrored to municipal health & environment boundary.`,
          actor: 'adapter:hapi_fhir',
          category: 'FHIR',
          status: 'SYNCHRONIZED',
          metadata: { fhirTaskId: task.fhirTaskId },
        });
      }

      if (task.acceptedAt) {
        timelineItems.push({
          id: `task-accepted-${task.id}`,
          timestamp: task.acceptedAt,
          eventType: 'TaskAccepted',
          title: `Task Accepted by ${task.assignedTo}`,
          description: 'Field officer acknowledged assignment and scheduled deployment.',
          actor: task.assignedTo,
          category: 'TASK',
          status: 'ACCEPTED',
        });
      }

      if (task.inProgressAt) {
        timelineItems.push({
          id: `task-inprogress-${task.id}`,
          timestamp: task.inProgressAt,
          eventType: 'TaskInProgress',
          title: `Field Work Started: ${task.title}`,
          description: 'Personnel deployed to stream reach coordinates for active field operations.',
          actor: task.assignedTo,
          category: 'TASK',
          status: 'IN_PROGRESS',
        });
      }

      if (task.completedAt) {
        timelineItems.push({
          id: `task-completed-${task.id}`,
          timestamp: task.completedAt,
          eventType: 'TaskCompleted',
          title: `Task Completed: ${task.title}`,
          description: task.notes || 'Field protocol execution completed and reported.',
          actor: task.assignedTo,
          category: 'TASK',
          status: 'COMPLETED',
        });
      }

      if (task.verifiedAt) {
        timelineItems.push({
          id: `task-verified-${task.id}`,
          timestamp: task.verifiedAt,
          eventType: 'TaskVerified',
          title: `Supervisory Verification Confirmed`,
          description: 'Municipal authority supervisor verified task deliverables and field evidence.',
          actor: 'Supervisor',
          category: 'TASK',
          status: 'VERIFIED',
        });
      }
    }

    // 6. Ground Verification
    const verification = await repos.incidents.findVerificationByIncidentId(incident.id);
    if (verification) {
      const inspectorName = (verification.inspector as any)?.name || verification.observer || 'Field Inspector';
      const photoCount = verification.evidence?.photos?.length || verification.photos?.length || 0;
      const hasSamples = (verification.evidence?.samples?.length || 0) > 0 || verification.sampleCollected;
      timelineItems.push({
        id: `verification-${verification.id}`,
        timestamp: verification.submittedAt || verification.createdAt || verification.timestamp,
        eventType: 'VerificationSubmitted',
        title: `Ground Verification Recorded: ${verification.status || verification.result}`,
        description: `${verification.notes || 'Field verification completed'} (Photos: ${photoCount}, Samples: ${hasSamples ? 'Yes' : 'No'})`,
        actor: inspectorName,
        category: 'VERIFICATION',
        status: verification.status || verification.result,
      });
    }

    // Sort chronologically ascending
    timelineItems.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json({
      success: true,
      data: timelineItems,
      meta: {
        total: timelineItems.length,
        incidentId: incident.id,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/incidents/:id/outcomes
incidentsRouter.get('/:id/outcomes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const incident = await repos.incidents.findById(req.params.id);
    if (!incident) {
      throw new NotFoundError(`Incident with id '${req.params.id}' not found`);
    }

    const outcomes = await repos.incidentOutcomes.findByIncidentId(req.params.id);
    res.json({
      success: true,
      data: outcomes,
      meta: {
        total: outcomes.length,
        incidentId: req.params.id,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/incidents/:id/outcome/confirm
incidentsRouter.post('/:id/outcome/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const confirmSchema = z.object({
      outcomeType: z.enum(['CONFIRMED', 'NOT_CONFIRMED', 'UNCERTAIN', 'ESCALATE', 'ADDITIONAL_VERIFICATION_REQUIRED']),
      actor: z.string().optional().default('Supervisor Dimitris'),
      notes: z.string().optional(),
    });

    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid outcome confirmation payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const service = getOperationalResponseService();
    const result = await service.confirmIncidentOutcome(
      req.params.id,
      parsed.data.outcomeType as OperationalOutcomeType,
      parsed.data.actor,
      parsed.data.notes
    );

    res.json({
      success: true,
      data: result,
      message: `Outcome ${parsed.data.outcomeType} confirmed for incident ${req.params.id}`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/incidents/:id/resolve
incidentsRouter.post('/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resolveSchema = z.object({
      resolution: z.string().min(1),
      actor: z.string().optional().default('Human Operator'),
    });

    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid incident resolution payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const repos = getRepositories();
    const incident = await repos.incidents.findById(req.params.id);
    if (!incident) {
      throw new NotFoundError(`Incident with id '${req.params.id}' not found`);
    }

    const now = nowUtc();
    const updated = await repos.incidents.update(req.params.id, {
      status: 'RESOLVED',
      updatedAt: now,
    });

    // Publish IncidentResolved event
    const eventBus = getEventBus();
    await eventBus.publish({
      eventId: generateId(),
      eventType: 'IncidentResolved',
      timestamp: now,
      actor: parsed.data.actor,
      payload: {
        incidentId: req.params.id,
        resolution: parsed.data.resolution,
        actor: parsed.data.actor,
      },
    });

    res.json({
      success: true,
      data: updated,
      message: `Incident ${req.params.id} resolved`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/incidents/:id/escalate
incidentsRouter.post('/:id/escalate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const escalateSchema = z.object({
      newSeverity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      reason: z.string().min(1),
      actor: z.string().optional().default('Supervisor Dimitris'),
    });

    const parsed = escalateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid escalation payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const repos = getRepositories();
    const incident = await repos.incidents.findById(req.params.id);
    if (!incident) {
      throw new NotFoundError(`Incident with id '${req.params.id}' not found`);
    }

    const now = nowUtc();
    const previousSeverity = incident.severity;
    const updated = await repos.incidents.update(req.params.id, {
      severity: parsed.data.newSeverity as any,
      updatedAt: now,
    });

    const eventBus = getEventBus();
    await eventBus.publish({
      eventId: generateId(),
      eventType: 'IncidentEscalated',
      timestamp: now,
      actor: parsed.data.actor,
      payload: {
        incidentId: req.params.id,
        previousSeverity,
        newSeverity: parsed.data.newSeverity,
        reason: parsed.data.reason,
        actor: parsed.data.actor,
      },
    });

    res.json({
      success: true,
      data: updated,
      message: `Incident ${req.params.id} escalated to ${parsed.data.newSeverity}`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/incidents/:id/tasks/follow-up
incidentsRouter.post('/:id/tasks/follow-up', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const followUpSchema = z.object({
      title: z.string().optional(),
      instructions: z.string().min(1),
      assignedTo: z.string().optional(),
      assignedRole: z.string().optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      requiredEvidence: z.array(z.string()).optional(),
      actor: z.string().optional(),
    });

    const parsed = followUpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid follow-up task payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const service = getOperationalResponseService();
    const newTask = await service.createFollowUpTask(req.params.id, parsed.data);

    res.status(201).json({
      success: true,
      data: newTask,
      message: `Follow-up task created for incident ${req.params.id}`,
    });
  } catch (err) {
    next(err);
  }
});

