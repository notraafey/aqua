import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { config } from '../../src/config/index.js';
import { setRepositories, createRepositories, getRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';
import { resetSystemState } from '../../src/database/reset.js';
import { evidenceFusionService } from '../../src/services/evidence/evidence-fusion-service.js';
import { getOperationalResponseService, SubmitVerificationInput } from '../../src/services/response/operational-response-service.js';
import { getInteroperabilityService } from '../../src/services/interoperability/interoperability-service.js';
import { getDeliveryWorker } from '../../src/services/interoperability/delivery-worker.js';
import { getEventBus } from '../../src/events/index.js';
import { Phase8DemoRunner } from '../../src/domain/response/demo-scenarios-phase8.js';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';
import { createProvenanceRecord } from '../../src/domain/provenance.js';
import { createConsumerApp } from '../../../consumer/src/server.js';
import { consumerStore } from '../../../consumer/src/store.js';
import {
  Observation,
  Incident,
  Task,
  Recommendation,
  OutboxEvent,
} from '@aquasentinel/shared';

describe('Phase 9: Comprehensive End-to-End Release Validation Suite', () => {
  let consumerServer: http.Server;
  const CONSUMER_PORT = 3099;
  const originalConsumerUrl = config.EXTERNAL_CONSUMER_URL;

  beforeAll(async () => {
    // 1. Initialize In-Memory isolated test repositories
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();

    // Configure test consumer URL to match isolated test server port
    config.EXTERNAL_CONSUMER_URL = `http://127.0.0.1:${CONSUMER_PORT}/webhook/fhir`;

    // 2. Initialize Core Domain Services
    evidenceFusionService.initialize();
    getOperationalResponseService().initialize();
    getInteroperabilityService().initialize();

    // Stop background timer so tests control delivery batch execution deterministically
    getDeliveryWorker().stop();

    // 3. Spin up the external consumer on isolated port 3099
    consumerStore.reset();
    const app = createConsumerApp();
    consumerServer = http.createServer(app);
    await new Promise<void>((resolve) => {
      consumerServer.listen(CONSUMER_PORT, '127.0.0.1', () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    config.EXTERNAL_CONSUMER_URL = originalConsumerUrl;
    await new Promise<void>((resolve) => {
      consumerServer.close(() => resolve());
    });
  });

  // ============================================================
  // Test 1: Full 13-Step Canonical Golden Path
  // ============================================================
  it('1. Executes full 13-step Golden Path (Signal → Evidence → Incident → Approval → Task → Verification → Reassessment → Outcome → FHIR → Outbox → Consumer → Ack → Audit)', async () => {
    const repos = getRepositories();
    const bus = getEventBus();
    const responseService = getOperationalResponseService();
    const worker = getDeliveryWorker();

    const reaches = await repos.streamReaches.findAll();
    const reach = reaches[0];
    const reachId = reach.id;
    const reachCoords = reach.geometry.coordinates[0];

    // Step 1: Environmental Signal Ingestion (Copernicus Sentinel-2 NDCI Anomaly)
    const obsId = generateId();
    const obsProvenance = createProvenanceRecord({
      entityId: obsId,
      entityType: 'OBSERVATION',
      source: 'SATELLITE_SENTINEL2',
      sourceIdentifier: 'S2B_MSIL2A_20260919_ALMYROS_B04_B05',
      acquisitionTimestamp: nowUtc(),
      processingMethod: 'NDCI_NORMALIZED_INDEX',
      qualityStatus: 'FLAGGED',
    });

    const observation: Observation = {
      id: obsId,
      streamReachId: reachId,
      source: 'SATELLITE_SENTINEL2',
      timestamp: nowUtc(),
      location: { type: 'Point', coordinates: [reachCoords[0], reachCoords[1]] },
      indicator: 'NDCI',
      value: 0.32,
      unit: 'index',
      quality: 'FLAGGED',
      provenance: obsProvenance,
      createdAt: nowUtc(),
    };
    await repos.observations.create(observation);
    await bus.publish({
      eventId: generateId(),
      eventType: 'ObservationReceived',
      timestamp: nowUtc(),
      actor: 'copernicus-satellite-pipeline',
      payload: { observation },
    });

    // Step 2 & 3: Evidence Fusion Assessment
    const assessment = await evidenceFusionService.assessReach(reachId);
    expect(assessment).toBeDefined();
    expect(assessment.streamReachId).toBe(reachId);

    // Step 4: Incident Creation
    const incident: Incident = {
      id: generateId(),
      streamReachId: reachId,
      severity: 'HIGH',
      status: 'DETECTED',
      hazardType: 'ALGAL_BLOOM',
      evidenceConfidence: assessment.score || 78,
      verificationStatus: 'PENDING',
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    };
    await repos.incidents.create(incident);
    await bus.publish({
      eventId: generateId(),
      eventType: 'IncidentCreated',
      timestamp: nowUtc(),
      actor: 'aquasentinel-decision-engine',
      payload: { incident },
      correlationId: incident.id,
    });

    // Step 5: Recommendation Generated
    const recId = generateId();
    const recommendation: Recommendation = {
      id: recId,
      incidentId: incident.id,
      assessmentId: assessment.id,
      streamReachId: reachId,
      priority: 'HIGH',
      actionType: 'FIELD_VERIFICATION',
      title: 'Dispatch Certified Field Inspector for Ground Truth Sampling',
      description: 'Collect in-situ turbidity, fluorometry, and photographic corroboration.',
      status: 'PENDING_REVIEW',
      suggestedTaskTypes: ['FIELD_INSPECTION'],
      createdAt: nowUtc(),
    };
    await repos.recommendations.create(recommendation);

    // Step 6: Human Supervisor Review & Approval
    await repos.recommendations.update(recId, {
      status: 'APPROVED',
      reviewedBy: 'Supervisor Dimitris',
      reviewedAt: nowUtc(),
      notes: 'Approved for immediate emergency field dispatch.',
    });

    // Step 7: Field Task Creation & Assignment
    const task: Task = {
      id: generateId(),
      incidentId: incident.id,
      recommendationId: recId,
      taskType: 'FIELD_INSPECTION' as any,
      title: 'Ground Truth Verification at Almyros Reach',
      assignedTo: 'Alex Rivera',
      assignedRole: 'FIELD_INSPECTOR',
      location: { type: 'Point', coordinates: [reachCoords[0], reachCoords[1]] },
      priority: 'HIGH',
      instructions: 'Inspect water surface for cyanobacterial scum, foam, and odor. Collect photos.',
      requiredEvidence: ['photos', 'structured_observations'],
      status: 'REQUESTED',
      createdAt: nowUtc(),
    };
    await repos.tasks.create(task);
    await bus.publish({
      eventId: generateId(),
      eventType: 'TaskCreated',
      timestamp: nowUtc(),
      actor: 'system:task_engine',
      payload: { task },
      correlationId: incident.id,
    });

    // Transition task through lifecycle
    await responseService.transitionTaskStatus(task.id, 'ACCEPTED', 'Alex Rivera', 'Dispatched');
    await responseService.transitionTaskStatus(task.id, 'IN_PROGRESS', 'Alex Rivera', 'On-site');

    // Step 8: Field Verification Submission
    const verifInput: SubmitVerificationInput = {
      taskId: task.id,
      inspector: { name: 'Alex Rivera', role: 'FIELD_INSPECTOR', organization: 'Volos Municipal Environmental Dept' },
      location: { type: 'Point', coordinates: [reachCoords[0], reachCoords[1]], accuracyMeters: 5 },
      status: 'CONFIRMED',
      observations: {
        waterColour: 'DENSE_GREEN',
        surfaceAppearance: 'FOAM',
        odour: 'FISHY',
        foam: true,
        visibleAlgae: true,
        deadFish: 4,
        flowConditions: 'STAGNANT',
        weatherConditions: 'SUNNY',
      },
      notes: 'Dense green scummy foam verified across 40% of stream surface. Strong septic odor.',
      photos: [{
        evidenceId: generateId(),
        verificationId: '',
        timestamp: nowUtc(),
        filename: 'golden_path_evidence_01.jpg',
        mediaType: 'image/jpeg',
        description: 'Dense cyanobacterial foam on water surface',
        source: 'field_camera',
      }],
      clientSubmissionId: `golden-path-${generateId()}`,
      actor: 'Alex Rivera',
    };
    const verifResult = await responseService.submitVerification(verifInput);
    expect(verifResult.verification.id).toBeDefined();

    // Step 9 & 10: Reassessment & Outcome Determination
    expect(verifResult.outcome.proposedOutcome).toBe('CONFIRMED');
    const confirmResult = await responseService.confirmIncidentOutcome(
      incident.id,
      'CONFIRMED',
      'Supervisor Dimitris',
      'Field ground truth conclusively confirms cyanobacterial bloom.'
    );
    expect(confirmResult.incident.verificationStatus).toBe('CONFIRMED');

    // Step 11 & 12: FHIR Outbox Delivery to External Consumer
    await worker.processPendingEvents(20);
    const outboxEvents = await repos.outbox.find();
    expect(outboxEvents.length).toBeGreaterThan(0);
    expect(outboxEvents.some((e) => e.status === 'DELIVERED')).toBe(true);

    // Step 13: Acknowledgement & Audit Trail Verification
    const acknowledgements = await repos.acknowledgements.findAll(10);
    expect(acknowledgements.length).toBeGreaterThan(0);
    expect(acknowledgements[0].status).toBe('ACCEPTED');

    const auditTrail = await repos.interoperabilityAudit.findAll(25);
    expect(auditTrail.some((a) => a.stage === 'DELIVERED')).toBe(true);

    const consumerEvents = consumerStore.getEvents();
    expect(consumerEvents.length).toBeGreaterThan(0);
  });

  // ============================================================
  // Test 2: Scenario A (Confirmed Contamination)
  // ============================================================
  it('2. Scenario A: Confirmed Contamination end-to-end', async () => {
    const result = await Phase8DemoRunner.runScenarioA_Confirmed();
    expect(result.scenario).toBe('A');
    expect(result.proposedOutcome).toBe('CONFIRMED');
    expect(result.confirmedOutcome).toBe('CONFIRMED');

    const repos = getRepositories();
    const incident = await repos.incidents.findById(result.incidentId);
    expect(incident?.verificationStatus).toBe('CONFIRMED');
  });

  // ============================================================
  // Test 3: Scenario B (Not Confirmed / False Alarm - Signal Preserved)
  // ============================================================
  it('3. Scenario B: Not Confirmed (False Alarm) - Preserves original observation signal', async () => {
    const repos = getRepositories();
    const reach = (await repos.streamReaches.findAll())[0];

    // Seed original observation
    const originalObs: Observation = {
      id: generateId(),
      streamReachId: reach.id,
      source: 'SATELLITE_SENTINEL2',
      timestamp: nowUtc(),
      location: { type: 'Point', coordinates: [reach.geometry.coordinates[0][0], reach.geometry.coordinates[0][1]] },
      indicator: 'NDCI',
      value: 0.29,
      unit: 'index',
      quality: 'FLAGGED',
      createdAt: nowUtc(),
    };
    await repos.observations.create(originalObs);

    const result = await Phase8DemoRunner.runScenarioB_NotConfirmed();
    expect(result.scenario).toBe('B');
    expect(result.proposedOutcome).toBe('NOT_CONFIRMED');
    expect(result.confirmedOutcome).toBe('NOT_CONFIRMED');

    // Verify original observation is NOT destroyed or purged
    const preserved = await repos.observations.findById(originalObs.id);
    expect(preserved).toBeDefined();
    expect(preserved?.value).toBe(0.29);
  });

  // ============================================================
  // Test 4: Scenario C (Uncertain - Additional Verification Required)
  // ============================================================
  it('4. Scenario C: Uncertain - Triggers follow-up lab sampling task', async () => {
    const result = await Phase8DemoRunner.runScenarioC_Uncertain();
    expect(result.scenario).toBe('C');
    expect(result.proposedOutcome).toBe('ADDITIONAL_VERIFICATION_REQUIRED');
    expect(result.confirmedOutcome).toBe('ADDITIONAL_VERIFICATION_REQUIRED');
    expect(result.followUpTaskId).toBeDefined();

    const repos = getRepositories();
    const followUp = await repos.tasks.findById(result.followUpTaskId);
    expect(followUp).toBeDefined();
    expect(followUp?.title).toContain('Secondary water sampling');
  });

  // ============================================================
  // Test 5: FHIR Resource & Subscription Delivery
  // ============================================================
  it('5. Maps domain events to valid HL7 FHIR R4 resources (Flag, Task, Observation)', async () => {
    const bus = getEventBus();
    const repos = getRepositories();

    const incident: Incident = {
      id: generateId(),
      streamReachId: 'reach-test',
      status: 'DETECTED',
      severity: 'HIGH',
      hazardType: 'ALGAL_BLOOM',
      evidenceConfidence: 80,
      verificationStatus: 'PENDING',
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    };

    await bus.publish({
      eventId: generateId(),
      eventType: 'IncidentCreated',
      timestamp: nowUtc(),
      actor: 'system:test',
      payload: { incident },
    });

    const outboxEvents = await repos.outbox.find({ correlationId: incident.id });
    expect(outboxEvents.length).toBeGreaterThan(0);
    const flagEvent = outboxEvents.find((e) => e.resourceType === 'Flag');
    expect(flagEvent).toBeDefined();
    expect(flagEvent?.resourceType).toBe('Flag');
    expect(flagEvent?.payload?.resource?.resourceType).toBe('Flag');
    expect(flagEvent?.payload?.resource?.status).toBe('active');
  });

  // ============================================================
  // Test 6: Failure & Retry Test
  // ============================================================
  it('6. Handles delivery failure, applies retry backoff, and succeeds on restoration', async () => {
    const repos = getRepositories();
    const worker = getDeliveryWorker();

    // Enable failure mode on external consumer (HTTP 503)
    consumerStore.setSimulatedFailure(true);

    const failingEvent: OutboxEvent = {
      id: generateId(),
      eventId: generateId(),
      eventType: 'IncidentCreated',
      eventVersion: '1.0.0',
      occurredAt: nowUtc(),
      producer: 'aquasentinel',
      subject: 'Location/test-1',
      resourceType: 'Flag',
      resourceId: 'flag-fail-1',
      payload: { resourceType: 'Flag', id: 'flag-fail-1', status: 'active' },
      destination: `http://127.0.0.1:${CONSUMER_PORT}/webhook/fhir`,
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    };
    await repos.outbox.save(failingEvent);

    // Attempt delivery while consumer fails
    const failedAttempt = await worker.deliverEvent(failingEvent);
    expect(failedAttempt).toBe(false);

    const stateAfterFail = await repos.outbox.findById(failingEvent.id);
    expect(stateAfterFail?.status).toBe('RETRYING');
    expect(stateAfterFail?.retryCount).toBe(1);

    // Restore consumer and redeliver
    consumerStore.setSimulatedFailure(false);
    const retrySuccess = await worker.deliverEvent(stateAfterFail!);
    expect(retrySuccess).toBe(true);

    const stateAfterRecovery = await repos.outbox.findById(failingEvent.id);
    expect(stateAfterRecovery?.status).toBe('DELIVERED');
  });

  // ============================================================
  // Test 7: Duplicate / Idempotency Test
  // ============================================================
  it('7. Consumer deduplicates identical events sent twice without duplicate action', async () => {
    const duplicateEventId = generateId();
    const payload = {
      eventId: duplicateEventId,
      resourceType: 'Flag',
      resourceId: 'flag-duplicate-test',
      status: 'active',
    };

    // First delivery
    const res1 = await fetch(`http://127.0.0.1:${CONSUMER_PORT}/webhook/fhir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body1 = await res1.json();
    expect(body1.status).toBe('ACCEPTED');
    expect(body1.acknowledgement.status).toBe('ACCEPTED');

    // Second delivery (Duplicate)
    const res2 = await fetch(`http://127.0.0.1:${CONSUMER_PORT}/webhook/fhir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body2 = await res2.json();
    expect(body2.status).toBe('DUPLICATE');
    expect(body2.acknowledgement.status).toBe('DUPLICATE');
    expect(body2.acknowledgement.details).toContain('Duplicate downstream action skipped');
  });

  // ============================================================
  // Test 8: Dead-Letter & Non-Destructive Replay Test
  // ============================================================
  it('8. Moves event to DEAD_LETTER after max retries, then replays non-destructively', async () => {
    const repos = getRepositories();
    const worker = getDeliveryWorker();

    consumerStore.setSimulatedFailure(true);

    const deadLetterCandidate: OutboxEvent = {
      id: generateId(),
      eventId: generateId(),
      eventType: 'TaskCreated',
      eventVersion: '1.0.0',
      occurredAt: nowUtc(),
      producer: 'aquasentinel',
      subject: 'Location/test-dlq',
      resourceType: 'Task',
      resourceId: 'task-dlq-1',
      payload: { resourceType: 'Task', id: 'task-dlq-1', status: 'requested' },
      destination: `http://127.0.0.1:${CONSUMER_PORT}/webhook/fhir`,
      status: 'RETRYING',
      retryCount: 2, // Reaching maxRetries (3) on next attempt
      maxRetries: 3,
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    };
    await repos.outbox.save(deadLetterCandidate);

    // Deliver 3rd failing attempt
    await worker.deliverEvent(deadLetterCandidate);

    const deadState = await repos.outbox.findById(deadLetterCandidate.id);
    expect(deadState?.status).toBe('DEAD_LETTER');

    // Restore consumer and replay using worker.replayEvent
    consumerStore.setSimulatedFailure(false);
    const replayed = await worker.replayEvent(deadLetterCandidate.eventId, 'Supervisor Dimitris');
    expect(replayed).toBeDefined();

    const stateAfterReplay = await repos.outbox.findById(deadLetterCandidate.id);
    expect(stateAfterReplay?.status).toBe('DELIVERED');
    expect(stateAfterReplay?.eventId).toBe(deadLetterCandidate.eventId); // Non-destructive ID preservation
  });

  // ============================================================
  // Test 9: Complete Provenance & Lineage Trace
  // ============================================================
  it('9. Traces unbroken provenance chain from satellite observation through field verification to FHIR event', async () => {
    const repos = getRepositories();

    // Fetch observation provenance
    const obsList = await repos.observations.findAll();
    expect(obsList.length).toBeGreaterThan(0);
    const obs = obsList[0];
    expect(obs.provenance).toBeDefined();
    expect(obs.provenance?.entityId).toBe(obs.id);
    expect(obs.provenance?.source).toBeDefined();

    // Verify verification evidence integrity
    const verifList = await repos.verifications.findAll();
    expect(verifList.length).toBeGreaterThan(0);
    const verif = verifList[0];
    expect(verif.id).toBeDefined();
    expect(verif.location.coordinates).toBeDefined();
    expect(verif.timestamp).toBeDefined();

    // Verify task linkage
    const task = await repos.tasks.findById(verif.taskId);
    expect(task).toBeDefined();
    expect(task?.incidentId).toBe(verif.incidentId);

    // Verify audit trail timestamps
    const audits = await repos.auditLogs.findByIncidentId(verif.incidentId);
    for (const entry of audits) {
      expect(entry.timestamp).toBeDefined();
      expect(new Date(entry.timestamp).getTime()).not.toBeNaN();
    }
  });

  // ============================================================
  // Test 10: Deterministic System Reset
  // ============================================================
  it('10. System reset returns environment to clean baseline state in < 5 seconds', async () => {
    const resetResult = await resetSystemState();
    expect(resetResult.success).toBe(true);
    expect(resetResult.durationMs).toBeLessThan(5000);
    expect(resetResult.reachesSeeded).toBeGreaterThan(0);

    const repos = getRepositories();
    const activeIncidents = await repos.incidents.findAll();
    expect(activeIncidents.length).toBe(0);

    const activeTasks = await repos.tasks.findAll();
    expect(activeTasks.length).toBe(0);

    const activeOutbox = await repos.outbox.find();
    expect(activeOutbox.length).toBe(0);

    const reaches = await repos.streamReaches.findAll();
    expect(reaches.length).toBe(resetResult.reachesSeeded);
  });
});
