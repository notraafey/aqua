import { describe, it, expect } from 'vitest';
import { ForecastingEngine } from '../../src/domain/analytics/forecasting-engine.js';
import { Observation, StreamReach } from '@aquasentinel/shared';

describe('Data Leakage Protection Unit Tests', () => {
  const testReach: StreamReach = {
    id: 'reach-leakage-test',
    name: 'Almyros Test Reach',
    city: 'Volos',
    region: 'Thessaly',
    monitoringStatus: 'ACTIVE',
    geometry: { type: 'Point', coordinates: [22.75, 39.18] },
    baselineData: { typicalNdci: 0.12 },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  // Forecast origin T is set to 2026-09-10T12:00:00.000Z
  const T = '2026-09-10T12:00:00.000Z';

  // Past observations (valid at T)
  const pastObservations: Observation[] = [
    {
      id: 'obs-past-1',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.15,
      timestamp: '2026-09-05T10:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      streamReachId: testReach.id,
      qualityScore: 0.9,
      qualityStatus: 'ASSESSED',
      provenanceRecord: {
        ingestedAt: '2026-09-05T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'h1',
        isSynthetic: false,
      },
      createdAt: '2026-09-05T10:00:00.000Z',
    },
    {
      id: 'obs-past-2',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.20,
      timestamp: '2026-09-07T10:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      streamReachId: testReach.id,
      qualityScore: 0.9,
      qualityStatus: 'ASSESSED',
      provenanceRecord: {
        ingestedAt: '2026-09-07T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'h2',
        isSynthetic: false,
      },
      createdAt: '2026-09-07T10:00:00.000Z',
    },
    {
      id: 'obs-past-3',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.25,
      timestamp: '2026-09-10T10:00:00.000Z', // 2h before T
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      streamReachId: testReach.id,
      qualityScore: 0.95,
      qualityStatus: 'ASSESSED',
      provenanceRecord: {
        ingestedAt: '2026-09-10T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'h3',
        isSynthetic: false,
      },
      createdAt: '2026-09-10T10:00:00.000Z',
    },
  ];

  // Future observations occurring strictly AFTER T
  const futureObservations: Observation[] = [
    {
      id: 'obs-future-1',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.85, // Huge future spike that would drastically distort trend slope if leaked!
      timestamp: '2026-09-11T10:00:00.000Z', // 22h after T
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      streamReachId: testReach.id,
      qualityScore: 0.95,
      qualityStatus: 'ASSESSED',
      provenanceRecord: {
        ingestedAt: '2026-09-11T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'hf1',
        isSynthetic: false,
      },
      createdAt: '2026-09-11T10:00:00.000Z',
    },
    {
      id: 'obs-future-2',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.92,
      timestamp: '2026-09-13T10:00:00.000Z', // 3 days after T
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      streamReachId: testReach.id,
      qualityScore: 0.95,
      qualityStatus: 'ASSESSED',
      provenanceRecord: {
        ingestedAt: '2026-09-13T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'hf2',
        isSynthetic: false,
      },
      createdAt: '2026-09-13T10:00:00.000Z',
    },
  ];

  it('strictly excludes observations occurring after origin timestamp T from forecast computation', () => {
    // Forecast A: Computed using ONLY past observations
    const forecastA = ForecastingEngine.generateForecast({
      observations: pastObservations,
      reach: testReach,
      indicator: 'NDCI',
      horizonHours: 48,
      originTimestamp: T,
      modelId: 'linear-trend-v1',
    });

    // Forecast B: Computed using a mixed dataset containing future observations
    const forecastB = ForecastingEngine.generateForecast({
      observations: [...pastObservations, ...futureObservations],
      reach: testReach,
      indicator: 'NDCI',
      horizonHours: 48,
      originTimestamp: T, // Explicitly anchored at T
      modelId: 'linear-trend-v1',
    });

    // 1. None of the future observation IDs may appear in inputObservationIds
    expect(forecastB.inputObservationIds).not.toContain('obs-future-1');
    expect(forecastB.inputObservationIds).not.toContain('obs-future-2');
    expect(forecastB.inputObservationIds).toEqual(forecastA.inputObservationIds);

    // 2. Training window end timestamp must be <= T
    const trainingEndMs = new Date(forecastB.trainingWindow.end).getTime();
    const tOriginMs = new Date(T).getTime();
    expect(trainingEndMs).toBeLessThanOrEqual(tOriginMs);

    // 3. The current value must be from the latest observation <= T (0.25, not 0.92)
    expect(forecastB.currentValue).toBe(0.25);

    // 4. Projections must be 100% mathematically identical between Forecast A and B
    expect(forecastB.projections).toEqual(forecastA.projections);
    expect(forecastB.trendSlopePerDay).toEqual(forecastA.trendSlopePerDay);
  });
});
