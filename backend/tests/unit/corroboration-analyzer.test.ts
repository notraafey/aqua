import { describe, it, expect } from 'vitest';
import { corroborationAnalyzer } from '../../src/domain/evidence/corroboration-analyzer.js';
import { Observation } from '@aquasentinel/shared';

describe('Corroboration Analyzer Unit Tests (Independence & Diminishing Returns)', () => {
  const createMockObs = (source: any, indicator: string, id: string): Observation => ({
    id,
    source,
    timestamp: '2026-09-17T10:00:00.000Z',
    location: { type: 'Point', coordinates: [22.0, 39.0] },
    streamReachId: 'reach-1',
    indicator,
    value: 10,
    unit: 'units',
    quality: 'VALIDATED',
    provenance: {
      id: `p-${id}`,
      entityId: id,
      entityType: 'OBSERVATION',
      source,
      sourceIdentifier: id,
      acquisitionTimestamp: '2026-09-17T10:00:00.000Z',
      ingestionTimestamp: '2026-09-17T10:00:00.000Z',
      processingTimestamp: '2026-09-17T10:00:00.000Z',
      processingMethod: 'test',
      qualityStatus: 'VALIDATED',
    },
    createdAt: '2026-09-17T10:00:00.000Z',
  });

  it('enforces diminishing returns: repeated observations from same source diminish in contribution', () => {
    // 3 citizen reports
    const citizenItems = [
      { observation: createMockObs('CITIZEN_REPORT', 'WATER_COLOR', 'c1'), baseScore: 20 },
      { observation: createMockObs('CITIZEN_REPORT', 'ODOR', 'c2'), baseScore: 20 },
      { observation: createMockObs('CITIZEN_REPORT', 'FOAM', 'c3'), baseScore: 20 },
    ];

    const res = corroborationAnalyzer.analyze(citizenItems);
    const citizenContrib = res.groupContributions.CITIZEN;

    // 1st: 20 * 1.0 = 20
    // 2nd: 20 * 0.5 = 10
    // 3rd: 20 * 0.1 = 2
    // Raw sum = 60, but diminishing sum = 32 (capped at CITIZEN cap 30)
    expect(citizenContrib.observationCount).toBe(3);
    expect(citizenContrib.rawPoints).toBe(60);
    expect(citizenContrib.effectivePoints).toBe(30); // Capped at 30
    expect(citizenContrib.isCapped).toBe(true);
  });

  it('enforces source-group caps: 20 weather observations cannot exceed WEATHER cap (15 pts)', () => {
    const weatherItems = Array.from({ length: 20 }, (_, idx) => ({
      observation: createMockObs('WEATHER_STATION', 'PRECIPITATION', `w${idx}`),
      baseScore: 8,
    }));

    const res = corroborationAnalyzer.analyze(weatherItems);
    const weatherContrib = res.groupContributions.WEATHER;

    // 20 * 8 = 160 raw points, but must be strictly capped at 15
    expect(weatherContrib.rawPoints).toBe(160);
    expect(weatherContrib.effectivePoints).toBe(15);
    expect(weatherContrib.isCapped).toBe(true);
  });

  it('awards +15 corroboration bonus for 2 independent groups (Satellite + Citizen)', () => {
    const items = [
      { observation: createMockObs('SATELLITE_SENTINEL2', 'NDCI', 's1'), baseScore: 25 },
      { observation: createMockObs('CITIZEN_REPORT', 'WATER_COLOR', 'c1'), baseScore: 20 },
    ];

    const res = corroborationAnalyzer.analyze(items);

    expect(res.independentGroups).toHaveLength(2);
    expect(res.independentGroups).toContain('REMOTE_SENSING');
    expect(res.independentGroups).toContain('CITIZEN');
    expect(res.corroborationBonus).toBe(15);
  });

  it('awards +25 corroboration bonus for 3+ independent groups (Satellite + Citizen + Weather)', () => {
    const items = [
      { observation: createMockObs('SATELLITE_SENTINEL2', 'NDCI', 's1'), baseScore: 25 },
      { observation: createMockObs('CITIZEN_REPORT', 'WATER_COLOR', 'c1'), baseScore: 20 },
      { observation: createMockObs('WEATHER_STATION', 'AIR_TEMP', 'w1'), baseScore: 8 },
    ];

    const res = corroborationAnalyzer.analyze(items);

    expect(res.independentGroups).toHaveLength(3);
    expect(res.corroborationBonus).toBe(25);
    expect(res.explanation).toContain('Multi-source corroboration confirmed across 3 independent groups');
  });
});
