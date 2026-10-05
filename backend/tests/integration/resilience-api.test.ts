/**
 * Phase 6 Resilience Intelligence & Scenario Simulation Integration Tests
 * Conforms to Phase 6 PRD Sections 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 23.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/api/server.js';
import { setRepositories, createRepositories, getRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';
import { getResilienceAnalyticsService } from '../../src/services/analytics/resilience-analytics-service.js';
import { Phase6DemoScenarios } from '../../src/domain/analytics/demo-scenarios.js';

describe('Resilience Analytics & Scenario Simulation API Integration Tests', () => {
  let app: ReturnType<typeof createServer>;
  const almyrosId = Phase6DemoScenarios.reachAlmyros.id;

  beforeAll(async () => {
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();

    const service = getResilienceAnalyticsService();
    service.initialize();

    // Populate demo dataset
    await service.executeDemoScenarios();

    app = createServer();
  });

  describe('1. Overview & Multi-Dimensional Scorecards', () => {
    it('GET /api/v1/resilience/overview returns system-wide scorecards and active warnings', async () => {
      const res = await request(app).get('/api/v1/resilience/overview');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scorecards.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.systemSummary).toBeDefined();
      expect(res.body.data.systemSummary.totalReachesMonitored).toBeGreaterThanOrEqual(3);

      // Verify explicit multi-dimensional ratings (no arbitrary composite single score)
      const almyrosScorecard = res.body.data.scorecards.find((s: any) => s.reachId === almyrosId);
      expect(almyrosScorecard).toBeDefined();
      expect(almyrosScorecard.environmentalStability).toBeDefined();
      expect(almyrosScorecard.evidenceCoverage).toBeDefined();
      expect(almyrosScorecard.monitoringCoverage).toBeDefined();
      expect(almyrosScorecard.responseReadiness).toBeDefined();
    });

    it('GET /api/v1/resilience/reaches/:reachId returns reach scorecard, coverage and forecasts', async () => {
      const res = await request(app).get(`/api/v1/resilience/reaches/${almyrosId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reach.id).toBe(almyrosId);
      expect(res.body.data.scorecard.environmentalStability).toBe('DETERIORATING');
      expect(res.body.data.coverage.sourceBreakdown.satellite).toBeDefined();
      expect(res.body.data.forecasts.length).toBeGreaterThan(0);
    });
  });

  describe('2. Short-Horizon Forecasting & Anti-Data Leakage', () => {
    it('POST /api/v1/resilience/reaches/:reachId/forecasts generates and persists forecast', async () => {
      const res = await request(app)
        .post(`/api/v1/resilience/reaches/${almyrosId}/forecasts`)
        .send({
          indicator: 'NDCI',
          modelId: 'linear-trend-v1',
          horizonHours: 72,
          originTimestamp: '2026-09-15T16:00:00.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const fc = res.body.data;
      expect(fc.id).toBeDefined();
      expect(fc.modelId).toBe('linear-trend-v1');
      expect(fc.originTimestamp).toBe('2026-09-15T16:00:00.000Z');
      expect(fc.projections.length).toBeGreaterThan(0);
      expect(fc.labels).toContain('PROJECTED');
      expect(fc.explanation).toBeDefined();

      // Projections have uncertainty bounds
      const firstStep = fc.projections[0];
      expect(firstStep.lowerBound).toBeLessThanOrEqual(firstStep.projectedValue);
      expect(firstStep.upperBound).toBeGreaterThanOrEqual(firstStep.projectedValue);
    });

    it('GET /api/v1/resilience/forecasts/:id retrieves existing forecast', async () => {
      const repos = getRepositories();
      const existing = await repos.forecasts.findLatestByReach(almyrosId);
      expect(existing).not.toBeNull();

      const res = await request(app).get(`/api/v1/resilience/forecasts/${existing!.id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(existing!.id);
    });
  });

  describe('3. Scenario Simulation & Comparison', () => {
    it('POST /api/v1/resilience/reaches/:reachId/scenarios/run simulates hypothetical scenario', async () => {
      const res = await request(app)
        .post(`/api/v1/resilience/reaches/${almyrosId}/scenarios/run`)
        .send({
          name: 'Accelerated Deterioration Test',
          description: 'Testing 2.0x acceleration rate',
          type: 'ACCELERATED_DETERIORATION',
          indicator: 'NDCI',
          horizonHours: 72,
          parameters: {
            accelerationMultiplier: 2.0,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const sim = res.body.data;
      expect(sim.scenarioId).toBeDefined();
      expect(sim.type).toBe('ACCELERATED_DETERIORATION');
      expect(sim.isHypothetical).toBe(true);
      expect(sim.labels).toContain('SIMULATED');
      expect(sim.assumptions.length).toBeGreaterThan(0);
    });

    it('POST /api/v1/resilience/reaches/:reachId/scenarios/compare compares scenarios against baseline', async () => {
      const repos = getRepositories();
      const scenarios = await repos.scenarios.findByReach(almyrosId);
      expect(scenarios.length).toBeGreaterThanOrEqual(1);

      const scenarioIds = scenarios.slice(0, 2).map((s) => s.scenarioId);

      const res = await request(app)
        .post(`/api/v1/resilience/reaches/${almyrosId}/scenarios/compare`)
        .send({
          scenarioIds,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.comparisonPoints.length).toBeGreaterThan(0);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.operationalImplications).toBeDefined();
    });
  });

  describe('4. Multi-Signal Early Warnings & Contradiction Downgrading', () => {
    it('GET /api/v1/resilience/early-warnings returns detected warnings', async () => {
      const res = await request(app).get('/api/v1/resilience/early-warnings');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const almyrosWarning = res.body.data.find((w: any) => w.streamReachId === almyrosId);
      expect(almyrosWarning).toBeDefined();
      expect(almyrosWarning.triggerReason).toBeDefined();
      expect(almyrosWarning.contributingFactors.length).toBeGreaterThan(0);
      expect(almyrosWarning.labels).toContain('EARLY_WARNING');
    });

    it('POST /api/v1/resilience/early-warnings/:id/acknowledge acknowledges warning', async () => {
      const repos = getRepositories();
      const warnings = await repos.earlyWarnings.find({ reachId: almyrosId });
      expect(warnings.length).toBeGreaterThan(0);
      const warning = warnings[0];

      const res = await request(app)
        .post(`/api/v1/resilience/early-warnings/${warning.id}/acknowledge`)
        .send({
          acknowledgedBy: 'Senior Operator Elena',
          notes: 'Field crew notified for expedited sampling',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.acknowledged).toBe(true);
      expect(res.body.data.acknowledgedBy).toBe('Senior Operator Elena');
    });
  });

  describe('5. Historical Rolling Backtesting & Model Evaluations', () => {
    it('POST /api/v1/resilience/models/backtest runs rolling backtest and returns benchmark metrics', async () => {
      const res = await request(app)
        .post('/api/v1/resilience/models/backtest')
        .send({
          reachId: almyrosId,
          indicator: 'NDCI',
          modelIds: ['linear-trend-v1', 'ewma-damped-trend-v1'],
          horizons: [24, 48],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const candidateMetric = res.body.data.find((m: any) => m.baselineModelComparison !== undefined);
      expect(candidateMetric).toBeDefined();
      expect(candidateMetric.mae).toBeDefined();
      expect(candidateMetric.rmse).toBeDefined();
      expect(candidateMetric.directionalAccuracy).toBeDefined();
      expect(candidateMetric.baselineModelComparison.baselineModelId).toBeDefined();
    });

    it('GET /api/v1/resilience/models/evaluation lists historical model metrics', async () => {
      const res = await request(app).get('/api/v1/resilience/models/evaluation');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('6. Analytical Provenance DAG Traceability', () => {
    it('GET /api/v1/resilience/provenance/:id traces forecast lineage and input observations', async () => {
      const repos = getRepositories();
      const fc = await repos.forecasts.findLatestByReach(almyrosId);
      expect(fc).not.toBeNull();

      const res = await request(app).get(`/api/v1/resilience/provenance/${fc!.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const prov = res.body.data;
      expect(prov.targetId).toBe(fc!.id);
      expect(prov.targetType).toBe('FORECAST');
      expect(prov.modelId).toBe(fc!.modelId);
      expect(prov.inputObservations.length).toBeGreaterThan(0);
      expect(prov.trainingWindow.observationCount).toBeGreaterThan(0);
    });
  });

  describe('7. Demo Endpoints Execution', () => {
    it('POST /api/v1/demo/phase6/execute executes deterministic Phase 6 scenarios', async () => {
      const res = await request(app).post('/api/v1/demo/phase6/execute');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.forecastCount).toBeGreaterThan(0);
      expect(res.body.data.earlyWarningCount).toBeGreaterThan(0);
    });
  });
});
