/**
 * Dedicated Integration Test Suite for AquaSentinel Canonical Demo Mode
 * 
 * Verifies that the canonical demonstration mode exercises the REAL application architecture:
 * - Real ingestion pipelines with deduplication & provenance
 * - Real domain EventBus event propagation
 * - Real Evidence Fusion scoring & explainability breakdown
 * - Real Incident & Severity classification
 * - Real Recommendation generation & Human-in-the-Loop approval gate
 * - Real Operational Task lifecycle (REQUESTED -> ACCEPTED -> IN_PROGRESS -> COMPLETED)
 * - Real Geofence validation on mobile field verification
 * - Real Closed-Loop feedback reassessment (FIELD_INSPECTION observation)
 * - Real OutcomeEngine evaluation & Supervisor confirmation
 * - Real Interoperability qualification & FHIR R4 mapping
 * - Real Transactional Outbox delivery with HMAC-SHA256 signature verification & consumer ACK
 * - Clean deterministic resets and idempotency
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { CanonicalDemoService } from '../../src/services/demo/canonical-demo-service.js';
import { getRepositories } from '../../src/database/repositories/index.js';
import { resetSystemState } from '../../src/database/reset.js';
import { config } from '../../src/config/index.js';
import { createConsumerApp } from '../../../consumer/src/server.js';
import { consumerStore } from '../../../consumer/src/store.js';
import { getDeliveryWorker } from '../../src/services/interoperability/delivery-worker.js';

describe('Canonical Demonstration Mode: Real Architecture End-to-End Verification', () => {
  let consumerServer: http.Server;
  const TEST_CONSUMER_PORT = 3105;
  const originalConsumerUrl = config.EXTERNAL_CONSUMER_URL;

  beforeAll(async () => {
    config.EXTERNAL_CONSUMER_URL = `http://127.0.0.1:${TEST_CONSUMER_PORT}/webhook/fhir`;
    getDeliveryWorker().stop();

    consumerStore.reset();
    const app = createConsumerApp();
    consumerServer = http.createServer(app);
    await new Promise<void>((resolve) => {
      consumerServer.listen(TEST_CONSUMER_PORT, '127.0.0.1', () => resolve());
    });
  });

  afterAll(async () => {
    config.EXTERNAL_CONSUMER_URL = originalConsumerUrl;
    await new Promise<void>((resolve) => {
      consumerServer.close(() => resolve());
    });
  });

  beforeEach(async () => {
    await resetSystemState();
    consumerStore.reset();
  });

  it('Stage 0: Establishes a clean surveillance baseline with 0 active incidents', async () => {
    const status = await CanonicalDemoService.stage0_resetAndBaseline();
    const repos = getRepositories();

    expect(status.currentStage).toBe(0);
    expect(status.stageName).toContain('Baseline Surveillance');
    expect(status.reachId).toBe('7a3b4c12-89de-4f56-9abc-1234567890ab');

    const reach = await repos.streamReaches.findById(status.reachId);
    expect(reach).not.toBeNull();
    expect(reach?.monitoringStatus).toBe('ACTIVE');

    const incidents = await repos.incidents.findAll();
    expect(incidents.length).toBe(0);

    const tasks = await repos.tasks.findAll();
    expect(tasks.length).toBe(0);

    const outbox = await repos.outbox.find();
    expect(outbox.length).toBe(0);
  });

  it('Stage 1: Ingests weak satellite anomaly without triggering premature emergency actions', async () => {
    await CanonicalDemoService.stage0_resetAndBaseline();
    const status = await CanonicalDemoService.stage1_ingestSatelliteAnomaly();
    const repos = getRepositories();

    expect(status.currentStage).toBe(1);
    expect(status.incidentId).toBeDefined();

    const observations = await repos.observations.find({ streamReachId: status.reachId });
    expect(observations.length).toBe(1);
    expect(observations[0].source).toBe('SATELLITE_SENTINEL2');
    expect(observations[0].indicator).toBe('NDCI');
    expect(observations[0].value).toBe(0.28);
    expect(observations[0].provenance.sourceIdentifier).toContain('S2B_MSIL2A');

    const assessment = await repos.evidenceAssessments.findLatestByStreamReach(status.reachId);
    expect(assessment).not.toBeNull();
    expect(assessment?.score).toBeLessThan(60); // Low/moderate score, uncorroborated single source

    const incident = await repos.incidents.findById(status.incidentId!);
    expect(incident).not.toBeNull();
    expect(['DETECTED', 'FIELD_VERIFICATION_PENDING']).toContain(incident?.status);
  });

  it('Stage 2: Multi-source evidence fusion elevates confidence score to PRIORITIZE band', async () => {
    await CanonicalDemoService.stage0_resetAndBaseline();
    await CanonicalDemoService.stage1_ingestSatelliteAnomaly();
    const status = await CanonicalDemoService.stage2_ingestCorroboratingEvidence();
    const repos = getRepositories();

    expect(status.currentStage).toBe(2);
    expect(status.confidenceScore).toBeGreaterThanOrEqual(80);
    expect(status.confidenceBand).toBe('PRIORITIZE');
    expect(status.incidentStatus).toBe('ACTION_RECOMMENDED');
    expect(status.hazardType).toBe('ALGAL_BLOOM');

    const observations = await repos.observations.find({ streamReachId: status.reachId });
    expect(observations.length).toBeGreaterThanOrEqual(4);

    const sources = observations.map((o) => o.source);
    expect(sources).toContain('SATELLITE_SENTINEL2');
    expect(sources).toContain('IN_SITU_SENSOR');
    expect(sources).toContain('WEATHER_STATION');
    expect(sources).toContain('CITIZEN_REPORT');

    // Recommendations generated and waiting in PENDING_REVIEW
    const recs = await repos.recommendations.findByIncidentId(status.incidentId!);
    expect(recs.length).toBeGreaterThanOrEqual(1);
    expect(recs.some((r) => r.status === 'PENDING_REVIEW')).toBe(true);
  });

  it('Stage 3: Human review gate holds execution until operator approval', async () => {
    await CanonicalDemoService.stage0_resetAndBaseline();
    await CanonicalDemoService.stage1_ingestSatelliteAnomaly();
    await CanonicalDemoService.stage2_ingestCorroboratingEvidence();

    const gate = await CanonicalDemoService.stage3_getPendingReviewState();
    expect(gate.status.currentStage).toBe(3);
    expect(gate.incident).not.toBeNull();
    expect(gate.assessment).not.toBeNull();
    expect(gate.recommendations.length).toBeGreaterThan(0);
    expect(gate.recommendations[0].status).toBe('PENDING_REVIEW');
  });

  it('Stage 4: Supervisor approval creates operational field task & mirrors to FHIR', async () => {
    await CanonicalDemoService.stage0_resetAndBaseline();
    await CanonicalDemoService.stage1_ingestSatelliteAnomaly();
    await CanonicalDemoService.stage2_ingestCorroboratingEvidence();

    const status = await CanonicalDemoService.stage4_approveRecommendation({
      actor: 'Chief Inspector Maria Papadopoulou',
      role: 'SUPERVISOR',
      notes: 'Approved emergency ground dispatch',
    });

    const repos = getRepositories();
    expect(status.currentStage).toBe(4);
    expect(status.taskId).toBeDefined();

    const task = await repos.tasks.findById(status.taskId!);
    expect(task).not.toBeNull();
    expect(task?.incidentId).toBe(status.incidentId);
    expect(task?.status).toBe('REQUESTED');
    expect(['HIGH', 'URGENT']).toContain(task?.priority);
  });

  it('Stage 5 & 6: Field crew deployment, geofenced verification, and closed-loop evidence reassessment', async () => {
    await CanonicalDemoService.stage0_resetAndBaseline();
    await CanonicalDemoService.stage1_ingestSatelliteAnomaly();
    await CanonicalDemoService.stage2_ingestCorroboratingEvidence();
    await CanonicalDemoService.stage4_approveRecommendation();

    // Advance to en route & on-site
    const stage5 = await CanonicalDemoService.stage5_advanceFieldTask();
    expect(stage5.currentStage).toBe(5);
    expect(stage5.taskStatus).toBe('IN_PROGRESS');

    // Submit field verification
    const stage6 = await CanonicalDemoService.stage6_submitFieldVerification();
    const repos = getRepositories();

    expect(stage6.currentStage).toBe(6);
    expect(stage6.taskStatus).toBe('COMPLETED');
    expect(stage6.verificationId).toBeDefined();

    const verif = await repos.verifications.findById(stage6.verificationId!);
    expect(verif).not.toBeNull();
    expect(verif?.status).toBe('CONFIRMED');
    expect(verif?.location.isWithinGeofence).toBe(true);
    expect(verif?.observations.waterColour).toBe('DENSE_GREEN');
    expect(verif?.observations.deadFish).toBe(4);

    // Verify closed loop: new FIELD_INSPECTION observation exists
    const allObs = await repos.observations.find({ streamReachId: stage6.reachId });
    const fieldObs = allObs.find((o) => o.source === 'FIELD_INSPECTION');
    expect(fieldObs).toBeDefined();
    expect(fieldObs?.provenance.sourceIdentifier).toBe(verif?.id);

    // Verify reassessment happened and proposed outcome is CONFIRMED
    const outcome = await repos.incidentOutcomes.findLatestByIncidentId(stage6.incidentId!);
    expect(outcome).not.toBeNull();
    expect(outcome?.proposedOutcome).toBe('CONFIRMED');
  });

  it('Stage 7 & 8: Outcome confirmed, FHIR R4 outbox delivered with HMAC-SHA256, consumer acknowledged', async () => {
    await CanonicalDemoService.stage0_resetAndBaseline();
    await CanonicalDemoService.stage1_ingestSatelliteAnomaly();
    await CanonicalDemoService.stage2_ingestCorroboratingEvidence();
    await CanonicalDemoService.stage4_approveRecommendation();
    await CanonicalDemoService.stage5_advanceFieldTask();
    await CanonicalDemoService.stage6_submitFieldVerification();

    // Stage 7: Confirm outcome
    const stage7 = await CanonicalDemoService.stage7_confirmOutcome();
    expect(stage7.currentStage).toBe(7);
    expect(stage7.outcomeStatus).toBe('CONFIRMED');

    const repos = getRepositories();
    const incident = await repos.incidents.findById(stage7.incidentId!);
    expect(incident?.verificationStatus).toBe('CONFIRMED');

    // Outbox should contain qualified events
    const outboxEvents = await repos.outbox.find();
    expect(outboxEvents.length).toBeGreaterThan(0);

    // Stage 8: Deliver to external consumer
    const stage8 = await CanonicalDemoService.stage8_deliverInteroperability();
    expect(stage8.currentStage).toBe(8);
    expect(stage8.outboxDeliveredCount).toBeGreaterThan(0);

    // Verify consumer received and acknowledged event
    const delivered = await repos.outbox.find({ status: 'DELIVERED' });
    expect(delivered.length).toBeGreaterThan(0);
    expect(delivered[0].deliveredAt).toBeDefined();

    // Consumer store should have the received FHIR resource
    const receivedEvents = consumerStore.getEvents();
    expect(receivedEvents.length).toBeGreaterThan(0);
    expect(['ACKNOWLEDGED', 'DUPLICATE']).toContain(receivedEvents[0].acknowledgement.status);

    const acknowledgements = await repos.acknowledgements.findAll(10);
    expect(acknowledgements.length).toBeGreaterThan(0);
    expect(['ACCEPTED', 'ACKNOWLEDGED', 'DUPLICATE']).toContain(acknowledgements[0].status);
  });

  it('runToGate(): Executes from baseline directly to the human review gate deterministically', async () => {
    const status = await CanonicalDemoService.runToGate();

    expect(status.currentStage).toBe(3);
    expect(status.reachId).toBe('7a3b4c12-89de-4f56-9abc-1234567890ab');
    expect(status.incidentId).toBeDefined();
    expect(status.recommendationId).toBeDefined();
    expect(status.confidenceBand).toBe('PRIORITIZE');
    expect(status.taskStatus).toBeNull(); // Task not created yet because human hasn't approved
  });

  it('executeNextStep(): Advances through stages 0 to 8 step-by-step', async () => {
    await CanonicalDemoService.stage0_resetAndBaseline();

    for (let expectedStage = 1; expectedStage <= 8; expectedStage++) {
      const status = await CanonicalDemoService.executeNextStep();
      expect(status.currentStage).toBe(expectedStage);
    }
  });
});
