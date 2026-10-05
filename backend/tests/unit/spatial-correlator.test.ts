import { describe, it, expect } from 'vitest';
import { spatialCorrelator } from '../../src/domain/evidence/spatial-correlator.js';
import { Observation, StreamReach } from '@aquasentinel/shared';

describe('Spatial Correlator Unit Tests', () => {
  const reach: StreamReach = {
    id: 'reach-volos-alpha',
    name: 'Almyros Stream Reach Alpha',
    city: 'Volos',
    region: 'Thessaly',
    monitoringStatus: 'ACTIVE',
    geometry: {
      type: 'LineString',
      coordinates: [
        [22.751, 39.182],
        [22.7535, 39.1812],
        [22.757, 39.1798],
      ],
    },
    waterCoverageConstraint: {
      minWidthMeters: 14, // Narrow stream (<20m)
      confidencePenalty: 0.2,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const createObs = (coords: [number, number], source: any = 'SATELLITE_SENTINEL2'): Observation => ({
    id: 'obs-test-01',
    source,
    timestamp: '2026-09-17T10:00:00.000Z',
    location: { type: 'Point', coordinates: coords },
    streamReachId: reach.id,
    indicator: 'NDCI',
    value: 0.35,
    unit: 'index',
    quality: 'VALIDATED',
    provenance: {
      id: 'prov-01',
      entityId: 'obs-test-01',
      entityType: 'OBSERVATION',
      source,
      sourceIdentifier: 'TEST_SRC',
      acquisitionTimestamp: '2026-09-17T10:00:00.000Z',
      ingestionTimestamp: '2026-09-17T10:00:00.000Z',
      processingTimestamp: '2026-09-17T10:00:00.000Z',
      processingMethod: 'TEST_METHOD',
      qualityStatus: 'VALIDATED',
    },
    createdAt: '2026-09-17T10:00:00.000Z',
  });

  it('matches observation close to reach centerline with HIGH relevance', () => {
    const obs = createObs([22.7535, 39.1812]); // Exact vertex
    const res = spatialCorrelator.correlateToReach(obs, reach);

    expect(res.isMatch).toBe(true);
    expect(res.distanceMeters).toBeLessThan(10);
    expect(res.relevance).toBe('HIGH');
  });

  it('identifies narrow stream mixed-pixel risk for satellite observation', () => {
    const obs = createObs([22.7535, 39.1812], 'SATELLITE_SENTINEL2');
    const res = spatialCorrelator.correlateToReach(obs, reach);

    expect(res.flags).toContain('narrow_stream_mixed_pixel');
    expect(res.penalty).toBe(10);
  });

  it('does not apply mixed-pixel penalty for citizen observation on narrow stream', () => {
    const obs = createObs([22.7535, 39.1812], 'CITIZEN_REPORT');
    const res = spatialCorrelator.correlateToReach(obs, reach);

    expect(res.flags).not.toContain('narrow_stream_mixed_pixel');
    expect(res.penalty).toBe(0);
  });

  it('marks distant observation as not matched when exceeding max radius', () => {
    const farObs = createObs([23.5, 40.0]); // Many kilometers away
    const res = spatialCorrelator.correlateToReach(farObs, reach);

    expect(res.isMatch).toBe(false);
    expect(res.distanceMeters).toBeGreaterThan(1000);
  });

  it('correlates two nearby observations within default radius', () => {
    const obsA = createObs([22.7535, 39.1812]);
    const obsB = createObs([22.754, 39.1815]); // ~50m apart
    const res = spatialCorrelator.correlateObservations(obsA, obsB);

    expect(res.isMatch).toBe(true);
    expect(res.distanceMeters).toBeLessThan(100);
  });
});
