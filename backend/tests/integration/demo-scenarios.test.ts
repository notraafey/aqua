import { describe, it, expect } from 'vitest';
import { demoScenariosRunner } from '../../src/domain/evidence/demo-scenarios.js';

describe('Demo Scenarios Integration Test Suite (Scenarios A - E)', () => {
  it('verifies Scenario A: Isolated Satellite-Only Anomaly produces VERIFY band', () => {
    const result = demoScenariosRunner.runScenarioA();

    expect(result.scenarioId).toBe('SCENARIO_A');
    expect(result.assessment.confidenceBand).toBe('VERIFY');
    expect(result.assessment.score).toBeGreaterThanOrEqual(40);
    expect(result.assessment.score).toBeLessThanOrEqual(59);
    expect(result.assessment.independentSourceGroups).toEqual(['REMOTE_SENSING']);
    expect(result.assessment.scoreBreakdown.corroborationContribution).toBeLessThan(35);
  });

  it('verifies Scenario B: Satellite + Citizen Corroboration increases to INVESTIGATE band', () => {
    const resultA = demoScenariosRunner.runScenarioA();
    const resultB = demoScenariosRunner.runScenarioB();

    expect(resultB.scenarioId).toBe('SCENARIO_B');
    expect(resultB.assessment.confidenceBand).toBe('INVESTIGATE');
    expect(resultB.assessment.score).toBeGreaterThan(resultA.assessment.score);
    expect(resultB.assessment.score).toBeGreaterThanOrEqual(60);
    expect(resultB.assessment.score).toBeLessThanOrEqual(79);
    expect(resultB.assessment.independentSourceGroups).toContain('REMOTE_SENSING');
    expect(resultB.assessment.independentSourceGroups).toContain('CITIZEN');
  });

  it('verifies Scenario C: Satellite + Citizen + Weather Context elevates to PRIORITIZE band', () => {
    const resultB = demoScenariosRunner.runScenarioB();
    const resultC = demoScenariosRunner.runScenarioC();

    expect(resultC.scenarioId).toBe('SCENARIO_C');
    expect(resultC.assessment.score).toBeGreaterThan(resultB.assessment.score);
    expect(resultC.assessment.score).toBeGreaterThanOrEqual(80);
    expect(resultC.assessment.confidenceBand).toBe('PRIORITIZE');
    expect(resultC.assessment.independentSourceGroups).toHaveLength(3);
    expect(resultC.assessment.scoreBreakdown.contextContribution).toBeGreaterThan(0);
  });

  it('verifies Scenario D: Contradictory Evidence decreases score and surfaces contradictions', () => {
    const resultA = demoScenariosRunner.runScenarioA();
    const resultD = demoScenariosRunner.runScenarioD();

    expect(resultD.scenarioId).toBe('SCENARIO_D');
    expect(resultD.assessment.score).toBeLessThan(resultA.assessment.score);
    expect(resultD.assessment.scoreBreakdown.contradictionPenalty).toBeGreaterThan(0);
    expect(resultD.assessment.contradictingEvidence.length).toBeGreaterThan(0);
    expect(resultD.assessment.rationale.whatWeakens).toContain('contradictory');
  });

  it('verifies Scenario E: Missing Baseline explicitly reports BASELINE_UNAVAILABLE', () => {
    const result = demoScenariosRunner.runScenarioE();

    expect(result.scenarioId).toBe('SCENARIO_E');
    expect(result.assessment.baselineStatus).toBe('UNAVAILABLE');
    expect(result.assessment.missingEvidence.some((m) => m.includes('Historical baseline unavailable'))).toBe(true);
    expect(result.assessment.rationale.whatIsMissing).toContain('baseline unavailable');
  });

  it('runs all scenarios successfully in batch', () => {
    const all = demoScenariosRunner.runAllScenarios();
    expect(all).toHaveLength(5);
  });
});
