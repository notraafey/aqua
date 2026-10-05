import { describe, it, expect } from 'vitest';
import { severityCalculator } from '../../src/domain/response/severity-calculator.js';
import {
  EvidenceAssessment,
  IncidentClassification,
  StreamReach,
} from '@aquasentinel/shared';

describe('Severity Calculator Unit Tests (Phase 4 Decoupled Severity)', () => {
  const mockUrbanReach: StreamReach = {
    id: 'reach-urban-high-pop',
    name: 'Downtown Estuary Reach',
    city: 'Heraklion',
    country: 'Greece',
    pilotSiteId: 'GR-HER-01',
    geometry: {
      type: 'LineString',
      coordinates: [
        [25.13, 35.33],
        [25.14, 35.34],
      ],
    },
    screeningThresholds: {},
    baselineStatus: 'MONITORED',
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
  };

  const createBaseAssessment = (score: number, band: any): EvidenceAssessment => ({
    id: 'eval-sev',
    streamReachId: mockUrbanReach.id,
    evaluatedAt: '2026-09-17T12:00:00.000Z',
    score,
    confidenceBand: band,
    supportingEvidence: [],
    contradictingEvidence: [],
    missingEvidence: [],
    independentSourceGroups: ['REMOTE_SENSING', 'IN_SITU'],
    groupContributions: {},
    dimensionScores: {
      spatialProximity: 80,
      temporalProximity: 80,
      severityExceedance: 80,
      sourceIndependence: 80,
      reproducibility: 80,
    },
    scoringBreakdown: {
      baseScore: score,
      penalties: { dataQualityPenalty: 0, missingGroupPenalty: 0, contradictionPenalty: 0 },
      netScore: score,
      band,
      details: [],
    },
    dataQualityAudit: {
      totalObservationsEvaluated: 2,
      observationsFilteredOut: 0,
      observationsDemoted: 0,
      filterReasons: [],
      demoteReasons: [],
    },
  });

  it('calculates CRITICAL severity for high-confidence cyanobacteria bloom in urban reach', () => {
    const assessment = createBaseAssessment(92, 'PRIORITIZE');
    const classification: IncidentClassification = {
      type: 'POSSIBLE_CYANOBLOOM',
      confidence: 0.95,
      primaryIndicators: ['NDCI', 'DISSOLVED_OXYGEN'],
      stressorEvidence: ['Harmful cyanotoxins suspected', 'Acute hypoxia'],
      rationale: 'Severe bloom with ground validation',
      classifiedAt: '2026-09-17T12:00:00.000Z',
    };

    const severity = severityCalculator.calculate(assessment, classification, mockUrbanReach);
    expect(severity.level).toBe('CRITICAL');
    expect(severity.score).toBeGreaterThanOrEqual(75);
    expect(severity.factors.hazardProfile).toBeGreaterThanOrEqual(85);
    expect(severity.factors.exposurePotential).toBeGreaterThanOrEqual(70);
    expect(severity.explanations.length).toBeGreaterThanOrEqual(3);
  });

  it('calculates LOW severity for low-confidence stormwater anomaly', () => {
    const assessment = createBaseAssessment(30, 'NORMAL');
    const classification: IncidentClassification = {
      type: 'POSSIBLE_STORMWATER_EVENT',
      confidence: 0.4,
      primaryIndicators: ['TURBIDITY'],
      stressorEvidence: ['Minor turbidity elevation'],
      rationale: 'Routine seasonal precipitation runoff',
      classifiedAt: '2026-09-17T12:00:00.000Z',
    };

    const severity = severityCalculator.calculate(assessment, classification, mockUrbanReach);
    expect(severity.level).toBe('LOW');
    expect(severity.score).toBeLessThan(40);
  });

  it('enforces weighted factor balance across all 5 dimensions', () => {
    const assessment = createBaseAssessment(70, 'INVESTIGATE');
    const classification: IncidentClassification = {
      type: 'POSSIBLE_EUTROPHICATION',
      confidence: 0.8,
      primaryIndicators: ['NDCI'],
      stressorEvidence: ['Moderate algal bloom'],
      rationale: 'Eutrophication with moderate risk',
      classifiedAt: '2026-09-17T12:00:00.000Z',
    };

    const severity = severityCalculator.calculate(assessment, classification, mockUrbanReach);
    expect(severity.factors).toBeDefined();
    expect(severity.factors.confidenceFactor).toBeGreaterThan(0);
    expect(severity.factors.hazardProfile).toBeGreaterThan(0);
    expect(severity.factors.exposurePotential).toBeGreaterThan(0);
    expect(severity.factors.publicVisibility).toBeGreaterThan(0);
    expect(severity.factors.ecologicalImpact).toBeGreaterThan(0);
  });
});
