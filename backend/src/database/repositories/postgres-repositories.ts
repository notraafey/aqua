import { pool } from '../client.js';
import {
  StreamReach,
  Observation,
  ObservationFilter,
  Incident,
  Task,
  TaskFilter,
  EvidenceItem,
  EvidenceAssessment,
  EvidenceAssessmentFilter,
  Recommendation,
  RecommendationFilter,
  CatalogueMeasure,
  TaskAuditEvent,
  Verification,
  VerificationFilter,
  FieldActor,
  IncidentOutcome,
  ForecastResult,
  ScenarioSimulation,
  EarlyWarning,
  ModelEvaluationMetric,
  OutboxEvent,
  OutboxDeliveryStatus,
  InteroperabilityAcknowledgement,
  InteroperabilityAuditEntry,
  FhirSubscription,
  InteroperabilityFilter,
} from '@aquasentinel/shared';
import {
  IStreamReachRepository,
  IObservationRepository,
  IIncidentRepository,
  ITaskRepository,
  IRecommendationRepository,
  ICatalogueRepository,
  IAuditLogRepository,
  IEvidenceAssessmentRepository,
  IForecastRepository,
  IScenarioRepository,
  IEarlyWarningRepository,
  IModelEvaluationRepository,
  IOutboxRepository,
  IAcknowledgementRepository,
  IInteroperabilityAuditRepository,
  IFhirSubscriptionRepository,
  IVerificationRepository,
  IFieldActorRepository,
  IIncidentOutcomeRepository,
} from './types.js';
import { SEED_CATALOGUE_MEASURES } from '../../domain/catalogue/seed-measures.js';

export class PostgresStreamReachRepository implements IStreamReachRepository {
  async findAll(): Promise<StreamReach[]> {
    const res = await pool.query(`
      SELECT id, name, geometry, city, region, monitoring_status as "monitoringStatus",
             water_coverage_constraint as "waterCoverageConstraint", baseline_data as "baselineData",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM stream_reaches
      ORDER BY name ASC
    `);
    return res.rows;
  }

  async findById(id: string): Promise<StreamReach | null> {
    const res = await pool.query(
      `
      SELECT id, name, geometry, city, region, monitoring_status as "monitoringStatus",
             water_coverage_constraint as "waterCoverageConstraint", baseline_data as "baselineData",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM stream_reaches
      WHERE id = $1
    `,
      [id]
    );
    return res.rows[0] || null;
  }

  async create(reach: StreamReach): Promise<StreamReach> {
    await pool.query(
      `
      INSERT INTO stream_reaches (id, name, geometry, city, region, monitoring_status, water_coverage_constraint, baseline_data, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        monitoring_status = EXCLUDED.monitoring_status,
        updated_at = EXCLUDED.updated_at
    `,
      [
        reach.id,
        reach.name,
        JSON.stringify(reach.geometry),
        reach.city,
        reach.region,
        reach.monitoringStatus,
        reach.waterCoverageConstraint ? JSON.stringify(reach.waterCoverageConstraint) : null,
        reach.baselineData ? JSON.stringify(reach.baselineData) : null,
        reach.createdAt,
        reach.updatedAt,
      ]
    );
    return reach;
  }

  async save(reach: StreamReach): Promise<StreamReach> {
    return this.create(reach);
  }

  async count(): Promise<number> {
    const res = await pool.query('SELECT COUNT(*) FROM stream_reaches');
    return parseInt(res.rows[0].count, 10);
  }
}

export class PostgresObservationRepository implements IObservationRepository {
  private mapRow(r: any): Observation {
    return {
      id: r.id,
      source: r.source,
      timestamp: r.timestamp.toISOString ? r.timestamp.toISOString() : r.timestamp,
      location: r.location,
      streamReachId: r.streamReachId,
      indicator: r.indicator,
      value: isNaN(Number(r.value)) ? r.value : Number(r.value),
      unit: r.unit,
      quality: r.quality,
      deduplicationHash: r.deduplicationHash || undefined,
      metadata: r.metadata || undefined,
      createdAt: r.createdAt.toISOString ? r.createdAt.toISOString() : r.createdAt,
      provenance: {
        id: r.prov_id || r.id,
        entityId: r.prov_entity_id || r.id,
        entityType: r.prov_entity_type || 'OBSERVATION',
        source: r.prov_source || r.source,
        sourceIdentifier: r.prov_source_id || 'UNKNOWN',
        acquisitionTimestamp: r.prov_acq ? (r.prov_acq.toISOString ? r.prov_acq.toISOString() : r.prov_acq) : r.timestamp,
        ingestionTimestamp: r.prov_ing ? (r.prov_ing.toISOString ? r.prov_ing.toISOString() : r.prov_ing) : r.createdAt,
        processingTimestamp: r.prov_proc ? (r.prov_proc.toISOString ? r.prov_proc.toISOString() : r.prov_proc) : r.createdAt,
        processingMethod: r.prov_method || 'DEFAULT',
        qualityStatus: r.prov_quality || r.quality,
        metadata: r.prov_metadata || {},
      },
    };
  }

  async findAll(limit = 100): Promise<Observation[]> {
    const res = await pool.query(
      `
      SELECT o.id, o.source, o.timestamp, o.location, o.stream_reach_id as "streamReachId",
             o.indicator, o.value, o.unit, o.quality, o.deduplication_hash as "deduplicationHash",
             o.metadata, o.created_at as "createdAt",
             p.id as prov_id, p.entity_id as prov_entity_id, p.entity_type as prov_entity_type,
             p.source as prov_source, p.source_identifier as prov_source_id,
             p.acquisition_timestamp as prov_acq, p.ingestion_timestamp as prov_ing,
             p.processing_timestamp as prov_proc, p.processing_method as prov_method,
             p.quality_status as prov_quality, p.metadata as prov_metadata
      FROM observations o
      LEFT JOIN provenance_records p ON o.provenance_id = p.id
      ORDER BY o.timestamp DESC
      LIMIT $1
    `,
      [limit]
    );

    return res.rows.map((r) => this.mapRow(r));
  }

  async findById(id: string): Promise<Observation | null> {
    const res = await pool.query(
      `
      SELECT o.id, o.source, o.timestamp, o.location, o.stream_reach_id as "streamReachId",
             o.indicator, o.value, o.unit, o.quality, o.deduplication_hash as "deduplicationHash",
             o.metadata, o.created_at as "createdAt",
             p.id as prov_id, p.entity_id as prov_entity_id, p.entity_type as prov_entity_type,
             p.source as prov_source, p.source_identifier as prov_source_id,
             p.acquisition_timestamp as prov_acq, p.ingestion_timestamp as prov_ing,
             p.processing_timestamp as prov_proc, p.processing_method as prov_method,
             p.quality_status as prov_quality, p.metadata as prov_metadata
      FROM observations o
      LEFT JOIN provenance_records p ON o.provenance_id = p.id
      WHERE o.id = $1
    `,
      [id]
    );

    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async findByStreamReach(streamReachId: string): Promise<Observation[]> {
    return this.find({ streamReachId, limit: 500 });
  }

  async findByDeduplicationHash(hash: string): Promise<Observation | null> {
    const res = await pool.query(
      `
      SELECT o.id, o.source, o.timestamp, o.location, o.stream_reach_id as "streamReachId",
             o.indicator, o.value, o.unit, o.quality, o.deduplication_hash as "deduplicationHash",
             o.metadata, o.created_at as "createdAt",
             p.id as prov_id, p.entity_id as prov_entity_id, p.entity_type as prov_entity_type,
             p.source as prov_source, p.source_identifier as prov_source_id,
             p.acquisition_timestamp as prov_acq, p.ingestion_timestamp as prov_ing,
             p.processing_timestamp as prov_proc, p.processing_method as prov_method,
             p.quality_status as prov_quality, p.metadata as prov_metadata
      FROM observations o
      LEFT JOIN provenance_records p ON o.provenance_id = p.id
      WHERE o.deduplication_hash = $1
      LIMIT 1
    `,
      [hash]
    );

    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async find(filter?: ObservationFilter): Promise<Observation[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter?.streamReachId !== undefined) {
      if (filter.streamReachId === null) {
        conditions.push('o.stream_reach_id IS NULL');
      } else {
        conditions.push(`o.stream_reach_id = $${idx++}`);
        values.push(filter.streamReachId);
      }
    }

    if (filter?.source) {
      conditions.push(`o.source = $${idx++}`);
      values.push(filter.source);
    }

    if (filter?.indicator) {
      conditions.push(`o.indicator = $${idx++}`);
      values.push(filter.indicator);
    }

    if (filter?.quality) {
      conditions.push(`o.quality = $${idx++}`);
      values.push(filter.quality);
    }

    if (filter?.startDate) {
      conditions.push(`o.timestamp >= $${idx++}`);
      values.push(filter.startDate);
    }

    if (filter?.endDate) {
      conditions.push(`o.timestamp <= $${idx++}`);
      values.push(filter.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter?.limit || 100;
    values.push(limit);

    const query = `
      SELECT o.id, o.source, o.timestamp, o.location, o.stream_reach_id as "streamReachId",
             o.indicator, o.value, o.unit, o.quality, o.deduplication_hash as "deduplicationHash",
             o.metadata, o.created_at as "createdAt",
             p.id as prov_id, p.entity_id as prov_entity_id, p.entity_type as prov_entity_type,
             p.source as prov_source, p.source_identifier as prov_source_id,
             p.acquisition_timestamp as prov_acq, p.ingestion_timestamp as prov_ing,
             p.processing_timestamp as prov_proc, p.processing_method as prov_method,
             p.quality_status as prov_quality, p.metadata as prov_metadata
      FROM observations o
      LEFT JOIN provenance_records p ON o.provenance_id = p.id
      ${whereClause}
      ORDER BY o.timestamp DESC
      LIMIT $${idx}
    `;

    const res = await pool.query(query, values);
    return res.rows.map((r) => this.mapRow(r));
  }

  async create(obs: Observation): Promise<Observation> {
    // 1. Insert provenance record
    await pool.query(
      `
      INSERT INTO provenance_records (
        id, entity_id, entity_type, source, source_identifier,
        acquisition_timestamp, ingestion_timestamp, processing_timestamp,
        processing_method, quality_status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO NOTHING
    `,
      [
        obs.provenance.id,
        obs.provenance.entityId,
        obs.provenance.entityType,
        obs.provenance.source,
        obs.provenance.sourceIdentifier,
        obs.provenance.acquisitionTimestamp,
        obs.provenance.ingestionTimestamp,
        obs.provenance.processingTimestamp,
        obs.provenance.processingMethod,
        obs.provenance.qualityStatus,
        JSON.stringify(obs.provenance.metadata || {}),
      ]
    );

    // 2. Insert observation
    await pool.query(
      `
      INSERT INTO observations (
        id, source, timestamp, location, stream_reach_id, indicator, value, unit, quality, provenance_id, deduplication_hash, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `,
      [
        obs.id,
        obs.source,
        obs.timestamp,
        JSON.stringify(obs.location),
        obs.streamReachId || null,
        obs.indicator,
        String(obs.value),
        obs.unit,
        obs.quality,
        obs.provenance.id,
        obs.deduplicationHash || null,
        JSON.stringify(obs.metadata || {}),
        obs.createdAt,
      ]
    );

    return obs;
  }

  async save(obs: Observation): Promise<Observation> {
    return this.create(obs);
  }

  async count(): Promise<number> {
    const res = await pool.query('SELECT COUNT(*) FROM observations');
    return parseInt(res.rows[0].count, 10);
  }
}

export class PostgresIncidentRepository implements IIncidentRepository {
  async findAll(): Promise<Incident[]> {
    const res = await pool.query(`
      SELECT id, stream_reach_id as "streamReachId", created_at as "createdAt", updated_at as "updatedAt",
             status, hazard_type as "hazardType", evidence_confidence as "evidenceConfidence",
             severity, verification_status as "verificationStatus", resolution
      FROM incidents
      ORDER BY updated_at DESC
    `);
    return res.rows.map((r) => ({
      ...r,
      evidenceConfidence: parseFloat(r.evidenceConfidence),
      createdAt: r.createdAt.toISOString ? r.createdAt.toISOString() : r.createdAt,
      updatedAt: r.updatedAt.toISOString ? r.updatedAt.toISOString() : r.updatedAt,
    }));
  }

  async findById(id: string): Promise<Incident | null> {
    const res = await pool.query(
      `
      SELECT id, stream_reach_id as "streamReachId", created_at as "createdAt", updated_at as "updatedAt",
             status, hazard_type as "hazardType", evidence_confidence as "evidenceConfidence",
             severity, verification_status as "verificationStatus", resolution
      FROM incidents
      WHERE id = $1
    `,
      [id]
    );
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      ...r,
      evidenceConfidence: parseFloat(r.evidenceConfidence),
      createdAt: r.createdAt.toISOString ? r.createdAt.toISOString() : r.createdAt,
      updatedAt: r.updatedAt.toISOString ? r.updatedAt.toISOString() : r.updatedAt,
    };
  }

  async create(incident: Incident): Promise<Incident> {
    await pool.query(
      `
      INSERT INTO incidents (id, stream_reach_id, created_at, updated_at, status, hazard_type, evidence_confidence, severity, verification_status, resolution)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
      [
        incident.id,
        incident.streamReachId,
        incident.createdAt,
        incident.updatedAt,
        incident.status,
        incident.hazardType,
        incident.evidenceConfidence,
        incident.severity,
        incident.verificationStatus,
        incident.resolution || null,
      ]
    );
    return incident;
  }

  async update(id: string, updates: Partial<Incident>): Promise<Incident | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await pool.query(
      `
      UPDATE incidents
      SET status = $2, hazard_type = $3, evidence_confidence = $4, severity = $5,
          verification_status = $6, resolution = $7, updated_at = $8
      WHERE id = $1
    `,
      [
        id,
        updated.status,
        updated.hazardType,
        updated.evidenceConfidence,
        updated.severity,
        updated.verificationStatus,
        updated.resolution || null,
        updated.updatedAt,
      ]
    );
    return updated;
  }

  async findEvidenceByIncidentId(incidentId: string): Promise<EvidenceItem[]> {
    const res = await pool.query(
      `
      SELECT id, incident_id as "incidentId", source, observation_id as "observationId",
             relevance, spatial_match as "spatialMatch", temporal_match as "temporalMatch",
             quality_score as "qualityScore", contribution, created_at as "createdAt"
      FROM evidence_items
      WHERE incident_id = $1
      ORDER BY created_at ASC
    `,
      [incidentId]
    );
    return res.rows.map((r) => ({
      ...r,
      qualityScore: parseFloat(r.qualityScore),
      createdAt: r.createdAt.toISOString ? r.createdAt.toISOString() : r.createdAt,
      provenance: {
        id: r.id,
        entityId: r.id,
        entityType: 'EVIDENCE_ITEM',
        source: r.source,
        sourceIdentifier: r.observationId,
        acquisitionTimestamp: r.createdAt,
        ingestionTimestamp: r.createdAt,
        processingTimestamp: r.createdAt,
        processingMethod: 'EVIDENCE_MATCHER',
        qualityStatus: 'VALIDATED',
      },
    }));
  }

  async addEvidence(evidence: EvidenceItem): Promise<EvidenceItem> {
    await pool.query(
      `
      INSERT INTO evidence_items (id, incident_id, source, observation_id, relevance, spatial_match, temporal_match, quality_score, contribution, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
      [
        evidence.id,
        evidence.incidentId,
        evidence.source,
        evidence.observationId,
        evidence.relevance,
        JSON.stringify(evidence.spatialMatch),
        JSON.stringify(evidence.temporalMatch),
        evidence.qualityScore,
        evidence.contribution,
        evidence.createdAt,
      ]
    );
    return evidence;
  }

  async findRecommendationsByIncidentId(incidentId: string): Promise<Recommendation[]> {
    const res = await pool.query(
      `
      SELECT id, incident_id as "incidentId", action_type as "actionType", priority,
             rationale, source_rule as "sourceRule", requires_approval as "requiresApproval",
             status, created_at as "createdAt", updated_at as "updatedAt"
      FROM recommendations
      WHERE incident_id = $1
      ORDER BY priority DESC
    `,
      [incidentId]
    );
    return res.rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString ? r.createdAt.toISOString() : r.createdAt,
      updatedAt: r.updatedAt.toISOString ? r.updatedAt.toISOString() : r.updatedAt,
    }));
  }

  async addRecommendation(recommendation: Recommendation): Promise<Recommendation> {
    await pool.query(
      `
      INSERT INTO recommendations (id, incident_id, action_type, priority, rationale, source_rule, requires_approval, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
      [
        recommendation.id,
        recommendation.incidentId,
        recommendation.actionType,
        recommendation.priority,
        recommendation.rationale,
        recommendation.sourceRule || null,
        recommendation.requiresApproval,
        recommendation.status,
        recommendation.createdAt,
        recommendation.updatedAt,
      ]
    );
    return recommendation;
  }

  async findVerificationByIncidentId(incidentId: string): Promise<Verification | null> {
    const res = await pool.query(
      `
      SELECT id, incident_id as "incidentId", observer, timestamp, location,
             result, photos, sample_collected as "sampleCollected", notes, created_at as "createdAt"
      FROM verifications
      WHERE incident_id = $1
      LIMIT 1
    `,
      [incidentId]
    );
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      ...r,
      timestamp: r.timestamp.toISOString ? r.timestamp.toISOString() : r.timestamp,
      createdAt: r.createdAt.toISOString ? r.createdAt.toISOString() : r.createdAt,
    };
  }

  async addVerification(verification: Verification): Promise<Verification> {
    await pool.query(
      `
      INSERT INTO verifications (id, incident_id, observer, timestamp, location, result, photos, sample_collected, notes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
      [
        verification.id,
        verification.incidentId,
        verification.observer,
        verification.timestamp,
        JSON.stringify(verification.location),
        verification.result,
        JSON.stringify(verification.photos),
        verification.sampleCollected,
        verification.notes,
        verification.createdAt,
      ]
    );
    return verification;
  }

  async count(): Promise<number> {
    const res = await pool.query('SELECT COUNT(*) FROM incidents');
    return parseInt(res.rows[0].count, 10);
  }
}

export class PostgresTaskRepository implements ITaskRepository {
  private mapRow(r: any): Task {
    return {
      id: r.id,
      incidentId: r.incidentId,
      recommendationId: r.recommendationId || undefined,
      assessmentId: r.assessmentId || undefined,
      taskType: r.taskType || undefined,
      title: r.title || r.instructions,
      assignedRole: r.assignedRole || undefined,
      assignedTo: r.assignedTo,
      location: typeof r.location === 'string' ? JSON.parse(r.location) : r.location,
      priority: r.priority,
      instructions: r.instructions,
      requiredEvidence: typeof r.requiredEvidence === 'string' ? JSON.parse(r.requiredEvidence) : (r.requiredEvidence || []),
      status: r.status,
      fhirTaskId: r.fhirTaskId || undefined,
      fhirTaskIdentifier: r.fhirTaskIdentifier || undefined,
      provenance: typeof r.provenance === 'string' ? JSON.parse(r.provenance) : r.provenance,
      createdAt: r.createdAt?.toISOString ? r.createdAt.toISOString() : r.createdAt,
      acceptedAt: r.acceptedAt ? (r.acceptedAt.toISOString ? r.acceptedAt.toISOString() : r.acceptedAt) : undefined,
      inProgressAt: r.inProgressAt ? (r.inProgressAt.toISOString ? r.inProgressAt.toISOString() : r.inProgressAt) : undefined,
      completedAt: r.completedAt ? (r.completedAt.toISOString ? r.completedAt.toISOString() : r.completedAt) : undefined,
      verifiedAt: r.verifiedAt ? (r.verifiedAt.toISOString ? r.verifiedAt.toISOString() : r.verifiedAt) : undefined,
      notes: r.notes || undefined,
    };
  }

  async findAll(filter?: TaskFilter): Promise<Task[]> {
    let query = `
      SELECT id, incident_id as "incidentId", recommendation_id as "recommendationId",
             assessment_id as "assessmentId", task_type as "taskType", title,
             assigned_role as "assignedRole", assigned_to as "assignedTo", location,
             priority, instructions, required_evidence as "requiredEvidence", status,
             fhir_task_id as "fhirTaskId", fhir_task_identifier as "fhirTaskIdentifier",
             provenance, created_at as "createdAt", accepted_at as "acceptedAt",
             in_progress_at as "inProgressAt", completed_at as "completedAt",
             verified_at as "verifiedAt", notes
      FROM tasks
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filter?.incidentId) {
      query += ` AND incident_id = $${idx++}`;
      params.push(filter.incidentId);
    }
    if (filter?.recommendationId) {
      query += ` AND recommendation_id = $${idx++}`;
      params.push(filter.recommendationId);
    }
    if (filter?.status) {
      query += ` AND status = $${idx++}`;
      params.push(filter.status);
    }
    if (filter?.assignedTo) {
      query += ` AND assigned_to = $${idx++}`;
      params.push(filter.assignedTo);
    }

    query += ` ORDER BY created_at DESC`;

    if (filter?.limit) {
      query += ` LIMIT $${idx++}`;
      params.push(filter.limit);
    }

    const res = await pool.query(query, params);
    return res.rows.map((r) => this.mapRow(r));
  }

  async findById(id: string): Promise<Task | null> {
    const res = await pool.query(
      `
      SELECT id, incident_id as "incidentId", recommendation_id as "recommendationId",
             assessment_id as "assessmentId", task_type as "taskType", title,
             assigned_role as "assignedRole", assigned_to as "assignedTo", location,
             priority, instructions, required_evidence as "requiredEvidence", status,
             fhir_task_id as "fhirTaskId", fhir_task_identifier as "fhirTaskIdentifier",
             provenance, created_at as "createdAt", accepted_at as "acceptedAt",
             in_progress_at as "inProgressAt", completed_at as "completedAt",
             verified_at as "verifiedAt", notes
      FROM tasks
      WHERE id = $1
    `,
      [id]
    );
    if (!res.rows[0]) return null;
    return this.mapRow(res.rows[0]);
  }

  async findByIncidentId(incidentId: string): Promise<Task[]> {
    return this.findAll({ incidentId });
  }

  async findByRecommendationId(recommendationId: string): Promise<Task[]> {
    return this.findAll({ recommendationId });
  }

  async create(task: Task): Promise<Task> {
    await pool.query(
      `
      INSERT INTO tasks (
        id, incident_id, recommendation_id, assessment_id, task_type, title,
        assigned_role, assigned_to, location, priority, instructions,
        required_evidence, status, fhir_task_id, fhir_task_identifier,
        provenance, created_at, accepted_at, in_progress_at, completed_at,
        verified_at, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    `,
      [
        task.id,
        task.incidentId,
        task.recommendationId || null,
        task.assessmentId || null,
        task.taskType || null,
        task.title || null,
        task.assignedRole || null,
        task.assignedTo,
        JSON.stringify(task.location),
        task.priority,
        task.instructions,
        JSON.stringify(task.requiredEvidence || []),
        task.status,
        task.fhirTaskId || null,
        task.fhirTaskIdentifier || null,
        JSON.stringify(task.provenance || {}),
        task.createdAt,
        task.acceptedAt || null,
        task.inProgressAt || null,
        task.completedAt || null,
        task.verifiedAt || null,
        task.notes || null,
      ]
    );
    return task;
  }

  async update(id: string, updates: Partial<Task>): Promise<Task | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };

    await pool.query(
      `
      UPDATE tasks
      SET assigned_to = $2, priority = $3, instructions = $4, status = $5,
          assigned_role = $6, task_type = $7, title = $8, required_evidence = $9,
          fhir_task_id = $10, fhir_task_identifier = $11, accepted_at = $12,
          in_progress_at = $13, completed_at = $14, verified_at = $15, notes = $16
      WHERE id = $1
    `,
      [
        id,
        updated.assignedTo,
        updated.priority,
        updated.instructions,
        updated.status,
        updated.assignedRole || null,
        updated.taskType || null,
        updated.title || null,
        JSON.stringify(updated.requiredEvidence || []),
        updated.fhirTaskId || null,
        updated.fhirTaskIdentifier || null,
        updated.acceptedAt || null,
        updated.inProgressAt || null,
        updated.completedAt || null,
        updated.verifiedAt || null,
        updated.notes || null,
      ]
    );
    return updated;
  }

  async count(): Promise<number> {
    const res = await pool.query('SELECT COUNT(*) FROM tasks');
    return parseInt(res.rows[0].count, 10);
  }
}

export class PostgresEvidenceAssessmentRepository implements IEvidenceAssessmentRepository {
  private mapRow(row: any): EvidenceAssessment {
    return {
      id: row.id,
      streamReachId: row.stream_reach_id,
      candidateId: row.candidate_id || null,
      incidentId: row.incident_id || null,
      score: parseFloat(row.score),
      confidenceBand: row.confidence_band,
      scoringVersion: row.scoring_version || 'v1.0',
      baselineStatus: row.baseline_status || 'UNAVAILABLE',
      baselineDeviation: row.baseline_deviation || undefined,
      scoreBreakdown: row.score_breakdown || {
        anomalyContribution: 0,
        baselineContribution: 0,
        corroborationContribution: 0,
        spatialContribution: 0,
        temporalContribution: 0,
        contextContribution: 0,
        qualityPenalty: 0,
        contradictionPenalty: 0,
      },
      independentSourceGroups: row.independent_source_groups || [],
      supportingEvidenceIds: row.supporting_evidence_ids || [],
      contradictingEvidenceIds: row.contradicting_evidence_ids || [],
      supportingEvidence: row.supporting_evidence || [],
      contradictingEvidence: row.contradicting_evidence || [],
      missingEvidence: row.missing_evidence || [],
      rationale: row.rationale_details || (typeof row.rationale === 'object' ? row.rationale : {
        summary: row.rationale || '',
        whatChanged: '',
        whatCorroborates: '',
        whatWeakens: '',
        whatIsMissing: '',
      }),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  async findAll(filter?: EvidenceAssessmentFilter): Promise<EvidenceAssessment[]> {
    let query = 'SELECT * FROM evidence_assessments WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (filter?.streamReachId) {
      query += ` AND stream_reach_id = $${idx++}`;
      params.push(filter.streamReachId);
    }
    if (filter?.confidenceBand) {
      query += ` AND confidence_band = $${idx++}`;
      params.push(filter.confidenceBand);
    }
    if (filter?.minScore !== undefined) {
      query += ` AND score >= $${idx++}`;
      params.push(filter.minScore);
    }
    if (filter?.maxScore !== undefined) {
      query += ` AND score <= $${idx++}`;
      params.push(filter.maxScore);
    }
    if (filter?.startDate) {
      query += ` AND created_at >= $${idx++}`;
      params.push(filter.startDate);
    }
    if (filter?.endDate) {
      query += ` AND created_at <= $${idx++}`;
      params.push(filter.endDate);
    }

    query += ' ORDER BY created_at DESC';

    if (filter?.limit) {
      query += ` LIMIT $${idx++}`;
      params.push(filter.limit);
    }

    const res = await pool.query(query, params);
    return res.rows.map(this.mapRow);
  }

  async findById(id: string): Promise<EvidenceAssessment | null> {
    const res = await pool.query('SELECT * FROM evidence_assessments WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async findLatestByStreamReach(streamReachId: string): Promise<EvidenceAssessment | null> {
    const res = await pool.query(
      'SELECT * FROM evidence_assessments WHERE stream_reach_id = $1 ORDER BY created_at DESC LIMIT 1',
      [streamReachId]
    );
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async save(assessment: EvidenceAssessment): Promise<EvidenceAssessment> {
    const rationaleText = typeof assessment.rationale === 'string'
      ? assessment.rationale
      : assessment.rationale.summary;

    await pool.query(
      `
      INSERT INTO evidence_assessments (
        id, stream_reach_id, candidate_id, incident_id, score, confidence_band,
        scoring_version, baseline_status, baseline_deviation, score_breakdown,
        independent_source_groups, supporting_evidence_ids, contradicting_evidence_ids,
        supporting_evidence, contradicting_evidence, missing_evidence, rationale,
        rationale_details, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20
      )
      ON CONFLICT (id) DO UPDATE SET
        score = EXCLUDED.score,
        confidence_band = EXCLUDED.confidence_band,
        baseline_status = EXCLUDED.baseline_status,
        baseline_deviation = EXCLUDED.baseline_deviation,
        score_breakdown = EXCLUDED.score_breakdown,
        independent_source_groups = EXCLUDED.independent_source_groups,
        supporting_evidence_ids = EXCLUDED.supporting_evidence_ids,
        contradicting_evidence_ids = EXCLUDED.contradicting_evidence_ids,
        supporting_evidence = EXCLUDED.supporting_evidence,
        contradicting_evidence = EXCLUDED.contradicting_evidence,
        missing_evidence = EXCLUDED.missing_evidence,
        rationale = EXCLUDED.rationale,
        rationale_details = EXCLUDED.rationale_details,
        updated_at = EXCLUDED.updated_at
      `,
      [
        assessment.id,
        assessment.streamReachId,
        assessment.candidateId || null,
        assessment.incidentId || null,
        assessment.score,
        assessment.confidenceBand,
        assessment.scoringVersion || 'v1.0',
        assessment.baselineStatus || 'UNAVAILABLE',
        JSON.stringify(assessment.baselineDeviation || null),
        JSON.stringify(assessment.scoreBreakdown),
        JSON.stringify(assessment.independentSourceGroups),
        JSON.stringify(assessment.supportingEvidenceIds),
        JSON.stringify(assessment.contradictingEvidenceIds),
        JSON.stringify(assessment.supportingEvidence),
        JSON.stringify(assessment.contradictingEvidence),
        JSON.stringify(assessment.missingEvidence),
        rationaleText,
        JSON.stringify(assessment.rationale),
        assessment.createdAt,
        assessment.updatedAt,
      ]
    );

    return assessment;
  }

  async count(): Promise<number> {
    const res = await pool.query('SELECT COUNT(*) FROM evidence_assessments');
    return parseInt(res.rows[0].count, 10);
  }
}

export class PostgresRecommendationRepository implements IRecommendationRepository {
  private mapRow(r: any): Recommendation {
    return {
      id: r.id,
      incidentId: r.incident_id,
      assessmentId: r.assessment_id || undefined,
      measureId: r.measure_id || r.id,
      actionType: r.action_type,
      title: r.title || r.action_type,
      description: r.description || r.rationale,
      rank: r.rank ? parseInt(r.rank, 10) : 1,
      suitabilityScore: r.suitability_score ? parseInt(r.suitability_score, 10) : 50,
      scoreBreakdown: typeof r.score_breakdown === 'string' ? JSON.parse(r.score_breakdown) : (r.score_breakdown || {}),
      rationaleDetails: typeof r.rationale_details === 'string' ? JSON.parse(r.rationale_details) : (r.rationale_details || { whyThis: r.rationale, whyNow: '', whatSupportsIt: [], whatWeakensIt: [], whatIsMissing: [] }),
      rationale: r.rationale,
      sourceRule: r.source_rule || undefined,
      supportingEvidenceIds: typeof r.supporting_evidence_ids === 'string' ? JSON.parse(r.supporting_evidence_ids) : (r.supporting_evidence_ids || []),
      contradictingEvidenceIds: typeof r.contradicting_evidence_ids === 'string' ? JSON.parse(r.contradicting_evidence_ids) : (r.contradicting_evidence_ids || []),
      missingPrerequisites: typeof r.missing_prerequisites === 'string' ? JSON.parse(r.missing_prerequisites) : (r.missing_prerequisites || []),
      contraindications: typeof r.contraindications === 'string' ? JSON.parse(r.contraindications) : (r.contraindications || []),
      requiredVerification: typeof r.required_verification === 'string' ? JSON.parse(r.required_verification) : (r.required_verification || []),
      responsibleRole: r.responsible_role || 'ENVIRONMENTAL_INSPECTOR',
      requiresApproval: r.requires_approval,
      humanApprovalRequired: r.human_approval_required ?? r.requires_approval ?? true,
      status: r.status,
      priority: r.priority,
      rejectionReason: r.rejection_reason || undefined,
      reviewNotes: r.review_notes || undefined,
      reviewedAt: r.reviewed_at ? (r.reviewed_at.toISOString ? r.reviewed_at.toISOString() : r.reviewed_at) : undefined,
      reviewedBy: r.reviewed_by || undefined,
      idempotencyKey: r.idempotency_key || r.id,
      generatedTaskId: r.generated_task_id || undefined,
      provenance: typeof r.provenance === 'string' ? JSON.parse(r.provenance) : (r.provenance || {}),
      createdAt: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updatedAt: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at,
    };
  }

  async findAll(filter?: RecommendationFilter): Promise<Recommendation[]> {
    let query = `
      SELECT id, incident_id, assessment_id, measure_id, action_type, title, description,
             rank, suitability_score, score_breakdown, rationale_details, rationale,
             source_rule, supporting_evidence_ids, contradicting_evidence_ids,
             missing_prerequisites, contraindications, required_verification,
             responsible_role, requires_approval, human_approval_required, status,
             priority, rejection_reason, review_notes, reviewed_at, reviewed_by,
             idempotency_key, generated_task_id, provenance, created_at, updated_at
      FROM recommendations
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filter?.incidentId) {
      query += ` AND incident_id = $${idx++}`;
      params.push(filter.incidentId);
    }
    if (filter?.assessmentId) {
      query += ` AND assessment_id = $${idx++}`;
      params.push(filter.assessmentId);
    }
    if (filter?.status) {
      query += ` AND status = $${idx++}`;
      params.push(filter.status);
    }
    if (filter?.measureId) {
      query += ` AND measure_id = $${idx++}`;
      params.push(filter.measureId);
    }

    query += ` ORDER BY rank ASC, suitability_score DESC`;

    if (filter?.limit) {
      query += ` LIMIT $${idx++}`;
      params.push(filter.limit);
    }

    const res = await pool.query(query, params);
    return res.rows.map((r) => this.mapRow(r));
  }

  async findById(id: string): Promise<Recommendation | null> {
    const res = await pool.query(
      `
      SELECT *
      FROM recommendations
      WHERE id = $1
    `,
      [id]
    );
    if (!res.rows[0]) return null;
    return this.mapRow(res.rows[0]);
  }

  async findByIncidentId(incidentId: string): Promise<Recommendation[]> {
    return this.findAll({ incidentId });
  }

  async findByAssessmentId(assessmentId: string): Promise<Recommendation[]> {
    return this.findAll({ assessmentId });
  }

  async findByIdempotencyKey(key: string): Promise<Recommendation | null> {
    const res = await pool.query(
      `
      SELECT *
      FROM recommendations
      WHERE idempotency_key = $1
      LIMIT 1
    `,
      [key]
    );
    if (!res.rows[0]) return null;
    return this.mapRow(res.rows[0]);
  }

  async create(rec: Recommendation): Promise<Recommendation> {
    await pool.query(
      `
      INSERT INTO recommendations (
        id, incident_id, assessment_id, measure_id, action_type, title, description,
        rank, suitability_score, score_breakdown, rationale_details, rationale,
        source_rule, supporting_evidence_ids, contradicting_evidence_ids,
        missing_prerequisites, contraindications, required_verification,
        responsible_role, requires_approval, human_approval_required, status,
        priority, rejection_reason, review_notes, reviewed_at, reviewed_by,
        idempotency_key, generated_task_id, provenance, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        rank = EXCLUDED.rank,
        suitability_score = EXCLUDED.suitability_score,
        rejection_reason = EXCLUDED.rejection_reason,
        review_notes = EXCLUDED.review_notes,
        reviewed_at = EXCLUDED.reviewed_at,
        reviewed_by = EXCLUDED.reviewed_by,
        generated_task_id = EXCLUDED.generated_task_id,
        updated_at = EXCLUDED.updated_at
    `,
      [
        rec.id,
        rec.incidentId,
        rec.assessmentId || null,
        rec.measureId,
        rec.actionType,
        rec.title,
        rec.description,
        rec.rank,
        rec.suitabilityScore,
        JSON.stringify(rec.scoreBreakdown),
        JSON.stringify(rec.rationaleDetails),
        rec.rationale,
        rec.sourceRule || null,
        JSON.stringify(rec.supportingEvidenceIds || []),
        JSON.stringify(rec.contradictingEvidenceIds || []),
        JSON.stringify(rec.missingPrerequisites || []),
        JSON.stringify(rec.contraindications || []),
        JSON.stringify(rec.requiredVerification || []),
        rec.responsibleRole,
        rec.requiresApproval,
        rec.humanApprovalRequired,
        rec.status,
        rec.priority,
        rec.rejectionReason || null,
        rec.reviewNotes || null,
        rec.reviewedAt || null,
        rec.reviewedBy || null,
        rec.idempotencyKey,
        rec.generatedTaskId || null,
        JSON.stringify(rec.provenance || {}),
        rec.createdAt,
        rec.updatedAt,
      ]
    );
    return rec;
  }

  async update(id: string, updates: Partial<Recommendation>): Promise<Recommendation | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };

    await pool.query(
      `
      UPDATE recommendations
      SET status = $2, rejection_reason = $3, review_notes = $4,
          reviewed_at = $5, reviewed_by = $6, generated_task_id = $7,
          rank = $8, suitability_score = $9, updated_at = $10
      WHERE id = $1
    `,
      [
        id,
        updated.status,
        updated.rejectionReason || null,
        updated.reviewNotes || null,
        updated.reviewedAt || null,
        updated.reviewedBy || null,
        updated.generatedTaskId || null,
        updated.rank,
        updated.suitabilityScore,
        updated.updatedAt,
      ]
    );
    return updated;
  }

  async count(): Promise<number> {
    const res = await pool.query('SELECT COUNT(*) FROM recommendations');
    return parseInt(res.rows[0].count, 10);
  }
}

export class PostgresCatalogueRepository implements ICatalogueRepository {
  private mapRow(r: any): CatalogueMeasure {
    return {
      measureId: r.measure_id,
      title: r.title,
      description: r.description,
      measureType: r.measure_type,
      applicableIncidentTypes: typeof r.applicable_incident_types === 'string' ? JSON.parse(r.applicable_incident_types) : r.applicable_incident_types,
      applicableStressors: typeof r.applicable_stressors === 'string' ? JSON.parse(r.applicable_stressors) : r.applicable_stressors,
      applicableIndicators: typeof r.applicable_indicators === 'string' ? JSON.parse(r.applicable_indicators) : r.applicable_indicators,
      minimumEvidenceBand: r.minimum_evidence_band,
      requiredVerification: typeof r.required_verification === 'string' ? JSON.parse(r.required_verification) : r.required_verification,
      spatialRequirements: r.spatial_requirements ? (typeof r.spatial_requirements === 'string' ? JSON.parse(r.spatial_requirements) : r.spatial_requirements) : undefined,
      temporalRequirements: typeof r.temporal_requirements === 'string' ? JSON.parse(r.temporal_requirements) : r.temporal_requirements,
      implementationComplexity: r.implementation_complexity,
      estimatedTimeToInitiate: r.estimated_time_to_initiate,
      responsibleStakeholder: r.responsible_stakeholder,
      responsibleRole: r.responsible_role,
      contraindications: typeof r.contraindications === 'string' ? JSON.parse(r.contraindications) : r.contraindications,
      prerequisites: typeof r.prerequisites === 'string' ? JSON.parse(r.prerequisites) : r.prerequisites,
      sourceReference: r.source_reference,
      provenance: typeof r.provenance === 'string' ? JSON.parse(r.provenance) : r.provenance,
      humanApprovalRequired: r.human_approval_required,
    };
  }

  async findAll(): Promise<CatalogueMeasure[]> {
    const res = await pool.query('SELECT * FROM action_catalogue ORDER BY measure_id ASC');
    if (res.rows.length === 0) {
      // Auto-seed if empty
      await this.seed(SEED_CATALOGUE_MEASURES);
      return SEED_CATALOGUE_MEASURES;
    }
    return res.rows.map((r) => this.mapRow(r));
  }

  async findById(measureId: string): Promise<CatalogueMeasure | null> {
    const res = await pool.query('SELECT * FROM action_catalogue WHERE measure_id = $1', [measureId]);
    if (!res.rows[0]) return null;
    return this.mapRow(res.rows[0]);
  }

  async findByIncidentType(type: string): Promise<CatalogueMeasure[]> {
    const all = await this.findAll();
    return all.filter((m) => m.applicableIncidentTypes.includes(type as any));
  }

  async create(measure: CatalogueMeasure): Promise<CatalogueMeasure> {
    await pool.query(
      `
      INSERT INTO action_catalogue (
        measure_id, title, description, measure_type, applicable_incident_types,
        applicable_stressors, applicable_indicators, minimum_evidence_band,
        required_verification, spatial_requirements, temporal_requirements,
        implementation_complexity, estimated_time_to_initiate, responsible_stakeholder,
        responsible_role, contraindications, prerequisites, source_reference,
        provenance, human_approval_required
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      ON CONFLICT (measure_id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        measure_type = EXCLUDED.measure_type,
        applicable_incident_types = EXCLUDED.applicable_incident_types,
        applicable_stressors = EXCLUDED.applicable_stressors,
        applicable_indicators = EXCLUDED.applicable_indicators,
        minimum_evidence_band = EXCLUDED.minimum_evidence_band,
        required_verification = EXCLUDED.required_verification,
        spatial_requirements = EXCLUDED.spatial_requirements,
        temporal_requirements = EXCLUDED.temporal_requirements,
        implementation_complexity = EXCLUDED.implementation_complexity,
        estimated_time_to_initiate = EXCLUDED.estimated_time_to_initiate,
        responsible_stakeholder = EXCLUDED.responsible_stakeholder,
        responsible_role = EXCLUDED.responsible_role,
        contraindications = EXCLUDED.contraindications,
        prerequisites = EXCLUDED.prerequisites,
        source_reference = EXCLUDED.source_reference,
        provenance = EXCLUDED.provenance,
        human_approval_required = EXCLUDED.human_approval_required,
        updated_at = CURRENT_TIMESTAMP
    `,
      [
        measure.measureId,
        measure.title,
        measure.description,
        measure.measureType,
        JSON.stringify(measure.applicableIncidentTypes),
        JSON.stringify(measure.applicableStressors),
        JSON.stringify(measure.applicableIndicators),
        measure.minimumEvidenceBand,
        JSON.stringify(measure.requiredVerification),
        measure.spatialRequirements ? JSON.stringify(measure.spatialRequirements) : null,
        JSON.stringify(measure.temporalRequirements),
        measure.implementationComplexity,
        measure.estimatedTimeToInitiate,
        measure.responsibleStakeholder,
        measure.responsibleRole,
        JSON.stringify(measure.contraindications),
        JSON.stringify(measure.prerequisites),
        measure.sourceReference,
        JSON.stringify(measure.provenance),
        measure.humanApprovalRequired,
      ]
    );
    return measure;
  }

  async seed(measures: CatalogueMeasure[]): Promise<void> {
    for (const m of measures) {
      await this.create(m);
    }
  }

  async count(): Promise<number> {
    const res = await pool.query('SELECT COUNT(*) FROM action_catalogue');
    return parseInt(res.rows[0].count, 10);
  }
}

export class PostgresAuditLogRepository implements IAuditLogRepository {
  async log(event: TaskAuditEvent): Promise<TaskAuditEvent> {
    await pool.query(
      `
      INSERT INTO task_events (
        id, task_id, recommendation_id, incident_id, event_type,
        actor, previous_status, new_status, reason, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
      [
        event.id,
        event.taskId || null,
        event.recommendationId || null,
        event.incidentId || null,
        event.eventType,
        event.actor,
        event.previousStatus || null,
        event.newStatus || null,
        event.reason || null,
        JSON.stringify(event.metadata || {}),
        event.timestamp,
      ]
    );
    return event;
  }

  async findByTaskId(taskId: string): Promise<TaskAuditEvent[]> {
    const res = await pool.query(
      `
      SELECT id, task_id as "taskId", recommendation_id as "recommendationId",
             incident_id as "incidentId", event_type as "eventType", actor,
             previous_status as "previousStatus", new_status as "newStatus",
             reason, metadata, created_at as "timestamp"
      FROM task_events
      WHERE task_id = $1
      ORDER BY created_at DESC
    `,
      [taskId]
    );
    return res.rows.map((r) => ({
      ...r,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {}),
      timestamp: r.timestamp?.toISOString ? r.timestamp.toISOString() : r.timestamp,
    }));
  }

  async findByRecommendationId(recommendationId: string): Promise<TaskAuditEvent[]> {
    const res = await pool.query(
      `
      SELECT id, task_id as "taskId", recommendation_id as "recommendationId",
             incident_id as "incidentId", event_type as "eventType", actor,
             previous_status as "previousStatus", new_status as "newStatus",
             reason, metadata, created_at as "timestamp"
      FROM task_events
      WHERE recommendation_id = $1
      ORDER BY created_at DESC
    `,
      [recommendationId]
    );
    return res.rows.map((r) => ({
      ...r,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {}),
      timestamp: r.timestamp?.toISOString ? r.timestamp.toISOString() : r.timestamp,
    }));
  }

  async findByIncidentId(incidentId: string): Promise<TaskAuditEvent[]> {
    const res = await pool.query(
      `
      SELECT id, task_id as "taskId", recommendation_id as "recommendationId",
             incident_id as "incidentId", event_type as "eventType", actor,
             previous_status as "previousStatus", new_status as "newStatus",
             reason, metadata, created_at as "timestamp"
      FROM task_events
      WHERE incident_id = $1
      ORDER BY created_at DESC
    `,
      [incidentId]
    );
    return res.rows.map((r) => ({
      ...r,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {}),
      timestamp: r.timestamp?.toISOString ? r.timestamp.toISOString() : r.timestamp,
    }));
  }

  async findAll(limit = 100): Promise<TaskAuditEvent[]> {
    const res = await pool.query(
      `
      SELECT id, task_id as "taskId", recommendation_id as "recommendationId",
             incident_id as "incidentId", event_type as "eventType", actor,
             previous_status as "previousStatus", new_status as "newStatus",
             reason, metadata, created_at as "timestamp"
      FROM task_events
      ORDER BY created_at DESC
      LIMIT $1
    `,
      [limit]
    );
    return res.rows.map((r) => ({
      ...r,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {}),
      timestamp: r.timestamp?.toISOString ? r.timestamp.toISOString() : r.timestamp,
    }));
  }
}

export class PostgresForecastRepository implements IForecastRepository {
  private mapRow(r: any): ForecastResult {
    return {
      id: r.id,
      reachId: r.stream_reach_id,
      reachName: r.reach_name,
      indicator: r.indicator,
      originTimestamp: r.origin_timestamp?.toISOString ? r.origin_timestamp.toISOString() : r.origin_timestamp,
      horizonHours: r.horizon_hours,
      currentValue: parseFloat(r.current_value),
      historicalBaseline: r.historical_baseline ? parseFloat(r.historical_baseline) : undefined,
      baselineDeviationPercent: r.baseline_deviation_percent ? parseFloat(r.baseline_deviation_percent) : undefined,
      trend: r.trend,
      trendSlopePerDay: parseFloat(r.trend_slope_per_day),
      uncertainty: r.uncertainty,
      confidence: r.confidence,
      modelId: r.model_id,
      modelVersion: r.model_version,
      modelName: r.model_name,
      trainingWindow: typeof r.training_window === 'string' ? JSON.parse(r.training_window) : r.training_window,
      inputObservationIds: typeof r.input_observation_ids === 'string' ? JSON.parse(r.input_observation_ids) : r.input_observation_ids,
      projections: typeof r.projections === 'string' ? JSON.parse(r.projections) : r.projections,
      explanation: r.explanation,
      labels: typeof r.labels === 'string' ? JSON.parse(r.labels) : r.labels,
      isSufficientData: r.is_sufficient_data,
      dataQualityReasons: r.data_quality_reasons ? (typeof r.data_quality_reasons === 'string' ? JSON.parse(r.data_quality_reasons) : r.data_quality_reasons) : undefined,
      generatedTimestamp: r.generated_timestamp?.toISOString ? r.generated_timestamp.toISOString() : r.generated_timestamp,
    };
  }

  async save(forecast: ForecastResult): Promise<ForecastResult> {
    await pool.query(
      `
      INSERT INTO forecasts (
        id, stream_reach_id, reach_name, indicator, origin_timestamp, horizon_hours,
        current_value, historical_baseline, baseline_deviation_percent, trend,
        trend_slope_per_day, uncertainty, confidence, model_id, model_version,
        model_name, training_window, input_observation_ids, projections,
        explanation, labels, is_sufficient_data, data_quality_reasons, generated_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      ON CONFLICT (id) DO UPDATE SET
        projections = EXCLUDED.projections,
        explanation = EXCLUDED.explanation,
        generated_timestamp = EXCLUDED.generated_timestamp
    `,
      [
        forecast.id,
        forecast.reachId,
        forecast.reachName,
        forecast.indicator,
        forecast.originTimestamp,
        forecast.horizonHours,
        forecast.currentValue,
        forecast.historicalBaseline ?? null,
        forecast.baselineDeviationPercent ?? null,
        forecast.trend,
        forecast.trendSlopePerDay,
        forecast.uncertainty,
        forecast.confidence,
        forecast.modelId,
        forecast.modelVersion,
        forecast.modelName,
        JSON.stringify(forecast.trainingWindow),
        JSON.stringify(forecast.inputObservationIds),
        JSON.stringify(forecast.projections),
        forecast.explanation,
        JSON.stringify(forecast.labels),
        forecast.isSufficientData,
        forecast.dataQualityReasons ? JSON.stringify(forecast.dataQualityReasons) : null,
        forecast.generatedTimestamp,
      ]
    );
    return forecast;
  }

  async findById(id: string): Promise<ForecastResult | null> {
    const res = await pool.query('SELECT * FROM forecasts WHERE id = $1', [id]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async findLatestByReach(reachId: string, indicator?: string): Promise<ForecastResult | null> {
    const query = indicator
      ? 'SELECT * FROM forecasts WHERE stream_reach_id = $1 AND indicator = $2 ORDER BY generated_timestamp DESC LIMIT 1'
      : 'SELECT * FROM forecasts WHERE stream_reach_id = $1 ORDER BY generated_timestamp DESC LIMIT 1';
    const params = indicator ? [reachId, indicator] : [reachId];
    const res = await pool.query(query, params);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async findByReach(reachId: string, limit = 20): Promise<ForecastResult[]> {
    const res = await pool.query(
      'SELECT * FROM forecasts WHERE stream_reach_id = $1 ORDER BY generated_timestamp DESC LIMIT $2',
      [reachId, limit]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async findAll(limit = 100): Promise<ForecastResult[]> {
    const res = await pool.query(
      'SELECT * FROM forecasts ORDER BY generated_timestamp DESC LIMIT $1',
      [limit]
    );
    return res.rows.map((r) => this.mapRow(r));
  }
}

export class PostgresScenarioRepository implements IScenarioRepository {
  private mapRow(r: any): ScenarioSimulation {
    return {
      scenarioId: r.id,
      name: r.name,
      type: r.type,
      description: r.description,
      streamReachId: r.stream_reach_id,
      reachName: r.reach_name,
      indicator: r.indicator,
      originTimestamp: r.origin_timestamp?.toISOString ? r.origin_timestamp.toISOString() : r.origin_timestamp,
      horizonHours: r.horizon_hours,
      baselineForecastId: r.baseline_forecast_id,
      changedParameters: typeof r.changed_parameters === 'string' ? JSON.parse(r.changed_parameters) : r.changed_parameters,
      assumptions: typeof r.assumptions === 'string' ? JSON.parse(r.assumptions) : r.assumptions,
      projections: typeof r.projections === 'string' ? JSON.parse(r.projections) : r.projections,
      uncertainty: r.uncertainty,
      confidence: r.confidence,
      modelVersion: r.model_version,
      generatedTimestamp: r.generated_timestamp?.toISOString ? r.generated_timestamp.toISOString() : r.generated_timestamp,
      isHypothetical: r.is_hypothetical,
      labels: typeof r.labels === 'string' ? JSON.parse(r.labels) : r.labels,
    };
  }

  async save(scenario: ScenarioSimulation): Promise<ScenarioSimulation> {
    await pool.query(
      `
      INSERT INTO scenarios (
        id, name, type, description, stream_reach_id, reach_name, indicator,
        origin_timestamp, horizon_hours, baseline_forecast_id, changed_parameters,
        assumptions, projections, uncertainty, confidence, model_version,
        generated_timestamp, is_hypothetical, labels
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (id) DO UPDATE SET
        projections = EXCLUDED.projections,
        generated_timestamp = EXCLUDED.generated_timestamp
    `,
      [
        scenario.scenarioId,
        scenario.name,
        scenario.type,
        scenario.description,
        scenario.streamReachId,
        scenario.reachName,
        scenario.indicator,
        scenario.originTimestamp,
        scenario.horizonHours,
        scenario.baselineForecastId,
        JSON.stringify(scenario.changedParameters),
        JSON.stringify(scenario.assumptions),
        JSON.stringify(scenario.projections),
        scenario.uncertainty,
        scenario.confidence,
        scenario.modelVersion,
        scenario.generatedTimestamp,
        scenario.isHypothetical,
        JSON.stringify(scenario.labels),
      ]
    );
    return scenario;
  }

  async findById(id: string): Promise<ScenarioSimulation | null> {
    const res = await pool.query('SELECT * FROM scenarios WHERE id = $1', [id]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async findByReach(reachId: string): Promise<ScenarioSimulation[]> {
    const res = await pool.query(
      'SELECT * FROM scenarios WHERE stream_reach_id = $1 ORDER BY generated_timestamp DESC',
      [reachId]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async findAll(limit = 50): Promise<ScenarioSimulation[]> {
    const res = await pool.query(
      'SELECT * FROM scenarios ORDER BY generated_timestamp DESC LIMIT $1',
      [limit]
    );
    return res.rows.map((r) => this.mapRow(r));
  }
}

export class PostgresEarlyWarningRepository implements IEarlyWarningRepository {
  private mapRow(r: any): EarlyWarning {
    return {
      id: r.id,
      streamReachId: r.stream_reach_id,
      reachName: r.reach_name,
      indicator: r.indicator,
      warningLevel: r.warning_level,
      triggerReason: r.trigger_reason,
      contributingFactors: typeof r.contributing_factors === 'string' ? JSON.parse(r.contributing_factors) : r.contributing_factors,
      confidence: r.confidence,
      recommendedAction: r.recommended_action,
      timestamp: r.timestamp?.toISOString ? r.timestamp.toISOString() : r.timestamp,
      incidentId: r.incident_id,
      evidenceAssessmentId: r.evidence_assessment_id,
      labels: typeof r.labels === 'string' ? JSON.parse(r.labels) : r.labels,
    };
  }

  async save(warning: EarlyWarning): Promise<EarlyWarning> {
    await pool.query(
      `
      INSERT INTO early_warnings (
        id, stream_reach_id, reach_name, indicator, warning_level, trigger_reason,
        contributing_factors, confidence, recommended_action, timestamp,
        incident_id, evidence_assessment_id, labels
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        warning_level = EXCLUDED.warning_level,
        trigger_reason = EXCLUDED.trigger_reason,
        confidence = EXCLUDED.confidence
    `,
      [
        warning.id,
        warning.streamReachId,
        warning.reachName,
        warning.indicator,
        warning.warningLevel,
        warning.triggerReason,
        JSON.stringify(warning.contributingFactors),
        warning.confidence,
        warning.recommendedAction,
        warning.timestamp,
        warning.incidentId ?? null,
        warning.evidenceAssessmentId ?? null,
        JSON.stringify(warning.labels),
      ]
    );
    return warning;
  }

  async findById(id: string): Promise<EarlyWarning | null> {
    const res = await pool.query('SELECT * FROM early_warnings WHERE id = $1', [id]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async findActive(): Promise<EarlyWarning[]> {
    const res = await pool.query(
      'SELECT * FROM early_warnings WHERE dismissed = false ORDER BY timestamp DESC'
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async findByReach(reachId: string): Promise<EarlyWarning[]> {
    const res = await pool.query(
      'SELECT * FROM early_warnings WHERE stream_reach_id = $1 AND dismissed = false ORDER BY timestamp DESC',
      [reachId]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async find(filter?: { reachId?: string; acknowledged?: boolean; minSeverity?: string }): Promise<EarlyWarning[]> {
    let query = 'SELECT * FROM early_warnings WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (filter?.reachId) {
      query += ` AND stream_reach_id = $${idx++}`;
      params.push(filter.reachId);
    }
    if (filter?.acknowledged !== undefined) {
      query += ` AND dismissed = $${idx++}`;
      params.push(filter.acknowledged);
    }
    if (filter?.minSeverity) {
      query += ` AND warning_level = $${idx++}`;
      params.push(filter.minSeverity);
    }

    query += ' ORDER BY timestamp DESC';
    const res = await pool.query(query, params);
    return res.rows.map((r) => this.mapRow(r));
  }

  async acknowledge(id: string, user = 'Operator', _notes?: string): Promise<EarlyWarning | null> {
    const res = await pool.query(
      'UPDATE early_warnings SET dismissed = true WHERE id = $1 RETURNING *',
      [id]
    );
    if (!res.rows[0]) return null;
    const mapped = this.mapRow(res.rows[0]);
    (mapped as any).acknowledged = true;
    (mapped as any).acknowledgedBy = user;
    return mapped;
  }

  async dismiss(id: string): Promise<boolean> {
    const res = await pool.query('UPDATE early_warnings SET dismissed = true WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
}

export class PostgresModelEvaluationRepository implements IModelEvaluationRepository {
  private mapRow(r: any): ModelEvaluationMetric {
    return {
      id: r.id,
      modelId: r.model_id,
      modelName: r.model_name,
      modelVersion: r.model_version,
      horizonHours: r.horizon_hours,
      sampleSize: r.sample_size,
      mae: parseFloat(r.mae),
      rmse: parseFloat(r.rmse),
      mape: r.mape ? parseFloat(r.mape) : undefined,
      directionalAccuracy: parseFloat(r.directional_accuracy),
      evaluationPeriod: typeof r.evaluation_period === 'string' ? JSON.parse(r.evaluation_period) : r.evaluation_period,
      baselineModelComparison: r.baseline_model_comparison
        ? (typeof r.baseline_model_comparison === 'string'
            ? JSON.parse(r.baseline_model_comparison)
            : r.baseline_model_comparison)
        : undefined,
      evaluatedAt: r.evaluated_at?.toISOString ? r.evaluated_at.toISOString() : r.evaluated_at,
    };
  }

  async save(metric: ModelEvaluationMetric): Promise<ModelEvaluationMetric> {
    await pool.query(
      `
      INSERT INTO model_evaluations (
        id, model_id, model_name, model_version, horizon_hours, sample_size,
        mae, rmse, mape, directional_accuracy, evaluation_period,
        baseline_model_comparison, evaluated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        mae = EXCLUDED.mae,
        rmse = EXCLUDED.rmse,
        directional_accuracy = EXCLUDED.directional_accuracy,
        evaluated_at = EXCLUDED.evaluated_at
    `,
      [
        metric.id,
        metric.modelId,
        metric.modelName,
        metric.modelVersion,
        metric.horizonHours,
        metric.sampleSize,
        metric.mae,
        metric.rmse,
        metric.mape ?? null,
        metric.directionalAccuracy,
        JSON.stringify(metric.evaluationPeriod),
        metric.baselineModelComparison ? JSON.stringify(metric.baselineModelComparison) : null,
        metric.evaluatedAt,
      ]
    );
    return metric;
  }

  async findAll(): Promise<ModelEvaluationMetric[]> {
    const res = await pool.query(
      'SELECT * FROM model_evaluations ORDER BY evaluated_at DESC'
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async saveMany(metrics: ModelEvaluationMetric[]): Promise<ModelEvaluationMetric[]> {
    for (const m of metrics) {
      await this.save(m);
    }
    return metrics;
  }

  async findLatestByModel(
    modelId: string,
    horizonHours?: number
  ): Promise<ModelEvaluationMetric | null> {
    const query = horizonHours !== undefined
      ? 'SELECT * FROM model_evaluations WHERE model_id = $1 AND horizon_hours = $2 ORDER BY evaluated_at DESC LIMIT 1'
      : 'SELECT * FROM model_evaluations WHERE model_id = $1 ORDER BY evaluated_at DESC LIMIT 1';
    const params = horizonHours !== undefined ? [modelId, horizonHours] : [modelId];
    const res = await pool.query(query, params);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async findByReachAndIndicator(_reachId?: string, _indicator?: string): Promise<ModelEvaluationMetric[]> {
    return this.findAll();
  }
}

export class PostgresOutboxRepository implements IOutboxRepository {
  private mapRow(r: any): OutboxEvent {
    return {
      id: r.id,
      eventId: r.event_id,
      eventType: r.event_type,
      eventVersion: r.event_version,
      occurredAt: r.occurred_at ? new Date(r.occurred_at).toISOString() : new Date().toISOString(),
      producer: r.producer,
      subject: r.subject,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      correlationId: r.correlation_id,
      causationId: r.causation_id,
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
      destination: r.destination,
      status: r.status,
      retryCount: r.retry_count,
      maxRetries: r.max_retries,
      nextRetryAt: r.next_retry_at ? new Date(r.next_retry_at).toISOString() : undefined,
      lastError: r.last_error || undefined,
      deadLetterAt: r.dead_letter_at ? new Date(r.dead_letter_at).toISOString() : undefined,
      deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : undefined,
      acknowledgementId: r.acknowledgement_id || undefined,
      replayCount: r.replay_count || 0,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  async save(event: OutboxEvent): Promise<OutboxEvent> {
    const query = `
      INSERT INTO outbox_events (
        id, event_id, event_type, event_version, occurred_at, producer, subject,
        resource_type, resource_id, correlation_id, causation_id, payload, destination,
        status, retry_count, max_retries, next_retry_at, last_error, dead_letter_at,
        delivered_at, acknowledgement_id, replay_count, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        retry_count = EXCLUDED.retry_count,
        next_retry_at = EXCLUDED.next_retry_at,
        last_error = EXCLUDED.last_error,
        dead_letter_at = EXCLUDED.dead_letter_at,
        delivered_at = EXCLUDED.delivered_at,
        acknowledgement_id = EXCLUDED.acknowledgement_id,
        replay_count = EXCLUDED.replay_count,
        payload = EXCLUDED.payload,
        updated_at = NOW()
      RETURNING *
    `;

    const res = await pool.query(query, [
      event.id,
      event.eventId,
      event.eventType,
      event.eventVersion,
      event.occurredAt,
      event.producer,
      event.subject,
      event.resourceType,
      event.resourceId,
      event.correlationId,
      event.causationId,
      JSON.stringify(event.payload),
      event.destination,
      event.status,
      event.retryCount,
      event.maxRetries,
      event.nextRetryAt || null,
      event.lastError || null,
      event.deadLetterAt || null,
      event.deliveredAt || null,
      event.acknowledgementId || null,
      event.replayCount || 0,
      event.createdAt || new Date().toISOString(),
      new Date().toISOString(),
    ]);

    return this.mapRow(res.rows[0]);
  }

  async findById(id: string): Promise<OutboxEvent | null> {
    const res = await pool.query('SELECT * FROM outbox_events WHERE id = $1', [id]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async findByEventId(eventId: string): Promise<OutboxEvent | null> {
    const res = await pool.query('SELECT * FROM outbox_events WHERE event_id = $1', [eventId]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async findPending(limit = 50): Promise<OutboxEvent[]> {
    const query = `
      SELECT * FROM outbox_events
      WHERE status = 'PENDING'
         OR (status = 'RETRYING' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
      ORDER BY created_at ASC
      LIMIT $1
    `;
    const res = await pool.query(query, [limit]);
    return res.rows.map((r) => this.mapRow(r));
  }

  async findDeadLetter(limit = 50): Promise<OutboxEvent[]> {
    const query = `
      SELECT * FROM outbox_events
      WHERE status = 'DEAD_LETTER'
      ORDER BY updated_at DESC
      LIMIT $1
    `;
    const res = await pool.query(query, [limit]);
    return res.rows.map((r) => this.mapRow(r));
  }

  async find(filter?: InteroperabilityFilter): Promise<OutboxEvent[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filter?.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filter.status);
    }
    if (filter?.eventType) {
      conditions.push(`event_type = $${idx++}`);
      params.push(filter.eventType);
    }
    if (filter?.correlationId) {
      conditions.push(`correlation_id = $${idx++}`);
      params.push(filter.correlationId);
    }
    if (filter?.resourceType) {
      conditions.push(`resource_type = $${idx++}`);
      params.push(filter.resourceType);
    }
    if (filter?.destination) {
      conditions.push(`destination = $${idx++}`);
      params.push(filter.destination);
    }
    if (filter?.since) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(filter.since);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter?.limit || 100;
    const offset = filter?.offset || 0;

    params.push(limit);
    params.push(offset);

    const query = `
      SELECT * FROM outbox_events
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const res = await pool.query(query, params);
    return res.rows.map((r) => this.mapRow(r));
  }

  async updateStatus(
    id: string,
    status: OutboxDeliveryStatus,
    details?: { error?: string; nextRetryAt?: string; acknowledgementId?: string }
  ): Promise<OutboxEvent | null> {
    const sets = ['status = $2', 'updated_at = NOW()'];
    const params: any[] = [id, status];
    let idx = 3;

    if (details?.error !== undefined) {
      sets.push(`last_error = $${idx++}`);
      params.push(details.error);
    }
    if (details?.nextRetryAt !== undefined) {
      sets.push(`next_retry_at = $${idx++}`);
      params.push(details.nextRetryAt);
    }
    if (details?.acknowledgementId !== undefined) {
      sets.push(`acknowledgement_id = $${idx++}`);
      params.push(details.acknowledgementId);
    }
    if (status === 'DELIVERED') {
      sets.push(`delivered_at = NOW()`);
    }
    if (status === 'DEAD_LETTER') {
      sets.push(`dead_letter_at = NOW()`);
    }

    const query = `UPDATE outbox_events SET ${sets.join(', ')} WHERE id = $1 RETURNING *`;
    const res = await pool.query(query, params);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async markDelivered(id: string, acknowledgementId?: string): Promise<OutboxEvent | null> {
    const query = `
      UPDATE outbox_events
      SET status = 'DELIVERED',
          delivered_at = NOW(),
          acknowledgement_id = COALESCE($2, acknowledgement_id),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await pool.query(query, [id, acknowledgementId || null]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async scheduleRetry(id: string, error: string, nextRetryAt: string): Promise<OutboxEvent | null> {
    const query = `
      UPDATE outbox_events
      SET status = 'RETRYING',
          retry_count = retry_count + 1,
          last_error = $2,
          next_retry_at = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await pool.query(query, [id, error, nextRetryAt]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async markDeadLetter(id: string, error: string): Promise<OutboxEvent | null> {
    const query = `
      UPDATE outbox_events
      SET status = 'DEAD_LETTER',
          last_error = $2,
          dead_letter_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await pool.query(query, [id, error]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async replay(id: string, replayedBy = 'Operator'): Promise<OutboxEvent | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const payload = {
      ...existing.payload,
      replayedAt: new Date().toISOString(),
      replayedBy,
      replayCount: (existing.replayCount || 0) + 1,
    };

    const query = `
      UPDATE outbox_events
      SET status = 'PENDING',
          retry_count = 0,
          replay_count = COALESCE(replay_count, 0) + 1,
          next_retry_at = NULL,
          dead_letter_at = NULL,
          payload = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await pool.query(query, [id, JSON.stringify(payload)]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async count(): Promise<{
    pending: number;
    delivering: number;
    delivered: number;
    retrying: number;
    deadLetter: number;
    total: number;
  }> {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
        COUNT(*) FILTER (WHERE status = 'DELIVERING') AS delivering,
        COUNT(*) FILTER (WHERE status = 'DELIVERED') AS delivered,
        COUNT(*) FILTER (WHERE status = 'RETRYING') AS retrying,
        COUNT(*) FILTER (WHERE status = 'DEAD_LETTER') AS dead_letter,
        COUNT(*) AS total
      FROM outbox_events
    `;
    const res = await pool.query(query);
    const r = res.rows[0] || {};
    return {
      pending: parseInt(r.pending || '0', 10),
      delivering: parseInt(r.delivering || '0', 10),
      delivered: parseInt(r.delivered || '0', 10),
      retrying: parseInt(r.retrying || '0', 10),
      deadLetter: parseInt(r.dead_letter || '0', 10),
      total: parseInt(r.total || '0', 10),
    };
  }
}

export class PostgresAcknowledgementRepository implements IAcknowledgementRepository {
  async save(ack: InteroperabilityAcknowledgement): Promise<InteroperabilityAcknowledgement> {
    const query = `
      INSERT INTO interoperability_acknowledgements (
        id, event_id, consumer_id, status, details, processed_resource_type, processed_resource_id, received_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    await pool.query(query, [
      ack.acknowledgementId,
      ack.eventId,
      ack.consumerId,
      ack.status,
      ack.details || null,
      ack.processedResourceType || null,
      ack.processedResourceId || null,
      ack.receivedAt,
    ]);
    return ack;
  }

  async findByEventId(eventId: string): Promise<InteroperabilityAcknowledgement[]> {
    const res = await pool.query(
      'SELECT * FROM interoperability_acknowledgements WHERE event_id = $1 ORDER BY received_at DESC',
      [eventId]
    );
    return res.rows.map((r) => ({
      acknowledgementId: r.id,
      eventId: r.event_id,
      consumerId: r.consumer_id,
      status: r.status,
      details: r.details || undefined,
      processedResourceType: r.processed_resource_type || undefined,
      processedResourceId: r.processed_resource_id || undefined,
      receivedAt: new Date(r.received_at).toISOString(),
    }));
  }

  async findAll(limit = 100): Promise<InteroperabilityAcknowledgement[]> {
    const res = await pool.query(
      'SELECT * FROM interoperability_acknowledgements ORDER BY received_at DESC LIMIT $1',
      [limit]
    );
    return res.rows.map((r) => ({
      acknowledgementId: r.id,
      eventId: r.event_id,
      consumerId: r.consumer_id,
      status: r.status,
      details: r.details || undefined,
      processedResourceType: r.processed_resource_type || undefined,
      processedResourceId: r.processed_resource_id || undefined,
      receivedAt: new Date(r.received_at).toISOString(),
    }));
  }
}

export class PostgresInteroperabilityAuditRepository implements IInteroperabilityAuditRepository {
  async log(entry: InteroperabilityAuditEntry): Promise<InteroperabilityAuditEntry> {
    const query = `
      INSERT INTO interoperability_audit_log (id, event_id, stage, status, message, details, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    await pool.query(query, [
      entry.id,
      entry.eventId,
      entry.stage,
      entry.status,
      entry.message,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.timestamp,
    ]);
    return entry;
  }

  async findByEventId(eventId: string): Promise<InteroperabilityAuditEntry[]> {
    const res = await pool.query(
      'SELECT * FROM interoperability_audit_log WHERE event_id = $1 ORDER BY timestamp ASC',
      [eventId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      stage: r.stage,
      status: r.status,
      message: r.message,
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details || undefined,
      timestamp: new Date(r.timestamp).toISOString(),
    }));
  }

  async findAll(limit = 200): Promise<InteroperabilityAuditEntry[]> {
    const res = await pool.query(
      'SELECT * FROM interoperability_audit_log ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
    return res.rows.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      stage: r.stage,
      status: r.status,
      message: r.message,
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details || undefined,
      timestamp: new Date(r.timestamp).toISOString(),
    }));
  }
}

export class PostgresFhirSubscriptionRepository implements IFhirSubscriptionRepository {
  async save(sub: FhirSubscription): Promise<FhirSubscription> {
    const query = `
      INSERT INTO fhir_subscriptions (id, status, reason, criteria, channel_type, endpoint, payload, created_at, error)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        criteria = EXCLUDED.criteria,
        channel_type = EXCLUDED.channel_type,
        endpoint = EXCLUDED.endpoint,
        payload = EXCLUDED.payload,
        error = EXCLUDED.error
      RETURNING *
    `;
    await pool.query(query, [
      sub.id,
      sub.status,
      sub.reason,
      sub.criteria,
      sub.channel.type,
      sub.channel.endpoint,
      sub.channel.payload || 'application/fhir+json',
      sub.createdAt || new Date().toISOString(),
      sub.error || null,
    ]);
    return sub;
  }

  async findById(id: string): Promise<FhirSubscription | null> {
    const res = await pool.query('SELECT * FROM fhir_subscriptions WHERE id = $1', [id]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      status: r.status,
      reason: r.reason,
      criteria: r.criteria,
      channel: {
        type: r.channel_type,
        endpoint: r.endpoint,
        payload: r.payload || undefined,
      },
      createdAt: new Date(r.created_at).toISOString(),
      lastTriggeredAt: r.last_triggered_at ? new Date(r.last_triggered_at).toISOString() : undefined,
      error: r.error || undefined,
    };
  }

  async findAll(): Promise<FhirSubscription[]> {
    const res = await pool.query('SELECT * FROM fhir_subscriptions ORDER BY created_at ASC');
    return res.rows.map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      criteria: r.criteria,
      channel: {
        type: r.channel_type,
        endpoint: r.endpoint,
        payload: r.payload || undefined,
      },
      createdAt: new Date(r.created_at).toISOString(),
      lastTriggeredAt: r.last_triggered_at ? new Date(r.last_triggered_at).toISOString() : undefined,
      error: r.error || undefined,
    }));
  }

  async findActive(): Promise<FhirSubscription[]> {
    const res = await pool.query("SELECT * FROM fhir_subscriptions WHERE status = 'active' ORDER BY created_at ASC");
    return res.rows.map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      criteria: r.criteria,
      channel: {
        type: r.channel_type,
        endpoint: r.endpoint,
        payload: r.payload || undefined,
      },
      createdAt: new Date(r.created_at).toISOString(),
      lastTriggeredAt: r.last_triggered_at ? new Date(r.last_triggered_at).toISOString() : undefined,
      error: r.error || undefined,
    }));
  }

  async updateStatus(id: string, status: FhirSubscription['status'], error?: string): Promise<FhirSubscription | null> {
    const query = `
      UPDATE fhir_subscriptions
      SET status = $2, error = $3
      WHERE id = $1
      RETURNING *
    `;
    const res = await pool.query(query, [id, status, error || null]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      status: r.status,
      reason: r.reason,
      criteria: r.criteria,
      channel: {
        type: r.channel_type,
        endpoint: r.endpoint,
        payload: r.payload || undefined,
      },
      createdAt: new Date(r.created_at).toISOString(),
      lastTriggeredAt: r.last_triggered_at ? new Date(r.last_triggered_at).toISOString() : undefined,
      error: r.error || undefined,
    };
  }

  async updateLastTriggered(id: string, timestamp = new Date().toISOString()): Promise<void> {
    await pool.query('UPDATE fhir_subscriptions SET last_triggered_at = $2 WHERE id = $1', [id, timestamp]);
  }
}

export class PostgresVerificationRepository implements IVerificationRepository {
  private mapRow(r: any): Verification {
    const inspector = r.inspector_data && typeof r.inspector_data === 'string'
      ? JSON.parse(r.inspector_data)
      : (r.inspector_data || { name: r.observer || 'Field Inspector' });

    const location = r.location && typeof r.location === 'string'
      ? JSON.parse(r.location)
      : r.location;

    const observations = r.observations && typeof r.observations === 'string'
      ? JSON.parse(r.observations)
      : (r.observations || {});

    const evidenceData = r.evidence_data && typeof r.evidence_data === 'string'
      ? JSON.parse(r.evidence_data)
      : (r.evidence_data || { photos: [], samples: [] });

    return {
      id: r.id,
      verificationId: r.id,
      taskId: r.task_id,
      incidentId: r.incident_id,
      observer: r.observer,
      inspector,
      timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
      location,
      status: r.status || 'CONFIRMED',
      result: r.result || (r.status === 'NOT_CONFIRMED' ? 'NOT_CONFIRMED' : r.status === 'UNCERTAIN' ? 'UNCERTAIN' : 'CONFIRMED'),
      observations,
      notes: r.notes || '',
      evidence: evidenceData,
      photos: r.photos && typeof r.photos === 'string' ? JSON.parse(r.photos) : (r.photos || []),
      sampleCollected: r.sample_collected || false,
      assessment: r.assessment || undefined,
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : undefined,
      syncStatus: r.sync_status || 'SYNCED',
      conflictStatus: r.conflict_status || 'NONE',
      clientSubmissionId: r.client_submission_id || undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }

  async findAll(filter?: VerificationFilter): Promise<Verification[]> {
    let query = `SELECT * FROM verifications WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (filter?.taskId) {
      query += ` AND task_id = $${idx++}`;
      params.push(filter.taskId);
    }
    if (filter?.incidentId) {
      query += ` AND incident_id = $${idx++}`;
      params.push(filter.incidentId);
    }
    if (filter?.status) {
      query += ` AND status = $${idx++}`;
      params.push(filter.status);
    }

    query += ` ORDER BY timestamp DESC`;
    if (filter?.limit) {
      query += ` LIMIT $${idx++}`;
      params.push(filter.limit);
    }

    const res = await pool.query(query, params);
    return res.rows.map((r) => this.mapRow(r));
  }

  async findById(id: string): Promise<Verification | null> {
    const res = await pool.query(`SELECT * FROM verifications WHERE id = $1`, [id]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async findByTaskId(taskId: string): Promise<Verification | null> {
    const res = await pool.query(`SELECT * FROM verifications WHERE task_id = $1 ORDER BY timestamp DESC LIMIT 1`, [taskId]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async findByIncidentId(incidentId: string): Promise<Verification[]> {
    const res = await pool.query(`SELECT * FROM verifications WHERE incident_id = $1 ORDER BY timestamp DESC`, [incidentId]);
    return res.rows.map((r) => this.mapRow(r));
  }

  async findByClientSubmissionId(clientSubmissionId: string): Promise<Verification | null> {
    const res = await pool.query(`SELECT * FROM verifications WHERE client_submission_id = $1 LIMIT 1`, [clientSubmissionId]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async create(verification: Verification): Promise<Verification> {
    const query = `
      INSERT INTO verifications (
        id, incident_id, task_id, observer, inspector_data, timestamp,
        location, status, result, observations, evidence_data, photos,
        sample_collected, assessment, notes, submitted_at, sync_status,
        conflict_status, client_submission_id, location_validation, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21
      )
      RETURNING *
    `;

    const observerName = (verification.inspector as any)?.name || verification.observer || 'Field Inspector';
    const params = [
      verification.id,
      verification.incidentId,
      verification.taskId || null,
      observerName,
      JSON.stringify(verification.inspector || {}),
      verification.timestamp,
      JSON.stringify(verification.location),
      verification.status || 'CONFIRMED',
      verification.result || 'CONFIRMED',
      JSON.stringify(verification.observations || {}),
      JSON.stringify(verification.evidence || { photos: [], samples: [] }),
      JSON.stringify(verification.photos || []),
      verification.sampleCollected || false,
      verification.assessment || null,
      verification.notes || '',
      verification.submittedAt || null,
      verification.syncStatus || 'SYNCED',
      verification.conflictStatus || 'NONE',
      verification.clientSubmissionId || null,
      JSON.stringify((verification.location as any)?.validationStatus ? verification.location : {}),
      verification.createdAt || new Date().toISOString(),
    ];

    const res = await pool.query(query, params);
    return this.mapRow(res.rows[0]);
  }

  async update(id: string, updates: Partial<Verification>): Promise<Verification | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const merged = { ...existing, ...updates };
    const query = `
      UPDATE verifications
      SET status = $2,
          observations = $3,
          evidence_data = $4,
          assessment = $5,
          notes = $6,
          sync_status = $7,
          conflict_status = $8,
          submitted_at = $9
      WHERE id = $1
      RETURNING *
    `;

    const params = [
      id,
      merged.status,
      JSON.stringify(merged.observations),
      JSON.stringify(merged.evidence),
      merged.assessment || null,
      merged.notes,
      merged.syncStatus || 'SYNCED',
      merged.conflictStatus || 'NONE',
      merged.submittedAt || null,
    ];

    const res = await pool.query(query, params);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async count(): Promise<number> {
    const res = await pool.query(`SELECT COUNT(*) as count FROM verifications`);
    return parseInt(res.rows[0].count, 10);
  }
}

export class PostgresFieldActorRepository implements IFieldActorRepository {
  private mapRow(r: any): FieldActor {
    return {
      actorId: r.actor_id,
      name: r.name,
      organization: r.organization,
      role: r.role,
      contact: r.contact || undefined,
      active: r.active,
    };
  }

  async findAll(): Promise<FieldActor[]> {
    const res = await pool.query(`SELECT * FROM field_actors WHERE active = TRUE ORDER BY name ASC`);
    return res.rows.map((r) => this.mapRow(r));
  }

  async findById(id: string): Promise<FieldActor | null> {
    const res = await pool.query(`SELECT * FROM field_actors WHERE actor_id = $1`, [id]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async create(actor: FieldActor): Promise<FieldActor> {
    const query = `
      INSERT INTO field_actors (actor_id, name, organization, role, contact, active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (actor_id) DO UPDATE
      SET name = EXCLUDED.name,
          organization = EXCLUDED.organization,
          role = EXCLUDED.role,
          contact = EXCLUDED.contact,
          active = EXCLUDED.active
      RETURNING *
    `;
    const res = await pool.query(query, [
      actor.actorId,
      actor.name,
      actor.organization,
      actor.role,
      actor.contact || null,
      actor.active !== undefined ? actor.active : true,
    ]);
    return this.mapRow(res.rows[0]);
  }
}

export class PostgresIncidentOutcomeRepository implements IIncidentOutcomeRepository {
  private mapRow(r: any): IncidentOutcome {
    return {
      id: r.id,
      incidentId: r.incident_id,
      verificationId: r.verification_id || undefined,
      proposedOutcome: r.proposed_outcome,
      confirmedOutcome: r.confirmed_outcome || undefined,
      reason: r.reason,
      supportingEvidence: typeof r.supporting_evidence === 'string' ? JSON.parse(r.supporting_evidence) : (r.supporting_evidence || []),
      confidence: parseFloat(r.confidence),
      determinedAt: new Date(r.determined_at).toISOString(),
      determinedBy: r.determined_by,
      confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).toISOString() : undefined,
      confirmedBy: r.confirmed_by || undefined,
      ruleVersion: r.rule_version,
      notes: r.notes || undefined,
    };
  }

  async create(outcome: IncidentOutcome): Promise<IncidentOutcome> {
    const query = `
      INSERT INTO incident_outcomes (
        id, incident_id, verification_id, proposed_outcome, confirmed_outcome,
        reason, supporting_evidence, confidence, determined_at, determined_by,
        confirmed_at, confirmed_by, rule_version, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const params = [
      outcome.id,
      outcome.incidentId,
      outcome.verificationId || null,
      outcome.proposedOutcome,
      outcome.confirmedOutcome || null,
      outcome.reason,
      JSON.stringify(outcome.supportingEvidence || []),
      outcome.confidence,
      outcome.determinedAt,
      outcome.determinedBy,
      outcome.confirmedAt || null,
      outcome.confirmedBy || null,
      outcome.ruleVersion,
      outcome.notes || null,
    ];
    const res = await pool.query(query, params);
    return this.mapRow(res.rows[0]);
  }

  async findById(id: string): Promise<IncidentOutcome | null> {
    const res = await pool.query(`SELECT * FROM incident_outcomes WHERE id = $1`, [id]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async findByIncidentId(incidentId: string): Promise<IncidentOutcome[]> {
    const res = await pool.query(
      `SELECT * FROM incident_outcomes WHERE incident_id = $1 ORDER BY determined_at DESC`,
      [incidentId]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async findLatestByIncidentId(incidentId: string): Promise<IncidentOutcome | null> {
    const res = await pool.query(
      `SELECT * FROM incident_outcomes WHERE incident_id = $1 ORDER BY determined_at DESC LIMIT 1`,
      [incidentId]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async update(id: string, updates: Partial<IncidentOutcome>): Promise<IncidentOutcome | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    const query = `
      UPDATE incident_outcomes
      SET confirmed_outcome = $2,
          confirmed_at = $3,
          confirmed_by = $4,
          notes = $5
      WHERE id = $1
      RETURNING *
    `;
    const res = await pool.query(query, [
      id,
      merged.confirmedOutcome || null,
      merged.confirmedAt || null,
      merged.confirmedBy || null,
      merged.notes || null,
    ]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }
}
