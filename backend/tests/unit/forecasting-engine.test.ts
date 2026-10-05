import { describe, it, expect } from 'vitest';
import { ForecastingEngine } from '../../src/domain/analytics/forecasting-engine.js';
import { ModelRegistry, PersistenceBaselineModel, LinearTrendModel, EwmaDampedTrendModel } from '../../src/domain/analytics/forecast-models.js';
import { Observation, StreamReach } from '@aquasentinel/shared';

describe('Forecasting Engine & Models Unit Tests', () => {
  const sampleReach: StreamReach = {
    id: 'reach-almyros-01',
    name: 'Almyros Stream - Reach Alpha',
    city: 'Volos',
    region: 'Thessaly',
    monitoringStatus: 'ACTIVE',
    geometry: { type: 'Point', coordinates: [22.75, 39.18] },
    baselineData: {
      typicalNdci: 0.12,
      typicalTurbidity: 4.0,
      typicalTempC: 18.0,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const sampleObservations: Observation[] = [
    {
      id: 'obs-1',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.12,
      timestamp: '2026-09-01T10:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      qualityScore: 0.9,
      qualityStatus: 'ASSESSED',
      streamReachId: sampleReach.id,
      provenanceRecord: {
        ingestedAt: '2026-09-01T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'hash-1',
        isSynthetic: false,
      },
      createdAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'obs-2',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.16,
      timestamp: '2026-09-03T10:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      qualityScore: 0.9,
      qualityStatus: 'ASSESSED',
      streamReachId: sampleReach.id,
      provenanceRecord: {
        ingestedAt: '2026-09-03T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'hash-2',
        isSynthetic: false,
      },
      createdAt: '2026-09-03T10:00:00.000Z',
    },
    {
      id: 'obs-3',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.22,
      timestamp: '2026-09-05T10:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      qualityScore: 0.88,
      qualityStatus: 'ASSESSED',
      streamReachId: sampleReach.id,
      provenanceRecord: {
        ingestedAt: '2026-09-05T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'hash-3',
        isSynthetic: false,
      },
      createdAt: '2026-09-05T10:00:00.000Z',
    },
    {
      id: 'obs-4',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.31,
      timestamp: '2026-09-07T10:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      qualityScore: 0.95,
      qualityStatus: 'ASSESSED',
      streamReachId: sampleReach.id,
      provenanceRecord: {
        ingestedAt: '2026-09-07T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'hash-4',
        isSynthetic: false,
      },
      createdAt: '2026-09-07T10:00:00.000Z',
    },
    {
      id: 'obs-5',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.44,
      timestamp: '2026-09-09T10:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      qualityScore: 0.92,
      qualityStatus: 'ASSESSED',
      streamReachId: sampleReach.id,
      provenanceRecord: {
        ingestedAt: '2026-09-09T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'hash-5',
        isSynthetic: false,
      },
      createdAt: '2026-09-09T10:00:00.000Z',
    },
  ];

  it('registers the 3 required forecast models', () => {
    const models = ModelRegistry.listModels();
    expect(models.length).toBe(3);
    expect(models.map((m) => m.id)).toEqual([
      'persistence-baseline-v1',
      'linear-trend-v1',
      'ewma-damped-trend-v1',
    ]);
  });

  it('generates a short-horizon forecast using LinearTrendModel', () => {
    const forecast = ForecastingEngine.generateForecast({
      observations: sampleObservations,
      reach: sampleReach,
      indicator: 'NDCI',
      horizonHours: 72,
      modelId: 'linear-trend-v1',
    });

    expect(forecast.isSufficientData).toBe(true);
    expect(forecast.modelId).toBe('linear-trend-v1');
    expect(forecast.horizonHours).toBe(72);
    expect(forecast.currentValue).toBe(0.44);
    expect(forecast.historicalBaseline).toBe(0.12);
    expect(forecast.baselineDeviationPercent).toBeGreaterThan(200);
    expect(forecast.projections.length).toBeGreaterThan(0);
    expect(forecast.projections[forecast.projections.length - 1].projectedValue).toBeGreaterThan(0.44);
    expect(forecast.uncertainty).toBeDefined();
    expect(forecast.inputObservationIds).toHaveLength(5);
    expect(forecast.explanation).toContain('NDCI');
    expect(forecast.explanation).toContain('proxies');
  });

  it('generates a forecast using PersistenceBaselineModel', () => {
    const forecast = ForecastingEngine.generateForecast({
      observations: sampleObservations,
      reach: sampleReach,
      indicator: 'NDCI',
      horizonHours: 48,
      modelId: 'persistence-baseline-v1',
    });

    expect(forecast.isSufficientData).toBe(true);
    expect(forecast.modelId).toBe('persistence-baseline-v1');
    // Persistence model holds current value constant
    forecast.projections.forEach((p) => {
      expect(p.projectedValue).toBe(0.44);
    });
    // Uncertainty upper bound expands with step
    const firstProj = forecast.projections[0];
    const lastProj = forecast.projections[forecast.projections.length - 1];
    expect(lastProj.upperBound).toBeGreaterThan(firstProj.upperBound);
  });

  it('generates a forecast using EwmaDampedTrendModel', () => {
    const forecast = ForecastingEngine.generateForecast({
      observations: sampleObservations,
      reach: sampleReach,
      indicator: 'NDCI',
      horizonHours: 72,
      modelId: 'ewma-damped-trend-v1',
    });

    expect(forecast.isSufficientData).toBe(true);
    expect(forecast.modelId).toBe('ewma-damped-trend-v1');
    expect(forecast.projections.length).toBeGreaterThan(0);
  });

  it('fails data quality gate cleanly for sparse data and does not fabricate numbers', () => {
    const sparseObservations = sampleObservations.slice(0, 1); // only 1 observation
    const forecast = ForecastingEngine.generateForecast({
      observations: sparseObservations,
      reach: sampleReach,
      indicator: 'NDCI',
      horizonHours: 72,
    });

    expect(forecast.isSufficientData).toBe(false);
    expect(forecast.projections).toHaveLength(0);
    expect(forecast.uncertainty).toBe('INSUFFICIENT');
    expect(forecast.confidence).toBe('INSUFFICIENT');
    expect(forecast.explanation).toContain('Insufficient evidence for projection');
  });
});
