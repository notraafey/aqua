import { describe, it, expect } from 'vitest';
import { temporalCorrelator } from '../../src/domain/evidence/temporal-correlator.js';
import { Observation } from '@aquasentinel/shared';

describe('Temporal Correlator Unit Tests', () => {
  const makeObs = (timestamp: string, source: any = 'SATELLITE_SENTINEL2'): Observation => ({
    id: 'test-obs',
    source,
    timestamp,
    location: { type: 'Point', coordinates: [22.0, 39.0] },
    streamReachId: 'reach-1',
    indicator: 'NDCI',
    value: 0.4,
    unit: 'index',
    quality: 'VALIDATED',
    provenance: {
      id: 'p1',
      entityId: 'test-obs',
      entityType: 'OBSERVATION',
      source,
      sourceIdentifier: 'src',
      acquisitionTimestamp: timestamp,
      ingestionTimestamp: timestamp,
      processingTimestamp: timestamp,
      processingMethod: 'test',
      qualityStatus: 'VALIDATED',
    },
    createdAt: timestamp,
  });

  it('assigns HIGH relevance to observations within 3 hours', () => {
    const obs = makeObs('2026-09-17T11:00:00.000Z');
    const ref = '2026-09-17T10:00:00.000Z'; // 60 min delta
    const res = temporalCorrelator.correlate(obs, ref);

    expect(res.isMatch).toBe(true);
    expect(res.deltaMinutes).toBe(60);
    expect(res.relevance).toBe('HIGH');
  });

  it('assigns MEDIUM relevance to observations within 12 hours', () => {
    const obs = makeObs('2026-09-17T18:00:00.000Z');
    const ref = '2026-09-17T10:00:00.000Z'; // 8 hours = 480 min delta
    const res = temporalCorrelator.correlate(obs, ref);

    expect(res.isMatch).toBe(true);
    expect(res.deltaMinutes).toBe(480);
    expect(res.relevance).toBe('MEDIUM');
  });

  it('rejects observations that exceed source-specific temporal window', () => {
    // Weather observations have a 12 hour window
    const weatherObs = makeObs('2026-09-16T12:00:00.000Z', 'WEATHER_STATION');
    const ref = '2026-09-17T10:00:00.000Z'; // 22 hours later
    const res = temporalCorrelator.correlate(weatherObs, ref);

    expect(res.isMatch).toBe(false);
    expect(res.flags).toContain('temporal_window_exceeded');
  });

  it('handles invalid timestamp gracefully', () => {
    const badObs = makeObs('invalid-date');
    const res = temporalCorrelator.correlate(badObs, '2026-09-17T10:00:00.000Z');

    expect(res.isMatch).toBe(false);
    expect(res.flags).toContain('invalid_timestamp');
  });
});
