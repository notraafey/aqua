import { describe, it, expect } from 'vitest';
import { BacktestingEngine } from '../../src/domain/analytics/backtesting-engine.js';
import { Observation, StreamReach } from '@aquasentinel/shared';

describe('BacktestingEngine Unit Tests', () => {
  const sampleReach: StreamReach = {
    id: 'reach-backtest-01',
    name: 'Almyros Stream',
    city: 'Volos',
    region: 'Thessaly',
    monitoringStatus: 'ACTIVE',
    geometry: { type: 'Point', coordinates: [22.75, 39.18] },
    baselineData: { typicalNdci: 0.12 },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  // Create a 10-observation time series spanning 18 days with steady upward trend
  const historicalSeries: Observation[] = [
    { id: 'o-1', timestamp: '2026-09-01T10:00:00.000Z', value: 0.12 },
    { id: 'o-2', timestamp: '2026-09-03T10:00:00.000Z', value: 0.15 },
    { id: 'o-3', timestamp: '2026-09-05T10:00:00.000Z', value: 0.18 },
    { id: 'o-4', timestamp: '2026-09-07T10:00:00.000Z', value: 0.22 },
    { id: 'o-5', timestamp: '2026-09-09T10:00:00.000Z', value: 0.26 },
    { id: 'o-6', timestamp: '2026-09-11T10:00:00.000Z', value: 0.31 },
    { id: 'o-7', timestamp: '2026-09-13T10:00:00.000Z', value: 0.36 },
    { id: 'o-8', timestamp: '2026-09-15T10:00:00.000Z', value: 0.42 },
    { id: 'o-9', timestamp: '2026-09-17T10:00:00.000Z', value: 0.49 },
    { id: 'o-10', timestamp: '2026-09-19T10:00:00.000Z', value: 0.56 },
  ].map((item) => ({
    id: item.id,
    source: 'SATELLITE_SENTINEL2',
    indicator: 'NDCI',
    value: item.value,
    timestamp: item.timestamp,
    location: { type: 'Point', coordinates: [22.75, 39.18] },
    streamReachId: sampleReach.id,
    qualityScore: 0.9,
    qualityStatus: 'ASSESSED',
    provenanceRecord: {
      ingestedAt: item.timestamp,
      sourceSystem: 'Copernicus',
      processingPipelineVersion: '1.0',
      contentHash: `hash-${item.id}`,
      isSynthetic: false,
    },
    createdAt: item.timestamp,
  }));

  it('runs backtest holdout evaluation and computes MAE, RMSE, and directional accuracy', () => {
    const metrics = BacktestingEngine.runBacktest({
      reach: sampleReach,
      observations: historicalSeries,
      indicator: 'NDCI',
      horizons: [48],
      modelIds: ['linear-trend-v1'],
      minHistoricalPointsRequired: 4,
    });

    expect(metrics.length).toBeGreaterThanOrEqual(2); // Baseline + Linear trend

    const baselineMetric = metrics.find((m) => m.modelId === 'persistence-baseline-v1');
    const linearMetric = metrics.find((m) => m.modelId === 'linear-trend-v1');

    expect(baselineMetric).toBeDefined();
    expect(linearMetric).toBeDefined();

    expect(baselineMetric?.sampleSize).toBeGreaterThan(0);
    expect(linearMetric?.sampleSize).toBeGreaterThan(0);

    expect(linearMetric?.mae).toBeGreaterThanOrEqual(0);
    expect(linearMetric?.rmse).toBeGreaterThanOrEqual(0);
    expect(linearMetric?.directionalAccuracy).toBeGreaterThan(50); // On trending series, directional accuracy is high

    // Benchmarking against persistence baseline
    expect(linearMetric?.baselineModelComparison).toBeDefined();
    expect(linearMetric?.baselineModelComparison?.baselineModelId).toBe('persistence-baseline-v1');
  });

  it('returns empty array when historical observations are too sparse for backtesting', () => {
    const metrics = BacktestingEngine.runBacktest({
      reach: sampleReach,
      observations: historicalSeries.slice(0, 3), // Only 3 observations
      indicator: 'NDCI',
      horizons: [48],
    });

    expect(metrics).toEqual([]);
  });
});
