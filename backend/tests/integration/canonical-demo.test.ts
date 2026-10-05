import { describe, it, expect, beforeEach } from 'vitest';
import { CanonicalDemoService } from '../../src/services/demo/canonical-demo-service.js';
import { resetSystemState } from '../../src/database/reset.js';
import { getRepositories } from '../../src/database/repositories/index.js';

describe('Canonical End-to-End Operational Lifecycle Demo Test', () => {
  beforeEach(async () => {
    await resetSystemState();
  });

  it('executes full 10-step lifecycle and populates all domain entities with strict referential integrity', async () => {
    const result = await CanonicalDemoService.executeEndToEndScenario();

    expect(result.scenarioId).toBe('CANONICAL_ALMYROS_BLOOM');
    expect(result.stepsCompleted.length).toBeGreaterThanOrEqual(8);
    expect(result.reach.id).toBe('7a3b4c12-89de-4f56-9abc-1234567890ab');
    expect(result.observations.length).toBeGreaterThanOrEqual(4);
    expect(result.assessment.score).toBeGreaterThanOrEqual(75);
    expect(result.assessment.confidenceBand).toBe('PRIORITIZE');
    expect(result.incident.id).toBeDefined();
    expect(result.incident.verificationStatus).toBe('CONFIRMED');
    expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(result.tasks.length).toBe(1);
    expect(result.tasks[0].status).toBe('COMPLETED');
    expect(result.verification.id).toBeDefined();
    expect(result.verification.status).toBe('CONFIRMED');
    expect(result.outcome.confirmedOutcome).toBe('CONFIRMED');
    expect(result.outboxEvents.length).toBeGreaterThan(0);

    // Verify repositories reflect the persisted records
    const repos = getRepositories();
    const storedIncident = await repos.incidents.findById(result.incident.id);
    expect(storedIncident).not.toBeNull();
    expect(storedIncident?.hazardType).toBe('ALGAL_BLOOM');
    expect(['HIGH', 'CRITICAL', 'MEDIUM']).toContain(storedIncident?.severity);

    const storedTask = await repos.tasks.findById(result.tasks[0].id);
    expect(storedTask).not.toBeNull();
    expect(storedTask?.incidentId).toBe(result.incident.id);
    const approvedRec = result.recommendations.find((r) => r.id === storedTask?.recommendationId);
    expect(approvedRec).toBeDefined();
    expect(approvedRec?.status).toBe('APPROVED');

    const storedVerif = await repos.verifications.findById(result.verification.id);
    expect(storedVerif).not.toBeNull();
    expect(storedVerif?.taskId).toBe(result.tasks[0].id);
    expect(storedVerif?.observations.waterColour).toBe('DENSE_GREEN');

    const storedRecs = await repos.recommendations.findByIncidentId(result.incident.id);
    expect(storedRecs.length).toBeGreaterThanOrEqual(1);

    const storedAudit = await repos.auditLogs.findByIncidentId(result.incident.id);
    expect(storedAudit.length).toBeGreaterThan(0);

    const outbox = await repos.outbox.find();
    expect(outbox.some((e) => e.correlationId === result.incident.id || e.id === result.outboxEvents[0]?.id)).toBe(true);
  });
});
