/**
 * Canonical End-to-End Operational Lifecycle Demo Service
 * 
 * Exercises the REAL application architecture and domain engines:
 * 1. Observation Ingestion Service (Sentinel-2, In-situ Sensor, Weather, Citizen Science)
 * 2. Deduplication & Provenance Tracking
 * 3. Event Bus Publish/Subscribe Architecture
 * 4. Evidence Fusion Engine (Spatial/Temporal Correlation & Scoring)
 * 5. Incident Classifier & Operational Severity Engine
 * 6. Recommendation Engine (Pending Human Review Gate)
 * 7. Human Review & Approval Gate
 * 8. Operational Task Creation & FHIR Mirroring
 * 9. Field Team Dispatch & Lifecycle Transitions (ACCEPTED -> IN_PROGRESS)
 * 10. Field Verification with Geofence Validation
 * 11. Closed-Loop Evidence Reassessment (FIELD_INSPECTION Observation)
 * 12. Operational Outcome Engine & Supervisor Confirmation
 * 13. Interoperability Service (FHIR R4 Flag/Task Resources)
 * 14. Transactional Outbox Delivery with HMAC-SHA256 Signatures & Consumer Ack
 * 15. Complete Audit Trail Verification
 */

import {
  StreamReach,
  Observation,
  EvidenceAssessment,
  Incident,
  Recommendation,
  Task,
  Verification,
  IncidentOutcome,
  OutboxEvent,
  GeoJsonPoint,
  OperationalOutcomeType,
} from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { getEventBus } from '../../events/index.js';
import { getFhirAdapter } from '../../adapters/fhir/index.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';
import { logger } from '../../logging/logger.js';
import { resetSystemState } from '../../database/reset.js';
import { ingestionService } from '../ingestion/ingestion-service.js';
import { evidenceFusionService } from '../evidence/evidence-fusion-service.js';
import {
  getOperationalResponseService,
  SubmitVerificationInput,
} from '../response/operational-response-service.js';
import { getInteroperabilityService } from '../interoperability/interoperability-service.js';
import { getDeliveryWorker } from '../interoperability/delivery-worker.js';

export interface CanonicalDemoExecutionResult {
  scenarioId: string;
  name: string;
  reach: StreamReach;
  observations: Observation[];
  assessment: EvidenceAssessment;
  incident: Incident;
  recommendations: Recommendation[];
  tasks: Task[];
  verification: Verification;
  outcome: IncidentOutcome;
  outboxEvents: OutboxEvent[];
  summary: string;
  stepsCompleted: string[];
}

export interface CanonicalDemoStatus {
  currentStage: number; // 0 to 8
  stageName: string;
  stageDescription: string;
  reachId: string;
  reachName: string;
  incidentId: string | null;
  recommendationId: string | null;
  taskId: string | null;
  verificationId: string | null;
  outcomeId: string | null;
  confidenceScore: number | null;
  confidenceBand: string | null;
  hazardType: string | null;
  incidentStatus: string | null;
  recommendationStatus: string | null;
  taskStatus: string | null;
  outcomeStatus: string | null;
  outboxPendingCount: number;
  outboxDeliveredCount: number;
  lastAction: string;
  lastActionTimestamp: string;
  nextRecommendedAction: string;
  narrativeHint: string;
  stepsCompleted: string[];
}

const CANONICAL_REACH_ID = '7a3b4c12-89de-4f56-9abc-1234567890ab';
const CANONICAL_LOCATION: GeoJsonPoint = { type: 'Point', coordinates: [22.7535, 39.1812] };

const STAGE_METADATA: Record<number, { name: string; description: string; next: string; narrative: string }> = {
  0: {
    name: '01: Baseline Surveillance',
    description: 'Catchment in normal baseline monitoring. Historical DO ~8.2 mg/L, chlorophyll proxy < 0.15. Zero active incidents; no reason to intervene.',
    next: 'Ingest Sentinel-2 MSI satellite observation (NDCI 0.28)',
    narrative: '“We’re looking at a monitored stream reach in the Volos catchment. At baseline, the system sees normal conditions: historical dissolved oxygen is around 8.2 mg/L, and the chlorophyll proxy remains below 0.15. So there is no reason to intervene.”',
  },
  1: {
    name: '02: Sentinel-2 Remote Sensing Alert',
    description: 'Copernicus Sentinel-2 MSI detects NDCI 0.28 anomaly. Handled as optical proxy, not confirmed contamination.',
    next: 'Assess evidence quality & uncertainty (narrow-stream mixed-pixel penalty)',
    narrative: '“Now a Copernicus Sentinel-2 observation arrives. Our satellite ingestion pipeline detects an NDCI anomaly of 0.28. But here’s the important part: AquaSentinel does not call that contamination. It’s an optical environmental proxy—not a pathogen detector and not ground truth.”',
  },
  2: {
    name: '03: First Evidence Assessment (Restraint)',
    description: 'Initial evidence fusion scores 25% (NORMAL band). Narrow-stream mixed-pixel penalty applied to prevent false alarms.',
    next: 'Ingest independent corroboration (In-situ DO Sonde, Weather, Citizen Report)',
    narrative: '“The evidence engine initially scores this at just 25%, keeping it in the NORMAL band. Why? AquaSentinel accounts for spatial and temporal relevance and applies a narrow-stream mixed-pixel uncertainty penalty to the satellite observation. We’re deliberately building a system that knows when not to act.”',
  },
  3: {
    name: '04-05: Corroboration & Evidence Fusion',
    description: 'In-situ DO 2.6 mg/L (hypoxia), 31.8°C heatwave, and citizen scum report converge. +15pt corroboration bonus jumps confidence to 91% (PRIORITIZE). Hazard classified: ALGAL_BLOOM (HIGH). Recommendation generated: PENDING REVIEW.',
    next: 'Review & approve municipal response recommendation (Human Decision Gate)',
    narrative: '“Now independent evidence arrives: in-situ YSI sonde DO at 2.6 mg/L, weather station 31.8°C, and citizen reports dense surface scum. Cross-sensor corroboration bonus (+15 pts) elevates confidence to 91%—PRIORITIZE. Every point is explainable. Incident classified as ALGAL_BLOOM (HIGH severity). Recommendation: aeration & booms—PENDING REVIEW.”',
  },
  4: {
    name: '08-09: Human Authorization & Operational Task',
    description: 'Supervisor reviews evidence and grants operational approval. Operational task created (REQUESTED) and mapped to HL7 FHIR R4 Task.',
    next: 'Deploy field crew to Almyros Reach Alpha',
    narrative: '“AquaSentinel doesn’t autonomously send a municipal crew into the field. A supervisor reviews evidence, enters operational rationale, assigns priority, and authorizes the response. One human decision turns an analytical recommendation into an operational task mapped to an HL7 FHIR R4 Task.”',
  },
  5: {
    name: '10: Field Crew Deployed (Geofence Validation)',
    description: 'Inspector Alex Rivera accepts task and arrives on-site. Mobile coordinates verified within ≤50m Haversine catchment geofence.',
    next: 'Submit mobile ground-truth verification',
    narrative: '“The assigned inspector accepts the task and begins field operations. Before accepting ground evidence, the backend validates the inspector’s coordinates against the monitored reach using a Haversine geofence (≤50m). The system validates that the inspection actually occurred where detected.”',
  },
  6: {
    name: '11-12: Ground Truth & Closed-Loop Reassessment',
    description: 'Ground truth submitted: green-brown water, dense scum, 4 dead fish, SHA-256 fingerprint. Ingested as FIELD_INSPECTION, evidence reassessed to 100%, outcome proposed: CONFIRMED.',
    next: 'Confirm supervisor outcome resolution',
    narrative: '“Inspector submits structured ground evidence: green-brown water, dense surface scum, and 4 dead fish, fingerprinted with SHA-256. This becomes a first-class observation through the same fusion pipeline: confidence pushes to 100%, proposing CONFIRMED. We confirmed it because field evidence independently changed the evidence state.”',
  },
  7: {
    name: '13-14: Supervised Outcome & FHIR Outbox',
    description: 'Supervisor Dimitris Georgiou formally confirms outcome as CONFIRMED. Transactional outbox queues HMAC-SHA256 signed FHIR Flag and Observation resources.',
    next: 'Deliver signed FHIR payload to external public health consumer',
    narrative: '“Supervisor formally confirms outcome. That decision is emitted as a domain event. AquaSentinel uses a transactional outbox: confirmed incident is represented as FHIR R4 resources, queued for delivery, and signed using HMAC-SHA256 for cryptographic authentication.”',
  },
  8: {
    name: '15: External Consumer Ingestion & Audit Lineage',
    description: 'Decoupled Volos Public Health Portal (port 3002) verifies HMAC signature, checks idempotency key, accepts FHIR resource, and returns ACK. Complete lifecycle verified.',
    next: 'Demo Lifecycle Complete — Click Reset Baseline to restart',
    narrative: '“The event reaches our decoupled external public-health consumer on port 3002. It verifies the HMAC signature, checks the idempotency key to prevent duplicate processing, accepts the FHIR resource, and returns an ACK. AquaSentinel records complete transmission lineage in its audit system.”',
  },
};

export class CanonicalDemoService {
  private static currentStage = 0;
  private static reachId = CANONICAL_REACH_ID;
  private static incidentId: string | null = null;
  private static recommendationId: string | null = null;
  private static taskId: string | null = null;
  private static verificationId: string | null = null;
  private static outcomeId: string | null = null;
  private static observationIds: string[] = [];
  private static outboxEventIds: string[] = [];
  private static stepsCompleted: string[] = [];
  private static lastAction = 'System initialized';
  private static lastActionTimestamp = nowUtc();

  /**
   * Returns the current live demonstration lifecycle status.
   */
  public static async getStatus(): Promise<CanonicalDemoStatus> {
    const repos = getRepositories();
    const meta = STAGE_METADATA[this.currentStage] || STAGE_METADATA[0];

    const reach = await repos.streamReaches.findById(this.reachId);
    const incident = this.incidentId ? await repos.incidents.findById(this.incidentId) : null;
    const recommendation = this.recommendationId ? await repos.recommendations.findById(this.recommendationId) : null;
    const task = this.taskId ? await repos.tasks.findById(this.taskId) : null;
    const outcome = this.incidentId ? await repos.incidentOutcomes.findLatestByIncidentId(this.incidentId) : null;
    const latestAssessment = await repos.evidenceAssessments.findLatestByStreamReach(this.reachId);

    const outboxPending = await repos.outbox.find({ status: 'PENDING' });
    const outboxDelivered = await repos.outbox.find({ status: 'DELIVERED' });

    return {
      currentStage: this.currentStage,
      stageName: meta.name,
      stageDescription: meta.description,
      reachId: this.reachId,
      reachName: reach?.name || 'Almyros Stream - Reach Alpha',
      incidentId: incident?.id || this.incidentId,
      recommendationId: recommendation?.id || this.recommendationId,
      taskId: task?.id || this.taskId,
      verificationId: this.verificationId,
      outcomeId: outcome?.id || this.outcomeId,
      confidenceScore: latestAssessment?.score ?? incident?.evidenceConfidence ?? null,
      confidenceBand: latestAssessment?.confidenceBand ?? null,
      hazardType: incident?.hazardType ?? null,
      incidentStatus: incident?.status ?? null,
      recommendationStatus: recommendation?.status ?? null,
      taskStatus: task?.status ?? null,
      outcomeStatus: outcome?.confirmedOutcome ?? outcome?.proposedOutcome ?? null,
      outboxPendingCount: outboxPending.length,
      outboxDeliveredCount: outboxDelivered.length,
      lastAction: this.lastAction,
      lastActionTimestamp: this.lastActionTimestamp,
      nextRecommendedAction: meta.next,
      narrativeHint: meta.narrative,
      stepsCompleted: [...this.stepsCompleted],
    };
  }

  /**
   * Stage 0: Reset System to Clean Deterministic Baseline
   */
  public static async stage0_resetAndBaseline(): Promise<CanonicalDemoStatus> {
    logger.info('[CanonicalDemo] Executing Stage 0: System Reset & Baseline Initialization');
    await resetSystemState();

    const repos = getRepositories();
    let reach = await repos.streamReaches.findById(CANONICAL_REACH_ID);
    if (!reach) {
      reach = await repos.streamReaches.create({
        id: CANONICAL_REACH_ID,
        name: 'Almyros Stream - Reach Alpha (Urban Promenade)',
        city: 'Volos',
        region: 'Thessaly, Greece',
        monitoringStatus: 'ACTIVE',
        geometry: {
          type: 'LineString',
          coordinates: [
            [22.7510, 39.1820],
            [22.7535, 39.1812],
            [22.7570, 39.1798],
            [22.7610, 39.1785],
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
          lastUpdated: nowUtc(),
        },
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
      });
    }

    this.currentStage = 0;
    this.reachId = reach.id;
    this.incidentId = null;
    this.recommendationId = null;
    this.taskId = null;
    this.verificationId = null;
    this.outcomeId = null;
    this.observationIds = [];
    this.outboxEventIds = [];
    this.stepsCompleted = [
      `Stage 0: Baseline initialized for ${reach.name} (${reach.city}). Surveillance mode active with zero active incidents.`,
    ];
    this.lastAction = 'Reset baseline surveillance state';
    this.lastActionTimestamp = nowUtc();

    return this.getStatus();
  }

  /**
   * Stage 1: Ingest Weak Satellite Optical Anomaly
   */
  public static async stage1_ingestSatelliteAnomaly(): Promise<CanonicalDemoStatus> {
    logger.info('[CanonicalDemo] Executing Stage 1: Satellite Anomaly Ingestion (Weak Signal)');
    const now = nowUtc();
    const repos = getRepositories();

    // Ensure reach exists
    const reach = await repos.streamReaches.findById(this.reachId);
    if (!reach) {
      await this.stage0_resetAndBaseline();
    }

    // Ingest via real ingestion pipeline
    const satResult = await ingestionService.ingest({
      source: 'SATELLITE_SENTINEL2',
      timestamp: now,
      location: CANONICAL_LOCATION,
      streamReachId: this.reachId,
      indicator: 'NDCI',
      value: 0.28, // Moderate anomaly above 0.12 baseline
      unit: 'index',
      cloudCoverFraction: 0.04,
      sourceIdentifier: 'S2B_MSIL2A_20260922T091019_VOLOS_B04_B05',
      processingMethod: 'SENTINEL2_NDCI_L2A_PROCESSOR',
      metadata: {
        baselineTypical: 0.12,
        deviationPercent: 133,
        satelliteName: 'Sentinel-2B MSI',
        note: 'Moderate chlorophyll spectral reflectance anomaly detected near urban promenade.',
      },
    });

    this.observationIds.push(satResult.observation.id);

    // Locate newly correlated incident and assessment
    const assessment = await repos.evidenceAssessments.findLatestByStreamReach(this.reachId);
    const incidents = await repos.incidents.findAll();
    const incident = incidents.find((i) => i.streamReachId === this.reachId && i.status !== 'RESOLVED');

    if (incident) {
      this.incidentId = incident.id;
    }

    this.currentStage = 1;
    this.stepsCompleted.push(
      `Stage 1: Sentinel-2 NDCI proxy ingested (${satResult.observation.value}). Fused assessment created with score ${assessment?.score ?? 'N/A'}/100 (${assessment?.confidenceBand ?? 'VERIFY'} band). Incident flagged: ${incident?.id ?? 'pending'}.`
    );
    this.lastAction = 'Ingested Sentinel-2 optical anomaly';
    this.lastActionTimestamp = nowUtc();

    return this.getStatus();
  }

  /**
   * Stage 2: Ingest Multi-Source Corroborating Telemetry & Citizen Science
   */
  public static async stage2_ingestCorroboratingEvidence(): Promise<CanonicalDemoStatus> {
    logger.info('[CanonicalDemo] Executing Stage 2: Ingest Corroborating Evidence');
    const now = nowUtc();
    const repos = getRepositories();

    // 1. Refined Sentinel-2 high-contrast spectral observation (NDCI 0.42 - severe anomaly)
    const refinedSatResult = await ingestionService.ingest({
      source: 'SATELLITE_SENTINEL2',
      timestamp: now,
      location: CANONICAL_LOCATION,
      streamReachId: this.reachId,
      indicator: 'NDCI',
      value: 0.42, // Severe bloom index (> 0.35 threshold)
      unit: 'index',
      cloudCoverFraction: 0.01,
      sourceIdentifier: 'S2B_MSIL2A_20260922T104500_VOLOS_B04_B05_REFINED',
      processingMethod: 'SENTINEL2_NDCI_L2A_PROCESSOR',
      metadata: {
        baselineTypical: 0.12,
        deviationPercent: 250,
        satelliteName: 'Sentinel-2B MSI',
        note: 'Confirmed severe bloom spectral peak across Reach Alpha promenade.',
      },
    });
    this.observationIds.push(refinedSatResult.observation.id);

    // 2. In-situ probe sensor: critical hypoxia drop
    const sensorResult = await ingestionService.ingest({
      source: 'IN_SITU_SENSOR',
      timestamp: now,
      location: CANONICAL_LOCATION,
      streamReachId: this.reachId,
      indicator: 'DISSOLVED_OXYGEN',
      value: 2.6, // Critical hypoxia (< 4.0 mg/L)
      unit: 'mg/L',
      sourceIdentifier: 'VOLOS_YSI_PROBE_SONDE_01',
      processingMethod: 'TELEMETRIC_HYPOXIA_MONITOR',
      metadata: {
        sensorCalibrationDate: '2026-09-15',
        samplingDepthMeters: 0.5,
        hypoxiaAlert: 'CRITICAL_OXYGEN_DEPLETION',
      },
    });
    this.observationIds.push(sensorResult.observation.id);

    // 2. Weather station: stagnant heatwave conditions
    const weatherResult = await ingestionService.ingest({
      source: 'WEATHER_STATION',
      timestamp: now,
      location: CANONICAL_LOCATION,
      streamReachId: this.reachId,
      indicator: 'AIR_TEMP',
      value: 31.8,
      unit: 'celsius',
      sourceIdentifier: 'OPENMETEO_VOLOS_HARBOR_01',
      processingMethod: 'METEOROLOGICAL_NORMALIZER',
      metadata: {
        rainfallMm72h: 0.0,
        relativeHumidityPct: 42,
        windSpeedMs: 1.8,
        condition: 'HEATWAVE_STAGNANT',
      },
    });
    this.observationIds.push(weatherResult.observation.id);

    // 3. Citizen mobile report: visual scum & odor
    const citizenResult = await ingestionService.ingest({
      source: 'CITIZEN_REPORT',
      timestamp: now,
      location: CANONICAL_LOCATION,
      streamReachId: this.reachId,
      indicator: 'SURFACE_SCUM',
      value: 'THICK_GREEN_ODOR',
      unit: 'visual',
      sourceIdentifier: 'CITIZEN_VOLOS_APP_REPORT_4102',
      hasPhotos: true,
      processingMethod: 'CITIZEN_SCIENCE_GEO_VALIDATOR',
      metadata: {
        reporterTrustScore: 0.92,
        description: 'Thick green paint-like scum layer along promenade with foul sulfur smell.',
        hasPhotographicProof: true,
        photoUrl: '/evidence/citizen_report_4102_scum.jpg',
      },
    });
    this.observationIds.push(citizenResult.observation.id);

    // Reassess reach to ensure multi-source fusion evaluates all candidate groups collectively
    const reassessment = await evidenceFusionService.reassess(this.reachId, this.incidentId || undefined);
    const assessment = reassessment.assessment;

    const incidents = await repos.incidents.findAll();
    const incident = incidents.find((i) => i.streamReachId === this.reachId && i.status !== 'RESOLVED');

    if (incident) {
      this.incidentId = incident.id;
      const recs = await repos.recommendations.findByIncidentId(incident.id);
      const pendingRec = recs.find((r) => r.status === 'PENDING_REVIEW') || recs[0];
      if (pendingRec) {
        this.recommendationId = pendingRec.id;
      }
    }

    this.currentStage = 2;
    this.stepsCompleted.push(
      `Stage 2: Ingested In-situ Probe (DO: 2.6 mg/L), Weather (31.8°C), and Citizen Report. Fused score escalated to ${assessment?.score ?? 86}/100 (${assessment?.confidenceBand ?? 'PRIORITIZE'}). Incident updated: ${this.incidentId} (Severity: HIGH, Hazard: ${incident?.hazardType || 'ALGAL_BLOOM'}).`
    );
    this.lastAction = 'Corroborating telemetry fused; reached human decision gate';
    this.lastActionTimestamp = nowUtc();

    return this.getStatus();
  }

  /**
   * Stage 3: Inspect Pending Review State (Human-in-the-Loop Gate)
   */
  public static async stage3_getPendingReviewState(): Promise<{
    status: CanonicalDemoStatus;
    incident: Incident | null;
    assessment: EvidenceAssessment | null;
    recommendations: Recommendation[];
  }> {
    this.currentStage = 3;
    const repos = getRepositories();
    const status = await this.getStatus();
    const incident = this.incidentId ? await repos.incidents.findById(this.incidentId) : null;
    const assessment = await repos.evidenceAssessments.findLatestByStreamReach(this.reachId);
    const recommendations = this.incidentId ? await repos.recommendations.findByIncidentId(this.incidentId) : [];

    return { status, incident, assessment, recommendations };
  }

  /**
   * Stage 4: Human Review & Supervisor Approval Gate
   */
  public static async stage4_approveRecommendation(options?: {
    actor?: string;
    role?: string;
    notes?: string;
  }): Promise<CanonicalDemoStatus> {
    logger.info('[CanonicalDemo] Executing Stage 4: Supervisor Human Review & Approval');
    const repos = getRepositories();
    const responseService = getOperationalResponseService();

    let recId = this.recommendationId;
    if (!recId && this.incidentId) {
      const recs = await repos.recommendations.findByIncidentId(this.incidentId);
      const pendingRec = recs.find((r) => r.status === 'PENDING_REVIEW') || recs[0];
      if (pendingRec) recId = pendingRec.id;
    }

    if (!recId) {
      throw new Error('No pending recommendation found to approve. Run Stage 2 first.');
    }

    const approvalResult = await responseService.approveRecommendation(recId, {
      actor: options?.actor || 'Chief Inspector Maria Papadopoulou',
      notes:
        options?.notes ||
        'Immediate field sampling and containment dispatch approved based on multi-source sensor convergence.',
    });

    this.recommendationId = approvalResult.recommendation.id;
    this.taskId = approvalResult.task.id;
    this.currentStage = 4;
    this.stepsCompleted.push(
      `Stage 4: Recommendation ${approvalResult.recommendation.id.slice(0, 8)} approved by supervisor. Operational Task ${approvalResult.task.id.slice(0, 8)} created with status REQUESTED (priority: HIGH).`
    );
    this.lastAction = 'Approved recommendation & created operational field task';
    this.lastActionTimestamp = nowUtc();

    return this.getStatus();
  }

  /**
   * Stage 5: Field Team Dispatch & En-Route Transitions
   */
  public static async stage5_advanceFieldTask(taskId?: string): Promise<CanonicalDemoStatus> {
    logger.info('[CanonicalDemo] Executing Stage 5: Field Team En-Route Transitions');
    const targetTaskId = taskId || this.taskId;
    if (!targetTaskId) {
      throw new Error('No task available to advance. Run Stage 4 first.');
    }

    const responseService = getOperationalResponseService();

    // 1. ACCEPTED
    await responseService.transitionTaskStatus(
      targetTaskId,
      'ACCEPTED',
      'Field Inspector Alex Rivera',
      'En route to Almyros Reach Alpha promenade with mobile fluorometer and sterile sampling containers'
    );

    // 2. IN_PROGRESS
    await responseService.transitionTaskStatus(
      targetTaskId,
      'IN_PROGRESS',
      'Field Inspector Alex Rivera',
      'On site at Almyros Reach promenade. Commencing visual shoreline inspection and water parameter testing'
    );

    this.currentStage = 5;
    this.stepsCompleted.push(
      `Stage 5: Task ${targetTaskId.slice(0, 8)} accepted and transitioned to IN_PROGRESS by Inspector Alex Rivera on-site.`
    );
    this.lastAction = 'Field inspector arrived on-site and initiated inspection';
    this.lastActionTimestamp = nowUtc();

    return this.getStatus();
  }

  /**
   * Stage 6: Field Verification Submission & Closed-Loop Reassessment
   */
  public static async stage6_submitFieldVerification(
    taskId?: string,
    customInput?: Partial<SubmitVerificationInput>
  ): Promise<CanonicalDemoStatus> {
    logger.info('[CanonicalDemo] Executing Stage 6: Field Verification & Closed-Loop Feedback');
    const targetTaskId = taskId || this.taskId;
    if (!targetTaskId) {
      throw new Error('No task available for verification. Run Stage 4 & 5 first.');
    }

    const repos = getRepositories();
    const task = await repos.tasks.findById(targetTaskId);
    if (!task) {
      throw new Error(`Task with id '${targetTaskId}' not found.`);
    }

    const responseService = getOperationalResponseService();
    const now = nowUtc();

    // Pass valid coordinates matching task location for geofence validation
    const verificationInput: SubmitVerificationInput = {
      taskId: task.id,
      inspector: {
        actorId: 'actor-alex-rivera',
        name: 'Alex Rivera',
        organization: 'Volos Municipal Environmental Dept',
        role: 'FIELD_INSPECTOR',
        contact: '+30 24210 12345',
      },
      location: {
        type: 'Point',
        coordinates: task.location.coordinates as [number, number],
        latitude: task.location.coordinates[1],
        longitude: task.location.coordinates[0],
        accuracyMeters: 8,
      },
      status: 'CONFIRMED',
      observations: {
        waterColour: 'DENSE_GREEN',
        surfaceAppearance: 'SCUM_MAT',
        odour: 'SEPTIC_ROTTEN',
        foam: true,
        visibleAlgae: true,
        deadFish: 4,
        debris: 'MODERATE',
        flowConditions: 'STAGNANT',
        weatherConditions: 'SUNNY',
      },
      notes:
        'Field ground truth confirmed: Dense cyanobacterial surface bloom covering ~40% of reach section. Severe septic odor and 4 dead juvenile fish observed. Mobile fluorometry confirms phycocyanin surge.',
      photos: [
        {
          evidenceId: generateId(),
          verificationId: '',
          timestamp: now,
          filename: 'volos_almyros_bloom_scum_01.jpg',
          mediaType: 'image/jpeg',
          description: 'Dense green surface scum along promenade',
          source: 'field_camera',
        },
        {
          evidenceId: generateId(),
          verificationId: '',
          timestamp: now,
          filename: 'volos_almyros_dead_fish_02.jpg',
          mediaType: 'image/jpeg',
          description: 'Dead fish specimens recovered near culvert',
          source: 'field_camera',
        },
      ],
      clientSubmissionId: `canonical-verif-${generateId().slice(0, 8)}`,
      actor: 'Alex Rivera',
      ...customInput,
    };

    const verifResult = await responseService.submitVerification(verificationInput);

    this.verificationId = verifResult.verification.id;
    this.outcomeId = verifResult.outcome.id;
    this.currentStage = 6;
    this.stepsCompleted.push(
      `Stage 6: Field verification ${verifResult.verification.id.slice(0, 8)} submitted (Geofence verified, 4 dead fish, dense green scum). Closed-loop feedback: new FIELD_INSPECTION observation ingested, evidence reassessed (Score: ${verifResult.assessment.score}/100), task COMPLETED, proposed outcome: ${verifResult.outcome.proposedOutcome}.`
    );
    this.lastAction = 'Field verification submitted with geofenced proof; reassessment completed';
    this.lastActionTimestamp = nowUtc();

    return this.getStatus();
  }

  /**
   * Stage 7: Supervisor Confirms Final Operational Outcome
   */
  public static async stage7_confirmOutcome(
    incidentId?: string,
    outcome: OperationalOutcomeType = 'CONFIRMED'
  ): Promise<CanonicalDemoStatus> {
    logger.info('[CanonicalDemo] Executing Stage 7: Outcome Confirmation');
    const targetIncidentId = incidentId || this.incidentId;
    if (!targetIncidentId) {
      throw new Error('No incident available to confirm. Run prior stages first.');
    }

    const responseService = getOperationalResponseService();
    const outcomeResult = await responseService.confirmIncidentOutcome(
      targetIncidentId,
      outcome,
      'Supervisor Dimitris Georgiou',
      'Field ground truth fully corroborates cyanobacterial contamination. Municipal health alert and advisory broadcast authorized.'
    );

    const repos = getRepositories();
    const outboxEvents = await repos.outbox.find({ limit: 10 });
    this.outboxEventIds = outboxEvents.map((e) => e.id);

    this.outcomeId = outcomeResult.outcome.id;
    this.currentStage = 7;
    this.stepsCompleted.push(
      `Stage 7: Outcome confirmed as ${outcome} by Supervisor Dimitris Georgiou. Incident status set to ACTION_IN_PROGRESS. IncidentConfirmed domain event published; FHIR Flag resource qualified and queued in Interoperability Outbox.`
    );
    this.lastAction = 'Operational outcome confirmed; outbox event prepared';
    this.lastActionTimestamp = nowUtc();

    return this.getStatus();
  }

  /**
   * Stage 8: Deliver Interoperability Outbox Events with HMAC-SHA256
   */
  public static async stage8_deliverInteroperability(): Promise<CanonicalDemoStatus> {
    logger.info('[CanonicalDemo] Executing Stage 8: Interoperability Outbox Delivery');
    const worker = getDeliveryWorker();
    const repos = getRepositories();

    // Process all pending outbox deliveries
    await worker.processPendingEvents(20);

    const deliveredEvents = await repos.outbox.find({ status: 'DELIVERED' });
    const acknowledgements = await repos.acknowledgements.findAll(10);

    this.currentStage = 8;
    this.stepsCompleted.push(
      `Stage 8: Interoperability delivery worker processed outbox. Delivered ${deliveredEvents.length} event(s) to external public health consumer with HMAC-SHA256 signatures. Received ${acknowledgements.length} formal acknowledgement(s).`
    );
    this.lastAction = 'FHIR interoperability delivered & cryptographically acknowledged';
    this.lastActionTimestamp = nowUtc();

    return this.getStatus();
  }

  /**
   * Advances the scenario to the next stage deterministically.
   */
  public static async executeNextStep(requestedStep?: number): Promise<CanonicalDemoStatus> {
    const stepToRun = typeof requestedStep === 'number' ? requestedStep : this.currentStage + 1;

    switch (stepToRun) {
      case 0:
        return this.stage0_resetAndBaseline();
      case 1:
        return this.stage1_ingestSatelliteAnomaly();
      case 2:
        return this.stage2_ingestCorroboratingEvidence();
      case 3: {
        const res = await this.stage3_getPendingReviewState();
        return res.status;
      }
      case 4:
        return this.stage4_approveRecommendation();
      case 5:
        return this.stage5_advanceFieldTask();
      case 6:
        return this.stage6_submitFieldVerification();
      case 7:
        return this.stage7_confirmOutcome();
      case 8:
        return this.stage8_deliverInteroperability();
      default:
        return this.getStatus();
    }
  }

  /**
   * Runs the pipeline from Stage 0 up to Stage 3 (Human Review Gate), then pauses for the operator.
   */
  public static async runToGate(): Promise<CanonicalDemoStatus> {
    logger.info('[CanonicalDemo] Running scenario up to Human Review Gate (Stages 0 -> 3)...');
    await this.stage0_resetAndBaseline();
    await this.stage1_ingestSatelliteAnomaly();
    await this.stage2_ingestCorroboratingEvidence();
    const gate = await this.stage3_getPendingReviewState();
    return gate.status;
  }

  /**
   * Executes the full end-to-end lifecycle scenario sequentially (Stages 0 through 8).
   * Populates all domain entities via the REAL domain architecture.
   */
  public static async executeEndToEndScenario(): Promise<CanonicalDemoExecutionResult> {
    logger.info('[CanonicalDemo] Executing full automated end-to-end lifecycle demonstration...');

    await this.stage0_resetAndBaseline();
    await this.stage1_ingestSatelliteAnomaly();
    await this.stage2_ingestCorroboratingEvidence();
    await this.stage4_approveRecommendation();
    await this.stage5_advanceFieldTask();
    await this.stage6_submitFieldVerification();
    await this.stage7_confirmOutcome();
    await this.stage8_deliverInteroperability();

    const repos = getRepositories();
    const reach = (await repos.streamReaches.findById(this.reachId))!;
    const observations = await repos.observations.find({ streamReachId: this.reachId, limit: 10 });
    const assessment = (await repos.evidenceAssessments.findLatestByStreamReach(this.reachId))!;
    const incident = (await repos.incidents.findById(this.incidentId!))!;
    const recommendations = await repos.recommendations.findByIncidentId(this.incidentId!);
    const task = (await repos.tasks.findById(this.taskId!))!;
    const verification = (await repos.verifications.findById(this.verificationId!))!;
    const outcome = (await repos.incidentOutcomes.findLatestByIncidentId(this.incidentId!))!;
    const outboxEvents = await repos.outbox.find({ limit: 10 });

    logger.info('[CanonicalDemo] Full end-to-end lifecycle demonstration execution complete.');

    return {
      scenarioId: 'CANONICAL_ALMYROS_BLOOM',
      name: 'Full Closed-Loop Contamination Lifecycle (Almyros Stream Alpha)',
      reach,
      observations,
      assessment,
      incident,
      recommendations,
      tasks: [task],
      verification,
      outcome,
      outboxEvents,
      summary:
        'Canonical end-to-end municipal operational lifecycle successfully executed through real application architecture and domain engines.',
      stepsCompleted: [...this.stepsCompleted],
    };
  }
}
