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

export interface IStreamReachRepository {
  findAll(): Promise<StreamReach[]>;
  findById(id: string): Promise<StreamReach | null>;
  create(reach: StreamReach): Promise<StreamReach>;
  save(reach: StreamReach): Promise<StreamReach>;
  count(): Promise<number>;
}

export interface IObservationRepository {
  findAll(limit?: number): Promise<Observation[]>;
  findById(id: string): Promise<Observation | null>;
  findByStreamReach(streamReachId: string): Promise<Observation[]>;
  find(filter?: ObservationFilter): Promise<Observation[]>;
  findByDeduplicationHash(hash: string): Promise<Observation | null>;
  create(observation: Observation): Promise<Observation>;
  save(observation: Observation): Promise<Observation>;
  count(): Promise<number>;
}

export interface IIncidentRepository {
  findAll(): Promise<Incident[]>;
  findById(id: string): Promise<Incident | null>;
  create(incident: Incident): Promise<Incident>;
  update(id: string, updates: Partial<Incident>): Promise<Incident | null>;
  findEvidenceByIncidentId(incidentId: string): Promise<EvidenceItem[]>;
  addEvidence(evidence: EvidenceItem): Promise<EvidenceItem>;
  findRecommendationsByIncidentId(incidentId: string): Promise<Recommendation[]>;
  addRecommendation(recommendation: Recommendation): Promise<Recommendation>;
  findVerificationByIncidentId(incidentId: string): Promise<Verification | null>;
  addVerification(verification: Verification): Promise<Verification>;
  count(): Promise<number>;
}

export interface ITaskRepository {
  findAll(filter?: TaskFilter): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
  findByIncidentId(incidentId: string): Promise<Task[]>;
  findByRecommendationId(recommendationId: string): Promise<Task[]>;
  create(task: Task): Promise<Task>;
  update(id: string, updates: Partial<Task>): Promise<Task | null>;
  count(): Promise<number>;
}

export interface IRecommendationRepository {
  findAll(filter?: RecommendationFilter): Promise<Recommendation[]>;
  findById(id: string): Promise<Recommendation | null>;
  findByIncidentId(incidentId: string): Promise<Recommendation[]>;
  findByAssessmentId(assessmentId: string): Promise<Recommendation[]>;
  findByIdempotencyKey(key: string): Promise<Recommendation | null>;
  create(recommendation: Recommendation): Promise<Recommendation>;
  update(id: string, updates: Partial<Recommendation>): Promise<Recommendation | null>;
  count(): Promise<number>;
}

export interface ICatalogueRepository {
  findAll(): Promise<CatalogueMeasure[]>;
  findById(measureId: string): Promise<CatalogueMeasure | null>;
  findByIncidentType(type: string): Promise<CatalogueMeasure[]>;
  create(measure: CatalogueMeasure): Promise<CatalogueMeasure>;
  seed(measures: CatalogueMeasure[]): Promise<void>;
  count(): Promise<number>;
}

export interface IAuditLogRepository {
  log(event: TaskAuditEvent): Promise<TaskAuditEvent>;
  findByTaskId(taskId: string): Promise<TaskAuditEvent[]>;
  findByRecommendationId(recommendationId: string): Promise<TaskAuditEvent[]>;
  findByIncidentId(incidentId: string): Promise<TaskAuditEvent[]>;
  findAll(limit?: number): Promise<TaskAuditEvent[]>;
}

export interface IEvidenceAssessmentRepository {
  findAll(filter?: EvidenceAssessmentFilter): Promise<EvidenceAssessment[]>;
  findById(id: string): Promise<EvidenceAssessment | null>;
  findLatestByStreamReach(streamReachId: string): Promise<EvidenceAssessment | null>;
  save(assessment: EvidenceAssessment): Promise<EvidenceAssessment>;
  count(): Promise<number>;
}

export interface IForecastRepository {
  save(forecast: ForecastResult): Promise<ForecastResult>;
  findById(id: string): Promise<ForecastResult | null>;
  findLatestByReach(reachId: string, indicator?: string): Promise<ForecastResult | null>;
  findByReach(reachId: string, limit?: number): Promise<ForecastResult[]>;
  findAll(limit?: number): Promise<ForecastResult[]>;
}

export interface IScenarioRepository {
  save(scenario: ScenarioSimulation): Promise<ScenarioSimulation>;
  findById(id: string): Promise<ScenarioSimulation | null>;
  findByReach(reachId: string): Promise<ScenarioSimulation[]>;
  findAll(limit?: number): Promise<ScenarioSimulation[]>;
}

export interface IEarlyWarningRepository {
  save(warning: EarlyWarning): Promise<EarlyWarning>;
  findById(id: string): Promise<EarlyWarning | null>;
  findActive(): Promise<EarlyWarning[]>;
  findByReach(reachId: string): Promise<EarlyWarning[]>;
  find(filter?: { reachId?: string; acknowledged?: boolean; minSeverity?: string }): Promise<EarlyWarning[]>;
  acknowledge(id: string, user?: string, notes?: string): Promise<EarlyWarning | null>;
  dismiss(id: string): Promise<boolean>;
}

export interface IModelEvaluationRepository {
  save(metric: ModelEvaluationMetric): Promise<ModelEvaluationMetric>;
  saveMany(metrics: ModelEvaluationMetric[]): Promise<ModelEvaluationMetric[]>;
  findAll(): Promise<ModelEvaluationMetric[]>;
  findLatestByModel(modelId: string, horizonHours?: number): Promise<ModelEvaluationMetric | null>;
  findByReachAndIndicator(reachId?: string, indicator?: string): Promise<ModelEvaluationMetric[]>;
}

export interface IOutboxRepository {
  save(event: OutboxEvent): Promise<OutboxEvent>;
  findById(id: string): Promise<OutboxEvent | null>;
  findByEventId(eventId: string): Promise<OutboxEvent | null>;
  findPending(limit?: number): Promise<OutboxEvent[]>;
  findDeadLetter(limit?: number): Promise<OutboxEvent[]>;
  find(filter?: InteroperabilityFilter): Promise<OutboxEvent[]>;
  updateStatus(
    id: string,
    status: OutboxDeliveryStatus,
    details?: { error?: string; nextRetryAt?: string; acknowledgementId?: string }
  ): Promise<OutboxEvent | null>;
  markDelivered(id: string, acknowledgementId?: string): Promise<OutboxEvent | null>;
  scheduleRetry(id: string, error: string, nextRetryAt: string): Promise<OutboxEvent | null>;
  markDeadLetter(id: string, error: string): Promise<OutboxEvent | null>;
  replay(id: string, replayedBy?: string): Promise<OutboxEvent | null>;
  count(): Promise<{
    pending: number;
    delivering: number;
    delivered: number;
    retrying: number;
    deadLetter: number;
    total: number;
  }>;
}

export interface IAcknowledgementRepository {
  save(ack: InteroperabilityAcknowledgement): Promise<InteroperabilityAcknowledgement>;
  findByEventId(eventId: string): Promise<InteroperabilityAcknowledgement[]>;
  findAll(limit?: number): Promise<InteroperabilityAcknowledgement[]>;
}

export interface IInteroperabilityAuditRepository {
  log(entry: InteroperabilityAuditEntry): Promise<InteroperabilityAuditEntry>;
  findByEventId(eventId: string): Promise<InteroperabilityAuditEntry[]>;
  findAll(limit?: number): Promise<InteroperabilityAuditEntry[]>;
}

export interface IFhirSubscriptionRepository {
  save(sub: FhirSubscription): Promise<FhirSubscription>;
  findById(id: string): Promise<FhirSubscription | null>;
  findAll(): Promise<FhirSubscription[]>;
  findActive(): Promise<FhirSubscription[]>;
  updateStatus(id: string, status: FhirSubscription['status'], error?: string): Promise<FhirSubscription | null>;
  updateLastTriggered(id: string, timestamp?: string): Promise<void>;
}

export interface IVerificationRepository {
  findAll(filter?: VerificationFilter): Promise<Verification[]>;
  findById(id: string): Promise<Verification | null>;
  findByTaskId(taskId: string): Promise<Verification | null>;
  findByIncidentId(incidentId: string): Promise<Verification[]>;
  findByClientSubmissionId(clientSubmissionId: string): Promise<Verification | null>;
  create(verification: Verification): Promise<Verification>;
  update(id: string, updates: Partial<Verification>): Promise<Verification | null>;
  count(): Promise<number>;
}

export interface IFieldActorRepository {
  findAll(): Promise<FieldActor[]>;
  findById(id: string): Promise<FieldActor | null>;
  create(actor: FieldActor): Promise<FieldActor>;
}

export interface IIncidentOutcomeRepository {
  create(outcome: IncidentOutcome): Promise<IncidentOutcome>;
  findById(id: string): Promise<IncidentOutcome | null>;
  findByIncidentId(incidentId: string): Promise<IncidentOutcome[]>;
  findLatestByIncidentId(incidentId: string): Promise<IncidentOutcome | null>;
  update(id: string, updates: Partial<IncidentOutcome>): Promise<IncidentOutcome | null>;
}
