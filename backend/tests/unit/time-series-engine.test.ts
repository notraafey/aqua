import { describe, it, expect } from 'vitest';
import { TimeSeriesEngine } from '../../src/domain/analytics/time-series-engine.js';
import { TimeSeriesPoint, Observation } from '@aquasentinel/shared';

describe('TimeSeriesEngine Unit Tests', () => {
  const samplePoints: TimeSeriesPoint[] = [
    {
      observationId: 'obs-1',
      timestamp: '2026-09-01T10:00:00.000Z',
      value: 0.12,
      source: 'SATELLITE_SENTINEL2',
      qualityScore: 0.9,
    },
    {
      observationId: 'obs-2',
      timestamp: '2026-09-03T10:00:00.000Z',
      value: 0.14,
      source: 'SATELLITE_SENTINEL2',
      qualityScore: 0.85,
    },
    {
      observationId: 'obs-3',
      timestamp: '2026-09-05T10:00:00.000Z',
      value: 0.19,
      source: 'SATELLITE_SENTINEL2',
      qualityScore: 0.95,
    },
    {
      observationId: 'obs-4',
      timestamp: '2026-09-07T10:00:00.000Z',
      value: 0.28,
      source: 'SATELLITE_SENTINEL2',
      qualityScore: 0.9,
    },
    {
      observationId: 'obs-5',
      timestamp: '2026-09-09T10:00:00.000Z',
      value: 0.41,
      source: 'SATELLITE_SENTINEL2',
      qualityScore: 0.88,
    },
  ];

  it('orders observations chronologically ascending', () => {
    const shuffled = [samplePoints[3], samplePoints[0], samplePoints[4], samplePoints[1], samplePoints[2]];
    const sorted = TimeSeriesEngine.sortChronologically(shuffled);

    expect(sorted[0].observationId).toBe('obs-1');
    expect(sorted[1].observationId).toBe('obs-2');
    expect(sorted[2].observationId).toBe('obs-3');
    expect(sorted[3].observationId).toBe('obs-4');
    expect(sorted[4].observationId).toBe('obs-5');
  });

  it('detects missing periods exceeding allowed gap', () => {
    const pointsWithGap: TimeSeriesPoint[] = [
      samplePoints[0],
      samplePoints[1], // 48h gap
      {
        observationId: 'obs-gap',
        timestamp: '2026-09-25T10:00:00.000Z', // 22 days gap
        value: 0.2,
        source: 'SATELLITE_SENTINEL2',
        qualityScore: 0.8,
      },
    ];

    const gaps = TimeSeriesEngine.detectMissingPeriods(pointsWithGap, 72); // 72h max
    expect(gaps).toHaveLength(1);
    expect(gaps[0].gapStart).toBe('2026-09-03T10:00:00.000Z');
    expect(gaps[0].gapEnd).toBe('2026-09-25T10:00:00.000Z');
    expect(gaps[0].gapHours).toBeGreaterThan(500);
  });

  it('computes rolling mean, median, and rolling std dev correctly', () => {
    const values = [10, 20, 30, 40, 50];
    const rollingMean = TimeSeriesEngine.calculateRollingMean(values, 3);
    expect(rollingMean[0]).toBe(10);
    expect(rollingMean[1]).toBe(15);
    expect(rollingMean[2]).toBe(20);
    expect(rollingMean[3]).toBe(30);
    expect(rollingMean[4]).toBe(40);

    const rollingMedian = TimeSeriesEngine.calculateRollingMedian(values, 3);
    expect(rollingMedian[2]).toBe(20);
    expect(rollingMedian[3]).toBe(30);
    expect(rollingMedian[4]).toBe(40);

    const rollingStdDev = TimeSeriesEngine.calculateRollingStdDev(values, 3);
    expect(rollingStdDev[0]).toBe(0);
    expect(rollingStdDev[2]).toBeCloseTo(10, 2);
  });

  it('computes baseline deviation and status correctly', () => {
    const devElevated = TimeSeriesEngine.calculateBaselineDeviation(0.35, 0.2);
    expect(devElevated.percentageDiff).toBe(75);
    expect(devElevated.status).toBe('ELEVATED');

    const devNormal = TimeSeriesEngine.calculateBaselineDeviation(0.21, 0.2);
    expect(devNormal.percentageDiff).toBe(5);
    expect(devNormal.status).toBe('NORMAL');

    const devSuppressed = TimeSeriesEngine.calculateBaselineDeviation(0.12, 0.2);
    expect(devSuppressed.percentageDiff).toBe(-40);
    expect(devSuppressed.status).toBe('SUPPRESSED');
  });

  it('calculates trend slope and acceleration', () => {
    const slope = TimeSeriesEngine.calculateTrendSlopePerDay(samplePoints);
    expect(slope).toBeGreaterThan(0.03); // Positive growth rate

    const trend = TimeSeriesEngine.classifyTrend(samplePoints, 0.12);
    expect(trend.classification).toBe('ACCELERATING');
    expect(trend.slopePerDay).toBeGreaterThan(0.03);
    expect(trend.acceleration).toBeGreaterThan(0);
  });

  it('evaluates data quality gate: passes for sufficient valid data', () => {
    const gate = TimeSeriesEngine.evaluateDataQualityGate(
      samplePoints,
      { minObservations: 3, maxRecencyHours: 240 },
      '2026-09-10T10:00:00.000Z'
    );

    expect(gate.passed).toBe(true);
    expect(gate.confidenceBand).toBe('HIGH');
    expect(gate.reasons).toHaveLength(0);
  });

  it('evaluates data quality gate: fails and explains reasons for insufficient points', () => {
    const gate = TimeSeriesEngine.evaluateDataQualityGate(
      samplePoints.slice(0, 2),
      { minObservations: 3 },
      '2026-09-10T10:00:00.000Z'
    );

    expect(gate.passed).toBe(false);
    expect(gate.confidenceBand).toBe('INSUFFICIENT');
    expect(gate.reasons[0]).toContain('Insufficient observations');
  });

  it('evaluates data quality gate: detects contradictions within 6 hours', () => {
    const conflictingPoints: TimeSeriesPoint[] = [
      ...samplePoints,
      {
        observationId: 'obs-contradict',
        timestamp: '2026-09-09T13:00:00.000Z', // 3h after obs-5
        value: 0.05, // Sharp plunge from 0.41 to 0.05
        source: 'SATELLITE_SENTINEL2',
        qualityScore: 0.9,
      },
    ];

    const gate = TimeSeriesEngine.evaluateDataQualityGate(
      conflictingPoints,
      {},
      '2026-09-10T10:00:00.000Z'
    );

    expect(gate.metrics.contradictionPenalty).toBeGreaterThan(0);
    expect(gate.confidenceBand).toBe('LOW');
  });
});
