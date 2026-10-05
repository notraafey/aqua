/**
 * Phase 8 Demo Scenarios: Closed-Loop Field Response
 * PRD Section 33, 39, 40.
 *
 * Scenario A: Confirmed Contamination (green foam + dead fish → CONFIRMED)
 * Scenario B: False Alarm / Not Confirmed (clear water → NOT_CONFIRMED)
 * Scenario C: Uncertain / Follow-Up (ambiguous stormwater → ADDITIONAL_VERIFICATION_REQUIRED)
 */

import {
  Incident,
  Task,
  Verification,
  FieldActor,
  IncidentOutcome,
  StructuredFieldObservations,
  PhotoEvidence,
  GeoJsonPoint,
  OperationalOutcomeType,
} from '@aquasentinel/shared';
import { getOperationalResponseService, SubmitVerificationInput } from '../../services/response/operational-response-service.js';
import { getRepositories } from '../../database/repositories/index.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';
import { logger } from '../../logging/logger.js';

const DEMO_REACH_ID = 'reach-alfios-lower';
const DEMO_LOCATION: GeoJsonPoint = { type: 'Point', coordinates: [23.7275, 37.9838] };

export class Phase8DemoRunner {

  private static async getTargetReachAndLocation(scenarioIndex = 0): Promise<{ reachId: string; location: GeoJsonPoint }> {
    const repos = getRepositories();
    const reaches = await repos.streamReaches.findAll();
    if (reaches.length > scenarioIndex && reaches[scenarioIndex].geometry?.coordinates?.length > 0) {
      const reach = reaches[scenarioIndex];
      const rawCoords: any = reach.geometry.coordinates[Math.floor(reach.geometry.coordinates.length / 2)] || reach.geometry.coordinates[0];
      const ptCoords: [number, number] = Array.isArray(rawCoords) && typeof rawCoords[0] === 'number'
        ? [rawCoords[0], rawCoords[1]]
        : [22.7535, 39.1812];
      return {
        reachId: reach.id,
        location: { type: 'Point', coordinates: ptCoords },
      };
    }
    const reachIds = [
      '7a3b4c12-89de-4f56-9abc-1234567890ab',
      '8b4c5d23-90ef-5a67-abcd-2345678901bc',
      '9c5d6e34-01fa-6b78-bcde-3456789012cd',
    ];
    const reachNames = ['Almyros Stream - Reach Alpha', 'Kladissos River - Estuary Segment', 'Pineios River - Middle Basin'];
    const reachId = reachIds[scenarioIndex % 3];
    const existing = await repos.streamReaches.findById(reachId);
    if (existing) {
      const rawCoords: any = existing.geometry.coordinates[0];
      const ptCoords: [number, number] = Array.isArray(rawCoords) && typeof rawCoords[0] === 'number'
        ? [rawCoords[0], rawCoords[1]]
        : [22.7535, 39.1812];
      return { reachId: existing.id, location: { type: 'Point', coordinates: ptCoords } };
    }

    const newReach = await repos.streamReaches.create({
      id: reachId,
      name: reachNames[scenarioIndex % 3],
      city: 'Larissa',
      region: 'Thessaly, Greece',
      monitoringStatus: 'ACTIVE',
      geometry: {
        type: 'LineString',
        coordinates: [
          [22.4100 + scenarioIndex * 0.05, 39.6300],
          [22.4150 + scenarioIndex * 0.05, 39.6350],
        ],
      },
      waterCoverageConstraint: { minWidthMeters: 15, confidencePenalty: 0.2 },
      baselineData: { typicalNdci: 0.12, typicalTurbidity: 4.5, typicalTempC: 18.5, lastUpdated: nowUtc() },
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    });
    const rawCoords: any = newReach.geometry.coordinates[0];
    const ptCoords: [number, number] = [rawCoords[0], rawCoords[1]];
    return { reachId: newReach.id, location: { type: 'Point', coordinates: ptCoords } };
  }

  /**
   * Scenario A: Confirmed Contamination
   * Sentinel-2 detects green anomaly → Task created → Inspector Alex Rivera observes green foam
   * & dead fish → Reassessment → CONFIRMED → Supervisor confirms → Phase 7 outbox
   */
  static async runScenarioA_Confirmed(): Promise<any> {
    const repos = getRepositories();
    const service = getOperationalResponseService();
    const now = nowUtc();
    const steps: string[] = [];
    const reachInfo = await this.getTargetReachAndLocation(0);

    // Step 1: Create incident for demo
    const incident: Incident = {
      id: generateId(),
      streamReachId: reachInfo.reachId,
      severity: 'HIGH',
      status: 'FIELD_VERIFICATION_PENDING',
      hazardType: 'ALGAL_BLOOM',
      evidenceConfidence: 75,
      verificationStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    await repos.incidents.create(incident);
    steps.push(`1. Incident created: ${incident.id} (severity: HIGH)`);

    // Step 2: Create field inspection task
    const task: Task = {
      id: generateId(),
      incidentId: incident.id,
      taskType: 'FIELD_INSPECTION' as any,
      title: 'Ground truth verification — suspected algal bloom at Alfios Lower',
      assignedTo: 'Alex Rivera',
      location: reachInfo.location,
      priority: 'HIGH',
      instructions: 'Inspect water surface for discoloration, foam, odor. Collect photo evidence. Record structured observations.',
      requiredEvidence: ['photo', 'structured_observations'],
      status: 'REQUESTED',
      createdAt: now,
    };
    await repos.tasks.create(task);
    steps.push(`2. Task created: ${task.id} (assigned to: Alex Rivera)`);

    // Step 3: Assign to actor
    const actors = await repos.fieldActors.findAll();
    const alexActor = actors.find((a: FieldActor) => a.name === 'Alex Rivera');
    if (alexActor) {
      await service.assignTask(task.id, alexActor.actorId, 'Supervisor Dimitris', 'Priority field inspection');
      steps.push(`3. Task assigned to actor ${alexActor.actorId} (Alex Rivera)`);
    } else {
      await service.transitionTaskStatus(task.id, 'ASSIGNED', 'Supervisor Dimitris', 'No actor found, manual assignment');
      steps.push('3. Task assigned manually (actor not found)');
    }

    // Step 4: Inspector accepts and starts work
    await service.transitionTaskStatus(task.id, 'ACCEPTED', 'Alex Rivera', 'En route to location');
    steps.push('4. Task accepted by Alex Rivera');

    await service.transitionTaskStatus(task.id, 'IN_PROGRESS', 'Alex Rivera', 'On-site, beginning inspection');
    steps.push('5. Task in progress — inspector on site');

    // Step 5: Submit verification with positive contamination signals
    const verificationInput: SubmitVerificationInput = {
      taskId: task.id,
      inspector: alexActor || { name: 'Alex Rivera', role: 'FIELD_INSPECTOR', organization: 'EU Water Authority' },
      location: { ...reachInfo.location, accuracyMeters: 12 },
      status: 'CONFIRMED',
      observations: {
        waterColour: 'DENSE_GREEN',
        surfaceAppearance: 'FOAM',
        odour: 'FISHY',
        foam: true,
        visibleAlgae: true,
        deadFish: 3,
        debris: 'MODERATE',
        flowConditions: 'STAGNANT',
        weatherConditions: 'SUNNY',
      },
      notes: 'Visible green foam covering 40% of surface. Dead fish (3 specimens) observed near bank. Strong fishy odor. Algal mat developing.',
      photos: [{
        evidenceId: generateId(),
        verificationId: '',
        timestamp: now,
        filename: 'algal_bloom_evidence_01.jpg',
        mediaType: 'image/jpeg',
        description: 'Dense green foam on water surface with visible dead fish',
        source: 'field_camera',
      }],
      clientSubmissionId: `demo-a-${generateId().slice(0, 8)}`,
      actor: 'Alex Rivera',
    };

    const verificationResult = await service.submitVerification(verificationInput);
    steps.push(`6. Verification submitted: ${verificationResult.verification.id}`);
    steps.push(`7. Outcome proposed: ${verificationResult.outcome.proposedOutcome} (confidence: ${verificationResult.outcome.confidence}%)`);

    // Step 6: Supervisor confirms outcome
    const confirmResult = await service.confirmIncidentOutcome(
      incident.id,
      'CONFIRMED',
      'Supervisor Dimitris',
      'Field evidence is conclusive. Confirmed algal bloom with ecological impact.'
    );
    steps.push(`8. Outcome confirmed by supervisor: ${confirmResult.outcome.confirmedOutcome}`);

    logger.info('[Phase8DemoRunner] Scenario A (Confirmed) completed', { incidentId: incident.id, steps });

    return {
      scenario: 'A',
      title: 'Confirmed Contamination',
      incidentId: incident.id,
      taskId: task.id,
      verificationId: verificationResult.verification.id,
      outcomeId: confirmResult.outcome.id,
      proposedOutcome: verificationResult.outcome.proposedOutcome,
      confirmedOutcome: confirmResult.outcome.confirmedOutcome,
      steps,
    };
  }

  /**
   * Scenario B: False Alarm (Not Confirmed)
   * Optical anomaly → Inspector Elena Vasquez finds clear water → NOT_CONFIRMED → Phase 7 delivers
   */
  static async runScenarioB_NotConfirmed(): Promise<any> {
    const repos = getRepositories();
    const service = getOperationalResponseService();
    const now = nowUtc();
    const steps: string[] = [];
    const reachInfo = await this.getTargetReachAndLocation(1);

    const incident: Incident = {
      id: generateId(),
      streamReachId: reachInfo.reachId,
      severity: 'MEDIUM',
      status: 'FIELD_VERIFICATION_PENDING',
      hazardType: 'UNKNOWN',
      evidenceConfidence: 55,
      verificationStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    await repos.incidents.create(incident);
    steps.push(`1. Incident created: ${incident.id} (severity: MEDIUM)`);

    const task: Task = {
      id: generateId(),
      incidentId: incident.id,
      taskType: 'FIELD_INSPECTION' as any,
      title: 'Verify optical anomaly — possible false positive',
      assignedTo: 'Elena Vasquez',
      location: reachInfo.location,
      priority: 'MEDIUM',
      instructions: 'Inspect area for actual contamination. Note water clarity and collect surface sample.',
      status: 'REQUESTED',
      createdAt: now,
    };
    await repos.tasks.create(task);
    steps.push(`2. Task created: ${task.id}`);

    const actors = await repos.fieldActors.findAll();
    const elenaActor = actors.find((a: FieldActor) => a.name === 'Elena Vasquez');
    if (elenaActor) {
      await service.assignTask(task.id, elenaActor.actorId, 'Supervisor Dimitris');
    }
    await service.transitionTaskStatus(task.id, 'ACCEPTED', 'Elena Vasquez');
    await service.transitionTaskStatus(task.id, 'IN_PROGRESS', 'Elena Vasquez');
    steps.push('3. Task assigned, accepted, and in progress');

    // Elena finds clear water — false alarm
    const verificationInput: SubmitVerificationInput = {
      taskId: task.id,
      inspector: elenaActor || { name: 'Elena Vasquez', role: 'ENVIRONMENTAL_SPECIALIST', organization: 'EU Water Authority' },
      location: { ...reachInfo.location, accuracyMeters: 8 },
      status: 'NOT_CONFIRMED',
      observations: {
        waterColour: 'CLEAR',
        surfaceAppearance: 'CLEAR',
        odour: 'NONE',
        foam: false,
        visibleAlgae: false,
        deadFish: 0,
        debris: 'NONE',
        flowConditions: 'NORMAL',
        weatherConditions: 'OVERCAST',
      },
      notes: 'Water is clear with normal flow. No visible contamination, foam, or algae. Likely sediment plume from recent rainfall resolved naturally.',
      clientSubmissionId: `demo-b-${generateId().slice(0, 8)}`,
      actor: 'Elena Vasquez',
    };

    const verificationResult = await service.submitVerification(verificationInput);
    steps.push(`4. Verification submitted: ${verificationResult.verification.id}`);
    steps.push(`5. Outcome proposed: ${verificationResult.outcome.proposedOutcome}`);

    // Supervisor confirms not-confirmed (false alarm)
    const confirmResult = await service.confirmIncidentOutcome(
      incident.id,
      'NOT_CONFIRMED',
      'Supervisor Dimitris',
      'Field inspection confirms clear water. Original satellite signal was a false positive (sediment plume). Original data preserved.'
    );
    steps.push(`6. Outcome confirmed: ${confirmResult.outcome.confirmedOutcome} (false alarm recorded)`);

    logger.info('[Phase8DemoRunner] Scenario B (Not Confirmed) completed', { incidentId: incident.id });

    return {
      scenario: 'B',
      title: 'False Alarm (Not Confirmed)',
      incidentId: incident.id,
      taskId: task.id,
      verificationId: verificationResult.verification.id,
      outcomeId: confirmResult.outcome.id,
      proposedOutcome: verificationResult.outcome.proposedOutcome,
      confirmedOutcome: confirmResult.outcome.confirmedOutcome,
      steps,
    };
  }

  /**
   * Scenario C: Uncertain / Follow-Up Required
   * Turbidity signal → Inspector Nikos Katsaros records ambiguous stormwater →
   * ADDITIONAL_VERIFICATION_REQUIRED → follow-up task created
   */
  static async runScenarioC_Uncertain(): Promise<any> {
    const repos = getRepositories();
    const service = getOperationalResponseService();
    const now = nowUtc();
    const steps: string[] = [];
    const reachInfo = await this.getTargetReachAndLocation(2);

    const incident: Incident = {
      id: generateId(),
      streamReachId: reachInfo.reachId,
      severity: 'MEDIUM',
      status: 'FIELD_VERIFICATION_PENDING',
      hazardType: 'UNKNOWN',
      evidenceConfidence: 60,
      verificationStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    await repos.incidents.create(incident);
    steps.push(`1. Incident created: ${incident.id}`);

    const task: Task = {
      id: generateId(),
      incidentId: incident.id,
      taskType: 'FIELD_INSPECTION' as any,
      title: 'Investigate turbidity anomaly — stormwater or discharge?',
      assignedTo: 'Nikos Katsaros',
      location: reachInfo.location,
      priority: 'MEDIUM',
      instructions: 'Investigate source of turbidity. Check for point-source discharge. Collect water sample.',
      status: 'REQUESTED',
      createdAt: now,
    };
    await repos.tasks.create(task);
    steps.push(`2. Task created: ${task.id}`);

    const actors = await repos.fieldActors.findAll();
    const nikosActor = actors.find((a: FieldActor) => a.name === 'Nikos Katsaros');
    if (nikosActor) {
      await service.assignTask(task.id, nikosActor.actorId, 'Supervisor Dimitris');
    }
    await service.transitionTaskStatus(task.id, 'ACCEPTED', 'Nikos Katsaros');
    await service.transitionTaskStatus(task.id, 'IN_PROGRESS', 'Nikos Katsaros');
    steps.push('3. Task assigned, accepted, and in progress');

    // Nikos finds ambiguous conditions
    const verificationInput: SubmitVerificationInput = {
      taskId: task.id,
      inspector: nikosActor || { name: 'Nikos Katsaros', role: 'MUNICIPAL_OFFICER', organization: 'Hellenic Water Board' },
      location: { ...reachInfo.location, accuracyMeters: 15 },
      status: 'UNCERTAIN',
      observations: {
        waterColour: 'BROWN',
        surfaceAppearance: 'CLEAR',
        odour: 'EARTHY',
        foam: false,
        visibleAlgae: false,
        deadFish: false,
        debris: 'LIGHT',
        flowConditions: 'NORMAL',
        weatherConditions: 'POST_STORM',
        humanActivity: 'Construction site drainage 200m upstream',
      },
      notes: 'Water is brown/turbid but no chemical contamination indicators. Earthy smell suggests sediment. Possible stormwater runoff from nearby construction. Cannot rule out industrial discharge without lab analysis.',
      clientSubmissionId: `demo-c-${generateId().slice(0, 8)}`,
      actor: 'Nikos Katsaros',
    };

    const verificationResult = await service.submitVerification(verificationInput);
    steps.push(`4. Verification submitted: ${verificationResult.verification.id}`);
    steps.push(`5. Outcome proposed: ${verificationResult.outcome.proposedOutcome}`);

    // Supervisor acknowledges uncertainty and creates follow-up task
    const confirmResult = await service.confirmIncidentOutcome(
      incident.id,
      'ADDITIONAL_VERIFICATION_REQUIRED',
      'Supervisor Dimitris',
      'Ambiguous conditions. Need secondary sampling to distinguish stormwater from discharge.'
    );
    steps.push(`6. Outcome confirmed: ${confirmResult.outcome.confirmedOutcome}`);

    // Create follow-up task for secondary sampling
    const followUpTask = await service.createFollowUpTask(incident.id, {
      title: 'Secondary water sampling — turbidity source determination',
      instructions: 'Collect upstream and downstream water samples. Test for heavy metals and organic pollutants. Compare with stormwater baseline.',
      assignedTo: 'Elena Vasquez',
      assignedRole: 'ENVIRONMENTAL_SPECIALIST',
      priority: 'HIGH',
      requiredEvidence: ['water_sample', 'lab_analysis'],
      actor: 'Supervisor Dimitris',
    });
    steps.push(`7. Follow-up task created: ${followUpTask.id} (secondary sampling)`);

    logger.info('[Phase8DemoRunner] Scenario C (Uncertain) completed', { incidentId: incident.id });

    return {
      scenario: 'C',
      title: 'Uncertain / Follow-Up Required',
      incidentId: incident.id,
      taskId: task.id,
      followUpTaskId: followUpTask.id,
      verificationId: verificationResult.verification.id,
      outcomeId: confirmResult.outcome.id,
      proposedOutcome: verificationResult.outcome.proposedOutcome,
      confirmedOutcome: confirmResult.outcome.confirmedOutcome,
      steps,
    };
  }

  /**
   * Execute all three scenarios in sequence.
   */
  static async executeAll(): Promise<any> {
    const results = {
      scenarioA: await this.runScenarioA_Confirmed(),
      scenarioB: await this.runScenarioB_NotConfirmed(),
      scenarioC: await this.runScenarioC_Uncertain(),
    };

    logger.info('[Phase8DemoRunner] All Phase 8 demo scenarios completed successfully');
    return results;
  }
}
