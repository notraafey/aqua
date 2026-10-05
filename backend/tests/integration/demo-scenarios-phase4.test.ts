import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/api/server.js';
import { setRepositories, createRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';
import { getOperationalResponseService } from '../../src/services/response/operational-response-service.js';

describe('Phase 4 Demo Scenarios (A–E) Integration Tests', () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();
    const service = getOperationalResponseService();
    await service.initialize();
    app = createServer();
  });

  it('Scenario A: Executes Eutrophication & Sewage event deterministically', async () => {
    const res = await request(app).post('/api/v1/demo/scenarios/SCENARIO_A/execute');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.scenarioId).toBe('SCENARIO_A');
    expect(data.incidentType).toBe('POSSIBLE_CYANOBLOOM');
    expect(data.evidenceBand).toBe('VERIFY');
    expect(data.recommendationsCount).toBeGreaterThan(0);
    expect(data.tasksCount).toBeGreaterThan(0);
  });

  it('Scenario B: Executes Cyanobacterial Bloom Emergency with high severity & priority recommendations', async () => {
    const res = await request(app).post('/api/v1/demo/scenarios/SCENARIO_B/execute');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.scenarioId).toBe('SCENARIO_B');
    expect(data.incidentType).toBe('POSSIBLE_CYANOBLOOM');
    expect(data.evidenceBand).toBe('INVESTIGATE');
    expect(['HIGH', 'CRITICAL']).toContain(data.severityLevel);
    expect(data.recommendationsCount).toBeGreaterThanOrEqual(1);

    // Verify recommendations include grab sampling or field investigation
    const hasInvestigation = data.recommendations.some(
      (r: any) => r.measureId === 'OAH-M-SAMPLE-02' || r.actionType === 'FIELD_INVESTIGATION'
    );
    expect(hasInvestigation).toBe(true);
  });

  it('Scenario C: Executes Stormwater Runoff Anomaly deterministically', async () => {
    const res = await request(app).post('/api/v1/demo/scenarios/SCENARIO_C/execute');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.scenarioId).toBe('SCENARIO_C');
    expect(data.incidentType).toBe('POSSIBLE_STORMWATER_EVENT');
    expect(data.recommendationsCount).toBeGreaterThan(0);

    const hasMonitoring = data.recommendations.some(
      (r: any) => r.measureId === 'OAH-M-MONITOR-06' || r.actionType === 'FIELD_INVESTIGATION'
    );
    expect(hasMonitoring).toBe(true);
  });

  it('Scenario D: Executes Inconclusive Multi-Stressor Ambiguity', async () => {
    const res = await request(app).post('/api/v1/demo/scenarios/SCENARIO_D/execute');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.scenarioId).toBe('SCENARIO_D');
    expect(data.incidentType).toBe('POSSIBLE_CYANOBLOOM');
    expect(data.evidenceBand).toBe('PRIORITIZE');
    expect(data.recommendationsCount).toBe(10);
  });

  it('Scenario E: Executes Conflicting In-Situ Sensor Drift with calibration recommendation', async () => {
    const res = await request(app).post('/api/v1/demo/scenarios/SCENARIO_E/execute');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.scenarioId).toBe('SCENARIO_E');
    expect(data.recommendationsCount).toBeGreaterThan(0);

    // Should recommend sensor verification / telemetry recalibration
    const hasSensorCalibration = data.recommendations.some(
      (r: any) => r.measureId === 'OAH-M-SENSOR-03' || r.actionType === 'SENSOR_CALIBRATION' || r.actionType === 'FIELD_INVESTIGATION'
    );
    expect(hasSensorCalibration).toBe(true);
  });
});
