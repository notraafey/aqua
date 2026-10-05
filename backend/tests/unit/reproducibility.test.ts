import { describe, it, expect } from 'vitest';
import { scoringEngine } from '../../src/domain/evidence/scoring-engine.js';
import { demoScenariosRunner } from '../../src/domain/evidence/demo-scenarios.js';

describe('Reproducibility Test Suite', () => {
  it('produces identical Evidence Assessments across repeated evaluations with identical inputs', () => {
    const scenario = demoScenariosRunner.runScenarioB();
    const input = {
      streamReach: scenario.streamReach,
      triggerObservation: scenario.observations[0],
      candidateObservations: scenario.observations,
      candidateId: 'test-reproducibility',
    };

    const run1 = scoringEngine.evaluate(input);
    const run2 = scoringEngine.evaluate(input);
    const run3 = scoringEngine.evaluate(input);

    // Score must be perfectly identical
    expect(run1.score).toBe(run2.score);
    expect(run2.score).toBe(run3.score);

    // Confidence band must be identical
    expect(run1.confidenceBand).toBe(run2.confidenceBand);
    expect(run2.confidenceBand).toBe(run3.confidenceBand);

    // Component score breakdowns must be identical
    expect(run1.scoreBreakdown).toEqual(run2.scoreBreakdown);
    expect(run2.scoreBreakdown).toEqual(run3.scoreBreakdown);

    // Rationale strings must be identical
    expect(run1.rationale).toEqual(run2.rationale);
    expect(run2.rationale).toEqual(run3.rationale);
  });
});
