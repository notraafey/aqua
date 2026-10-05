import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/api/server.js';
import { setRepositories, createRepositories, getRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';

describe('Incident Detail & Timeline API', () => {
  let app: ReturnType<typeof createServer>;
  let testIncidentId: string;
  let testReachId: string;

  beforeAll(async () => {
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();
    app = createServer();

    const repos = getRepositories();
    const reaches = await repos.streamReaches.findAll();
    testReachId = reaches[0]?.id || '7a3b4c12-89de-4f56-9abc-1234567890ab';

    // Create a test incident
    testIncidentId = generateId();
    await repos.incidents.create({
      id: testIncidentId,
      streamReachId: testReachId,
      hazardType: 'ALGAL_BLOOM',
      evidenceConfidence: 82,
      severity: 'HIGH',
      status: 'ACTION_RECOMMENDED',
      verificationStatus: 'UNVERIFIED',
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    });

    // Create a linked task
    const taskId = generateId();
    await repos.tasks.create({
      id: taskId,
      incidentId: testIncidentId,
      title: 'Field Verification Deployment',
      instructions: 'Deploy water sensor probe at Reach Alpha',
      assignedTo: 'Officer Dimitriou',
      assignedRole: 'ENVIRONMENTAL_INSPECTOR',
      location: { type: 'Point', coordinates: [22.7535, 39.1812] },
      priority: 'HIGH',
      status: 'ACCEPTED',
      acceptedAt: nowUtc(),
      createdAt: nowUtc(),
    });

    // Create an audit log
    await repos.auditLogs.log({
      id: generateId(),
      incidentId: testIncidentId,
      taskId,
      eventType: 'TASK_ACCEPTED',
      actor: 'Officer Dimitriou',
      timestamp: nowUtc(),
      previousStatus: 'REQUESTED',
      newStatus: 'ACCEPTED',
      reason: 'Officer acknowledged field dispatch',
    });
  });

  it('GET /api/v1/incidents/:id returns incident details', async () => {
    const res = await request(app).get(`/api/v1/incidents/${testIncidentId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testIncidentId);
    expect(res.body.data.hazardType).toBe('ALGAL_BLOOM');
    expect(res.body.data.severity).toBe('HIGH');
  });

  it('GET /api/v1/incidents/:id/evidence returns evidence array and assessment metadata', async () => {
    const res = await request(app).get(`/api/v1/incidents/${testIncidentId}/evidence`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/incidents/:id/recommendations returns associated recommendations', async () => {
    const res = await request(app).get(`/api/v1/incidents/${testIncidentId}/recommendations`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/incidents/:id/timeline returns chronological event log', async () => {
    const res = await request(app).get(`/api/v1/incidents/${testIncidentId}/timeline`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);

    // Verify presence of incident and task events
    const categories = res.body.data.map((item: any) => item.category);
    expect(categories).toContain('INCIDENT');
    expect(categories).toContain('TASK');
  });
});
