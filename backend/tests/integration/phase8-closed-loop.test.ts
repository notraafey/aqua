import { describe, it, expect, beforeAll } from 'vitest';
import { setRepositories, createRepositories, getRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';
import { getOperationalResponseService, SubmitVerificationInput } from '../../src/services/response/operational-response-service.js';
import { Phase8DemoRunner } from '../../src/domain/response/demo-scenarios-phase8.js';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';
import { Incident, Task } from '@aquasentinel/shared';

describe('Phase 8: Closed-Loop Field Response Integration Tests', () => {
  beforeAll(async () => {
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();
    const service = getOperationalResponseService();
    service.initialize();
  });

  it('executes Scenario A (Confirmed Contamination) end-to-end', async () => {
    const result = await Phase8DemoRunner.runScenarioA_Confirmed();

    expect(result.scenario).toBe('A');
    expect(result.incidentId).toBeDefined();
    expect(result.taskId).toBeDefined();
    expect(result.verificationId).toBeDefined();
    expect(result.outcomeId).toBeDefined();
    expect(result.proposedOutcome).toBe('CONFIRMED');
    expect(result.confirmedOutcome).toBe('CONFIRMED');

    // Verify repository records
    const repos = getRepositories();
    const incident = await repos.incidents.findById(result.incidentId);
    expect(incident).toBeDefined();
    expect(incident?.verificationStatus).toBe('CONFIRMED');

    const verification = await repos.verifications.findById(result.verificationId);
    expect(verification).toBeDefined();
    expect(verification?.status).toBe('CONFIRMED');
    expect(verification?.observations.visibleAlgae).toBe(true);
    expect(verification?.evidence?.photos?.length).toBeGreaterThan(0);

    const outcomes = await repos.incidentOutcomes.findByIncidentId(result.incidentId);
    expect(outcomes.length).toBeGreaterThan(0);
    expect(outcomes[0].confirmedOutcome).toBe('CONFIRMED');
  });

  it('executes Scenario B (False Alarm / Not Confirmed) end-to-end', async () => {
    const result = await Phase8DemoRunner.runScenarioB_NotConfirmed();

    expect(result.scenario).toBe('B');
    expect(result.proposedOutcome).toBe('NOT_CONFIRMED');
    expect(result.confirmedOutcome).toBe('NOT_CONFIRMED');

    const repos = getRepositories();
    const incident = await repos.incidents.findById(result.incidentId);
    expect(incident).toBeDefined();
    expect(incident?.verificationStatus).toBe('NOT_CONFIRMED');
  });

  it('executes Scenario C (Uncertain / Follow-Up) end-to-end', async () => {
    const result = await Phase8DemoRunner.runScenarioC_Uncertain();

    expect(result.scenario).toBe('C');
    expect(result.proposedOutcome).toBe('ADDITIONAL_VERIFICATION_REQUIRED');
    expect(result.confirmedOutcome).toBe('ADDITIONAL_VERIFICATION_REQUIRED');
    expect(result.followUpTaskId).toBeDefined();

    const repos = getRepositories();
    const followUpTask = await repos.tasks.findById(result.followUpTaskId);
    expect(followUpTask).toBeDefined();
    expect(followUpTask?.incidentId).toBe(result.incidentId);
    expect(followUpTask?.title).toContain('Secondary water sampling');
  });

  it('enforces idempotency on duplicate verification clientSubmissionId', async () => {
    const repos = getRepositories();
    const service = getOperationalResponseService();
    const now = nowUtc();

    const reaches = await repos.streamReaches.findAll();
    const targetReach = reaches[0];
    const targetReachId = targetReach?.id || '7a3b4c12-89de-4f56-9abc-1234567890ab';
    const coords = targetReach?.geometry?.coordinates?.[0] || [22.7535, 39.1812];
    const reachLocation: GeoJsonPoint = { type: 'Point', coordinates: [coords[0], coords[1]] };

    const incident: Incident = {
      id: generateId(),
      streamReachId: targetReachId,
      severity: 'HIGH',
      status: 'FIELD_VERIFICATION_PENDING',
      hazardType: 'ALGAL_BLOOM',
      evidenceConfidence: 70,
      verificationStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    await repos.incidents.create(incident);

    const task: Task = {
      id: generateId(),
      incidentId: incident.id,
      taskType: 'FIELD_INSPECTION' as any,
      title: 'Idempotency test task',
      assignedTo: 'Alex Rivera',
      location: reachLocation,
      priority: 'HIGH',
      instructions: 'Inspect and test idempotency',
      status: 'IN_PROGRESS',
      createdAt: now,
    };
    await repos.tasks.create(task);

    const clientSubmissionId = `idempotency-test-${generateId()}`;

    const submissionInput: SubmitVerificationInput = {
      taskId: task.id,
      inspector: { name: 'Alex Rivera', role: 'FIELD_INSPECTOR' },
      location: { ...reachLocation, accuracyMeters: 10 },
      status: 'CONFIRMED',
      observations: {
        waterColour: 'GREEN',
        foam: true,
      },
      notes: 'Initial submission',
      clientSubmissionId,
    };

    // First submission: should succeed normally
    const firstResult = await service.submitVerification(submissionInput);
    expect(firstResult.duplicate).toBeFalsy();
    expect(firstResult.verification.clientSubmissionId).toBe(clientSubmissionId);

    // Duplicate submission with same clientSubmissionId: should return existing without re-processing
    const secondResult = await service.submitVerification(submissionInput);
    expect(secondResult.duplicate).toBe(true);
    expect(secondResult.verification.id).toBe(firstResult.verification.id);
  });
});
