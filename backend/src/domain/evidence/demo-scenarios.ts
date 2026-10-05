/**
 * Deterministic Demo Scenarios for AquaSentinel Phase 3 Evidence Fusion Engine
 * Implements scenarios A through E conforming to Phase 3 PRD Section 46 and prompt instruction 19.
 */

import { Observation, StreamReach, EvidenceAssessment } from '@aquasentinel/shared';
import { generateId, nowUtc, toUtcIso } from '../value-objects.js';
import { scoringEngine } from './scoring-engine.js';

export interface DemoScenarioResult {
  scenarioId: string;
  name: string;
  description: string;
  streamReach: StreamReach;
  observations: Observation[];
  assessment: EvidenceAssessment;
}

export class DemoScenariosRunner {
  private baseAlmyrosReach: StreamReach = {
    id: '7a3b4c12-89de-4f56-9abc-1234567890ab',
    name: 'Almyros Stream - Reach Alpha',
    city: 'Volos',
    region: 'Thessaly, Greece',
    monitoringStatus: 'ACTIVE',
    geometry: {
      type: 'LineString',
      coordinates: [
        [22.751, 39.182],
        [22.7535, 39.1812],
        [22.757, 39.1798],
        [22.761, 39.1785],
      ],
    },
    waterCoverageConstraint: {
      minWidthMeters: 15,
      confidencePenalty: 0.2,
    },
    baselineData: {
      typicalNdci: 0.12,
      typicalTurbidity: 4.5,
      typicalTempC: 18.5,
      lastUpdated: '2026-09-01T00:00:00.000Z',
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  /**
   * Scenario A: Isolated Satellite-Only Anomaly
   * Single Sentinel-2 anomaly without ground, citizen, or weather confirmation.
   * Expected: VERIFY band (40-59), not automatic high priority.
   */
  public runScenarioA(): DemoScenarioResult {
    const timestamp = '2026-09-17T10:00:00.000Z';
    const satObs: Observation = {
      id: generateId(),
      source: 'SATELLITE_SENTINEL2',
      timestamp,
      location: { type: 'Point', coordinates: [22.7535, 39.1812] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'NDCI',
      value: 0.42, // Elevated chlorophyll
      unit: 'index',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-sat-scen-a',
        entityType: 'OBSERVATION',
        source: 'SATELLITE_SENTINEL2',
        sourceIdentifier: 'S2B_MSIL2A_DEMO_SCENARIO_A',
        acquisitionTimestamp: timestamp,
        ingestionTimestamp: timestamp,
        processingTimestamp: timestamp,
        processingMethod: 'SENTINEL2_NDCI_L2A',
        qualityStatus: 'VALIDATED',
      },
      metadata: {
        cloudCoverFraction: 0.04,
        validPixelsFraction: 0.95,
        qualityScore: 0.92,
      },
      createdAt: nowUtc(),
    };

    const assessment = scoringEngine.evaluate({
      streamReach: this.baseAlmyrosReach,
      triggerObservation: satObs,
      candidateObservations: [satObs],
      candidateId: 'cand-scenario-a',
    });

    return {
      scenarioId: 'SCENARIO_A',
      name: 'Isolated Satellite Anomaly',
      description: 'Single satellite NDCI anomaly without corroboration. Evaluates to VERIFY band.',
      streamReach: this.baseAlmyrosReach,
      observations: [satObs],
      assessment,
    };
  }

  /**
   * Scenario B: Satellite + Citizen Corroboration
   * Sentinel-2 anomaly corroborated by an eyewitness citizen science report with photos.
   * Expected: Meaningful increase into INVESTIGATE band (60-79).
   */
  public runScenarioB(): DemoScenarioResult {
    const satTime = '2026-09-17T10:00:00.000Z';
    const citizenTime = '2026-09-17T11:15:00.000Z';

    const satObs: Observation = {
      id: generateId(),
      source: 'SATELLITE_SENTINEL2',
      timestamp: satTime,
      location: { type: 'Point', coordinates: [22.7535, 39.1812] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'NDCI',
      value: 0.45,
      unit: 'index',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-sat-scen-b',
        entityType: 'OBSERVATION',
        source: 'SATELLITE_SENTINEL2',
        sourceIdentifier: 'S2B_MSIL2A_DEMO_SCENARIO_B',
        acquisitionTimestamp: satTime,
        ingestionTimestamp: satTime,
        processingTimestamp: satTime,
        processingMethod: 'SENTINEL2_NDCI_L2A',
        qualityStatus: 'VALIDATED',
      },
      metadata: {
        cloudCoverFraction: 0.03,
        qualityScore: 0.94,
      },
      createdAt: nowUtc(),
    };

    const citizenObs: Observation = {
      id: generateId(),
      source: 'CITIZEN_REPORT',
      timestamp: citizenTime,
      location: { type: 'Point', coordinates: [22.754, 39.181] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'WATER_COLOR',
      value: 'Greenish opaque film on stream surface with sulfur odor',
      unit: 'text',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-cit-scen-b',
        entityType: 'OBSERVATION',
        source: 'CITIZEN_REPORT',
        sourceIdentifier: 'CITIZEN-OAH-VOLOS-084',
        acquisitionTimestamp: citizenTime,
        ingestionTimestamp: citizenTime,
        processingTimestamp: citizenTime,
        processingMethod: 'CITIZEN_COMMUNITY_INTAKE',
        qualityStatus: 'VALIDATED',
      },
      metadata: {
        photos: ['https://assets.aquasentinel.io/photos/almyros-bloom-01.jpg'],
        reporterName: 'Eleni Papadopoulou (OAH Contributor)',
        qualityScore: 0.85,
      },
      createdAt: nowUtc(),
    };

    const assessment = scoringEngine.evaluate({
      streamReach: this.baseAlmyrosReach,
      triggerObservation: satObs,
      candidateObservations: [satObs, citizenObs],
      candidateId: 'cand-scenario-b',
    });

    return {
      scenarioId: 'SCENARIO_B',
      name: 'Satellite + Citizen Corroboration',
      description: 'Satellite NDCI anomaly corroborated by citizen report. Evaluates to INVESTIGATE band.',
      streamReach: this.baseAlmyrosReach,
      observations: [satObs, citizenObs],
      assessment,
    };
  }

  /**
   * Scenario C: Satellite + Citizen + Relevant Weather Context
   * Satellite + Citizen + Supportive dry/warm meteorological context (warm temperature, low wind, zero rain).
   * Expected: Additional contextual contribution, evaluating into PRIORITIZE band (80-100).
   */
  public runScenarioC(): DemoScenarioResult {
    const baseResult = this.runScenarioB();
    const weatherTime = '2026-09-17T09:00:00.000Z';

    const tempObs: Observation = {
      id: generateId(),
      source: 'WEATHER_STATION',
      timestamp: weatherTime,
      location: { type: 'Point', coordinates: [22.755, 39.18] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'AIR_TEMP',
      value: 31.5, // High temperature accelerating algal kinetics
      unit: '°C',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-temp-scen-c',
        entityType: 'OBSERVATION',
        source: 'WEATHER_STATION',
        sourceIdentifier: 'OPEN_METEO_VOLOS_01',
        acquisitionTimestamp: weatherTime,
        ingestionTimestamp: weatherTime,
        processingTimestamp: weatherTime,
        processingMethod: 'METEO_HOURLY_API',
        qualityStatus: 'VALIDATED',
      },
      metadata: { qualityScore: 0.95 },
      createdAt: nowUtc(),
    };

    const rainObs: Observation = {
      id: generateId(),
      source: 'WEATHER_STATION',
      timestamp: weatherTime,
      location: { type: 'Point', coordinates: [22.755, 39.18] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'PRECIPITATION',
      value: 0.0, // Stagnant dry conditions
      unit: 'mm',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-rain-scen-c',
        entityType: 'OBSERVATION',
        source: 'WEATHER_STATION',
        sourceIdentifier: 'OPEN_METEO_VOLOS_02',
        acquisitionTimestamp: weatherTime,
        ingestionTimestamp: weatherTime,
        processingTimestamp: weatherTime,
        processingMethod: 'METEO_HOURLY_API',
        qualityStatus: 'VALIDATED',
      },
      metadata: { qualityScore: 0.95 },
      createdAt: nowUtc(),
    };

    const allObservations = [...baseResult.observations, tempObs, rainObs];

    const assessment = scoringEngine.evaluate({
      streamReach: this.baseAlmyrosReach,
      triggerObservation: baseResult.observations[0],
      candidateObservations: allObservations,
      candidateId: 'cand-scenario-c',
    });

    return {
      scenarioId: 'SCENARIO_C',
      name: 'Satellite + Citizen + Weather Context',
      description: 'Multi-source corroboration with warm stagnant weather context. Evaluates to PRIORITIZE band.',
      streamReach: this.baseAlmyrosReach,
      observations: allObservations,
      assessment,
    };
  }

  /**
   * Scenario D: Contradictory Evidence
   * Satellite anomaly with narrow-stream mixed-pixel flag AND concurrent normal NDCI observation.
   * Expected: Score reduced, contradiction penalty surfaced, evaluates to NORMAL/VERIFY.
   */
  public runScenarioD(): DemoScenarioResult {
    const timestamp = '2026-09-17T10:00:00.000Z';

    const satAnomalyObs: Observation = {
      id: generateId(),
      source: 'SATELLITE_SENTINEL2',
      timestamp,
      location: { type: 'Point', coordinates: [22.7535, 39.1812] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'NDCI',
      value: 0.38,
      unit: 'index',
      quality: 'FLAGGED',
      provenance: {
        id: generateId(),
        entityId: 'obs-sat-scen-d',
        entityType: 'OBSERVATION',
        source: 'SATELLITE_SENTINEL2',
        sourceIdentifier: 'S2B_MSIL2A_DEMO_SCENARIO_D',
        acquisitionTimestamp: timestamp,
        ingestionTimestamp: timestamp,
        processingTimestamp: timestamp,
        processingMethod: 'SENTINEL2_NDCI_L2A',
        qualityStatus: 'FLAGGED',
      },
      metadata: {
        narrowStreamWarning: true,
        qualityReasons: ['narrow_stream_mixed_pixel'],
        cloudCoverFraction: 0.22, // High cloud cover
        qualityScore: 0.45,
      },
      createdAt: nowUtc(),
    };

    const normalReadingObs: Observation = {
      id: generateId(),
      source: 'SATELLITE_SENTINEL2',
      timestamp: '2026-09-17T10:30:00.000Z',
      location: { type: 'Point', coordinates: [22.7538, 39.1814] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'NDCI',
      value: 0.08, // Normal clean baseline reading
      unit: 'index',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-sat-normal-d',
        entityType: 'OBSERVATION',
        source: 'SATELLITE_SENTINEL2',
        sourceIdentifier: 'S2A_MSIL2A_DEMO_NORMAL_D',
        acquisitionTimestamp: timestamp,
        ingestionTimestamp: timestamp,
        processingTimestamp: timestamp,
        processingMethod: 'SENTINEL2_NDCI_L2A',
        qualityStatus: 'VALIDATED',
      },
      metadata: { qualityScore: 0.90 },
      createdAt: nowUtc(),
    };

    const assessment = scoringEngine.evaluate({
      streamReach: this.baseAlmyrosReach,
      triggerObservation: satAnomalyObs,
      candidateObservations: [satAnomalyObs, normalReadingObs],
      candidateId: 'cand-scenario-d',
    });

    return {
      scenarioId: 'SCENARIO_D',
      name: 'Contradictory Evidence',
      description: 'Low-quality satellite anomaly with mixed-pixel risk and concurrent normal NDCI. Evaluates to low score with explicit contradiction penalties.',
      streamReach: this.baseAlmyrosReach,
      observations: [satAnomalyObs, normalReadingObs],
      assessment,
    };
  }

  /**
   * Scenario E: Missing Baseline
   * Observation recorded on an uncharacterized stream reach with no historical baseline.
   * Expected: baselineStatus is explicitly "UNAVAILABLE" and does not assume normal.
   */
  public runScenarioE(): DemoScenarioResult {
    const reachWithoutBaseline: StreamReach = {
      id: '9c5d6e34-a1fa-6b78-bcde-3456789012cd',
      name: 'Remote Mountain Creek - Reach Zeta',
      city: 'Pelion',
      region: 'Thessaly, Greece',
      monitoringStatus: 'ACTIVE',
      geometry: {
        type: 'LineString',
        coordinates: [
          [23.01, 39.38],
          [23.02, 39.39],
        ],
      },
      createdAt: '2026-09-17T00:00:00.000Z',
      updatedAt: '2026-09-17T00:00:00.000Z',
    };

    const satObs: Observation = {
      id: generateId(),
      source: 'SATELLITE_SENTINEL2',
      timestamp: '2026-09-17T10:00:00.000Z',
      location: { type: 'Point', coordinates: [23.015, 39.385] },
      streamReachId: reachWithoutBaseline.id,
      indicator: 'NDCI',
      value: 0.35,
      unit: 'index',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-sat-scen-e',
        entityType: 'OBSERVATION',
        source: 'SATELLITE_SENTINEL2',
        sourceIdentifier: 'S2B_MSIL2A_DEMO_SCENARIO_E',
        acquisitionTimestamp: '2026-09-17T10:00:00.000Z',
        ingestionTimestamp: '2026-09-17T10:00:00.000Z',
        processingTimestamp: '2026-09-17T10:00:00.000Z',
        processingMethod: 'SENTINEL2_NDCI_L2A',
        qualityStatus: 'VALIDATED',
      },
      metadata: { qualityScore: 0.90 },
      createdAt: nowUtc(),
    };

    const assessment = scoringEngine.evaluate({
      streamReach: reachWithoutBaseline,
      triggerObservation: satObs,
      candidateObservations: [satObs],
      candidateId: 'cand-scenario-e',
    });

    return {
      scenarioId: 'SCENARIO_E',
      name: 'Missing Baseline',
      description: 'Stream reach has no baselineData. Assessment explicitly reports BASELINE_UNAVAILABLE.',
      streamReach: reachWithoutBaseline,
      observations: [satObs],
      assessment,
    };
  }

  public runAllScenarios(): DemoScenarioResult[] {
    return [
      this.runScenarioA(),
      this.runScenarioB(),
      this.runScenarioC(),
      this.runScenarioD(),
      this.runScenarioE(),
    ];
  }
}

export const demoScenariosRunner = new DemoScenariosRunner();
