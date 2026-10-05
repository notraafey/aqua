import {
  DomainEvent,
  ObservationReceivedEvent,
  EvidenceUpdatedEvent,
  IncidentCreatedEvent,
  IncidentStateChangedEvent,
  RecommendationReviewedEvent,
  TaskCreatedEvent,
  TaskStatusUpdatedEvent,
  EarlyWarningTriggeredEvent,
  ForecastGeneratedEvent,
  ScenarioSimulatedEvent,
  VerificationCompletedEvent,
  IncidentConfirmedEvent,
  IncidentNotConfirmedEvent,
  IncidentEscalatedEvent,
  IncidentResolvedEvent,
  AdditionalVerificationRequiredEvent,
  InteroperabilityEventEnvelope,
  OutboxEvent,
  InteroperabilityOverviewResponse,
  FhirSubscription,
} from '@aquasentinel/shared';
import { getEventBus } from '../../events/index.js';
import { getRepositories } from '../../database/repositories/index.js';
import { getFhirAdapter, FhirMapper, FhirValidator } from '../../adapters/fhir/index.js';
import { EventQualifier } from '../../domain/interoperability/event-qualifier.js';
import { getDeliveryWorker } from './delivery-worker.js';
import { config } from '../../config/index.js';
import { logger } from '../../logging/logger.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';

export class InteroperabilityService {
  private isInitialized = false;

  initialize(): void {
    if (this.isInitialized) return;

    logger.info('[InteroperabilityService] Initializing event subscriptions and outbox worker...');
    const bus = getEventBus();

    // Subscribe to all DomainEvents for qualification
    bus.subscribe('ObservationReceived', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('EvidenceUpdated', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('IncidentCreated', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('IncidentStateChanged', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('RecommendationReviewed', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('TaskCreated', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('TaskStatusUpdated', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('EarlyWarningTriggered', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('ForecastGenerated', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('ScenarioSimulated', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('VerificationCompleted', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('IncidentConfirmed', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('IncidentNotConfirmed', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('IncidentEscalated', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('IncidentResolved', async (e) => { await this.handleDomainEvent(e); });
    bus.subscribe('AdditionalVerificationRequired', async (e) => { await this.handleDomainEvent(e); });


    // Start delivery worker background poller
    getDeliveryWorker({
      pollIntervalMs: config.OUTBOX_POLL_INTERVAL_MS,
      maxRetries: config.OUTBOX_MAX_RETRIES,
      initialBackoffMs: config.OUTBOX_RETRY_BACKOFF_MS,
    }).start();

    this.ensureDefaultSubscriptions().catch((err) => {
      logger.warn('[InteroperabilityService] Could not register default FHIR subscriptions on startup:', {
        error: err.message,
      });
    });

    this.isInitialized = true;
    logger.info('[InteroperabilityService] Initialized successfully.');
  }

  /**
   * Evaluates an incoming domain event, maps to FHIR, validates, and stores in outbox.
   */
  async handleDomainEvent(event: DomainEvent): Promise<OutboxEvent | null> {
    const repos = getRepositories();
    const fhir = getFhirAdapter();

    // 1. Event Qualification
    const qualification = EventQualifier.qualify(event);
    if (!qualification.qualified || !qualification.externalEventType) {
      logger.debug(
        `[InteroperabilityService] Event ${event.eventId} (${event.eventType}) skipped: ${qualification.reason}`
      );
      return null;
    }

    logger.info(
      `[InteroperabilityService] Event ${event.eventId} (${event.eventType}) QUALIFIED -> ${qualification.externalEventType}: ${qualification.reason}`
    );

    // 2. Map domain entity to standard FHIR R4 resource
    const fhirResource = this.mapToFhirResource(event);
    if (!fhirResource) {
      logger.warn(`[InteroperabilityService] Could not map event ${event.eventId} to FHIR resource`);
      return null;
    }

    // 3. FHIR Validation (Section 25)
    const validation = FhirValidator.validate(fhirResource);
    if (!validation.valid) {
      logger.error(
        `[InteroperabilityService] Outbound FHIR validation failed for ${fhirResource.resourceType}/${fhirResource.id}:`,
        validation.issues
      );
      await repos.interoperabilityAudit.log({
        id: generateId(),
        eventId: event.eventId,
        stage: 'VALIDATED',
        status: 'FAILURE',
        message: `FHIR validation rejected resource: ${validation.issues.map((i) => i.details).join('; ')}`,
        details: { issues: validation.issues, operationOutcome: validation.operationOutcome },
        timestamp: nowUtc(),
      });
      // Do not deliver invalid FHIR resources silently
      return null;
    }

    // 4. Publish to FHIR Server / Adapter (Section 17 - triggers FHIR Subscriptions)
    try {
      await this.publishToFhirServer(event, fhirResource);
    } catch (err: any) {
      logger.warn(`[InteroperabilityService] Non-fatal error publishing to FHIR server: ${err.message}`);
    }

    // 5. Construct Versioned Event Envelope (Section 9)
    const externalEventId = generateId();
    const envelope: InteroperabilityEventEnvelope = {
      eventId: externalEventId,
      eventType: qualification.externalEventType,
      eventVersion: '1.0.0',
      occurredAt: event.timestamp || nowUtc(),
      producer: 'aquasentinel-decision-engine',
      subject: qualification.subjectReference || `Location/unknown`,
      resource: fhirResource,
      resourceType: fhirResource.resourceType || 'Resource',
      resourceId: fhirResource.id || externalEventId,
      correlationId: qualification.correlationId || event.correlationId || externalEventId,
      causationId: qualification.causationId || event.eventId,
      provenance: {
        provenanceId: generateId(),
        sourceEntityId: fhirResource.id || externalEventId,
        sourceEntityType: fhirResource.resourceType || 'Resource',
        originatingSource: event.actor || 'AQUASENTINEL_SYSTEM',
        processingPipeline: 'FHIR_R4_INTEROPERABILITY_PIPELINE_V1',
        scientificDisclaimer:
          'Elevated chlorophyll-related remote-sensing signal detected (NDCI). Optical proxy indicates potential biogenic presence; pending field corroboration and laboratory verification. Not a verified clinical or pathogen diagnostic.',
        timestamp: nowUtc(),
      },
      severity: qualification.severity,
      qualificationReason: qualification.reason,
    };

    // 6. Persistent Outbox Entry (Section 13)
    const outboxEvent: OutboxEvent = {
      id: generateId(),
      eventId: externalEventId,
      eventType: qualification.externalEventType,
      eventVersion: '1.0.0',
      occurredAt: envelope.occurredAt,
      producer: envelope.producer,
      subject: envelope.subject,
      resourceType: envelope.resourceType,
      resourceId: envelope.resourceId,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId,
      payload: envelope,
      destination: config.EXTERNAL_CONSUMER_URL,
      status: 'PENDING',
      retryCount: 0,
      maxRetries: config.OUTBOX_MAX_RETRIES,
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    };

    await repos.outbox.save(outboxEvent);

    await repos.interoperabilityAudit.log({
      id: generateId(),
      eventId: externalEventId,
      stage: 'OUTBOX_QUEUED',
      status: 'SUCCESS',
      message: `Interoperability event queued in outbox for destination: ${config.EXTERNAL_CONSUMER_URL}`,
      details: {
        eventType: outboxEvent.eventType,
        resourceType: outboxEvent.resourceType,
        correlationId: outboxEvent.correlationId,
      },
      timestamp: nowUtc(),
    });

    // 7. Prompt Delivery Worker for immediate execution
    getDeliveryWorker().processPendingEvents(5).catch((err) => {
      logger.error('[InteroperabilityService] Error during immediate delivery trigger:', { error: err.message });
    });

    return outboxEvent;
  }

  private mapToFhirResource(event: DomainEvent): any {
    switch (event.eventType) {
      case 'ObservationReceived': {
        const obs = (event as ObservationReceivedEvent).payload.observation;
        return FhirMapper.toFhirObservation(obs);
      }
      case 'EvidenceUpdated': {
        const assessment = (event as EvidenceUpdatedEvent).payload.assessment;
        return {
          resourceType: 'Observation',
          id: assessment.id,
          status: 'final',
          code: {
            coding: [
              {
                system: 'https://oneaquahealth.eu/fhir/indicators',
                code: 'evidence_fusion_score',
                display: 'Evidence Fusion Multi-Factor Water Quality Assessment',
              },
            ],
          },
          subject: { reference: `Location/${assessment.streamReachId}` },
          effectiveDateTime: assessment.updatedAt,
          valueQuantity: {
            value: assessment.score,
            unit: 'score',
            system: 'http://unitsofmeasure.org',
            code: 'score',
          },
          note: [{ text: `ConfidenceBand: ${assessment.confidenceBand}; Version: ${assessment.scoringVersion}` }],
        };
      }
      case 'IncidentCreated': {
        const inc = (event as IncidentCreatedEvent).payload.incident;
        return FhirMapper.toFhirFlag(inc);
      }
      case 'IncidentStateChanged': {
        const { incidentId, newStatus } = (event as IncidentStateChangedEvent).payload;
        return {
          resourceType: 'Flag',
          id: incidentId,
          status: newStatus === 'RESOLVED' || newStatus === 'DISMISSED' ? 'inactive' : 'active',
          code: {
            coding: [
              {
                system: 'https://oneaquahealth.eu/fhir/hazards',
                code: 'status-change',
                display: `Incident Status Update (${newStatus})`,
              },
            ],
          },
          subject: { reference: `Incident/${incidentId}` },
        };
      }
      case 'RecommendationReviewed': {
        const recEvent = event as RecommendationReviewedEvent;
        return {
          resourceType: 'Task',
          id: `rec-approval-${recEvent.payload.recommendationId}`,
          status: 'requested',
          intent: 'order',
          code: {
            coding: [
              {
                system: 'https://oneaquahealth.eu/fhir/action-types',
                code: 'approved-measure',
                display: 'Approved Operational Recommendation',
              },
            ],
          },
          focus: { reference: `Incident/${recEvent.payload.incidentId}` },
          authoredOn: nowUtc(),
          description: `Supervisor ${recEvent.payload.actor} approved measure ${recEvent.payload.recommendationId}`,
        };
      }
      case 'TaskCreated': {
        const task = (event as TaskCreatedEvent).payload.task;
        return FhirMapper.toFhirTask(task);
      }
      case 'TaskStatusUpdated': {
        const { task } = (event as TaskStatusUpdatedEvent).payload;
        return task ? FhirMapper.toFhirTask(task) : null;
      }
      case 'EarlyWarningTriggered': {
        const warning = (event as EarlyWarningTriggeredEvent).payload.earlyWarning;
        return FhirMapper.toFhirEarlyWarningFlag(warning);
      }
      case 'ForecastGenerated': {
        const forecast = (event as ForecastGeneratedEvent).payload.forecast;
        const obsList = FhirMapper.toFhirForecastObservation(forecast);
        return obsList[0] || null;
      }
      case 'ScenarioSimulated': {
        const sim = (event as ScenarioSimulatedEvent).payload.simulation;
        return {
          resourceType: 'Observation',
          id: sim.scenarioId,
          status: 'preliminary',
          code: {
            coding: [
              {
                system: 'https://oneaquahealth.eu/fhir/indicators',
                code: 'counterfactual_scenario_result',
                display: `Counterfactual Scenario: ${sim.type}`,
              },
            ],
          },
          subject: { reference: `Location/${sim.streamReachId}` },
          effectiveDateTime: sim.generatedTimestamp,
          note: [{ text: `Scenario: ${sim.name}; Assumptions: ${sim.assumptions.join('; ')}` }],
        };
      }
      case 'VerificationCompleted': {
        const verification = (event as VerificationCompletedEvent).payload.verification;
        return FhirMapper.toFhirVerificationObservation(verification);
      }
      case 'IncidentConfirmed': {
        const { incidentId, verificationId, confidence, reason } = (event as IncidentConfirmedEvent).payload;
        return {
          resourceType: 'Flag',
          id: `outcome-confirmed-${incidentId}`,
          status: 'active',
          code: {
            coding: [
              {
                system: 'https://oneaquahealth.eu/fhir/hazards',
                code: 'incident-confirmed',
                display: 'Incident Confirmed via Field Verification',
              },
            ],
            text: `Incident ${incidentId} confirmed (confidence: ${confidence}): ${reason}`,
          },
          subject: { reference: `Incident/${incidentId}` },
        };
      }
      case 'IncidentNotConfirmed': {
        const { incidentId, verificationId, reason } = (event as IncidentNotConfirmedEvent).payload;
        return {
          resourceType: 'Flag',
          id: `outcome-not-confirmed-${incidentId}`,
          status: 'inactive',
          code: {
            coding: [
              {
                system: 'https://oneaquahealth.eu/fhir/hazards',
                code: 'incident-not-confirmed',
                display: 'Incident Not Confirmed (False Alarm / Clear Ground Truth)',
              },
            ],
            text: `Incident ${incidentId} not confirmed: ${reason}`,
          },
          subject: { reference: `Incident/${incidentId}` },
        };
      }
      case 'IncidentEscalated': {
        const { incidentId, previousSeverity, newSeverity, reason } = (event as IncidentEscalatedEvent).payload;
        return {
          resourceType: 'Flag',
          id: `outcome-escalated-${incidentId}`,
          status: 'active',
          code: {
            coding: [
              {
                system: 'https://oneaquahealth.eu/fhir/hazards',
                code: 'incident-escalated',
                display: 'Incident Escalated to Regional Authority',
              },
            ],
            text: `Incident ${incidentId} escalated from ${previousSeverity} to ${newSeverity}: ${reason}`,
          },
          subject: { reference: `Incident/${incidentId}` },
        };
      }
      case 'IncidentResolved': {
        const { incidentId, resolution } = (event as IncidentResolvedEvent).payload;
        return {
          resourceType: 'Flag',
          id: `outcome-resolved-${incidentId}`,
          status: 'inactive',
          code: {
            coding: [
              {
                system: 'https://oneaquahealth.eu/fhir/hazards',
                code: 'incident-resolved',
                display: 'Incident Fully Resolved and Closed',
              },
            ],
            text: `Incident ${incidentId} resolved: ${resolution}`,
          },
          subject: { reference: `Incident/${incidentId}` },
        };
      }
      case 'AdditionalVerificationRequired': {
        const { incidentId, verificationId, newTaskId, reason } = (event as AdditionalVerificationRequiredEvent).payload;
        return {
          resourceType: 'Task',
          id: newTaskId || `followup-${incidentId}-${Date.now()}`,
          status: 'requested',
          intent: 'order',
          code: {
            coding: [
              {
                system: 'https://oneaquahealth.eu/fhir/action-types',
                code: 'secondary-field-verification',
                display: 'Additional Secondary Field Verification Required',
              },
            ],
          },
          focus: { reference: `Incident/${incidentId}` },
          authoredOn: nowUtc(),
          description: `Follow-up verification for verification ${verificationId || 'initial'}: ${reason}`,
        };
      }
      default:
        return null;
    }
  }

  private async publishToFhirServer(event: DomainEvent, resource: any): Promise<void> {
    const fhir = getFhirAdapter();
    switch (resource.resourceType) {
      case 'Observation':
        if (event.eventType === 'ObservationReceived') {
          await fhir.publishObservation((event as ObservationReceivedEvent).payload.observation);
        }
        break;
      case 'Flag':
        if (event.eventType === 'IncidentCreated') {
          await fhir.publishFlag((event as IncidentCreatedEvent).payload.incident);
        } else if (event.eventType === 'EarlyWarningTriggered' && fhir.publishEarlyWarningFlag) {
          await fhir.publishEarlyWarningFlag((event as EarlyWarningTriggeredEvent).payload.earlyWarning);
        }
        break;
      case 'Task':
        if (event.eventType === 'TaskCreated') {
          await fhir.publishTask((event as TaskCreatedEvent).payload.task);
        }
        break;
    }
  }

  /**
   * Registers default FHIR Subscriptions for the external consumer (Section 17).
   */
  async ensureDefaultSubscriptions(): Promise<FhirSubscription[]> {
    const repos = getRepositories();
    const fhir = getFhirAdapter();

    const defaultSubs: FhirSubscription[] = [
      {
        id: 'sub-volos-flags',
        status: 'active',
        reason: 'Notify Volos Public Health Portal of active water contamination flags',
        criteria: 'Flag?status=active',
        channel: {
          type: 'rest-hook',
          endpoint: config.EXTERNAL_CONSUMER_URL,
          payload: 'application/fhir+json',
        },
      },
      {
        id: 'sub-volos-tasks',
        status: 'active',
        reason: 'Notify Volos Municipal Environmental Crew of dispatched operational tasks',
        criteria: 'Task?status=requested',
        channel: {
          type: 'rest-hook',
          endpoint: config.EXTERNAL_CONSUMER_URL,
          payload: 'application/fhir+json',
        },
      },
      {
        id: 'sub-volos-observations',
        status: 'active',
        reason: 'Stream anomalous environmental observations to public health portal',
        criteria: 'Observation?status=final',
        channel: {
          type: 'rest-hook',
          endpoint: config.EXTERNAL_CONSUMER_URL,
          payload: 'application/fhir+json',
        },
      },
    ];

    const results: FhirSubscription[] = [];
    for (const sub of defaultSubs) {
      const saved = await repos.fhirSubscriptions.save(sub);
      await fhir.registerSubscription(saved);
      results.push(saved);
    }

    return results;
  }

  /**
   * Returns complete telemetry and status for the interoperability Command Console (Section 48).
   */
  async getOverview(): Promise<InteroperabilityOverviewResponse> {
    const repos = getRepositories();
    const fhir = getFhirAdapter();

    // 1. FHIR status
    const fhirHealth = await fhir.healthCheck().catch((err) => ({
      healthy: false,
      endpoint: config.FHIR_SERVER_URL,
      isMock: config.APP_MODE === 'demo',
      version: 'unknown',
      error: err.message,
    }));

    // 2. Outbox counts
    const outboxCounts = await repos.outbox.count();

    // 3. Consumer health check
    let consumerHealth = {
      healthy: false,
      endpoint: config.EXTERNAL_CONSUMER_URL,
      consumerId: 'volos-public-health-portal',
      lastSeen: undefined as string | undefined,
      error: undefined as string | undefined,
    };

    try {
      const healthUrl = config.EXTERNAL_CONSUMER_URL.replace(/\/webhook\/fhir\/?$/, '/health');
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as any;
        consumerHealth = {
          healthy: true,
          endpoint: config.EXTERNAL_CONSUMER_URL,
          consumerId: json.consumerId || 'volos-public-health-portal',
          lastSeen: nowUtc(),
          error: undefined,
        };
      } else {
        consumerHealth.error = `HTTP ${res.status}: ${res.statusText}`;
      }
    } catch (err: any) {
      consumerHealth.error = err.message || 'Connection refused';
    }

    // 4. Subscriptions
    const subs = await repos.fhirSubscriptions.findAll();

    // 5. Recent events & dead letter
    const recentEvents = await repos.outbox.find({ limit: 15 });
    const recentDeadLetter = await repos.outbox.findDeadLetter(10);

    return {
      fhir: {
        healthy: fhirHealth.healthy,
        endpoint: fhirHealth.endpoint,
        isMock: fhirHealth.isMock,
        version: fhirHealth.version || '4.0.1',
        error: fhirHealth.error,
      },
      outbox: outboxCounts,
      consumer: consumerHealth,
      subscriptions: {
        total: subs.length,
        active: subs.filter((s) => s.status === 'active').length,
        list: subs,
      },
      recentEvents,
      recentDeadLetter,
    };
  }
}

let activeInteropService: InteroperabilityService | null = null;

export function getInteroperabilityService(): InteroperabilityService {
  if (!activeInteropService) {
    activeInteropService = new InteroperabilityService();
  }
  return activeInteropService;
}

export const interoperabilityService = getInteroperabilityService();
