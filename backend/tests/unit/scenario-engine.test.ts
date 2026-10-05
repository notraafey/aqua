import { describe, it, expect } from 'vitest';
import { ScenarioEngine } from '../../src/domain/analytics/scenario-engine.js';
import { ForecastResult } from '@aquasentinel/shared';

describe('ScenarioEngine Unit Tests', () => {
  const mockBaselineForecast: ForecastResult = {
    id: 'fc-base-01',
    reachId: 'reach-almyros-01',
    reachName: 'Almyros Stream',
    indicator: 'NDCI',
    originTimestamp: '2026-09-10T12:00:00.000Z',
    horizonHours: 72,
    currentValue: 0.35,
    historicalBaseline: 0.12,
    baselineDeviationPercent: 191.7,
    projections: [
      {
        targetTimestamp: '2026-09-11T06:00:00.000Z',
        stepHours: 18,
        projectedValue: 0.38,
        lowerBound: 0.31,
        upperBound: 0.45,
        confidenceInterval: 0.95,
      },
      {
        targetTimestamp: '2026-09-12T00:00:00.000Z',
        stepHours: 36,
        projectedValue: 0.41,
        lowerBound: 0.33,
        upperBound: 0.49,
        confidenceInterval: 0.95,
      },
      {
        targetTimestamp: '2026-09-12T18:00:00.000Z',
        stepHours: 54,
        projectedValue: 0.44,
        lowerBound: 0.35,
        upperBound: 0.53,
        confidenceInterval: 0.95,
      },
      {
        targetTimestamp: '2026-09-13T12:00:00.000Z',
        stepHours: 72,
        projectedValue: 0.47,
        lowerBound: 0.37,
        upperBound: 0.57,
        confidenceInterval: 0.95,
      },
    ],
    trend: 'INCREASING',
    trendSlopePerDay: 0.04,
    uncertainty: 'MODERATE',
    confidence: 'HIGH',
    modelId: 'linear-trend-v1',
    modelVersion: '1.0.0',
    modelName: 'Linear Trend',
    trainingWindow: {
      start: '2026-09-01T10:00:00.000Z',
      end: '2026-09-10T10:00:00.000Z',
      observationCount: 5,
    },
    inputObservationIds: ['obs-1', 'obs-2', 'obs-3', 'obs-4', 'obs-5'],
    generatedTimestamp: '2026-09-10T12:00:00.000Z',
    explanation: 'Test forecast explanation',
    labels: ['PROJECTED', 'UNCERTAIN'],
    isSufficientData: true,
  };

  it('simulates ACCELERATED_DETERIORATION scenario and enforces SIMULATED label', () => {
    const sim = ScenarioEngine.simulate({
      baselineForecast: mockBaselineForecast,
      type: 'ACCELERATED_DETERIORATION',
      parameters: { accelerationMultiplier: 1.8 },
    });

    expect(sim.type).toBe('ACCELERATED_DETERIORATION');
    expect(sim.labels).toContain('SIMULATED');
    expect(sim.labels).toContain('HYPOTHETICAL');
    expect(sim.isHypothetical).toBe(true);
    expect(sim.assumptions.length).toBeGreaterThan(0);
    expect(sim.assumptions[0]).toContain('1.8');

    // Final projection should be higher than baseline forecast
    const baseFinal = mockBaselineForecast.projections[mockBaselineForecast.projections.length - 1].projectedValue;
    const simFinal = sim.projections[sim.projections.length - 1].projectedValue;
    expect(simFinal).toBeGreaterThan(baseFinal);
  });

  it('simulates OPERATIONAL_INTERVENTION with lag and reduction towards baseline', () => {
    const sim = ScenarioEngine.simulate({
      baselineForecast: mockBaselineForecast,
      type: 'OPERATIONAL_INTERVENTION',
      parameters: { interventionEfficacyPercent: 50, interventionLagHours: 12 },
    });

    expect(sim.type).toBe('OPERATIONAL_INTERVENTION');
    expect(sim.assumptions.some((a) => a.includes('50%'))).toBe(true);
    expect(sim.assumptions.some((a) => a.includes('Phase 3/4 verification'))).toBe(true);

    // Final projection should show reduction compared to baseline forecast
    const baseFinal = mockBaselineForecast.projections[mockBaselineForecast.projections.length - 1].projectedValue;
    const simFinal = sim.projections[sim.projections.length - 1].projectedValue;
    expect(simFinal).toBeLessThan(baseFinal);
  });

  it('simulates WEATHER_EVENT with initial runoff spike and increased uncertainty', () => {
    const sim = ScenarioEngine.simulate({
      baselineForecast: mockBaselineForecast,
      type: 'WEATHER_EVENT',
      parameters: { rainfallIntensityMm: 45 },
    });

    expect(sim.type).toBe('WEATHER_EVENT');
    expect(sim.uncertainty).toBe('HIGH');
    expect(sim.assumptions[0]).toContain('45mm');
  });

  it('ensures simulation reproducibility given the exact same parameters', () => {
    const sim1 = ScenarioEngine.simulate({
      baselineForecast: mockBaselineForecast,
      type: 'ACCELERATED_DETERIORATION',
      parameters: { accelerationMultiplier: 2.0 },
    });

    const sim2 = ScenarioEngine.simulate({
      baselineForecast: mockBaselineForecast,
      type: 'ACCELERATED_DETERIORATION',
      parameters: { accelerationMultiplier: 2.0 },
    });

    expect(sim1.projections).toEqual(sim2.projections);
    expect(sim1.assumptions).toEqual(sim2.assumptions);
  });

  it('compares baseline forecast with multiple scenarios and generates operational implications', () => {
    const accelSim = ScenarioEngine.simulate({
      baselineForecast: mockBaselineForecast,
      type: 'ACCELERATED_DETERIORATION',
      parameters: { accelerationMultiplier: 1.5 },
    });

    const intervSim = ScenarioEngine.simulate({
      baselineForecast: mockBaselineForecast,
      type: 'OPERATIONAL_INTERVENTION',
      parameters: { interventionEfficacyPercent: 40 },
    });

    const comparison = ScenarioEngine.compare(mockBaselineForecast, [accelSim, intervSim]);

    expect(comparison.scenarios).toHaveLength(2);
    expect(comparison.comparisonPoints).toHaveLength(mockBaselineForecast.projections.length);
    expect(comparison.operationalImplications.length).toBeGreaterThanOrEqual(1);

    const lastPoint = comparison.comparisonPoints[comparison.comparisonPoints.length - 1];
    expect(lastPoint.baselineValue).toBe(0.47);
    expect(lastPoint.deltas[accelSim.name].percent).toBeGreaterThan(0);
    expect(lastPoint.deltas[intervSim.name].percent).toBeLessThan(0);
  });
});
