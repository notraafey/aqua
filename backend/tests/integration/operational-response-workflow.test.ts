import { describe, it, expect, beforeAll } from 'vitest';
import { setRepositories, createRepositories, getRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';
import { getOperationalResponseService } from '../../src/services/response/operational-response-service.js';
import { getEventBus } from '../../src/events/index.js';
import { EvidenceAssessment } from '@aquasentinel/shared';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';

describe('Operational Response End-to-End Workflow Integration Test', () => {
  beforeAll(async () => {
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();
    const service = getOperationalResponseService();
    await service.initialize();
  });

  it('completes full cycle: Evidence Assessment -> Incident & Recommendations -> Approval -> Task -> FHIR Sync -> Lifecycle Verification', async () => {
    const repos = getRepositories();
    const eventBus = getEventBus();
    const service = getOperationalResponseService();

    // 1. Fetch seeded reach
    const reaches = await repos.streamReaches.findAll();
    expect(reaches.length).toBeGreaterThan(0);
    const targetReach = reaches[0];

    // 2. Construct high-confidence EvidenceAssessment
    const now = nowUtc();
    const assessment: EvidenceAssessment = {
      id: generateId(),
      streamReachId: targetReach.id,
      evaluatedAt: now,
      score: 84,
      confidenceBand: 'PRIORITIZE',
      supportingEvidence: [
        {
          observationId: 'obs-sat-almyros',
          source: 'SATELLITE_SENTINEL2',
          corroborationGroup: 'REMOTE_SENSING',
          indicator: 'NDCI',
          value: 0.38,
          unit: 'index',
          weight: 0.9,
          reason: 'Severe cyanobacteria pigment reflection',
        },
        {
          observationId: 'obs-iot-almyros',
          source: 'IOT_SENSOR',
          corroborationGroup: 'IN_SITU',
          indicator: 'DISSOLVED_OXYGEN',
          value: 1.8,
          unit: 'mg/L',
          weight: 0.9,
          reason: 'Severe localized anoxia',
        },
      ],
      contradictingEvidence: [],
      missingEvidence: [],
      independentSourceGroups: ['REMOTE_SENSING', 'IN_SITU'],
      groupContributions: {},
      dimensionScores: {
        spatialProximity: 90,
        temporalProximity: 95,
        severityExceedance: 85,
        sourceIndependence: 90,
        reproducibility: 85,
      },
      scoringBreakdown: {
        baseScore: 84,
        penalties: { dataQualityPenalty: 0, missingGroupPenalty: 0, contradictionPenalty: 0 },
        netScore: 84,
        band: 'PRIORITIZE',
        details: [],
      },
      dataQualityAudit: {
        totalObservationsEvaluated: 2,
        observationsFilteredOut: 0,
        observationsDemoted: 0,
        filterReasons: [],
        demoteReasons: [],
      },
    };

    await repos.evidenceAssessments.save(assessment);

    // 3. Trigger EvidenceUpdated event on event bus
    await eventBus.publish({
      eventId: generateId(),
      eventType: 'EvidenceUpdated',
      timestamp: now,
      actor: 'system:evidence_fusion_engine',
      payload: {
        streamReachId: targetReach.id,
        assessment,
      },
    });

    // 4. Verify that Operational Response Service automatically generated Recommendations
    const recs = await repos.recommendations.findByAssessmentId(assessment.id);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].status).toBe('PENDING_REVIEW');
    expect(recs[0].humanApprovalRequired).toBe(true);

    const targetRec = recs[0];

    // 5. Human-in-the-loop: Lead Officer Approves Recommendation
    const approvalResult = await service.approveRecommendation(
      targetRec.id,
      'Dr. Elena Kostas, Regional Water Authority',
      'FIELD_TECHNICIAN',
      'Approved immediate deployment of rapid sampling crew.'
    );

    expect(approvalResult.recommendation.status).toBe('APPROVED');
    expect(approvalResult.task).toBeDefined();
    expect(approvalResult.task.status).toBe('REQUESTED');
    expect(approvalResult.task.fhirTaskId).toBeDefined();

    const createdTask = approvalResult.task;

    // 6. Complete Task Lifecycle
    const acceptedTask = await service.transitionTaskStatus(
      createdTask.id,
      'ACCEPTED',
      'Tech Lead Yannis',
      'Crew en route'
    );
    expect(acceptedTask.status).toBe('ACCEPTED');

    const inProgressTask = await service.transitionTaskStatus(
      createdTask.id,
      'IN_PROGRESS',
      'Tech Lead Yannis',
      'Deploying water sondes'
    );
    expect(inProgressTask.status).toBe('IN_PROGRESS');

    const completedTask = await service.transitionTaskStatus(
      createdTask.id,
      'COMPLETED',
      'Tech Lead Yannis',
      'Sample gathered. DO = 1.9 mg/L. Microcystin test strip positive.'
    );
    expect(completedTask.status).toBe('COMPLETED');

    const verifiedTask = await service.transitionTaskStatus(
      createdTask.id,
      'VERIFIED',
      'Dr. Elena Kostas',
      'Field results verified against municipal laboratory standards.'
    );
    expect(verifiedTask.status).toBe('VERIFIED');

    // 7. Inspect Audit Trail
    const auditLogs = await repos.auditLogs.findByTaskId(createdTask.id);
    expect(auditLogs.length).toBeGreaterThanOrEqual(4);
    expect(auditLogs.some((l) => l.newStatus === 'VERIFIED')).toBe(true);
  });
});
