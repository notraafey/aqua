import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/api/server.js';
import { setRepositories, createRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';
import { demoScenariosRunner } from '../../src/domain/evidence/demo-scenarios.js';

describe('Evidence Assessments REST API Integration Tests', () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();

    // Populate initial assessment from Scenario B
    const scenario = demoScenariosRunner.runScenarioB();
    await container.evidenceAssessments.save(scenario.assessment);

    app = createServer();
  });

  describe('GET /api/v1/evidence-assessments', () => {
    it('returns 200 OK and list of evidence assessments', async () => {
      const res = await request(app).get('/api/v1/evidence-assessments');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta.total).toBeDefined();
    });

    it('filters by confidenceBand', async () => {
      const res = await request(app).get('/api/v1/evidence-assessments?confidenceBand=INVESTIGATE');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.every((a: any) => a.confidenceBand === 'INVESTIGATE')).toBe(true);
    });

    it('rejects invalid confidenceBand parameter with 400 Validation error', async () => {
      const res = await request(app).get('/api/v1/evidence-assessments?confidenceBand=INVALID_BAND');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/evidence-assessments/demo-scenarios', () => {
    it('returns all 5 deterministic PRD demo scenarios', async () => {
      const res = await request(app).get('/api/v1/evidence-assessments/demo-scenarios');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.data.map((s: any) => s.scenarioId)).toEqual([
        'SCENARIO_A',
        'SCENARIO_B',
        'SCENARIO_C',
        'SCENARIO_D',
        'SCENARIO_E',
      ]);
    });
  });

  describe('GET /api/v1/evidence-assessments/:id', () => {
    it('returns 200 OK and detail breakdown for existing assessment', async () => {
      const listRes = await request(app).get('/api/v1/evidence-assessments');
      const assessmentId = listRes.body.data[0].id;

      const res = await request(app).get(`/api/v1/evidence-assessments/${assessmentId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assessment.id).toBe(assessmentId);
      expect(res.body.data.assessment.scoreBreakdown).toBeDefined();
      expect(res.body.data.assessment.rationale).toBeDefined();
    });

    it('returns 404 NOT_FOUND for non-existent assessment id', async () => {
      const res = await request(app).get('/api/v1/evidence-assessments/non-existent-id-12345');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/evidence-assessments/reassess', () => {
    it('triggers on-demand reassessment for a valid stream reach', async () => {
      const reachRes = await request(app).get('/api/v1/stream-reaches');
      const reachId = reachRes.body.data[0].id;

      const res = await request(app)
        .post('/api/v1/evidence-assessments/reassess')
        .send({ streamReachId: reachId, force: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reassessed).toBe(true);
      expect(res.body.data.currentScore).toBeDefined();
      expect(res.body.data.currentBand).toBeDefined();
      expect(res.body.data.assessment.streamReachId).toBe(reachId);
    });

    it('returns 400 Validation error if streamReachId is missing', async () => {
      const res = await request(app)
        .post('/api/v1/evidence-assessments/reassess')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
