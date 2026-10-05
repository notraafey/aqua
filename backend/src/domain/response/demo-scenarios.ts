/**
 * Deterministic Demo Scenarios for AquaSentinel Phase 4
 * Operational Response & Recommendation Engine
 * 
 * Implements Scenarios A through E conforming to Phase 4 PRD Section 24.
 */

import {
  Observation,
  StreamReach,
  EvidenceAssessment,
  IncidentClassification,
  OperationalSeverity,
  Recommendation,
  Task,
  FhirTask,
} from '@aquasentinel/shared';
import { generateId, nowUtc } from '../value-objects.js';
import { scoringEngine } from '../evidence/scoring-engine.js';
import { incidentClassifier } from './incident-classifier.js';
import { severityCalculator } from './severity-calculator.js';
import { recommendationEngine } from './recommendation-engine.js';
import { SEED_CATALOGUE_MEASURES } from '../catalogue/seed-measures.js';
import { FhirMapper } from '../../adapters/fhir/mapper.js';

export interface Phase4ScenarioResult {
  scenarioId: 'A' | 'B' | 'C' | 'D' | 'E';
  name: string;
  description: string;
  streamReach: StreamReach;
  observations: Observation[];
  assessment: EvidenceAssessment;
  classification: IncidentClassification;
  severity: OperationalSeverity;
  recommendations: Recommendation[];
  tasks: Task[];
  fhirTasks: FhirTask[];
}

export class Phase4DemoScenariosRunner {
  private baseAlmyrosReach: StreamReach = {
    id: '7a3b4c12-89de-4f56-9abc-1234567890ab',
    name: 'Almyros Stream - Reach Alpha (Urban Promenade)',
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
   * SCENARIO A: Satellite-Only Weak Signal
   * Uncorroborated Sentinel-2 anomaly.
   * Expected: VERIFY band, no intervention, field verification recommendation only.
   */
  public runScenarioA(): Phase4ScenarioResult {
    const timestamp = '2026-09-17T10:00:00.000Z';
    const satObs: Observation = {
      id: generateId(),
      source: 'SATELLITE_SENTINEL2',
      timestamp,
      location: { type: 'Point', coordinates: [22.7535, 39.1812] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'NDCI',
      value: 0.38,
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
      metadata: { cloudCoverFraction: 0.05, qualityScore: 0.9 },
      createdAt: nowUtc(),
    };

    const assessment = scoringEngine.evaluate({
      streamReach: this.baseAlmyrosReach,
      triggerObservation: satObs,
      candidateObservations: [satObs],
      candidateId: 'cand-phase4-scen-a',
    });

    const classification = incidentClassifier.classify(assessment);
    const severity = severityCalculator.calculate({
      assessment,
      classification,
      reach: this.baseAlmyrosReach,
    });

    const incidentId = generateId();
    const recommendations = recommendationEngine.evaluate({
      incidentId,
      assessment,
      classification,
      severity,
      reach: this.baseAlmyrosReach,
      catalogue: SEED_CATALOGUE_MEASURES,
    });

    // Auto-draft task for the top verification recommendation
    const topRec = recommendations[0];
    const tasks: Task[] = [];
    const fhirTasks: FhirTask[] = [];

    if (topRec) {
      const task: Task = {
        id: generateId(),
        incidentId,
        recommendationId: topRec.id,
        assessmentId: assessment.id,
        taskType: topRec.actionType,
        title: topRec.title,
        instructions: `Dispatch field officer to stream reach '${this.baseAlmyrosReach.name}'. Collect geotagged photos and perform visual clarity assessment.`,
        assignedRole: topRec.responsibleRole,
        assignedTo: 'Officer K. Dimitriou (Inspectorate)',
        location: { type: 'Point', coordinates: [22.7535, 39.1812] },
        priority: topRec.priority,
        status: 'REQUESTED',
        requiredEvidence: topRec.requiredVerification,
        createdAt: nowUtc(),
      };
      const fhirTask = FhirMapper.toFhirTask(task);
      task.fhirTaskId = fhirTask.id;
      tasks.push(task);
      fhirTasks.push(fhirTask);
    }

    return {
      scenarioId: 'A',
      name: 'Isolated Satellite Anomaly',
      description: 'Single satellite NDCI anomaly without field corroboration. Gated strictly to verification; interventions barred.',
      streamReach: this.baseAlmyrosReach,
      observations: [satObs],
      assessment,
      classification,
      severity,
      recommendations,
      tasks,
      fhirTasks,
    };
  }

  /**
   * SCENARIO B: Corroborated Environmental Event
   * Satellite anomaly + Citizen report + Baseline deviation.
   * Expected: INVESTIGATE band, classified as POSSIBLE_CYANOBLOOM, water sampling & field investigation recommended.
   */
  public runScenarioB(): Phase4ScenarioResult {
    const satTime = '2026-09-17T10:00:00.000Z';
    const citizenTime = '2026-09-17T11:30:00.000Z';

    const satObs: Observation = {
      id: generateId(),
      source: 'SATELLITE_SENTINEL2',
      timestamp: satTime,
      location: { type: 'Point', coordinates: [22.7535, 39.1812] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'NDCI',
      value: 0.46,
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
      createdAt: nowUtc(),
    };

    const citizenObs: Observation = {
      id: generateId(),
      source: 'CITIZEN_REPORT',
      timestamp: citizenTime,
      location: { type: 'Point', coordinates: [22.754, 39.181] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'WATER_COLOR',
      value: 'Thick turquoise-green paint-like scum on water edge with pungent odor',
      unit: 'text',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-cit-scen-b',
        entityType: 'OBSERVATION',
        source: 'CITIZEN_REPORT',
        sourceIdentifier: 'CITIZEN-VOLOS-102',
        acquisitionTimestamp: citizenTime,
        ingestionTimestamp: citizenTime,
        processingTimestamp: citizenTime,
        processingMethod: 'CITIZEN_COMMUNITY_INTAKE',
        qualityStatus: 'VALIDATED',
      },
      metadata: { reporterName: 'Nikos Katsaros', qualityScore: 0.9 },
      createdAt: nowUtc(),
    };

    const assessment = scoringEngine.evaluate({
      streamReach: this.baseAlmyrosReach,
      triggerObservation: satObs,
      candidateObservations: [satObs, citizenObs],
      candidateId: 'cand-phase4-scen-b',
    });

    const classification = incidentClassifier.classify(assessment);
    const severity = severityCalculator.calculate({
      assessment,
      classification,
      reach: this.baseAlmyrosReach,
    });

    const incidentId = generateId();
    const recommendations = recommendationEngine.evaluate({
      incidentId,
      assessment,
      classification,
      severity,
      reach: this.baseAlmyrosReach,
      catalogue: SEED_CATALOGUE_MEASURES,
    });

    // Generate tasks for top 2 recommendations
    const tasks: Task[] = [];
    const fhirTasks: FhirTask[] = [];

    recommendations.slice(0, 2).forEach((rec) => {
      const task: Task = {
        id: generateId(),
        incidentId,
        recommendationId: rec.id,
        assessmentId: assessment.id,
        taskType: rec.actionType,
        title: rec.title,
        instructions: `Conduct ${rec.title} along ${this.baseAlmyrosReach.name}. Follow SOP with certified cold storage.`,
        assignedRole: rec.responsibleRole,
        assignedTo: 'Municipal Water Lab & Field Team',
        location: { type: 'Point', coordinates: [22.7535, 39.1812] },
        priority: rec.priority,
        status: 'REQUESTED',
        requiredEvidence: rec.requiredVerification,
        createdAt: nowUtc(),
      };
      const fhirTask = FhirMapper.toFhirTask(task);
      task.fhirTaskId = fhirTask.id;
      tasks.push(task);
      fhirTasks.push(fhirTask);
    });

    return {
      scenarioId: 'B',
      name: 'Corroborated Cyanobacterial Event',
      description: 'Satellite NDCI anomaly corroborated by citizen scum report. Classified as POSSIBLE_CYANOBLOOM with water sampling tasks.',
      streamReach: this.baseAlmyrosReach,
      observations: [satObs, citizenObs],
      assessment,
      classification,
      severity,
      recommendations,
      tasks,
      fhirTasks,
    };
  }

  /**
   * SCENARIO C: Contradicted Event
   * Satellite anomaly + heavy rain / storm runoff explanation + no citizen reports.
   * Expected: Score reduced by contradiction detector, classified as POSSIBLE_STORMWATER_EVENT, no high-priority intervention.
   */
  public runScenarioC(): Phase4ScenarioResult {
    const timestamp = '2026-09-17T10:00:00.000Z';
    const satObs: Observation = {
      id: generateId(),
      source: 'SATELLITE_SENTINEL2',
      timestamp,
      location: { type: 'Point', coordinates: [22.7535, 39.1812] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'TURBIDITY',
      value: 38.5,
      unit: 'NTU',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-sat-scen-c',
        entityType: 'OBSERVATION',
        source: 'SATELLITE_SENTINEL2',
        sourceIdentifier: 'S2B_MSIL2A_DEMO_SCENARIO_C',
        acquisitionTimestamp: timestamp,
        ingestionTimestamp: timestamp,
        processingTimestamp: timestamp,
        processingMethod: 'SENTINEL2_TURBIDITY_L2A',
        qualityStatus: 'VALIDATED',
      },
      createdAt: nowUtc(),
    };

    const rainObs: Observation = {
      id: generateId(),
      source: 'WEATHER_STATION',
      timestamp: '2026-09-17T08:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'PRECIPITATION',
      value: 46.2, // 46.2 mm rain = intense storm runoff
      unit: 'mm',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-weather-scen-c',
        entityType: 'OBSERVATION',
        source: 'WEATHER_STATION',
        sourceIdentifier: 'METEO-VOLOS-01',
        acquisitionTimestamp: timestamp,
        ingestionTimestamp: timestamp,
        processingTimestamp: timestamp,
        processingMethod: 'HOURLY_PLUVIOMETER_ACCUMULATION',
        qualityStatus: 'VALIDATED',
      },
      createdAt: nowUtc(),
    };

    const assessment = scoringEngine.evaluate({
      streamReach: this.baseAlmyrosReach,
      triggerObservation: satObs,
      candidateObservations: [satObs, rainObs],
      candidateId: 'cand-phase4-scen-c',
    });

    const classification = incidentClassifier.classify(assessment);
    const severity = severityCalculator.calculate({
      assessment,
      classification,
      reach: this.baseAlmyrosReach,
    });

    const incidentId = generateId();
    const recommendations = recommendationEngine.evaluate({
      incidentId,
      assessment,
      classification,
      severity,
      reach: this.baseAlmyrosReach,
      catalogue: SEED_CATALOGUE_MEASURES,
    });

    const topRec = recommendations[0];
    const tasks: Task[] = [];
    const fhirTasks: FhirTask[] = [];

    if (topRec) {
      const task: Task = {
        id: generateId(),
        incidentId,
        recommendationId: topRec.id,
        assessmentId: assessment.id,
        taskType: topRec.actionType,
        title: topRec.title,
        instructions: 'Monitor stream reach for natural post-storm sediment settling over next 48h.',
        assignedRole: topRec.responsibleRole,
        assignedTo: 'Automated Monitoring Service',
        location: { type: 'Point', coordinates: [22.7535, 39.1812] },
        priority: topRec.priority,
        status: 'REQUESTED',
        createdAt: nowUtc(),
      };
      const fhirTask = FhirMapper.toFhirTask(task);
      task.fhirTaskId = fhirTask.id;
      tasks.push(task);
      fhirTasks.push(fhirTask);
    }

    return {
      scenarioId: 'C',
      name: 'Storm Runoff Contradiction',
      description: 'Elevated turbidity explained by heavy precipitation. Classified as POSSIBLE_STORMWATER_EVENT; toxic bloom advisories blocked.',
      streamReach: this.baseAlmyrosReach,
      observations: [satObs, rainObs],
      assessment,
      classification,
      severity,
      recommendations,
      tasks,
      fhirTasks,
    };
  }

  /**
   * SCENARIO D: High-Confidence Actionable Incident
   * Satellite anomaly + Citizen report + Warm dry weather + Historical baseline deviation.
   * Expected: Score >= 80 (PRIORITIZE), classified as POSSIBLE_CYANOBLOOM, severity CRITICAL,
   * ranked recommendations include advisory draft, sampling, and authority escalation.
   */
  public runScenarioD(): Phase4ScenarioResult {
    const baseB = this.runScenarioB();
    const weatherTime = '2026-09-17T09:00:00.000Z';

    const tempObs: Observation = {
      id: generateId(),
      source: 'WEATHER_STATION',
      timestamp: weatherTime,
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'TEMPERATURE',
      value: 31.5, // hot stagnant water promotes cyanobacteria
      unit: 'celsius',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-weather-temp',
        entityType: 'OBSERVATION',
        source: 'WEATHER_STATION',
        sourceIdentifier: 'METEO-VOLOS-01',
        acquisitionTimestamp: weatherTime,
        ingestionTimestamp: weatherTime,
        processingTimestamp: weatherTime,
        processingMethod: 'SURFACE_WEATHER_SENSING',
        qualityStatus: 'VALIDATED',
      },
      createdAt: nowUtc(),
    };

    const observations = [...baseB.observations, tempObs];

    const assessment = scoringEngine.evaluate({
      streamReach: this.baseAlmyrosReach,
      triggerObservation: baseB.observations[0],
      candidateObservations: observations,
      historicalObservations: [
        { ...baseB.observations[0], id: generateId(), value: 0.11, timestamp: '2026-08-01T10:00:00.000Z' },
        { ...baseB.observations[0], id: generateId(), value: 0.13, timestamp: '2026-08-10T10:00:00.000Z' },
        { ...baseB.observations[0], id: generateId(), value: 0.12, timestamp: '2026-08-20T10:00:00.000Z' },
      ],
      candidateId: 'cand-phase4-scen-d',
    });

    const classification = incidentClassifier.classify(assessment);
    const severity = severityCalculator.calculate({
      assessment,
      classification,
      reach: this.baseAlmyrosReach,
    });

    const incidentId = generateId();
    const recommendations = recommendationEngine.evaluate({
      incidentId,
      assessment,
      classification,
      severity,
      reach: this.baseAlmyrosReach,
      catalogue: SEED_CATALOGUE_MEASURES,
    });

    // In Scenario D, top recommendations are generated and top recommendation is simulated as APPROVED by human officer
    const tasks: Task[] = [];
    const fhirTasks: FhirTask[] = [];

    const topApprovedRec = recommendations[0];
    if (topApprovedRec) {
      topApprovedRec.status = 'APPROVED';
      topApprovedRec.reviewedBy = 'Dr. S. Giannakis (Chief Environmental Officer)';
      topApprovedRec.reviewNotes = 'Approved for immediate dispatch following verified citizen photo corroboration.';
      topApprovedRec.reviewedAt = nowUtc();

      const task: Task = {
        id: generateId(),
        incidentId,
        recommendationId: topApprovedRec.id,
        assessmentId: assessment.id,
        taskType: topApprovedRec.actionType,
        title: topApprovedRec.title,
        instructions: `URGENT ACTION: Initiate ${topApprovedRec.title} for reach '${this.baseAlmyrosReach.name}'. Coordinate with municipal health unit.`,
        assignedRole: topApprovedRec.responsibleRole,
        assignedTo: 'Chief Inspector G. Vasiliou',
        location: { type: 'Point', coordinates: [22.7535, 39.1812] },
        priority: 'URGENT',
        status: 'ACCEPTED',
        requiredEvidence: topApprovedRec.requiredVerification,
        createdAt: nowUtc(),
        acceptedAt: nowUtc(),
      };
      const fhirTask = FhirMapper.toFhirTask(task);
      task.fhirTaskId = fhirTask.id;
      topApprovedRec.generatedTaskId = task.id;
      tasks.push(task);
      fhirTasks.push(fhirTask);
    }

    return {
      scenarioId: 'D',
      name: 'High-Confidence Actionable Incident',
      description: 'Multi-source corroborated bloom in urban reach (Score >= 80). Human review approves urgent response and generates FHIR Task.',
      streamReach: this.baseAlmyrosReach,
      observations,
      assessment,
      classification,
      severity,
      recommendations,
      tasks,
      fhirTasks,
    };
  }

  /**
   * SCENARIO E: Missing Evidence Incident
   * Strong satellite signal but missing in-situ sensor and field confirmation.
   * Expected: Missing evidence analysis identifies required verification, generates field sampling tasks, keeps physical remediation gated.
   */
  public runScenarioE(): Phase4ScenarioResult {
    const timestamp = '2026-09-17T10:00:00.000Z';
    const satObs: Observation = {
      id: generateId(),
      source: 'SATELLITE_SENTINEL2',
      timestamp,
      location: { type: 'Point', coordinates: [22.7535, 39.1812] },
      streamReachId: this.baseAlmyrosReach.id,
      indicator: 'NDCI',
      value: 0.52, // high chlorophyll signal
      unit: 'index',
      quality: 'VALIDATED',
      provenance: {
        id: generateId(),
        entityId: 'obs-sat-scen-e',
        entityType: 'OBSERVATION',
        source: 'SATELLITE_SENTINEL2',
        sourceIdentifier: 'S2B_MSIL2A_DEMO_SCENARIO_E',
        acquisitionTimestamp: timestamp,
        ingestionTimestamp: timestamp,
        processingTimestamp: timestamp,
        processingMethod: 'SENTINEL2_NDCI_L2A',
        qualityStatus: 'VALIDATED',
      },
      createdAt: nowUtc(),
    };

    const assessment = scoringEngine.evaluate({
      streamReach: this.baseAlmyrosReach,
      triggerObservation: satObs,
      candidateObservations: [satObs],
      candidateId: 'cand-phase4-scen-e',
    });

    // Ensure explicit missing evidence callout
    if (!assessment.missingEvidence.includes('Recent field observation confirming visual discoloration')) {
      assessment.missingEvidence.push('Recent field observation confirming visual discoloration');
    }
    if (!assessment.missingEvidence.includes('In-situ probe telemetry verifying dissolved oxygen levels')) {
      assessment.missingEvidence.push('In-situ probe telemetry verifying dissolved oxygen levels');
    }

    const classification = incidentClassifier.classify(assessment);
    const severity = severityCalculator.calculate({
      assessment,
      classification,
      reach: this.baseAlmyrosReach,
    });

    const incidentId = generateId();
    const recommendations = recommendationEngine.evaluate({
      incidentId,
      assessment,
      classification,
      severity,
      reach: this.baseAlmyrosReach,
      catalogue: SEED_CATALOGUE_MEASURES,
    });

    // Explicitly generate tasks to resolve the missing evidence
    const tasks: Task[] = [];
    const fhirTasks: FhirTask[] = [];

    const fieldVerifyRec = recommendations.find((r) => r.measureId === 'OAH-M-VERIFY-01') || recommendations[0];
    if (fieldVerifyRec) {
      const task: Task = {
        id: generateId(),
        incidentId,
        recommendationId: fieldVerifyRec.id,
        assessmentId: assessment.id,
        taskType: 'FIELD_VERIFY',
        title: 'Missing Evidence Collection: Rapid Field Inspection',
        instructions: 'Gather missing evidence: Collect geotagged photos and verify surface water discoloration.',
        assignedRole: 'ENVIRONMENTAL_INSPECTOR',
        assignedTo: 'Officer T. Nikolaou (Rapid Response)',
        location: { type: 'Point', coordinates: [22.7535, 39.1812] },
        priority: 'HIGH',
        status: 'REQUESTED',
        requiredEvidence: ['Geotagged photographs', 'In-situ visual odor score'],
        createdAt: nowUtc(),
      };
      const fhirTask = FhirMapper.toFhirTask(task);
      task.fhirTaskId = fhirTask.id;
      tasks.push(task);
      fhirTasks.push(fhirTask);
    }

    return {
      scenarioId: 'E',
      name: 'Missing Evidence Investigation',
      description: 'Strong remote sensing signal with critical ground truth missing. Engine generates targeted verification tasks while gating interventions.',
      streamReach: this.baseAlmyrosReach,
      observations: [satObs],
      assessment,
      classification,
      severity,
      recommendations,
      tasks,
      fhirTasks,
    };
  }
}

export const phase4DemoScenarios = new Phase4DemoScenariosRunner();
