import { describe, it, expect } from 'vitest';
import { scoringEngine } from '../../src/domain/evidence/scoring-engine.js';
import { Observation, StreamReach } from '@aquasentinel/shared';

describe('Scoring Engine Unit Tests (Boundaries, Normalization & Rationale)', () => {
  const reach: StreamReach = {
    id: 'reach-scoring-test',
    name: 'Almyros Test Reach',
    city: 'Volos',
    region: 'Thessaly',
    monitoringStatus: 'ACTIVE',
    geometry: { type: 'Point', coordinates: [22.75, 39.18] },
    baselineData: { typicalNdci: 0.12 },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const makeObs = (source: any, indicator: string, value: any, coords: [number, number] = [22.75, 39.18]): Observation => ({
    id: `obs-${Math.random()}`,
    source,
    timestamp: '2026-09-17T10:00:00.000Z',
    location: { type: 'Point', coordinates: coords },
    streamReachId: reach.id,
    indicator,
    value,
    unit: 'units',
    quality: 'VALIDATED',
    provenance: {
      id: `p-${Math.random()}`,
      entityId: 'test',
      entityType: 'OBSERVATION',
      source,
      sourceIdentifier: 'src',
      acquisitionTimestamp: '2026-09-17T10:00:00.000Z',
      ingestionTimestamp: '2026-09-17T10:00:00.000Z',
      processingTimestamp: '2026-09-17T10:00:00.000Z',
      processingMethod: 'test',
      qualityStatus: 'VALIDATED',
    },
    metadata: { qualityScore: 0.9 },
    createdAt: '2026-09-17T10:00:00.000Z',
  });

  it('tests operational confidence band boundaries', () => {
    expect(scoringEngine.resolveConfidenceBand(0)).toBe('NORMAL');
    expect(scoringEngine.resolveConfidenceBand(39)).toBe('NORMAL');
    expect(scoringEngine.resolveConfidenceBand(40)).toBe('VERIFY');
    expect(scoringEngine.resolveConfidenceBand(59)).toBe('VERIFY');
    expect(scoringEngine.resolveConfidenceBand(60)).toBe('INVESTIGATE');
    expect(scoringEngine.resolveConfidenceBand(79)).toBe('INVESTIGATE');
    expect(scoringEngine.resolveConfidenceBand(80)).toBe('PRIORITIZE');
    expect(scoringEngine.resolveConfidenceBand(100)).toBe('PRIORITIZE');
  });

  it('generates fully populated score breakdown and explainable rationale', () => {
    const satObs = makeObs('SATELLITE_SENTINEL2', 'NDCI', 0.45);
    const citizenObs = makeObs('CITIZEN_REPORT', 'WATER_COLOR', 'Green film with foul odor');

    const assessment = scoringEngine.evaluate({
      streamReach: reach,
      triggerObservation: satObs,
      candidateObservations: [satObs, citizenObs],
    });

    expect(assessment.score).toBeGreaterThanOrEqual(0);
    expect(assessment.score).toBeLessThanOrEqual(100);
    expect(assessment.scoringVersion).toBe('v1.0');

    // Score breakdown checks
    expect(assessment.scoreBreakdown).toBeDefined();
    expect(assessment.scoreBreakdown.anomalyContribution).toBeGreaterThan(0);
    expect(assessment.scoreBreakdown.corroborationContribution).toBeGreaterThan(0);
    expect(assessment.scoreBreakdown.spatialContribution).toBeGreaterThan(0);

    // Rationale checks: must answer all 4 mandatory questions
    expect(assessment.rationale.whatChanged).toBeTruthy();
    expect(assessment.rationale.whatCorroborates).toBeTruthy();
    expect(assessment.rationale.whatWeakens).toBeTruthy();
    expect(assessment.rationale.whatIsMissing).toBeTruthy();

    // Scientific Guardrail check: no clinical certainty claims
    expect(assessment.rationale.summary).toContain('Evidence Confidence Score:');
    expect(assessment.rationale.summary).not.toContain('Confirmed cyanobacterial bloom');
    expect(assessment.rationale.summary).not.toContain('% probability');
  });

  it('clamps extreme negative penalty to 0 minimum', () => {
    const farDistantBadObs = makeObs('SATELLITE_SENTINEL2', 'NDCI', 0.02, [0, 0]); // Middle of Atlantic ocean
    const assessment = scoringEngine.evaluate({
      streamReach: reach,
      candidateObservations: [farDistantBadObs],
    });

    expect(assessment.score).toBeGreaterThanOrEqual(0);
  });
});
