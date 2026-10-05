import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createConsumerApp } from '../src/server.js';
import { consumerStore } from '../src/store.js';

describe('External Consumer (Volos Public Health Portal)', () => {
  const app = createConsumerApp();

  beforeEach(() => {
    consumerStore.reset();
  });

  it('GET /health returns healthy status and metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.consumerId).toBe('volos-public-health-portal');
    expect(res.body.status).toBe('healthy');
  });

  it('POST /webhook/fhir processes valid FHIR Flag resource and returns ACCEPTED', async () => {
    const eventId = '11111111-2222-3333-4444-555555555555';
    const payload = {
      eventId,
      eventType: 'IncidentCreated',
      resourceType: 'Flag',
      resourceId: 'inc-volos-1',
      resource: {
        resourceType: 'Flag',
        id: 'inc-volos-1',
        status: 'active',
        code: {
          coding: [
            { system: 'https://oneaquahealth.eu/fhir/hazards', code: 'algal_bloom', display: 'Algal Bloom' },
          ],
        },
        subject: { reference: 'Location/krafsidonas-1' },
      },
    };

    const res = await request(app)
      .post('/webhook/fhir')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACCEPTED');
    expect(res.body.acknowledgement).toBeDefined();
    expect(res.body.acknowledgement.eventId).toBe(eventId);
    expect(res.body.acknowledgement.status).toBe('ACCEPTED');
    expect(res.body.downstreamActionTaken).toContain('PUBLIC_HEALTH_ADVISORY');

    const stored = consumerStore.getEventById(eventId);
    expect(stored).toBeDefined();
    expect(stored?.isDuplicate).toBe(false);
  });

  it('Deduplicates identical events sent twice (Idempotency Rule)', async () => {
    const eventId = '22222222-3333-4444-5555-666666666666';
    const payload = {
      eventId,
      eventType: 'TaskCreated',
      resourceType: 'Task',
      resourceId: 'task-inspect-1',
      resource: {
        resourceType: 'Task',
        id: 'task-inspect-1',
        status: 'requested',
        intent: 'order',
      },
    };

    // First delivery -> ACCEPTED
    const res1 = await request(app).post('/webhook/fhir').send(payload);
    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('ACCEPTED');

    // Second delivery -> DUPLICATE
    const res2 = await request(app).post('/webhook/fhir').send(payload);
    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('DUPLICATE');
    expect(res2.body.acknowledgement.status).toBe('DUPLICATE');

    const stats = consumerStore.getStats();
    expect(stats.unique).toBe(1);
    expect(stats.duplicate).toBe(1);
    expect(stats.total).toBe(2);
  });

  it('Handles simulated service failure and recovery', async () => {
    // 1. Enable failure mode
    await request(app).post('/simulate-failure').send({ continuous: true });

    // Health returns 503
    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(503);

    // Webhook returns 503
    const hookRes = await request(app).post('/webhook/fhir').send({
      eventId: 'fail-test-1',
      resourceType: 'Observation',
    });
    expect(hookRes.status).toBe(503);
    expect(hookRes.body.simulated).toBe(true);

    // 2. Restore service
    await request(app).post('/simulate-restore');

    // Webhook now succeeds
    const restoreRes = await request(app).post('/webhook/fhir').send({
      eventId: 'fail-test-1',
      resourceType: 'Observation',
    });
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.status).toBe('ACCEPTED');
  });
});
