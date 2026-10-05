import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/api/server.js';
import { setRepositories, createRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';
import { getOperationalResponseService } from '../../src/services/response/operational-response-service.js';
import { Recommendation } from '@aquasentinel/shared';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';

describe('Recommendations & Operational Response API Integration Tests', () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();
    const service = getOperationalResponseService();
    await service.initialize();
    app = createServer();
  });

  const createTestRecommendation = async (): Promise<Recommendation> => {
    const repos = (await import('../../src/database/repositories/index.js')).getRepositories();
    const now = nowUtc();
    const rec: Recommendation = {
      id: generateId(),
      incidentId: 'inc-test-01',
      assessmentId: 'eval-test-01',
      measureId: 'OAH-M-FIELD-01',
      actionType: 'FIELD_INVESTIGATION',
      title: 'Targeted in-reach grab sampling & multi-parameter field fluorometry',
      description: 'Collect multi-point grab samples for microcystin quantification.',
      rank: 1,
      suitabilityScore: 88,
      scoreBreakdown: {
        evidenceCompatibility: 24,
        incidentCompatibility: 19,
        siteCompatibility: 14,
        temporalCompatibility: 9,
        verificationReadiness: 9,
        operationalFeasibility: 13,
        contraindicationPenalty: 0,
      },
      rationaleDetails: {
        whyThis: 'Directly targets cyanobacteria bloom in Almyros Reach',
        whyNow: 'Evidence score is 88 in PRIORITIZE band with HIGH severity',
        whatSupportsIt: ['Sentinel-2 observed NDCI anomaly', 'IoT sensor recorded hypoxia'],
        whatWeakensIt: [],
        whatIsMissing: ['Cold-chain sample transit verification'],
      },
      rationale: 'Directly targets cyanobacteria bloom in Almyros Reach. Evidence score is 88.',
      supportingEvidenceIds: ['obs-1', 'obs-2'],
      contradictingEvidenceIds: [],
      missingPrerequisites: [],
      contraindications: [],
      requiredVerification: ['Chain of custody documentation'],
      responsibleRole: 'WATER_QUALITY_ANALYST',
      requiresApproval: true,
      humanApprovalRequired: true,
      status: 'PENDING_REVIEW',
      priority: 'HIGH',
      idempotencyKey: `idem-${generateId()}`,
      provenance: {
        id: generateId(),
        entityId: 'OAH-M-FIELD-01',
        entityType: 'RECOMMENDATION',
        source: 'RECOMMENDATION_ENGINE',
        sourceIdentifier: 'OAH-CAT-FIELD-01',
        acquisitionTimestamp: now,
        ingestionTimestamp: now,
        processingTimestamp: now,
        processingMethod: 'DETERMINISTIC_SUITABILITY_SCORING_V1',
        qualityStatus: 'VALIDATED',
      },
      createdAt: now,
      updatedAt: now,
    };

    return repos.recommendations.create(rec);
  };

  it('GET /api/v1/recommendations lists recommendations', async () => {
    const rec = await createTestRecommendation();
    const res = await request(app).get('/api/v1/recommendations');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some((r: any) => r.id === rec.id)).toBe(true);
  });

  it('GET /api/v1/recommendations/:id returns recommendation and FHIR task draft', async () => {
    const rec = await createTestRecommendation();
    const res = await request(app).get(`/api/v1/recommendations/${rec.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recommendation.id).toBe(rec.id);
    expect(res.body.data.fhirTaskDraft).toBeDefined();
    expect(res.body.data.fhirTaskDraft.resourceType).toBe('Task');
  });

  it('POST /api/v1/recommendations/:id/approve approves recommendation and generates Task + FHIR Task', async () => {
    const rec = await createTestRecommendation();
    const res = await request(app)
      .post(`/api/v1/recommendations/${rec.id}/approve`)
      .send({
        actor: 'Dr. Maria Vance, Lead Hydrologist',
        assignedTo: 'Regional Rapid Response Unit',
        notes: 'Priority grab sampling approved with mobile laboratory unit.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recommendation.status).toBe('APPROVED');
    expect(res.body.data.task).toBeDefined();
    expect(res.body.data.task.status).toBe('REQUESTED');
    expect(res.body.data.task.recommendationId).toBe(rec.id);
    expect(res.body.data.fhirTask).toBeDefined();
    expect(res.body.data.fhirTask.resourceType).toBe('Task');
  });

  it('POST /api/v1/recommendations/:id/reject rejects recommendation with reason', async () => {
    const rec = await createTestRecommendation();
    const res = await request(app)
      .post(`/api/v1/recommendations/${rec.id}/reject`)
      .send({
        actor: 'Supervisor Chen',
        reason: 'Duplicate dispatch: team already deployed to adjacent reach segment.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('REJECTED');
    expect(res.body.data.rejectionReason).toContain('Duplicate dispatch');
  });

  it('POST /api/v1/recommendations/:id/request-more-evidence transitions status and logs audit', async () => {
    const rec = await createTestRecommendation();
    const res = await request(app)
      .post(`/api/v1/recommendations/${rec.id}/request-more-evidence`)
      .send({
        actor: 'Senior Inspector Ramos',
        notes: 'Need telemetry sensor drift check prior to physical dispatch.',
        missingData: ['SENSOR_CALIBRATION_LOG'],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reviewNotes).toContain('Need telemetry sensor drift check');
  });
});
