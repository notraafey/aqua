import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/api/server.js';
import { setRepositories, createRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';
import { getOperationalResponseService } from '../../src/services/response/operational-response-service.js';
import { Task } from '@aquasentinel/shared';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';

describe('Operational Tasks Lifecycle & FHIR API Integration Tests', () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();
    const service = getOperationalResponseService();
    await service.initialize();
    app = createServer();
  });

  const createTestTask = async (): Promise<Task> => {
    const repos = (await import('../../src/database/repositories/index.js')).getRepositories();
    const now = nowUtc();
    const task: Task = {
      id: generateId(),
      incidentId: 'inc-task-01',
      recommendationId: 'rec-task-01',
      assessmentId: 'eval-task-01',
      taskType: 'FIELD_INVESTIGATION',
      title: 'Collect stream bank samples',
      assignedRole: 'ENVIRONMENTAL_INSPECTOR',
      assignedTo: 'Inspector Alex Rivera',
      location: {
        type: 'Point',
        coordinates: [25.132, 35.338],
      },
      priority: 'HIGH',
      status: 'REQUESTED',
      instructions: 'Collect water samples at upstream and downstream transects.',
      requiredEvidence: ['Grab sample ID', 'Field photo'],
      createdAt: now,
    };

    return repos.tasks.create(task);
  };

  it('GET /api/v1/tasks returns list of tasks', async () => {
    const task = await createTestTask();
    const res = await request(app).get('/api/v1/tasks');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some((t: any) => t.id === task.id)).toBe(true);
  });

  it('executes full task lifecycle transitions with audit log: Requested -> Accepted -> In Progress -> Completed -> Verified', async () => {
    const task = await createTestTask();

    // 1. Accept Task
    const acceptRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/accept`)
      .send({ actor: 'Field Dispatch Lead', notes: 'Dispatched crew to location' });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.status).toBe('ACCEPTED');

    // 2. Start Task
    const startRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/start`)
      .send({ actor: 'Alex Rivera', notes: 'Arrived on-site and initiated probe telemetry' });
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe('IN_PROGRESS');

    // 3. Complete Task
    const completeRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/complete`)
      .send({ actor: 'Alex Rivera', notes: 'Grab samples secured in cooler. DO reading: 2.1 mg/L.' });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe('COMPLETED');

    // 4. Verify Task
    const verifyRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/verify`)
      .send({ actor: 'Supervisor Chen', notes: 'Chain of custody verified with municipal lab.' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('VERIFIED');

    // 5. Inspect Audit Trail
    const auditRes = await request(app).get(`/api/v1/tasks/${task.id}/audit-trail`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.success).toBe(true);
    expect(auditRes.body.data.length).toBeGreaterThanOrEqual(4);

    // 6. Inspect FHIR Task resource
    const fhirRes = await request(app).get(`/api/v1/tasks/${task.id}/fhir`);
    expect(fhirRes.status).toBe(200);
    expect(fhirRes.body.success).toBe(true);
    expect(fhirRes.body.data.resourceType).toBe('Task');
    expect(fhirRes.body.data.status).toBe('completed');
  });

  it('allows task cancellation with documented reason', async () => {
    const task = await createTestTask();

    const cancelRes = await request(app)
      .post(`/api/v1/tasks/${task.id}/cancel`)
      .send({ actor: 'Supervisor Chen', reason: 'False alarm confirmed by upstream telemetry' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const auditRes = await request(app).get(`/api/v1/tasks/${task.id}/audit-trail`);
    expect(auditRes.body.data.some((ev: any) => ev.newStatus === 'CANCELLED')).toBe(true);
  });
});
