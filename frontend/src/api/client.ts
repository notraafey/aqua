import {
  HealthCheckResponse,
  StreamReach,
  Observation,
  ObservationFilter,
  Incident,
  EvidenceItem,
  EvidenceAssessment,
  EvidenceAssessmentFilter,
  Task,
  CreateObservationRequest,
  SatelliteIngestionRequest,
  WeatherIngestionRequest,
  CitizenIngestionRequest,
  Recommendation,
  RecommendationFilter,
  ApproveRecommendationRequest,
  RejectRecommendationRequest,
  RequestMoreEvidenceRequest,
  CatalogueMeasure,
  TaskFilter,
  TaskLifecycleRequest,
  TaskAuditEvent,
  DemoScenarioExecutionResponse,
  DashboardSummaryResponse,
  ForecastResult,
  EarlyWarning,
  ScenarioSimulation,
  ScenarioComparison,
  ReachResilienceScorecard,
  MonitoringCoverageBreakdown,
  ModelEvaluationMetric,
  AnalyticalProvenance,
  ResilienceOverviewResponse,
  InteroperabilityOverviewResponse,
  OutboxEvent,
  InteroperabilityFilter,
  InteroperabilityAcknowledgement,
  InteroperabilityAuditEntry,
  FhirSubscription,
  Verification,
  FieldActor,
  IncidentOutcome,
  OperationalOutcomeType,
} from '@aquasentinel/shared';

export function safeArray<T>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (val && Array.isArray(val.data)) return val.data;
  if (val && Array.isArray(val.items)) return val.items;
  return [];
}

export function normalizeVerification(v: any): Verification {
  if (!v) return v;
  return {
    ...v,
    evidence: {
      photos: safeArray(v.evidence?.photos || v.photos),
      samples: safeArray(v.evidence?.samples),
    },
    photos: safeArray(v.photos || v.evidence?.photos),
    observations: v.observations || {},
    notes: v.notes || '',
  };
}

export function normalizeIncident(inc: any): Incident {
  if (!inc) return inc;
  return {
    ...inc,
    evidence: safeArray(inc.evidence),
    observations: safeArray(inc.observations),
    recommendations: safeArray(inc.recommendations),
    tasks: safeArray(inc.tasks),
    auditTrail: safeArray(inc.auditTrail),
  };
}

export function normalizeTask(task: any): Task {
  if (!task) return task;
  return {
    ...task,
    auditTrail: safeArray(task.auditTrail),
    history: safeArray(task.history),
  };
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    try {
      const res = await fetch(url, { ...options, headers });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || `Request failed with status ${res.status}`);
      }

      return data.data !== undefined ? data.data : data;
    } catch (err: any) {
      console.error(`[API Client Error] ${endpoint}:`, err.message);
      throw err;
    }
  }

  // System Health
  async getHealth(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/api/health');
  }

  // Stream Reaches
  async getStreamReaches(): Promise<StreamReach[]> {
    return this.request<StreamReach[]>('/api/v1/stream-reaches');
  }

  async getStreamReach(id: string): Promise<StreamReach> {
    return this.request<StreamReach>(`/api/v1/stream-reaches/${id}`);
  }

  // Observations with rich filtering
  async getObservations(filter: ObservationFilter = {}): Promise<Observation[]> {
    const params = new URLSearchParams();
    if (filter.limit) params.set('limit', filter.limit.toString());
    if (filter.streamReachId) params.set('streamReachId', filter.streamReachId);
    if (filter.source) params.set('source', filter.source);
    if (filter.indicator) params.set('indicator', filter.indicator);
    if (filter.quality) params.set('quality', filter.quality);
    if (filter.startDate) params.set('startDate', filter.startDate);
    if (filter.endDate) params.set('endDate', filter.endDate);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<Observation[]>(`/api/v1/observations${qs}`);
  }

  async createObservation(data: CreateObservationRequest): Promise<Observation> {
    return this.request<Observation>('/api/v1/observations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Multi-Source Environmental Ingestion (Phase 2)
  async ingestSatellite(data: SatelliteIngestionRequest = {}): Promise<any> {
    return this.request<any>('/api/v1/ingestion/satellite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async ingestWeather(data: WeatherIngestionRequest = {}): Promise<any> {
    return this.request<any>('/api/v1/ingestion/weather', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async ingestCitizen(data: CitizenIngestionRequest): Promise<any> {
    return this.request<any>('/api/v1/ingestion/citizen', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async triggerAllIngestion(streamReachId?: string): Promise<any> {
    return this.request<any>('/api/v1/ingestion/trigger-all', {
      method: 'POST',
      body: JSON.stringify({ streamReachId }),
    });
  }

  // Incidents
  async getIncidents(): Promise<Incident[]> {
    const res = await this.request<any>('/api/v1/incidents');
    return safeArray<Incident>(res).map(normalizeIncident);
  }

  async getIncident(id: string): Promise<Incident> {
    const res = await this.request<any>(`/api/v1/incidents/${id}`);
    return normalizeIncident(res);
  }

  async getIncidentEvidence(incidentId: string): Promise<{ data: EvidenceItem[]; assessment?: EvidenceAssessment }> {
    const res = await this.request<any>(`/api/v1/incidents/${incidentId}/evidence`);
    if (Array.isArray(res)) {
      return { data: res };
    }
    return {
      data: safeArray<EvidenceItem>(res?.data || res),
      assessment: res?.assessment,
    };
  }

  async getIncidentRecommendations(incidentId: string): Promise<Recommendation[]> {
    const res = await this.request<any>(`/api/v1/incidents/${incidentId}/recommendations`);
    return safeArray<Recommendation>(res);
  }

  async getIncidentTimeline(incidentId: string): Promise<any[]> {
    const res = await this.request<any>(`/api/v1/incidents/${incidentId}/timeline`);
    return safeArray<any>(res);
  }

  // Dashboard (Phase 5)
  async getDashboardSummary(): Promise<DashboardSummaryResponse> {
    return this.request<DashboardSummaryResponse>('/api/v1/dashboard/summary');
  }

  // Real-Time Transport Diagnostics (Phase 5)
  async getRealtimeStatus(): Promise<any> {
    return this.request<any>('/api/v1/events/status');
  }

  // Tasks (Phase 1 & Phase 4 lifecycle)
  async getTasks(filter: TaskFilter = {}): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filter.incidentId) params.set('incidentId', filter.incidentId);
    if (filter.recommendationId) params.set('recommendationId', filter.recommendationId);
    if (filter.status) params.set('status', filter.status);
    if (filter.assignedTo) params.set('assignedTo', filter.assignedTo);
    if (filter.limit) params.set('limit', filter.limit.toString());
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<any>(`/api/v1/tasks${qs}`);
    return safeArray<Task>(res).map(normalizeTask);
  }

  async getTask(taskId: string): Promise<Task> {
    const res = await this.request<any>(`/api/v1/tasks/${taskId}`);
    return normalizeTask(res);
  }

  async updateTaskStatus(taskId: string, req: TaskLifecycleRequest | { status: Task['status'] }): Promise<Task> {
    return this.request<Task>(`/api/v1/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    });
  }

  async transitionTask(
    taskId: string,
    action: 'accept' | 'start' | 'complete' | 'verify' | 'cancel',
    body?: TaskLifecycleRequest
  ): Promise<Task> {
    return this.request<Task>(`/api/v1/tasks/${taskId}/${action}`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    });
  }

  async getTaskAuditTrail(taskId: string): Promise<TaskAuditEvent[]> {
    return this.request<TaskAuditEvent[]>(`/api/v1/tasks/${taskId}/audit-trail`);
  }

  async getTaskFhir(taskId: string): Promise<any> {
    return this.request<any>(`/api/v1/tasks/${taskId}/fhir`);
  }

  // Recommendations & Operational Response (Phase 4)
  async getRecommendations(filter: RecommendationFilter = {}): Promise<Recommendation[]> {
    const params = new URLSearchParams();
    if (filter.incidentId) params.set('incidentId', filter.incidentId);
    if (filter.assessmentId) params.set('assessmentId', filter.assessmentId);
    if (filter.status) params.set('status', filter.status);
    if (filter.measureId) params.set('measureId', filter.measureId);
    if (filter.limit) params.set('limit', filter.limit.toString());
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<Recommendation[]>(`/api/v1/recommendations${qs}`);
  }

  async getRecommendation(id: string): Promise<{ recommendation: Recommendation; fhirTaskDraft?: any }> {
    return this.request<{ recommendation: Recommendation; fhirTaskDraft?: any }>(`/api/v1/recommendations/${id}`);
  }

  async approveRecommendation(
    id: string,
    req: ApproveRecommendationRequest
  ): Promise<{ recommendation: Recommendation; task: Task; fhirTask?: any }> {
    return this.request<{ recommendation: Recommendation; task: Task; fhirTask?: any }>(
      `/api/v1/recommendations/${id}/approve`,
      {
        method: 'POST',
        body: JSON.stringify(req),
      }
    );
  }

  async rejectRecommendation(id: string, req: RejectRecommendationRequest): Promise<Recommendation> {
    return this.request<Recommendation>(`/api/v1/recommendations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async requestMoreEvidence(id: string, req: RequestMoreEvidenceRequest): Promise<Recommendation> {
    return this.request<Recommendation>(`/api/v1/recommendations/${id}/request-more-evidence`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  // OneAquaHealth Measures Catalogue (Phase 4)
  async getCatalogueMeasures(filter: { type?: string; applicableIncidentType?: string; targetSector?: string } = {}): Promise<CatalogueMeasure[]> {
    const params = new URLSearchParams();
    if (filter.type) params.set('type', filter.type);
    if (filter.applicableIncidentType) params.set('applicableIncidentType', filter.applicableIncidentType);
    if (filter.targetSector) params.set('targetSector', filter.targetSector);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<CatalogueMeasure[]>(`/api/v1/actions/catalogue${qs}`);
  }

  async getCatalogueMeasure(id: string): Promise<CatalogueMeasure> {
    return this.request<CatalogueMeasure>(`/api/v1/actions/catalogue/${id}`);
  }

  // Phase 4 Demo Scenarios
  async executeDemoScenario(scenarioId: string, customOptions?: Record<string, any>): Promise<DemoScenarioExecutionResponse> {
    return this.request<DemoScenarioExecutionResponse>(`/api/v1/demo/scenarios/${scenarioId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ scenarioId, customOptions }),
    });
  }

  // Evidence Fusion Engine (Phase 3)
  async getEvidenceAssessments(filter: EvidenceAssessmentFilter = {}): Promise<EvidenceAssessment[]> {
    const params = new URLSearchParams();
    if (filter.streamReachId) params.set('streamReachId', filter.streamReachId);
    if (filter.confidenceBand) params.set('confidenceBand', filter.confidenceBand);
    if (filter.minScore !== undefined) params.set('minScore', filter.minScore.toString());
    if (filter.maxScore !== undefined) params.set('maxScore', filter.maxScore.toString());
    if (filter.limit) params.set('limit', filter.limit.toString());

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<EvidenceAssessment[]>(`/api/v1/evidence-assessments${qs}`);
  }

  async getEvidenceAssessment(id: string): Promise<{ assessment: EvidenceAssessment; streamReach?: StreamReach | null }> {
    return this.request<{ assessment: EvidenceAssessment; streamReach?: StreamReach | null }>(`/api/v1/evidence-assessments/${id}`);
  }

  async reassessEvidence(streamReachId: string, candidateId?: string): Promise<any> {
    return this.request<any>('/api/v1/evidence-assessments/reassess', {
      method: 'POST',
      body: JSON.stringify({ streamReachId, candidateId }),
    });
  }

  async getDemoScenarios(): Promise<any[]> {
    return this.request<any[]>('/api/v1/evidence-assessments/demo-scenarios');
  }

  // Phase 6 Resilience Intelligence & Scenario Simulation
  async getResilienceOverview(): Promise<ResilienceOverviewResponse> {
    return this.request<ResilienceOverviewResponse>('/api/v1/resilience/overview');
  }

  async getReachResilienceDetails(reachId: string): Promise<{
    reach: StreamReach;
    scorecard: ReachResilienceScorecard;
    coverage: MonitoringCoverageBreakdown;
    forecasts: ForecastResult[];
    activeWarnings: EarlyWarning[];
    scenarios: ScenarioSimulation[];
  }> {
    return this.request<any>(`/api/v1/resilience/reaches/${reachId}`);
  }

  async generateForecast(reachId: string, data: {
    indicator?: string;
    modelId?: string;
    horizonHours?: number;
    originTimestamp?: string;
  }): Promise<ForecastResult> {
    return this.request<ForecastResult>(`/api/v1/resilience/reaches/${reachId}/forecasts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getReachForecasts(reachId: string, indicator?: string): Promise<ForecastResult[]> {
    const qs = indicator ? `?indicator=${indicator}` : '';
    return this.request<ForecastResult[]>(`/api/v1/resilience/reaches/${reachId}/forecasts${qs}`);
  }

  async getForecast(id: string): Promise<ForecastResult> {
    return this.request<ForecastResult>(`/api/v1/resilience/forecasts/${id}`);
  }

  async runScenario(reachId: string, data: {
    name?: string;
    description?: string;
    type: string;
    indicator?: string;
    horizonHours?: number;
    baselineForecastId?: string;
    parameters?: Record<string, any>;
  }): Promise<ScenarioSimulation> {
    return this.request<ScenarioSimulation>(`/api/v1/resilience/reaches/${reachId}/scenarios/run`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getReachScenarios(reachId: string): Promise<ScenarioSimulation[]> {
    return this.request<ScenarioSimulation[]>(`/api/v1/resilience/reaches/${reachId}/scenarios`);
  }

  async getScenario(id: string): Promise<ScenarioSimulation> {
    return this.request<ScenarioSimulation>(`/api/v1/resilience/scenarios/${id}`);
  }

  async compareScenarios(reachId: string, scenarioIds: string[], baselineForecastId?: string): Promise<ScenarioComparison> {
    return this.request<ScenarioComparison>(`/api/v1/resilience/reaches/${reachId}/scenarios/compare`, {
      method: 'POST',
      body: JSON.stringify({ scenarioIds, baselineForecastId }),
    });
  }

  async getEarlyWarnings(filter?: { reachId?: string; acknowledged?: boolean; minSeverity?: string }): Promise<EarlyWarning[]> {
    const params = new URLSearchParams();
    if (filter?.reachId) params.set('reachId', filter.reachId);
    if (filter?.acknowledged !== undefined) params.set('acknowledged', filter.acknowledged.toString());
    if (filter?.minSeverity) params.set('minSeverity', filter.minSeverity);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<EarlyWarning[]>(`/api/v1/resilience/early-warnings${qs}`);
  }

  async acknowledgeEarlyWarning(id: string, acknowledgedBy = 'Operator', notes?: string): Promise<EarlyWarning> {
    return this.request<EarlyWarning>(`/api/v1/resilience/early-warnings/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ acknowledgedBy, notes }),
    });
  }

  async getModelEvaluations(reachId?: string, indicator?: string): Promise<ModelEvaluationMetric[]> {
    const params = new URLSearchParams();
    if (reachId) params.set('reachId', reachId);
    if (indicator) params.set('indicator', indicator);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<ModelEvaluationMetric[]>(`/api/v1/resilience/models/evaluation${qs}`);
  }

  async runBacktest(data: {
    reachId: string;
    indicator?: string;
    modelIds?: string[];
    horizons?: number[];
  }): Promise<ModelEvaluationMetric[]> {
    return this.request<ModelEvaluationMetric[]>('/api/v1/resilience/models/backtest', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProvenance(forecastId: string): Promise<AnalyticalProvenance> {
    return this.request<AnalyticalProvenance>(`/api/v1/resilience/provenance/${forecastId}`);
  }

  async executePhase6Demo(): Promise<any> {
    return this.request<any>('/api/v1/demo/phase6/execute', {
      method: 'POST',
    });
  }

  // Interoperability & FHIR Integration (Phase 7)
  async getInteroperabilityOverview(): Promise<InteroperabilityOverviewResponse> {
    return this.request<InteroperabilityOverviewResponse>('/api/v1/interoperability/overview');
  }

  async getInteroperabilityEvents(filter: InteroperabilityFilter = {}): Promise<{
    events: OutboxEvent[];
    pagination: { limit: number; offset: number; total: number };
  }> {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.eventType) params.set('eventType', filter.eventType);
    if (filter.correlationId) params.set('correlationId', filter.correlationId);
    if (filter.resourceType) params.set('resourceType', filter.resourceType);
    if (filter.limit) params.set('limit', filter.limit.toString());
    if (filter.offset) params.set('offset', filter.offset.toString());
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<{
      events: OutboxEvent[];
      pagination: { limit: number; offset: number; total: number };
    }>(`/api/v1/interoperability/events${qs}`);
  }

  async getInteroperabilityEvent(id: string): Promise<{
    event: OutboxEvent;
    auditTrail: InteroperabilityAuditEntry[];
    acknowledgements: InteroperabilityAcknowledgement[];
  }> {
    return this.request<{
      event: OutboxEvent;
      auditTrail: InteroperabilityAuditEntry[];
      acknowledgements: InteroperabilityAcknowledgement[];
    }>(`/api/v1/interoperability/events/${id}`);
  }

  async retryInteroperabilityEvent(id: string): Promise<any> {
    return this.request<any>(`/api/v1/interoperability/events/${id}/retry`, {
      method: 'POST',
    });
  }

  async replayDeadLetterEvent(id: string, replayedBy = 'Command Console Operator'): Promise<any> {
    return this.request<any>(`/api/v1/interoperability/dead-letter/${id}/replay`, {
      method: 'POST',
      body: JSON.stringify({ replayedBy }),
    });
  }

  async getInteroperabilitySubscriptions(): Promise<{
    count: number;
    subscriptions: FhirSubscription[];
  }> {
    return this.request<{
      count: number;
      subscriptions: FhirSubscription[];
    }>('/api/v1/interoperability/subscriptions');
  }

  async registerInteroperabilitySubscription(sub: {
    reason: string;
    criteria: string;
    endpoint: string;
    payload?: string;
  }): Promise<FhirSubscription> {
    return this.request<FhirSubscription>('/api/v1/interoperability/subscriptions', {
      method: 'POST',
      body: JSON.stringify(sub),
    });
  }

  async getInteroperabilityAudit(limit = 50, eventId?: string): Promise<InteroperabilityAuditEntry[]> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    if (eventId) params.set('eventId', eventId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<InteroperabilityAuditEntry[]>(`/api/v1/interoperability/audit${qs}`);
  }

  async getInteroperabilityAcknowledgements(limit = 50, eventId?: string): Promise<InteroperabilityAcknowledgement[]> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    if (eventId) params.set('eventId', eventId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<InteroperabilityAcknowledgement[]>(`/api/v1/interoperability/acknowledgements${qs}`);
  }

  // Phase 7 Interactive Demos
  async runInteroperabilityGoldenPath(): Promise<any> {
    return this.request<any>('/api/v1/demo/interoperability/golden-path', {
      method: 'POST',
    });
  }

  async runInteroperabilitySimulateFailure(): Promise<any> {
    return this.request<any>('/api/v1/demo/interoperability/simulate-failure', {
      method: 'POST',
    });
  }

  async runInteroperabilitySimulateDuplicate(): Promise<any> {
    return this.request<any>('/api/v1/demo/interoperability/simulate-duplicate', {
      method: 'POST',
    });
  }

  async runInteroperabilitySimulateDeadLetter(): Promise<any> {
    return this.request<any>('/api/v1/demo/interoperability/simulate-dead-letter', {
      method: 'POST',
    });
  }

  // ==========================================
  // Phase 8: Closed-Loop Field Operations
  // ==========================================

  async getVerifications(filter: { taskId?: string; incidentId?: string; status?: string } = {}): Promise<Verification[]> {
    const params = new URLSearchParams();
    if (filter.taskId) params.append('taskId', filter.taskId);
    if (filter.incidentId) params.append('incidentId', filter.incidentId);
    if (filter.status) params.append('status', filter.status);
    const queryString = params.toString();
    const endpoint = `/api/v1/verifications${queryString ? `?${queryString}` : ''}`;
    const res = await this.request<any>(endpoint);
    return safeArray<Verification>(res).map(normalizeVerification);
  }

  async getVerification(id: string): Promise<Verification> {
    const res = await this.request<any>(`/api/v1/verifications/${id}`);
    return normalizeVerification(res);
  }

  async createVerification(data: any): Promise<Verification> {
    const res = await this.request<any>('/api/v1/verifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return normalizeVerification(res);
  }

  async submitVerification(id: string, data: any): Promise<any> {
    return this.request<any>(`/api/v1/verifications/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async syncVerifications(items: any[]): Promise<any> {
    return this.request<any>('/api/v1/verifications/sync', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async getFieldActors(): Promise<FieldActor[]> {
    const res = await this.request<any>('/api/v1/actors');
    return safeArray<FieldActor>(res);
  }

  async getResponseAnalytics(): Promise<any> {
    return this.request<any>('/api/v1/analytics/response');
  }

  async getIncidentOutcomes(incidentId: string): Promise<IncidentOutcome[]> {
    const res = await this.request<any>(`/api/v1/incidents/${incidentId}/outcomes`);
    return safeArray<IncidentOutcome>(res);
  }

  async confirmIncidentOutcome(
    incidentId: string,
    data: { outcomeType: OperationalOutcomeType | string; confirmedBy?: string; notes?: string }
  ): Promise<any> {
    return this.request<any>(`/api/v1/incidents/${incidentId}/outcome/confirm`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resolveIncident(incidentId: string, data: { resolution: string; actor?: string }): Promise<any> {
    return this.request<any>(`/api/v1/incidents/${incidentId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async escalateIncident(incidentId: string, data: { newSeverity: string; reason: string; actor?: string }): Promise<any> {
    return this.request<any>(`/api/v1/incidents/${incidentId}/escalate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createFollowUpTask(
    incidentId: string,
    data: { instructions: string; title?: string; assignedTo?: string; priority?: string; actor?: string }
  ): Promise<any> {
    return this.request<any>(`/api/v1/incidents/${incidentId}/tasks/follow-up`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async assignTask(taskId: string, data: { actorId: string; assignedBy?: string; notes?: string }): Promise<any> {
    return this.request<any>(`/api/v1/tasks/${taskId}/assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Canonical End-to-End Demo Scenario Methods
  async getCanonicalDemoStatus(): Promise<any> {
    return this.request<any>('/api/v1/demo/canonical/status');
  }

  async advanceCanonicalDemoStep(step?: number): Promise<any> {
    return this.request<any>('/api/v1/demo/canonical/step', {
      method: 'POST',
      body: step !== undefined ? JSON.stringify({ step }) : undefined,
    });
  }

  async runCanonicalDemoToGate(): Promise<any> {
    return this.request<any>('/api/v1/demo/canonical/run-to-gate', {
      method: 'POST',
    });
  }

  async approveCanonicalDemoRecommendation(data?: any): Promise<any> {
    return this.request<any>('/api/v1/demo/canonical/approve', {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async resetCanonicalDemo(): Promise<any> {
    return this.request<any>('/api/v1/demo/canonical/reset', {
      method: 'POST',
    });
  }

  async executeCanonicalDemo(): Promise<any> {
    return this.request<any>('/api/v1/demo/canonical/execute', {
      method: 'POST',
    });
  }

  async runPhase8ScenarioA(): Promise<any> {
    return this.request<any>('/api/v1/demo/phase8/scenario-a', {
      method: 'POST',
    });
  }

  async runPhase8ScenarioB(): Promise<any> {
    return this.request<any>('/api/v1/demo/phase8/scenario-b', {
      method: 'POST',
    });
  }

  async runPhase8ScenarioC(): Promise<any> {
    return this.request<any>('/api/v1/demo/phase8/scenario-c', {
      method: 'POST',
    });
  }

  async runPhase8ExecuteAll(): Promise<any> {
    return this.request<any>('/api/v1/demo/phase8/execute-all', {
      method: 'POST',
    });
  }

  async resetDemo(): Promise<any> {
    return this.request<any>('/api/v1/demo/reset', {
      method: 'POST',
    });
  }
}

export const apiClient = new ApiClient();
