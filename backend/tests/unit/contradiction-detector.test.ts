import { describe, it, expect } from 'vitest';
import { contradictionDetector } from '../../src/domain/evidence/contradiction-detector.js';
import { Observation, StreamReach } from '@aquasentinel/shared';

describe('Contradiction Detector Unit Tests', () => {
  const narrowReach: StreamReach = {
    id: 'reach-narrow',
    name: 'Narrow Stream',
    city: 'Volos',
    region: 'Thessaly',
    monitoringStatus: 'ACTIVE',
    geometry: { type: 'Point', coordinates: [22.0, 39.0] },
    waterCoverageConstraint: { minWidthMeters: 12, confidencePenalty: 0.2 },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const makeObs = (source: any, indicator: string, value: any, metadata: any = {}): Observation => ({
    id: 'obs-1',
    source,
    timestamp: '2026-09-17T10:00:00.000Z',
    location: { type: 'Point', coordinates: [22.0, 39.0] },
    streamReachId: 'reach-narrow',
    indicator,
    value,
    unit: 'units',
    quality: 'VALIDATED',
    provenance: {
      id: 'p1',
      entityId: 'obs-1',
      entityType: 'OBSERVATION',
      source,
      sourceIdentifier: 'src',
      acquisitionTimestamp: '2026-09-17T10:00:00.000Z',
      ingestionTimestamp: '2026-09-17T10:00:00.000Z',
      processingTimestamp: '2026-09-17T10:00:00.000Z',
      processingMethod: 'test',
      qualityStatus: 'VALIDATED',
    },
    metadata,
    createdAt: '2026-09-17T10:00:00.000Z',
  });

  it('detects contradiction when satellite anomaly occurs on narrow stream with no ground corroboration', () => {
    const satAnomaly = makeObs('SATELLITE_SENTINEL2', 'NDCI', 0.45);
    const res = contradictionDetector.detect({
      primaryAnomaly: satAnomaly,
      observations: [satAnomaly],
      reach: narrowReach,
      activeGroups: ['REMOTE_SENSING'], // Citizen not present
    });

    expect(res.hasContradictions).toBe(true);
    expect(res.contradictions[0].rule).toBe('UNCORROBORATED_NARROW_STREAM_SATELLITE');
    expect(res.totalPenalty).toBeGreaterThanOrEqual(10);
  });

  it('detects contradiction when concurrent observation shows normal baseline NDCI', () => {
    const satAnomaly = makeObs('SATELLITE_SENTINEL2', 'NDCI', 0.45);
    const normalReading = makeObs('SATELLITE_SENTINEL2', 'NDCI', 0.05); // Clean water
    normalReading.id = 'obs-2';

    const res = contradictionDetector.detect({
      primaryAnomaly: satAnomaly,
      observations: [satAnomaly, normalReading],
      reach: narrowReach,
      activeGroups: ['REMOTE_SENSING'],
    });

    expect(res.hasContradictions).toBe(true);
    const normalContradiction = res.contradictions.find((c) => c.rule === 'CONFLICTING_NORMAL_NDCI');
    expect(normalContradiction).toBeDefined();
    expect(normalContradiction?.penalty).toBe(25);
  });

  it('detects heavy rainfall explaining elevated turbidity as natural storm runoff', () => {
    const rainObs = makeObs('WEATHER_STATION', 'PRECIPITATION', 22.0); // 22mm heavy rain
    const turbObs = makeObs('IN_SITU_SENSOR', 'TURBIDITY', 18.0); // Elevated turbidity
    rainObs.id = 'obs-rain';
    turbObs.id = 'obs-turb';

    const res = contradictionDetector.detect({
      primaryAnomaly: turbObs,
      observations: [turbObs, rainObs],
      reach: narrowReach,
      activeGroups: ['WEATHER', 'IN_SITU'],
    });

    expect(res.hasContradictions).toBe(true);
    const stormContradiction = res.contradictions.find((c) => c.rule === 'STORM_RUNOFF_EXPLANATION');
    expect(stormContradiction).toBeDefined();
    expect(stormContradiction?.reason).toContain('natural meteorological explanation');
  });
});
