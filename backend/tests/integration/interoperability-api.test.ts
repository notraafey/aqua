import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/api/server.js';
import { setRepositories, createRepositories, getRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';

describe('Interoperability API Integration Tests (Phase 7)', () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();
    app = createServer();
  });

  describe('GET /api/v1/interoperability/overview', () => {
    it('returns 200 OK and complete interoperability telemetry metrics', async () => {
      const res = await request(app).get('/api/v1/interoperability/overview');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.totalEvents).toBe('number');
      expect(typeof res.body.data.deliveredCount).toBe('number');
      expect(typeof res.body.data.deadLetterCount).toBe('number');
      expect(typeof res.body.data.subscriptionsCount).toBe('number');
      expect(res.body.data.consumerStatus).toBeDefined();
      expect(res.body.data.queueHealth).toBeDefined();
    });
  });

  describe('Outbox Events CRUD & Filtering', () => {
    it('lists outbox events and filters by status', async () => {
      const repos = getRepositories();
      const eventId = generateId();

      await repos.outbox.save({
        id: generateId(),
        eventId,
        eventType: 'IncidentCreated',
        eventVersion: '1.0.0',
        occurredAt: nowUtc(),
        producer: 'aquasentinel-decision-engine',
        subject: 'Location/krafsidonas-1',
        resourceType: 'Flag',
        resourceId: 'flag-int-1',
        payload: { sample: 123 },
        destination: 'http://localhost:3002/webhook/fhir',
        status: 'PENDING',
        retryCount: 0,
        maxRetries: 3,
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      });

      const resAll = await request(app).get('/api/v1/interoperability/outbox');
      expect(resAll.status).toBe(200);
      expect(resAll.body.success).toBe(true);
      expect(Array.isArray(resAll.body.data)).toBe(true);
      expect(resAll.body.data.some((e: any) => e.eventId === eventId)).toBe(true);

      const resFiltered = await request(app).get('/api/v1/interoperability/outbox?status=PENDING');
      expect(resFiltered.status).toBe(200);
      expect(resFiltered.body.data.every((e: any) => e.status === 'PENDING')).toBe(true);

      const resSingle = await request(app).get(`/api/v1/interoperability/outbox/${eventId}`);
      expect(resSingle.status).toBe(200);
      expect(resSingle.body.data.eventId).toBe(eventId);
    });

    it('returns 404 for non-existent outbox event', async () => {
      const res = await request(app).get('/api/v1/interoperability/outbox/non-existent-event-id');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Subscriptions Management', () => {
    it('lists and registers FHIR R4 subscriptions', async () => {
      const subId = generateId();
      const newSub = {
        id: subId,
        criteria: 'Flag?status=active',
        endpoint: 'http://localhost:3002/webhook/fhir',
        reason: 'Forward water security alerts to public health portal',
      };

      const postRes = await request(app)
        .post('/api/v1/interoperability/subscriptions')
        .send(newSub);

      expect(postRes.status).toBe(201);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.data.id).toBe(subId);
      expect(postRes.body.data.status).toBe('active');

      const getRes = await request(app).get('/api/v1/interoperability/subscriptions');
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.subscriptions.some((s: any) => s.id === subId)).toBe(true);
    });
  });

  describe('Audit Trail & Acknowledgements', () => {
    it('returns audit trail and acknowledgements records', async () => {
      const resAudit = await request(app).get('/api/v1/interoperability/audit?limit=10');
      expect(resAudit.status).toBe(200);
      expect(resAudit.body.success).toBe(true);
      expect(Array.isArray(resAudit.body.data)).toBe(true);

      const resAck = await request(app).get('/api/v1/interoperability/acknowledgements?limit=10');
      expect(resAck.status).toBe(200);
      expect(resAck.body.success).toBe(true);
      expect(Array.isArray(resAck.body.data)).toBe(true);
    });
  });

  describe('Manual Retry & Replay Endpoints', () => {
    it('handles manual retry and replay calls gracefully', async () => {
      const repos = getRepositories();
      const eventId = generateId();

      await repos.outbox.save({
        id: generateId(),
        eventId,
        eventType: 'ObservationCreated',
        eventVersion: '1.0.0',
        occurredAt: nowUtc(),
        producer: 'copernicus-satellite-pipeline',
        subject: 'Location/krafsidonas-1',
        resourceType: 'Observation',
        resourceId: 'obs-replay-1',
        payload: { sample: true },
        destination: 'http://localhost:3002/webhook/fhir',
        status: 'DEAD_LETTER',
        retryCount: 3,
        maxRetries: 3,
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      });

      // Mock fetch to avoid real network call during test
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          status: 'RECEIVED',
          acknowledgement: {
            acknowledgementId: 'ack-test-1',
            eventId,
            status: 'PROCESSED',
            consumerId: 'volos-public-health-portal',
            receivedAt: nowUtc(),
            processedAt: nowUtc(),
          },
        }),
      } as any);

      const retryRes = await request(app).post(`/api/v1/interoperability/outbox/${eventId}/retry`);
      expect(retryRes.status).toBe(200);
      expect(retryRes.body.success).toBe(true);

      const replayEventId = generateId();
      await repos.outbox.save({
        id: generateId(),
        eventId: replayEventId,
        eventType: 'ObservationCreated',
        eventVersion: '1.0.0',
        occurredAt: nowUtc(),
        producer: 'copernicus-satellite-pipeline',
        subject: 'Location/krafsidonas-1',
        resourceType: 'Observation',
        resourceId: 'obs-replay-2',
        payload: { sample: true },
        destination: 'http://localhost:3002/webhook/fhir',
        status: 'DEAD_LETTER',
        retryCount: 3,
        maxRetries: 3,
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      });

      const replayRes = await request(app)
        .post(`/api/v1/interoperability/outbox/${replayEventId}/replay`)
        .send({ operatorId: 'lead-operator-eleni' });
      expect(replayRes.status).toBe(200);
      expect(replayRes.body.success).toBe(true);
    });
  });
});
