import { describe, it, expect } from 'vitest';
import { baselineService } from '../../src/domain/evidence/baseline-service.js';
import { Observation, StreamReach } from '@aquasentinel/shared';

describe('Baseline Service Unit Tests', () => {
  const reachWithBaseline: StreamReach = {
    id: 'reach-01',
    name: 'Almyros Reach',
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

  const reachWithoutBaseline: StreamReach = {
    id: 'reach-02',
    name: 'Wild Creek',
    city: 'Pelion',
    region: 'Thessaly',
    monitoringStatus: 'ACTIVE',
    geometry: { type: 'Point', coordinates: [23.0, 39.3] },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const makeObs = (val: number, id = 'curr-obs'): Observation => ({
    id,
    source: 'SATELLITE_SENTINEL2',
    timestamp: '2026-09-17T10:00:00.000Z',
    location: { type: 'Point', coordinates: [22.75, 39.18] },
    streamReachId: 'reach-01',
    indicator: 'NDCI',
    value: val,
    unit: 'index',
    quality: 'VALIDATED',
    provenance: {
      id: 'p1',
      entityId: id,
      entityType: 'OBSERVATION',
      source: 'SATELLITE_SENTINEL2',
      sourceIdentifier: 'src',
      acquisitionTimestamp: '2026-09-17T10:00:00.000Z',
      ingestionTimestamp: '2026-09-17T10:00:00.000Z',
      processingTimestamp: '2026-09-17T10:00:00.000Z',
      processingMethod: 'NDCI',
      qualityStatus: 'VALIDATED',
    },
    createdAt: '2026-09-17T10:00:00.000Z',
  });

  it('detects significant anomaly against reach baselineData', () => {
    const obs = makeObs(0.45); // Deviation +0.33 above typicalNdci (0.12)
    const res = baselineService.evaluate(obs, [], reachWithBaseline);

    expect(res.status).toBe('AVAILABLE');
    expect(res.isAnomaly).toBe(true);
    expect(res.deviation?.expected).toBe(0.12);
    expect(res.deviation?.actual).toBe(0.45);
    expect(res.deviation?.deviation).toBe(0.33);
  });

  it('calculates historical median and z-score when sufficient empirical observations exist', () => {
    const historical = [
      makeObs(0.10, 'h1'),
      makeObs(0.12, 'h2'),
      makeObs(0.11, 'h3'),
      makeObs(0.13, 'h4'),
    ];
    const current = makeObs(0.55); // Severe spike

    const res = baselineService.evaluate(current, historical, reachWithoutBaseline);

    expect(res.status).toBe('AVAILABLE');
    expect(res.isAnomaly).toBe(true);
    expect(res.deviation?.sampleCount).toBe(4);
    expect(res.deviation?.standardDeviations).toBeGreaterThan(3); // > 3 sigma deviation
  });

  it('explicitly returns INSUFFICIENT when fewer than required historical observations exist', () => {
    const insufficientHistory = [makeObs(0.12, 'h1')]; // Only 1 observation (min required is 3)
    const current = makeObs(0.30);

    const res = baselineService.evaluate(current, insufficientHistory, reachWithoutBaseline);

    expect(res.status).toBe('INSUFFICIENT');
    expect(res.isAnomaly).toBe(false);
  });

  it('explicitly returns UNAVAILABLE when no historical observations or reach baseline exist', () => {
    const current = makeObs(0.40);
    const res = baselineService.evaluate(current, [], reachWithoutBaseline);

    expect(res.status).toBe('UNAVAILABLE');
    expect(res.isAnomaly).toBe(false);
    expect(res.reason).toContain('Baseline unavailable');
  });
});
