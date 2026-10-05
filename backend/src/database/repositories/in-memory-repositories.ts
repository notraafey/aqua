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

export class InMemoryStreamReachRepository implements IStreamReachRepository {
  private reaches = new Map<string, StreamReach>();

  async findAll(): Promise<StreamReach[]> {
    return Array.from(this.reaches.values());
  }

  async findById(id: string): Promise<StreamReach | null> {
    return this.reaches.get(id) || null;
  }

  async create(reach: StreamReach): Promise<StreamReach> {
    this.reaches.set(reach.id, reach);
    return reach;
  }

  async save(reach: StreamReach): Promise<StreamReach> {
    this.reaches.set(reach.id, reach);
    return reach;
  }

  async count(): Promise<number> {
    return this.reaches.size;
  }
}

export class InMemoryObservationRepository implements IObservationRepository {
  private observations = new Map<string, Observation>();

  async findAll(limit = 100): Promise<Observation[]> {
    return Array.from(this.observations.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async findById(id: string): Promise<Observation | null> {
    return this.observations.get(id) || null;
  }

  async findByStreamReach(streamReachId: string): Promise<Observation[]> {
    return Array.from(this.observations.values()).filter((o) => o.streamReachId === streamReachId);
  }

  async findByDeduplicationHash(hash: string): Promise<Observation | null> {
    for (const obs of this.observations.values()) {
      if (obs.deduplicationHash === hash) {
        return obs;
      }
    }
    return null;
  }

  async find(filter?: ObservationFilter): Promise<Observation[]> {
    let result = Array.from(this.observations.values());

    if (filter) {
      if (filter.streamReachId !== undefined) {
        result = result.filter((o) => o.streamReachId === filter.streamReachId);
      }
      if (filter.source) {
        result = result.filter((o) => o.source === filter.source);
      }
      if (filter.indicator) {
        result = result.filter((o) => o.indicator === filter.indicator);
      }
      if (filter.quality) {
        result = result.filter((o) => o.quality === filter.quality);
      }
      if (filter.startDate) {
        const start = new Date(filter.startDate).getTime();
        result = result.filter((o) => new Date(o.timestamp).getTime() >= start);
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate).getTime();
        result = result.filter((o) => new Date(o.timestamp).getTime() <= end);
      }
    }

    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  async create(observation: Observation): Promise<Observation> {
    this.observations.set(observation.id, observation);
    return observation;
  }

  async save(observation: Observation): Promise<Observation> {
    this.observations.set(observation.id, observation);
    return observation;
  }

  async count(): Promise<number> {
    return this.observations.size;
  }
}

export class InMemoryIncidentRepository implements IIncidentRepository {
  private incidents = new Map<string, Incident>();
  private evidence = new Map<string, EvidenceItem[]>();
  private recommendations = new Map<string, Recommendation[]>();
  private verifications = new Map<string, Verification>();

  async findAll(): Promise<Incident[]> {
    return Array.from(this.incidents.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async findById(id: string): Promise<Incident | null> {
    return this.incidents.get(id) || null;
  }

  async create(incident: Incident): Promise<Incident> {
    this.incidents.set(incident.id, incident);
    return incident;
  }

  async update(id: string, updates: Partial<Incident>): Promise<Incident | null> {
    const existing = this.incidents.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.incidents.set(id, updated);
    return updated;
  }

  async findEvidenceByIncidentId(incidentId: string): Promise<EvidenceItem[]> {
    return this.evidence.get(incidentId) || [];
  }

  async addEvidence(evidenceItem: EvidenceItem): Promise<EvidenceItem> {
    const key = evidenceItem.incidentId || 'UNASSOCIATED';
    const list = this.evidence.get(key) || [];
    list.push(evidenceItem);
    this.evidence.set(key, list);
    return evidenceItem;
  }

  async findRecommendationsByIncidentId(incidentId: string): Promise<Recommendation[]> {
    return this.recommendations.get(incidentId) || [];
  }

  async addRecommendation(recommendation: Recommendation): Promise<Recommendation> {
    const list = this.recommendations.get(recommendation.incidentId) || [];
    list.push(recommendation);
    this.recommendations.set(recommendation.incidentId, list);
    return recommendation;
  }

  async findVerificationByIncidentId(incidentId: string): Promise<Verification | null> {
    return this.verifications.get(incidentId) || null;
  }

  async addVerification(verification: Verification): Promise<Verification> {
    this.verifications.set(verification.incidentId, verification);
    return verification;
  }

  async count(): Promise<number> {
    return this.incidents.size;
  }
}

export class InMemoryTaskRepository implements ITaskRepository {
  private tasks = new Map<string, Task>();

  async findAll(filter?: TaskFilter): Promise<Task[]> {
    let list = Array.from(this.tasks.values());

    if (filter) {
      if (filter.incidentId) {
        list = list.filter((t) => t.incidentId === filter.incidentId);
      }
      if (filter.recommendationId) {
        list = list.filter((t) => t.recommendationId === filter.recommendationId);
      }
      if (filter.status) {
        list = list.filter((t) => t.status === filter.status);
      }
      if (filter.assignedTo) {
        list = list.filter((t) => t.assignedTo === filter.assignedTo);
      }
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }

    return list;
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async findByIncidentId(incidentId: string): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter((t) => t.incidentId === incidentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async findByRecommendationId(recommendationId: string): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter((t) => t.recommendationId === recommendationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async create(task: Task): Promise<Task> {
    this.tasks.set(task.id, task);
    return task;
  }

  async update(id: string, updates: Partial<Task>): Promise<Task | null> {
    const existing = this.tasks.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.tasks.set(id, updated);
    return updated;
  }

  async count(): Promise<number> {
    return this.tasks.size;
  }
}

export class InMemoryEvidenceAssessmentRepository implements IEvidenceAssessmentRepository {
  private assessments = new Map<string, EvidenceAssessment>();

  async findAll(filter?: EvidenceAssessmentFilter): Promise<EvidenceAssessment[]> {
    let list = Array.from(this.assessments.values());

    if (filter) {
      if (filter.streamReachId) {
        list = list.filter((a) => a.streamReachId === filter.streamReachId);
      }
      if (filter.confidenceBand) {
        list = list.filter((a) => a.confidenceBand === filter.confidenceBand);
      }
      if (filter.minScore !== undefined) {
        list = list.filter((a) => a.score >= filter.minScore!);
      }
      if (filter.maxScore !== undefined) {
        list = list.filter((a) => a.score <= filter.maxScore!);
      }
      if (filter.startDate) {
        const start = new Date(filter.startDate).getTime();
        list = list.filter((a) => new Date(a.createdAt).getTime() >= start);
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate).getTime();
        list = list.filter((a) => new Date(a.createdAt).getTime() <= end);
      }
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }

    return list;
  }

  async findById(id: string): Promise<EvidenceAssessment | null> {
    return this.assessments.get(id) || null;
  }

  async findLatestByStreamReach(streamReachId: string): Promise<EvidenceAssessment | null> {
    const list = Array.from(this.assessments.values())
      .filter((a) => a.streamReachId === streamReachId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return list.length > 0 ? list[0] : null;
  }

  async save(assessment: EvidenceAssessment): Promise<EvidenceAssessment> {
    this.assessments.set(assessment.id, assessment);
    return assessment;
  }

  async count(): Promise<number> {
    return this.assessments.size;
  }
}

export class InMemoryRecommendationRepository implements IRecommendationRepository {
  private recommendations = new Map<string, Recommendation>();

  async findAll(filter?: RecommendationFilter): Promise<Recommendation[]> {
    let list = Array.from(this.recommendations.values());

    if (filter) {
      if (filter.incidentId) {
        list = list.filter((r) => r.incidentId === filter.incidentId);
      }
      if (filter.assessmentId) {
        list = list.filter((r) => r.assessmentId === filter.assessmentId);
      }
      if (filter.status) {
        list = list.filter((r) => r.status === filter.status);
      }
      if (filter.measureId) {
        list = list.filter((r) => r.measureId === filter.measureId);
      }
    }

    list.sort((a, b) => a.rank - b.rank || b.suitabilityScore - a.suitabilityScore);

    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }

    return list;
  }

  async findById(id: string): Promise<Recommendation | null> {
    return this.recommendations.get(id) || null;
  }

  async findByIncidentId(incidentId: string): Promise<Recommendation[]> {
    return Array.from(this.recommendations.values())
      .filter((r) => r.incidentId === incidentId)
      .sort((a, b) => a.rank - b.rank || b.suitabilityScore - a.suitabilityScore);
  }

  async findByAssessmentId(assessmentId: string): Promise<Recommendation[]> {
    return Array.from(this.recommendations.values())
      .filter((r) => r.assessmentId === assessmentId)
      .sort((a, b) => a.rank - b.rank || b.suitabilityScore - a.suitabilityScore);
  }

  async findByIdempotencyKey(key: string): Promise<Recommendation | null> {
    for (const rec of this.recommendations.values()) {
      if (rec.idempotencyKey === key) {
        return rec;
      }
    }
    return null;
  }

  async create(recommendation: Recommendation): Promise<Recommendation> {
    this.recommendations.set(recommendation.id, recommendation);
    return recommendation;
  }

  async update(id: string, updates: Partial<Recommendation>): Promise<Recommendation | null> {
    const existing = this.recommendations.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.recommendations.set(id, updated);
    return updated;
  }

  async count(): Promise<number> {
    return this.recommendations.size;
  }
}

export class InMemoryCatalogueRepository implements ICatalogueRepository {
  private measures = new Map<string, CatalogueMeasure>();

  constructor() {
    this.seed(SEED_CATALOGUE_MEASURES);
  }

  async findAll(): Promise<CatalogueMeasure[]> {
    return Array.from(this.measures.values());
  }

  async findById(measureId: string): Promise<CatalogueMeasure | null> {
    return this.measures.get(measureId) || null;
  }

  async findByIncidentType(type: string): Promise<CatalogueMeasure[]> {
    return Array.from(this.measures.values()).filter((m) =>
      m.applicableIncidentTypes.includes(type as any)
    );
  }

  async create(measure: CatalogueMeasure): Promise<CatalogueMeasure> {
    this.measures.set(measure.measureId, measure);
    return measure;
  }

  async seed(measures: CatalogueMeasure[]): Promise<void> {
    for (const m of measures) {
      this.measures.set(m.measureId, m);
    }
  }

  async count(): Promise<number> {
    return this.measures.size;
  }
}

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  private logs: TaskAuditEvent[] = [];

  async log(event: TaskAuditEvent): Promise<TaskAuditEvent> {
    this.logs.push(event);
    return event;
  }

  async findByTaskId(taskId: string): Promise<TaskAuditEvent[]> {
    return this.logs
      .filter((l) => l.taskId === taskId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async findByRecommendationId(recommendationId: string): Promise<TaskAuditEvent[]> {
    return this.logs
      .filter((l) => l.recommendationId === recommendationId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async findByIncidentId(incidentId: string): Promise<TaskAuditEvent[]> {
    return this.logs
      .filter((l) => l.incidentId === incidentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async findAll(limit = 100): Promise<TaskAuditEvent[]> {
    return [...this.logs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}

export class InMemoryForecastRepository implements IForecastRepository {
  private forecasts = new Map<string, ForecastResult>();

  async save(forecast: ForecastResult): Promise<ForecastResult> {
    this.forecasts.set(forecast.id, forecast);
    return forecast;
  }

  async findById(id: string): Promise<ForecastResult | null> {
    return this.forecasts.get(id) ?? null;
  }

  async findLatestByReach(reachId: string, indicator?: string): Promise<ForecastResult | null> {
    const matching = Array.from(this.forecasts.values())
      .filter((f) => f.reachId === reachId && (!indicator || f.indicator === indicator))
      .sort((a, b) => new Date(b.generatedTimestamp).getTime() - new Date(a.generatedTimestamp).getTime());
    return matching[0] ?? null;
  }

  async findByReach(reachId: string, limit = 20): Promise<ForecastResult[]> {
    return Array.from(this.forecasts.values())
      .filter((f) => f.reachId === reachId)
      .sort((a, b) => new Date(b.generatedTimestamp).getTime() - new Date(a.generatedTimestamp).getTime())
      .slice(0, limit);
  }

  async findAll(limit = 100): Promise<ForecastResult[]> {
    return Array.from(this.forecasts.values())
      .sort((a, b) => new Date(b.generatedTimestamp).getTime() - new Date(a.generatedTimestamp).getTime())
      .slice(0, limit);
  }
}

export class InMemoryScenarioRepository implements IScenarioRepository {
  private scenarios = new Map<string, ScenarioSimulation>();

  async save(scenario: ScenarioSimulation): Promise<ScenarioSimulation> {
    this.scenarios.set(scenario.scenarioId, scenario);
    return scenario;
  }

  async findById(id: string): Promise<ScenarioSimulation | null> {
    return this.scenarios.get(id) ?? null;
  }

  async findByReach(reachId: string): Promise<ScenarioSimulation[]> {
    return Array.from(this.scenarios.values())
      .filter((s) => s.streamReachId === reachId)
      .sort((a, b) => new Date(b.generatedTimestamp).getTime() - new Date(a.generatedTimestamp).getTime());
  }

  async findAll(limit = 50): Promise<ScenarioSimulation[]> {
    return Array.from(this.scenarios.values())
      .sort((a, b) => new Date(b.generatedTimestamp).getTime() - new Date(a.generatedTimestamp).getTime())
      .slice(0, limit);
  }
}

export class InMemoryEarlyWarningRepository implements IEarlyWarningRepository {
  private warnings = new Map<string, EarlyWarning & { dismissed?: boolean }>();

  async save(warning: EarlyWarning): Promise<EarlyWarning> {
    this.warnings.set(warning.id, { ...warning, dismissed: false });
    return warning;
  }

  async findById(id: string): Promise<EarlyWarning | null> {
    return this.warnings.get(id) ?? null;
  }

  async findActive(): Promise<EarlyWarning[]> {
    return Array.from(this.warnings.values())
      .filter((w) => !w.dismissed)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async findByReach(reachId: string): Promise<EarlyWarning[]> {
    return Array.from(this.warnings.values())
      .filter((w) => w.streamReachId === reachId && !w.dismissed)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async find(filter?: { reachId?: string; acknowledged?: boolean; minSeverity?: string }): Promise<EarlyWarning[]> {
    let list = Array.from(this.warnings.values());
    if (filter?.reachId) {
      list = list.filter((w) => w.streamReachId === filter.reachId);
    }
    if (filter?.acknowledged !== undefined) {
      list = list.filter((w) => !!(w as any).acknowledged === filter.acknowledged);
    }
    if (filter?.minSeverity) {
      list = list.filter((w) => w.warningLevel === filter.minSeverity);
    }
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async acknowledge(id: string, user = 'Operator', notes?: string): Promise<EarlyWarning | null> {
    const warning = this.warnings.get(id);
    if (!warning) return null;
    (warning as any).acknowledged = true;
    (warning as any).acknowledgedBy = user;
    (warning as any).acknowledgedAt = new Date().toISOString();
    if (notes) (warning as any).notes = notes;
    this.warnings.set(id, warning);
    return warning;
  }

  async dismiss(id: string): Promise<boolean> {
    const warning = this.warnings.get(id);
    if (warning) {
      warning.dismissed = true;
      return true;
    }
    return false;
  }
}

export class InMemoryModelEvaluationRepository implements IModelEvaluationRepository {
  private metrics: ModelEvaluationMetric[] = [];

  async save(metric: ModelEvaluationMetric): Promise<ModelEvaluationMetric> {
    this.metrics.push(metric);
    return metric;
  }

  async saveMany(metrics: ModelEvaluationMetric[]): Promise<ModelEvaluationMetric[]> {
    for (const m of metrics) {
      this.metrics.push(m);
    }
    return metrics;
  }

  async findAll(): Promise<ModelEvaluationMetric[]> {
    return [...this.metrics].sort(
      (a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime()
    );
  }

  async findLatestByModel(
    modelId: string,
    horizonHours?: number
  ): Promise<ModelEvaluationMetric | null> {
    const matching = this.metrics
      .filter(
        (m) => m.modelId === modelId && (horizonHours === undefined || m.horizonHours === horizonHours)
      )
      .sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime());
    return matching[0] ?? null;
  }

  async findByReachAndIndicator(_reachId?: string, _indicator?: string): Promise<ModelEvaluationMetric[]> {
    return this.findAll();
  }
}

export class InMemoryOutboxRepository implements IOutboxRepository {
  private events = new Map<string, OutboxEvent>();

  async save(event: OutboxEvent): Promise<OutboxEvent> {
    const existing = this.events.get(event.id);
    const updated: OutboxEvent = {
      ...event,
      updatedAt: new Date().toISOString(),
      createdAt: existing ? existing.createdAt : event.createdAt || new Date().toISOString(),
    };
    this.events.set(updated.id, updated);
    return updated;
  }

  async findById(id: string): Promise<OutboxEvent | null> {
    return this.events.get(id) || null;
  }

  async findByEventId(eventId: string): Promise<OutboxEvent | null> {
    for (const evt of this.events.values()) {
      if (evt.eventId === eventId) return evt;
    }
    return null;
  }

  async findPending(limit = 50): Promise<OutboxEvent[]> {
    const now = new Date().getTime();
    return Array.from(this.events.values())
      .filter((e) => {
        if (e.status === 'PENDING') return true;
        if (e.status === 'RETRYING') {
          if (!e.nextRetryAt) return true;
          return new Date(e.nextRetryAt).getTime() <= now;
        }
        return false;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, limit);
  }

  async findDeadLetter(limit = 50): Promise<OutboxEvent[]> {
    return Array.from(this.events.values())
      .filter((e) => e.status === 'DEAD_LETTER')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  async find(filter?: InteroperabilityFilter): Promise<OutboxEvent[]> {
    let list = Array.from(this.events.values());
    if (filter?.status) {
      list = list.filter((e) => e.status === filter.status);
    }
    if (filter?.eventType) {
      list = list.filter((e) => e.eventType === filter.eventType);
    }
    if (filter?.correlationId) {
      list = list.filter((e) => e.correlationId === filter.correlationId);
    }
    if (filter?.resourceType) {
      list = list.filter((e) => e.resourceType === filter.resourceType);
    }
    if (filter?.destination) {
      list = list.filter((e) => e.destination === filter.destination);
    }
    if (filter?.since) {
      const sinceTime = new Date(filter.since).getTime();
      list = list.filter((e) => new Date(e.createdAt).getTime() >= sinceTime);
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const offset = filter?.offset || 0;
    const limit = filter?.limit || 100;
    return list.slice(offset, offset + limit);
  }

  async updateStatus(
    id: string,
    status: OutboxDeliveryStatus,
    details?: { error?: string; nextRetryAt?: string; acknowledgementId?: string }
  ): Promise<OutboxEvent | null> {
    const evt = this.events.get(id);
    if (!evt) return null;

    evt.status = status;
    evt.updatedAt = new Date().toISOString();
    if (details?.error !== undefined) evt.lastError = details.error;
    if (details?.nextRetryAt !== undefined) evt.nextRetryAt = details.nextRetryAt;
    if (details?.acknowledgementId !== undefined) evt.acknowledgementId = details.acknowledgementId;
    if (status === 'DELIVERED') evt.deliveredAt = new Date().toISOString();
    if (status === 'DEAD_LETTER') evt.deadLetterAt = new Date().toISOString();

    this.events.set(id, evt);
    return evt;
  }

  async markDelivered(id: string, acknowledgementId?: string): Promise<OutboxEvent | null> {
    const evt = this.events.get(id);
    if (!evt) return null;

    evt.status = 'DELIVERED';
    evt.deliveredAt = new Date().toISOString();
    evt.updatedAt = new Date().toISOString();
    if (acknowledgementId) evt.acknowledgementId = acknowledgementId;
    this.events.set(id, evt);
    return evt;
  }

  async scheduleRetry(id: string, error: string, nextRetryAt: string): Promise<OutboxEvent | null> {
    const evt = this.events.get(id);
    if (!evt) return null;

    evt.status = 'RETRYING';
    evt.retryCount += 1;
    evt.lastError = error;
    evt.nextRetryAt = nextRetryAt;
    evt.updatedAt = new Date().toISOString();
    this.events.set(id, evt);
    return evt;
  }

  async markDeadLetter(id: string, error: string): Promise<OutboxEvent | null> {
    const evt = this.events.get(id);
    if (!evt) return null;

    evt.status = 'DEAD_LETTER';
    evt.lastError = error;
    evt.deadLetterAt = new Date().toISOString();
    evt.updatedAt = new Date().toISOString();
    this.events.set(id, evt);
    return evt;
  }

  async replay(id: string, replayedBy = 'Operator'): Promise<OutboxEvent | null> {
    const evt = this.events.get(id);
    if (!evt) return null;

    evt.status = 'PENDING';
    evt.retryCount = 0;
    evt.replayCount = (evt.replayCount || 0) + 1;
    evt.nextRetryAt = undefined;
    evt.deadLetterAt = undefined;
    evt.updatedAt = new Date().toISOString();
    (evt.payload as any).replayedAt = new Date().toISOString();
    (evt.payload as any).replayedBy = replayedBy;
    (evt.payload as any).replayCount = evt.replayCount;

    this.events.set(id, evt);
    return evt;
  }

  async count(): Promise<{
    pending: number;
    delivering: number;
    delivered: number;
    retrying: number;
    deadLetter: number;
    total: number;
  }> {
    let pending = 0;
    let delivering = 0;
    let delivered = 0;
    let retrying = 0;
    let deadLetter = 0;

    for (const evt of this.events.values()) {
      switch (evt.status) {
        case 'PENDING':
          pending++;
          break;
        case 'DELIVERING':
          delivering++;
          break;
        case 'DELIVERED':
          delivered++;
          break;
        case 'RETRYING':
          retrying++;
          break;
        case 'DEAD_LETTER':
          deadLetter++;
          break;
      }
    }

    return {
      pending,
      delivering,
      delivered,
      retrying,
      deadLetter,
      total: this.events.size,
    };
  }
}

export class InMemoryAcknowledgementRepository implements IAcknowledgementRepository {
  private acks = new Map<string, InteroperabilityAcknowledgement>();

  async save(ack: InteroperabilityAcknowledgement): Promise<InteroperabilityAcknowledgement> {
    this.acks.set(ack.acknowledgementId, { ...ack });
    return ack;
  }

  async findByEventId(eventId: string): Promise<InteroperabilityAcknowledgement[]> {
    return Array.from(this.acks.values())
      .filter((a) => a.eventId === eventId)
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }

  async findAll(limit = 100): Promise<InteroperabilityAcknowledgement[]> {
    return Array.from(this.acks.values())
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
      .slice(0, limit);
  }
}

export class InMemoryInteroperabilityAuditRepository implements IInteroperabilityAuditRepository {
  private logs: InteroperabilityAuditEntry[] = [];

  async log(entry: InteroperabilityAuditEntry): Promise<InteroperabilityAuditEntry> {
    this.logs.push({ ...entry });
    return entry;
  }

  async findByEventId(eventId: string): Promise<InteroperabilityAuditEntry[]> {
    return this.logs
      .filter((l) => l.eventId === eventId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async findAll(limit = 200): Promise<InteroperabilityAuditEntry[]> {
    return [...this.logs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}

export class InMemoryFhirSubscriptionRepository implements IFhirSubscriptionRepository {
  private subs = new Map<string, FhirSubscription>();

  async save(sub: FhirSubscription): Promise<FhirSubscription> {
    const existing = this.subs.get(sub.id);
    const updated: FhirSubscription = {
      ...sub,
      createdAt: existing ? existing.createdAt : sub.createdAt || new Date().toISOString(),
    };
    this.subs.set(updated.id, updated);
    return updated;
  }

  async findById(id: string): Promise<FhirSubscription | null> {
    return this.subs.get(id) || null;
  }

  async findAll(): Promise<FhirSubscription[]> {
    return Array.from(this.subs.values());
  }

  async findActive(): Promise<FhirSubscription[]> {
    return Array.from(this.subs.values()).filter((s) => s.status === 'active');
  }

  async updateStatus(
    id: string,
    status: FhirSubscription['status'],
    error?: string
  ): Promise<FhirSubscription | null> {
    const sub = this.subs.get(id);
    if (!sub) return null;
    sub.status = status;
    if (error !== undefined) sub.error = error;
    this.subs.set(id, sub);
    return sub;
  }

  async updateLastTriggered(id: string, timestamp = new Date().toISOString()): Promise<void> {
    const sub = this.subs.get(id);
    if (sub) {
      sub.lastTriggeredAt = timestamp;
      this.subs.set(id, sub);
    }
  }
}

export class InMemoryVerificationRepository implements IVerificationRepository {
  private verifications = new Map<string, Verification>();

  async findAll(filter?: VerificationFilter): Promise<Verification[]> {
    let list = Array.from(this.verifications.values());

    if (filter) {
      if (filter.taskId) {
        list = list.filter((v) => v.taskId === filter.taskId);
      }
      if (filter.incidentId) {
        list = list.filter((v) => v.incidentId === filter.incidentId);
      }
      if (filter.status) {
        list = list.filter((v) => v.status === filter.status);
      }
      if (filter.inspectorId) {
        list = list.filter((v) => {
          const actorId = (v.inspector as FieldActor)?.actorId || (v.inspector as any)?.id;
          return actorId === filter.inspectorId;
        });
      }
    }

    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }

    return list;
  }

  async findById(id: string): Promise<Verification | null> {
    return this.verifications.get(id) || null;
  }

  async findByTaskId(taskId: string): Promise<Verification | null> {
    const found = Array.from(this.verifications.values()).find((v) => v.taskId === taskId);
    return found || null;
  }

  async findByIncidentId(incidentId: string): Promise<Verification[]> {
    return Array.from(this.verifications.values())
      .filter((v) => v.incidentId === incidentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async findByClientSubmissionId(clientSubmissionId: string): Promise<Verification | null> {
    const found = Array.from(this.verifications.values()).find(
      (v) => v.clientSubmissionId === clientSubmissionId
    );
    return found || null;
  }

  async create(verification: Verification): Promise<Verification> {
    this.verifications.set(verification.id, verification);
    return verification;
  }

  async update(id: string, updates: Partial<Verification>): Promise<Verification | null> {
    const existing = this.verifications.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.verifications.set(id, updated);
    return updated;
  }

  async count(): Promise<number> {
    return this.verifications.size;
  }
}

export class InMemoryFieldActorRepository implements IFieldActorRepository {
  private actors = new Map<string, FieldActor>();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    const defaults: FieldActor[] = [
      {
        actorId: 'actor-alex-rivera',
        name: 'Alex Rivera',
        organization: 'Volos Municipal Environmental Dept',
        role: 'FIELD_INSPECTOR',
        contact: '+30 24210 12345',
        active: true,
      },
      {
        actorId: 'actor-elena-vasquez',
        name: 'Elena Vasquez',
        organization: 'Thessaly Regional Water Monitoring Agency',
        role: 'ENVIRONMENTAL_SPECIALIST',
        contact: '+30 24210 54321',
        active: true,
      },
      {
        actorId: 'actor-nikos-katsaros',
        name: 'Nikos Katsaros',
        organization: 'Pagasetic Gulf Coastal Patrol',
        role: 'FIELD_INSPECTOR',
        contact: '+30 24210 98765',
        active: true,
      },
      {
        actorId: 'actor-maria-dimitriou',
        name: 'Maria Dimitriou',
        organization: 'Volos Municipal Civil Protection',
        role: 'MUNICIPAL_OFFICER',
        contact: '+30 24210 67890',
        active: true,
      },
    ];

    for (const actor of defaults) {
      this.actors.set(actor.actorId, actor);
    }
  }

  async findAll(): Promise<FieldActor[]> {
    return Array.from(this.actors.values()).filter((a) => a.active);
  }

  async findById(id: string): Promise<FieldActor | null> {
    return this.actors.get(id) || null;
  }

  async create(actor: FieldActor): Promise<FieldActor> {
    this.actors.set(actor.actorId, actor);
    return actor;
  }
}

export class InMemoryIncidentOutcomeRepository implements IIncidentOutcomeRepository {
  private outcomes = new Map<string, IncidentOutcome>();

  async create(outcome: IncidentOutcome): Promise<IncidentOutcome> {
    this.outcomes.set(outcome.id, outcome);
    return outcome;
  }

  async findById(id: string): Promise<IncidentOutcome | null> {
    return this.outcomes.get(id) || null;
  }

  async findByIncidentId(incidentId: string): Promise<IncidentOutcome[]> {
    return Array.from(this.outcomes.values())
      .filter((o) => o.incidentId === incidentId)
      .sort((a, b) => new Date(b.determinedAt).getTime() - new Date(a.determinedAt).getTime());
  }

  async findLatestByIncidentId(incidentId: string): Promise<IncidentOutcome | null> {
    const list = await this.findByIncidentId(incidentId);
    return list.length > 0 ? list[0] : null;
  }

  async update(id: string, updates: Partial<IncidentOutcome>): Promise<IncidentOutcome | null> {
    const existing = this.outcomes.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.outcomes.set(id, updated);
    return updated;
  }
}
