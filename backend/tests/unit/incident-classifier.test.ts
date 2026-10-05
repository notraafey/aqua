import { describe, it, expect } from 'vitest';
import { incidentClassifier } from '../../src/domain/response/incident-classifier.js';
import { EvidenceAssessment, StreamReach } from '@aquasentinel/shared';

describe('Incident Classifier Unit Tests (Phase 4 Deterministic Classification)', () => {
  const mockReach: StreamReach = {
    id: 'reach-urban-1',
    name: 'Upper Urban Reach',
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
    id: 'eval-1',
    streamReachId: mockReach.id,
    evaluatedAt: '2026-09-17T12:00:00.000Z',
    score,
    confidenceBand: band,
    supportingEvidence: [],
    contradictingEvidence: [],
    missingEvidence: [],
    independentSourceGroups: [],
    groupContributions: {},
    dimensionScores: {
      spatialProximity: 80,
      temporalProximity: 85,
      severityExceedance: 75,
      sourceIndependence: 90,
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
      totalObservationsEvaluated: 4,
      observationsFilteredOut: 0,
      observationsDemoted: 0,
      filterReasons: [],
      demoteReasons: [],
    },
  });

  it('classifies cyanobacterial bloom when NDCI is high and dissolved oxygen is low', () => {
    const assessment = createBaseAssessment(85, 'PRIORITIZE');
    assessment.supportingEvidence = [
      {
        observationId: 'obs-sat-1',
        source: 'SATELLITE_SENTINEL2',
        corroborationGroup: 'REMOTE_SENSING',
        indicator: 'NDCI',
        value: 0.35,
        unit: 'index',
        weight: 0.9,
        reason: 'Severe algal pigment signature detected',
      },
      {
        observationId: 'obs-iot-1',
        source: 'IOT_SENSOR',
        corroborationGroup: 'IN_SITU',
        indicator: 'DISSOLVED_OXYGEN',
        value: 2.1,
        unit: 'mg/L',
        weight: 0.85,
        reason: 'Anoxic event observed',
      },
    ];

    const result = incidentClassifier.classify(assessment, mockReach);
    expect(result.type).toBe('POSSIBLE_CYANOBLOOM');
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.primaryIndicators).toContain('NDCI');
    expect(result.rationale).toContain('Cyanobacterial bloom signature');
  });

  it('classifies eutrophication when NDCI is moderately elevated without severe hypoxia', () => {
    const assessment = createBaseAssessment(65, 'INVESTIGATE');
    assessment.supportingEvidence = [
      {
        observationId: 'obs-sat-2',
        source: 'SATELLITE_SENTINEL2',
        corroborationGroup: 'REMOTE_SENSING',
        indicator: 'NDCI',
        value: 0.18,
        unit: 'index',
        weight: 0.75,
        reason: 'Moderate chlorophyll peak',
      },
      {
        observationId: 'obs-iot-2',
        source: 'IOT_SENSOR',
        corroborationGroup: 'IN_SITU',
        indicator: 'TURBIDITY',
        value: 45.0,
        unit: 'NTU',
        weight: 0.7,
        reason: 'Elevated turbidity from phytoplankton suspension',
      },
    ];

    const result = incidentClassifier.classify(assessment, mockReach);
    expect(result.type).toBe('POSSIBLE_EUTROPHICATION');
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.primaryIndicators).toContain('NDCI');
  });

  it('classifies sewage contamination when coliform or ammonia indicators are reported', () => {
    const assessment = createBaseAssessment(80, 'PRIORITIZE');
    assessment.supportingEvidence = [
      {
        observationId: 'obs-cit-1',
        source: 'CITIZEN_REPORT',
        corroborationGroup: 'CITIZEN',
        indicator: 'ODOR',
        value: 'SEWER_SMELL',
        unit: 'qualitative',
        weight: 0.8,
        reason: 'Strong septic sewage odor along stream bank',
      },
      {
        observationId: 'obs-lab-1',
        source: 'IOT_SENSOR',
        corroborationGroup: 'IN_SITU',
        indicator: 'AMMONIA',
        value: 6.8,
        unit: 'mg/L',
        weight: 0.9,
        reason: 'High ammonium concentration',
      },
    ];

    const result = incidentClassifier.classify(assessment, mockReach);
    expect(result.type).toBe('POSSIBLE_SEWAGE_CONTAMINATION');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('classifies industrial discharge when extreme pH or chemical sheen is reported', () => {
    const assessment = createBaseAssessment(78, 'INVESTIGATE');
    assessment.supportingEvidence = [
      {
        observationId: 'obs-iot-ph',
        source: 'IOT_SENSOR',
        corroborationGroup: 'IN_SITU',
        indicator: 'PH',
        value: 3.2,
        unit: 'pH',
        weight: 0.95,
        reason: 'Extremely acidic runoff observed',
      },
      {
        observationId: 'obs-cit-sheen',
        source: 'CITIZEN_REPORT',
        corroborationGroup: 'CITIZEN',
        indicator: 'WATER_COLOR',
        value: 'CHEMICAL_SHEEN',
        unit: 'qualitative',
        weight: 0.8,
        reason: 'Iridescent sheen and chemical odor',
      },
    ];

    const result = incidentClassifier.classify(assessment, mockReach);
    expect(result.type).toBe('POSSIBLE_INDUSTRIAL_DISCHARGE');
    expect(result.primaryIndicators).toContain('PH');
  });

  it('classifies stormwater event when preceded by high rainfall with sediment turbidity', () => {
    const assessment = createBaseAssessment(55, 'VERIFY');
    assessment.supportingEvidence = [
      {
        observationId: 'obs-rain-1',
        source: 'WEATHER_STATION',
        corroborationGroup: 'WEATHER',
        indicator: 'RAINFALL_ACCUMULATION',
        value: 48.0,
        unit: 'mm',
        weight: 0.85,
        reason: 'Intense convective precipitation event',
      },
      {
        observationId: 'obs-iot-turb',
        source: 'IOT_SENSOR',
        corroborationGroup: 'IN_SITU',
        indicator: 'TURBIDITY',
        value: 75.0,
        unit: 'NTU',
        weight: 0.75,
        reason: 'Runoff suspension of inorganic sediment',
      },
    ];

    const result = incidentClassifier.classify(assessment, mockReach);
    expect(result.type).toBe('POSSIBLE_STORMWATER_EVENT');
    expect(result.primaryIndicators).toContain('RAINFALL_ACCUMULATION');
  });

  it('falls back to UNKNOWN_WATER_QUALITY_ANOMALY when evidence patterns do not match standard stressors', () => {
    const assessment = createBaseAssessment(45, 'VERIFY');
    assessment.supportingEvidence = [
      {
        observationId: 'obs-misc-1',
        source: 'IOT_SENSOR',
        corroborationGroup: 'IN_SITU',
        indicator: 'WATER_TEMP',
        value: 29.5,
        unit: 'degC',
        weight: 0.5,
        reason: 'Thermal anomaly',
      },
    ];

    const result = incidentClassifier.classify(assessment, mockReach);
    expect(result.type).toBe('UNKNOWN_WATER_QUALITY_ANOMALY');
    expect(result.confidence).toBeLessThan(0.7);
  });
});
