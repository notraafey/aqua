import { describe, it, expect } from 'vitest';
import { scoringEngine } from '../../src/domain/evidence/scoring-engine.js';
import { Observation, StreamReach } from '@aquasentinel/shared';

describe('False-Positive & Boundary Robustness Unit Tests', () => {
  const reach: StreamReach = {
    id: 'reach-fp-test',
    name: 'Almyros Stream',
    city: 'Volos',
    region: 'Thessaly',
    monitoringStatus: 'ACTIVE',
    geometry: { type: 'Point', coordinates: [22.7535, 39.1812] },
    waterCoverageConstraint: { minWidthMeters: 14, confidencePenalty: 0.2 },
    baselineData: { typicalNdci: 0.12 },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const makeObs = (params: {
    source: any;
    indicator: string;
    value: any;
    coords?: [number, number];
    timestamp?: string;
    qualityFlags?: string[];
    qualityScore?: number;
  }): Observation => ({
    id: `obs-${Math.random()}`,
    source: params.source,
    timestamp: params.timestamp || '2026-09-17T10:00:00.000Z',
    location: { type: 'Point', coordinates: params.coords || [22.7535, 39.1812] },
    streamReachId: reach.id,
    indicator: params.indicator,
    value: params.value,
    unit: 'units',
    quality: 'VALIDATED',
    provenance: {
      id: `p-${Math.random()}`,
      entityId: 'test',
      entityType: 'OBSERVATION',
      source: params.source,
      sourceIdentifier: 'src',
      acquisitionTimestamp: params.timestamp || '2026-09-17T10:00:00.000Z',
      ingestionTimestamp: params.timestamp || '2026-09-17T10:00:00.000Z',
      processingTimestamp: params.timestamp || '2026-09-17T10:00:00.000Z',
      processingMethod: 'test',
      qualityStatus: 'VALIDATED',
    },
    metadata: {
      qualityReasons: params.qualityFlags,
      qualityScore: params.qualityScore ?? 0.9,
    },
    createdAt: '2026-09-17T10:00:00.000Z',
  });

  it('ensures satellite-only anomaly does NOT automatically escalate to PRIORITIZE', () => {
    const satObs = makeObs({
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.45,
    });

    const assessment = scoringEngine.evaluate({
      streamReach: reach,
      triggerObservation: satObs,
      candidateObservations: [satObs],
    });

    expect(assessment.confidenceBand).not.toBe('PRIORITIZE');
    expect(assessment.score).toBeLessThan(80);
    expect(assessment.confidenceBand).toBe('VERIFY');
  });

  it('penalizes low-quality satellite anomaly with narrow stream and high cloud cover', () => {
    const highQualitySat = makeObs({
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.45,
      qualityScore: 0.95,
    });

    const lowQualitySat = makeObs({
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.45,
      qualityFlags: ['narrow_stream_mixed_pixel', 'high_cloud_cover_uncertainty'],
      qualityScore: 0.4,
    });

    const highAssessment = scoringEngine.evaluate({
      streamReach: reach,
      candidateObservations: [highQualitySat],
    });

    const lowAssessment = scoringEngine.evaluate({
      streamReach: reach,
      candidateObservations: [lowQualitySat],
    });

    expect(lowAssessment.score).toBeLessThan(highAssessment.score);
    expect(lowAssessment.scoreBreakdown.qualityPenalty).toBeGreaterThan(0);
  });

  it('does NOT corroborate when citizen observation is spatially distant', () => {
    const satObs = makeObs({ source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.45 });
    const distantCitizen = makeObs({
      source: 'CITIZEN_REPORT',
      indicator: 'WATER_COLOR',
      value: 'Greenish',
      coords: [25.0, 38.0], // ~200 km away
    });

    const assessment = scoringEngine.evaluate({
      streamReach: reach,
      candidateObservations: [satObs, distantCitizen],
    });

    // Distant citizen observation must be marked CONTRADICTING/UNMATCHED and not add corroboration bonus
    expect(assessment.independentSourceGroups).not.toContain('CITIZEN');
    expect(assessment.contradictingEvidence.some((c) => c.rule === 'SPATIAL_MISMATCH')).toBe(true);
  });

  it('does NOT corroborate when citizen observation is temporally unrelated', () => {
    const satObs = makeObs({
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.45,
      timestamp: '2026-09-17T10:00:00.000Z',
    });
    const staleCitizen = makeObs({
      source: 'CITIZEN_REPORT',
      indicator: 'WATER_COLOR',
      value: 'Greenish',
      timestamp: '2026-09-01T10:00:00.000Z', // 16 days earlier
    });

    const assessment = scoringEngine.evaluate({
      streamReach: reach,
      candidateObservations: [satObs, staleCitizen],
    });

    expect(assessment.contradictingEvidence.some((c) => c.rule === 'TEMPORAL_MISMATCH')).toBe(true);
  });

  it('prevents 15 weather records from overwhelming a satellite + citizen signal', () => {
    const satObs = makeObs({ source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.45 });
    const citObs = makeObs({ source: 'CITIZEN_REPORT', indicator: 'WATER_COLOR', value: 'Greenish' });

    const baseAssessment = scoringEngine.evaluate({
      streamReach: reach,
      candidateObservations: [satObs, citObs],
    });

    // Add 15 weather observations
    const weatherSeries = Array.from({ length: 15 }, (_, i) =>
      makeObs({
        source: 'WEATHER_STATION',
        indicator: 'AIR_TEMP',
        value: 28.0 + (i % 3),
        timestamp: new Date(Date.now() - i * 3600 * 1000).toISOString(),
      })
    );

    const withWeatherAssessment = scoringEngine.evaluate({
      streamReach: reach,
      candidateObservations: [satObs, citObs, ...weatherSeries],
    });

    // Weather contribution must be capped at 15 points
    expect(withWeatherAssessment.scoreBreakdown.contextContribution).toBeLessThanOrEqual(15);
    // The increase from adding 15 weather records must be bounded and reasonable
    expect(withWeatherAssessment.score - baseAssessment.score).toBeLessThanOrEqual(30);
  });
});
