import { describe, it, expect } from 'vitest';
import { RecommendationEngine } from '../../src/domain/response/recommendation-engine.js';
import { SEED_CATALOGUE_MEASURES } from '../../src/domain/catalogue/seed-measures.js';
import {
  EvidenceAssessment,
  IncidentClassification,
  OperationalSeverity,
  StreamReach,
} from '@aquasentinel/shared';

describe('Recommendation Engine Unit Tests (Phase 4 Scoring & Safety Gates)', () => {
  const engine = new RecommendationEngine();

  const mockReach: StreamReach = {
    id: 'reach-test-1',
    name: 'Almyros Coastal Reach',
    city: 'Heraklion',
    country: 'Greece',
    pilotSiteId: 'GR-HER-01',
    geometry: {
      type: 'LineString',
      coordinates: [
        [25.05, 35.33],
        [25.06, 35.34],
      ],
    },
    screeningThresholds: {},
    baselineStatus: 'MONITORED',
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
  };

  const createMockAssessment = (
    score: number,
    band: any,
    sources: ('REMOTE_SENSING' | 'IN_SITU' | 'CITIZEN' | 'WEATHER')[]
  ): EvidenceAssessment => ({
    id: 'eval-rec-1',
    streamReachId: mockReach.id,
    evaluatedAt: '2026-09-17T12:00:00.000Z',
    score,
    confidenceBand: band,
    supportingEvidence: sources.map((s, idx) => ({
      observationId: `obs-${idx}`,
      source: s === 'REMOTE_SENSING' ? 'SATELLITE_SENTINEL2' : s === 'IN_SITU' ? 'IOT_SENSOR' : 'CITIZEN_REPORT',
      corroborationGroup: s,
      indicator: s === 'REMOTE_SENSING' ? 'NDCI' : 'DISSOLVED_OXYGEN',
      value: 0.35,
      unit: 'index',
      weight: 0.85,
      reason: 'Anomalous signal',
    })),
    contradictingEvidence: [],
    missingEvidence: [],
    independentSourceGroups: sources,
    groupContributions: {},
    dimensionScores: {
      spatialProximity: 80,
      temporalProximity: 85,
      severityExceedance: 80,
      sourceIndependence: 85,
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
      totalObservationsEvaluated: sources.length,
      observationsFilteredOut: 0,
      observationsDemoted: 0,
      filterReasons: [],
      demoteReasons: [],
    },
  });

  const mockClassification: IncidentClassification = {
    type: 'POSSIBLE_CYANOBLOOM',
    confidence: 0.88,
    primaryIndicators: ['NDCI', 'DISSOLVED_OXYGEN'],
    stressorEvidence: ['Cyanotoxins suspected', 'Hypoxia'],
    rationale: 'Harmful algal bloom indicators verified',
    classifiedAt: '2026-09-17T12:00:00.000Z',
  };

  const mockSeverity: OperationalSeverity = {
    level: 'HIGH',
    score: 72,
    factors: {
      confidenceFactor: 80,
      hazardProfile: 85,
      exposurePotential: 65,
      publicVisibility: 60,
      ecologicalImpact: 70,
    },
    explanations: ['High hazard cyanobacteria profile', 'Corroborated ground data'],
    evaluatedAt: '2026-09-17T12:00:00.000Z',
  };

  it('generates ranked recommendations matching applicable incident types and suitability scores', () => {
    const assessment = createMockAssessment(82, 'PRIORITIZE', ['REMOTE_SENSING', 'IN_SITU']);
    const recs = engine.evaluateRecommendations(
      'inc-1',
      assessment,
      mockClassification,
      mockSeverity,
      mockReach,
      SEED_CATALOGUE_MEASURES
    );

    expect(recs.length).toBeGreaterThan(0);
    // Highest ranked recommendation should have high suitability score
    expect(recs[0].rank).toBe(1);
    expect(recs[0].suitabilityScore).toBeGreaterThanOrEqual(60);
    // All returned recs should require human approval (PRD governance)
    expect(recs.every((r) => r.humanApprovalRequired)).toBe(true);
  });

  it('enforces Single-Satellite Anomaly Gate: suppresses public advisory and aeration on satellite-only evidence', () => {
    // Only REMOTE_SENSING source group
    const satelliteOnlyAssessment = createMockAssessment(70, 'INVESTIGATE', ['REMOTE_SENSING']);
    const recs = engine.evaluateRecommendations(
      'inc-single-sat',
      satelliteOnlyAssessment,
      mockClassification,
      mockSeverity,
      mockReach,
      SEED_CATALOGUE_MEASURES
    );

    // High consequence measures must be gated out
    const publicAdvisories = recs.filter((r) => r.actionType === 'PUBLIC_ADVISORY' || r.measureId === 'OAH-M-PUB-06');
    const remediationAeration = recs.filter((r) => r.measureId === 'OAH-M-REMED-09');
    expect(publicAdvisories.length).toBe(0);
    expect(remediationAeration.length).toBe(0);

    // Investigatory measures should still be present
    const fieldInvestigations = recs.filter((r) => r.measureId === 'OAH-M-VERIFY-01' || r.measureId === 'OAH-M-SAMPLE-02' || r.actionType === 'FIELD_INVESTIGATION');
    expect(fieldInvestigations.length).toBeGreaterThan(0);
  });

  it('generates explainable 4-question rationale details', () => {
    const assessment = createMockAssessment(82, 'PRIORITIZE', ['REMOTE_SENSING', 'IN_SITU']);
    const recs = engine.evaluateRecommendations(
      'inc-rat-1',
      assessment,
      mockClassification,
      mockSeverity,
      mockReach,
      SEED_CATALOGUE_MEASURES
    );

    const rec = recs[0];
    expect(rec.rationaleDetails).toBeDefined();
    expect(rec.rationaleDetails.whyThis).toContain(mockReach.name);
    expect(rec.rationaleDetails.whyNow).toContain(assessment.confidenceBand);
    expect(rec.rationaleDetails.whatSupportsIt.length).toBeGreaterThan(0);
  });

  it('produces deterministic idempotency signatures for duplicate evaluations', () => {
    const assessment = createMockAssessment(82, 'PRIORITIZE', ['REMOTE_SENSING', 'IN_SITU']);
    const recs1 = engine.evaluateRecommendations(
      'inc-dup-1',
      assessment,
      mockClassification,
      mockSeverity,
      mockReach,
      SEED_CATALOGUE_MEASURES
    );
    const recs2 = engine.evaluateRecommendations(
      'inc-dup-1',
      assessment,
      mockClassification,
      mockSeverity,
      mockReach,
      SEED_CATALOGUE_MEASURES
    );

    expect(recs1.length).toBe(recs2.length);
    for (let i = 0; i < recs1.length; i++) {
      expect(recs1[i].idempotencyKey).toBe(recs2[i].idempotencyKey);
      expect(recs1[i].measureId).toBe(recs2[i].measureId);
      expect(recs1[i].suitabilityScore).toBe(recs2[i].suitabilityScore);
    }
  });
});
