import { describe, it, expect } from 'vitest';
import { Phase6DemoScenarios } from '../../src/domain/analytics/demo-scenarios.js';

describe('Phase 6 Deterministic Demo Scenarios Unit Tests', () => {
  it('generates rich deterministic data exercising the real analytical engines', () => {
    const demo = Phase6DemoScenarios.generateDemoData();

    // 1. Reaches
    expect(demo.reaches).toHaveLength(3);

    // 2. Observations
    expect(demo.observations.length).toBeGreaterThan(15);
    const citizenObs = demo.observations.filter((o) => o.source === 'CITIZEN_REPORT');
    expect(citizenObs.length).toBeGreaterThanOrEqual(2);

    // 3. Forecasts
    expect(demo.forecasts).toHaveLength(3);
    const almyrosFc = demo.forecasts.find((f) => f.reachId === Phase6DemoScenarios.reachAlmyros.id);
    expect(almyrosFc).toBeDefined();
    expect(almyrosFc?.isSufficientData).toBe(true);
    expect(almyrosFc?.trend).toBe('ACCELERATING');
    expect(almyrosFc?.projections.length).toBeGreaterThan(0);

    // 4. Early Warnings
    expect(demo.earlyWarnings.length).toBeGreaterThanOrEqual(1);
    const almyrosWarning = demo.earlyWarnings.find(
      (w) => w.streamReachId === Phase6DemoScenarios.reachAlmyros.id
    );
    expect(almyrosWarning).toBeDefined();
    expect(almyrosWarning?.warningLevel).toBe('WARNING');
    expect(almyrosWarning?.confidence).toBe('HIGH');
    expect(almyrosWarning?.triggerReason).toContain('Almyros');

    // 5. Scenario Comparison
    expect(demo.comparisons.length).toBeGreaterThanOrEqual(1);
    const comp = demo.comparisons[0];
    expect(comp.scenarios.length).toBe(3);
    expect(comp.comparisonPoints.length).toBe(almyrosFc?.projections.length);
    expect(comp.operationalImplications.length).toBeGreaterThan(0);

    // 6. Scorecards
    expect(demo.scorecards).toHaveLength(3);
    const almyrosSc = demo.scorecards.find((s) => s.reachId === Phase6DemoScenarios.reachAlmyros.id);
    expect(almyrosSc?.environmentalStability).toBe('DETERIORATING');

    const anavrosSc = demo.scorecards.find((s) => s.reachId === Phase6DemoScenarios.reachAnavros.id);
    expect(anavrosSc?.environmentalStability).toBe('STABLE');

    // 7. Model Evaluations (Backtesting)
    expect(demo.modelEvaluations.length).toBeGreaterThan(0);
    const baselineEval = demo.modelEvaluations.find((m) => m.modelId === 'persistence-baseline-v1');
    expect(baselineEval).toBeDefined();
  });
});
