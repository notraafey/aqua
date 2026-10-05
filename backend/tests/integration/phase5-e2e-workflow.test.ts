import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/api/server.js';
import { setRepositories, createRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';

describe('Phase 5 Municipal Command Console E2E Golden Path', () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();
    app = createServer();
  });

  it('executes full golden path: Scenario A -> Dashboard -> Evidence -> Recommendation Approval -> FHIR Task Lifecycle -> Timeline', async () => {
    // 1. Execute deterministic Scenario A (Krafsidonas Algal Surge)
    const demoRes = await request(app)
      .post('/api/v1/demo/scenarios/A/execute')
      .send({});

    expect(demoRes.status).toBe(200);
    expect(demoRes.body.success).toBe(true);
    const demoData = demoRes.body.data;
    expect(demoData.scenarioId).toBe('A');
    expect(['CRITICAL', 'HIGH']).toContain(demoData.severityLevel);
    expect(demoData.evidenceScore).toBeGreaterThan(40);
    expect(demoData.recommendations.length).toBeGreaterThan(0);

    // 2. Query Dashboard Summary API
    const dashRes = await request(app).get('/api/v1/dashboard/summary');
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.activeIncidentsCount).toBeGreaterThanOrEqual(1);
    expect(dashRes.body.data.highPriorityIncidentsCount).toBeGreaterThanOrEqual(1);
    expect(dashRes.body.data.environmentalReachesMonitoredCount).toBeGreaterThanOrEqual(2);

    // 3. Find created incident
    const incsRes = await request(app).get('/api/v1/incidents');
    expect(incsRes.status).toBe(200);
    const incident = incsRes.body.data.find(
      (i: any) => i.hazardType === 'INDUSTRIAL_DISCHARGE' || i.hazardType === 'SEWAGE_OVERFLOW' || i.evidenceConfidence > 60
    ) || incsRes.body.data[0];
    expect(incident).toBeDefined();
    expect(incident.id).toBeDefined();

    // 4. Query Incident Timeline
    const timelineRes = await request(app).get(`/api/v1/incidents/${incident.id}/timeline`);
    expect(timelineRes.status).toBe(200);
    expect(timelineRes.body.success).toBe(true);
    expect(Array.isArray(timelineRes.body.data)).toBe(true);
    expect(timelineRes.body.data.length).toBeGreaterThanOrEqual(1);

    // 5. Query Recommendations for the Incident
    const recsRes = await request(app).get(`/api/v1/incidents/${incident.id}/recommendations`);
    expect(recsRes.status).toBe(200);
    expect(recsRes.body.success).toBe(true);
    expect(recsRes.body.data.length).toBeGreaterThan(0);

    const targetRec = recsRes.body.data[0];
    expect(targetRec.status).toBe('PENDING_REVIEW');
    expect(targetRec.suitabilityScore).toBeGreaterThan(0);
    expect(targetRec.scoreBreakdown).toBeDefined();
    expect(typeof targetRec.scoreBreakdown.evidenceCompatibility).toBe('number');
    expect(typeof targetRec.scoreBreakdown.operationalFeasibility).toBe('number');

    // 6. Human Review: Approve Recommendation
    const approveRes = await request(app)
      .post(`/api/v1/recommendations/${targetRec.id}/approve`)
      .send({
        actor: 'Municipal Environmental Director',
        assignedTo: 'Rapid Remediation Unit Alpha',
        notes: 'Approved under emergency municipal protocol for immediate deployment.',
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.data.recommendation.status).toBe('APPROVED');
    expect(approveRes.body.data.task).toBeDefined();

    const task = approveRes.body.data.task;
    expect(task.status).toBe('REQUESTED');
    expect(task.fhirTaskId).toBeDefined();
    expect(task.assignedTo).toBe('Rapid Remediation Unit Alpha');

    // 7. Complete Task Lifecycle State Transitions
    // REQUESTED -> ACCEPTED
    const acceptRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/accept`)
      .send({ actor: 'Unit Alpha Lead', notes: 'Deployment dispatched to reach coordinates.' });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.status).toBe('ACCEPTED');

    // ACCEPTED -> IN_PROGRESS
    const startRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/start`)
      .send({ actor: 'Unit Alpha Lead', notes: 'Boom barriers deployed across channel.' });
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe('IN_PROGRESS');

    // IN_PROGRESS -> COMPLETED
    const completeRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/complete`)
      .send({ actor: 'Unit Alpha Lead', notes: 'Containment verified, turbidity samples collected.' });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe('COMPLETED');

    // COMPLETED -> VERIFIED
    const verifyRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/verify`)
      .send({
        actor: 'Municipal Environmental Inspector',
        notes: 'Independent site audit confirmed effective containment.',
        verificationResult: 'CONFIRMED',
      });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('VERIFIED');
    expect(verifyRes.body.data.verifiedAt).toBeDefined();

    // 8. Verify Timeline now includes the task progression
    const finalTimelineRes = await request(app).get(`/api/v1/incidents/${incident.id}/timeline`);
    expect(finalTimelineRes.status).toBe(200);
    const eventTypes = finalTimelineRes.body.data.map((t: any) => t.eventType || t.category || '');
    expect(eventTypes.some((t: string) => t.includes('Task') || t.includes('Incident') || t.includes('INCIDENT') || t.includes('TASK'))).toBe(true);

    // 9. Verify Real-time SSE status endpoint
    const sseStatusRes = await request(app).get('/api/v1/events/status');
    expect(sseStatusRes.status).toBe(200);
    expect(sseStatusRes.body.success).toBe(true);
    expect(typeof sseStatusRes.body.data.connectedClients).toBe('number');
  });
});
