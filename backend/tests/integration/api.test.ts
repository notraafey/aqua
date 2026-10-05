import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/api/server.js';
import { setRepositories, createRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';

describe('AquaSentinel REST API Integration Tests', () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(async () => {
    // Force in-memory repository container for deterministic test execution
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();
    app = createServer();
  });

  describe('GET /api/health', () => {
    it('returns 200 OK and health telemetry structure', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.version).toBe('1.0.0');
      expect(res.body.data.services).toBeDefined();
      expect(res.body.data.services.fhir).toBeDefined();
    });
  });

  describe('Stream Reaches API', () => {
    it('GET /api/v1/stream-reaches returns seeded baseline reaches', async () => {
      const res = await request(app).get('/api/v1/stream-reaches');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].name).toContain('Almyros');
    });

    it('POST /api/v1/stream-reaches creates a valid reach', async () => {
      const payload = {
        name: 'Test Stream Section',
        city: 'Heraklion',
        region: 'Crete',
        monitoringStatus: 'ACTIVE',
        geometry: {
          type: 'Point',
          coordinates: [25.13, 35.33],
        },
      };

      const res = await request(app).post('/api/v1/stream-reaches').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Test Stream Section');
    });

    it('POST /api/v1/stream-reaches returns 400 on invalid input', async () => {
      const res = await request(app).post('/api/v1/stream-reaches').send({ name: 'A' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Observations API', () => {
    it('POST /api/v1/observations creates an observation with valid provenance', async () => {
      const payload = {
        source: 'SATELLITE_SENTINEL2',
        timestamp: new Date().toISOString(),
        location: {
          type: 'Point',
          coordinates: [22.75, 39.18],
        },
        streamReachId: '7a3b4c12-89de-4f56-9abc-1234567890ab',
        indicator: 'NDCI',
        value: 0.62,
        unit: 'ratio',
        quality: 'VALIDATED',
        sourceIdentifier: 'S2-L2A-TEST-001',
      };

      const res = await request(app).post('/api/v1/observations').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.provenance).toBeDefined();
      expect(res.body.data.provenance.sourceIdentifier).toBe('S2-L2A-TEST-001');
    });

    it('GET /api/v1/observations retrieves stored observations', async () => {
      const res = await request(app).get('/api/v1/observations');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Incidents and Evidence API', () => {
    let incidentId: string;

    it('POST /api/v1/incidents creates a foundational incident record', async () => {
      const payload = {
        streamReachId: '7a3b4c12-89de-4f56-9abc-1234567890ab',
        hazardType: 'ALGAL_BLOOM',
        evidenceConfidence: 74.5,
        severity: 'HIGH',
      };

      const res = await request(app).post('/api/v1/incidents').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      incidentId = res.body.data.id;
    });

    it('POST /api/v1/incidents/:id/evidence attaches evidence with correlation info', async () => {
      const payload = {
        source: 'SATELLITE_SENTINEL2',
        observationId: 'obs-test-01',
        relevance: 'HIGH',
        spatialMatch: { isMatch: true, distanceMeters: 45 },
        temporalMatch: { isMatch: true, deltaMinutes: 10 },
        qualityScore: 0.95,
        contribution: 'SUPPORTING',
      };

      const res = await request(app).post(`/api/v1/incidents/${incidentId}/evidence`).send(payload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.contribution).toBe('SUPPORTING');
      expect(res.body.data.provenance).toBeDefined();
    });

    it('GET /api/v1/incidents/:id/evidence lists the attached evidence', async () => {
      const res = await request(app).get(`/api/v1/incidents/${incidentId}/evidence`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('Tasks API', () => {
    it('POST /api/v1/tasks creates an operational task', async () => {
      const payload = {
        incidentId: 'inc-test-01',
        recommendationId: 'rec-test-01',
        assignedTo: 'Officer Miller',
        location: {
          type: 'Point',
          coordinates: [22.75, 39.18],
        },
        priority: 'HIGH',
        instructions: 'Deploy absorbent boom at sector 4',
      };

      const res = await request(app).post('/api/v1/tasks').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REQUESTED');

      const taskId = res.body.data.id;

      // Update task
      const patchRes = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .send({ status: 'IN_PROGRESS' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.status).toBe('IN_PROGRESS');
    });
  });

  describe('FHIR Subscription Webhook', () => {
    it('POST /api/v1/webhooks/fhir/subscription accepts and processes incoming FHIR Observation', async () => {
      const fhirPayload = {
        resourceType: 'Observation',
        id: 'fhir-incoming-obs-99',
        status: 'final',
        code: {
          coding: [{ code: 'ndci', system: 'https://oneaquahealth.eu/fhir/indicators' }],
        },
        valueQuantity: {
          value: 0.65,
          unit: 'ratio',
        },
        subject: {
          reference: 'Location/7a3b4c12-89de-4f56-9abc-1234567890ab',
        },
        note: [{ text: 'Source: SATELLITE_SENTINEL2' }],
      };

      const res = await request(app)
        .post('/api/v1/webhooks/fhir/subscription')
        .send(fhirPayload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PROCESSED');
    });
  });

  describe('Centralized Error Handling', () => {
    it('returns structured JSON with code, message, and timestamp on 404', async () => {
      const res = await request(app).get('/api/v1/non-existent-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBeDefined();
      expect(res.body.error.timestamp).toBeDefined();
    });
  });
});
