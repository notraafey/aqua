/**
 * AquaSentinel API Contracts and Response Types
 */

import { StreamReach, Observation, Incident, EvidenceItem, EvidenceAssessment, EvidenceAssessmentFilter, Recommendation, Task, Verification } from './domain.js';
import {
  ForecastResult,
  EarlyWarning,
  ScenarioSimulation,
  ScenarioComparison,
  ReachResilienceScorecard,
  MonitoringCoverageBreakdown,
  ModelEvaluationMetric,
  AnalyticalProvenance,
  TimeSeriesStats,
  ForecastHorizonHours,
  ScenarioParameters,
} from './analytics.js';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    requestId?: string;
    timestamp: string;
  };
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    requestId?: string;
    timestamp: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  appMode: 'live' | 'demo';
  timestamp: string;
  uptimeSeconds: number;
  services: {
    database: {
      status: 'up' | 'down' | 'unconfigured';
      latencyMs?: number;
      error?: string;
    };
    fhir: {
      status: 'up' | 'down' | 'mocked';
      endpoint: string;
      error?: string;
    };
    satellite?: {
      status: 'up' | 'down' | 'mocked';
      provider: string;
      error?: string;
    };
    weather?: {
      status: 'up' | 'down' | 'mocked';
      provider: string;
      error?: string;
    };
    citizen?: {
      status: 'up' | 'down' | 'mocked';
      provider: string;
      error?: string;
    };
    eventSystem?: {
      status: 'up' | 'down' | 'mocked';
      listenerCount?: number;
      lastEventTimestamp?: string | null;
    };
    recommendationEngine?: {
      status: 'up' | 'down' | 'mocked';
      measuresCount?: number;
    };
    realtimeTransport?: {
      status: 'up' | 'down' | 'mocked';
      transport: string;
      connectedClients?: number;
    };
  };
}

export interface DashboardSummaryResponse {
  activeIncidentsCount: number;
  highPriorityIncidentsCount: number;
  pendingHumanReviewsCount: number;
  tasksInProgressCount: number;
  tasksAwaitingVerificationCount: number;
  environmentalReachesMonitoredCount: number;
  lastIngestionTimestamp: string | null;
  systemHealth: 'healthy' | 'degraded' | 'unhealthy';
  recentIncidents: any[];
  recentTasks: any[];
  recentObservations: any[];
}

export interface CreateObservationRequest {
  source: Observation['source'];
  timestamp: string; // ISO-8601 UTC
  location: Observation['location'];
  streamReachId?: string | null;
  indicator: Observation['indicator'] | string;
  value: number | string;
  unit: string;
  quality?: Observation['quality'];
  sourceIdentifier?: string;
  processingMethod?: string;
  metadata?: Record<string, unknown>;
}

export interface SatelliteIngestionRequest {
  streamReachId?: string;
  startDate?: string;
  endDate?: string;
  maxCloudCover?: number;
}

export interface WeatherIngestionRequest {
  streamReachId?: string;
  location?: Observation['location'];
  timestamp?: string;
  daysBack?: number;
}

export interface CitizenIngestionRequest {
  streamReachId?: string;
  location: Observation['location'];
  timestamp?: string;
  indicator: Observation['indicator'] | string;
  value?: number | string;
  description?: string;
  reporterName?: string;
  photos?: string[];
}

export interface IngestionResult {
  ingestedCount: number;
  duplicateCount: number;
  observations: Observation[];
}

export interface IncidentSummaryResponse {
  incident: Incident;
  streamReach: StreamReach;
  evidenceCount: number;
  activeRecommendationsCount: number;
  openTasksCount: number;
}

export interface EvidenceAssessmentListResponse {
  assessments: EvidenceAssessment[];
  total: number;
}

export interface EvidenceAssessmentDetailResponse {
  assessment: EvidenceAssessment;
  streamReach?: StreamReach | null;
}

export interface ReassessEvidenceRequest {
  streamReachId: string;
  candidateId?: string;
  force?: boolean;
}

export interface ReassessEvidenceResponse {
  assessment: EvidenceAssessment;
  reassessed: boolean;
  scoreDelta?: number;
  previousBand?: string;
  currentBand: string;
}

export interface ApproveRecommendationRequest {
  notes?: string;
  assignedTo?: string;
  actor?: string;
}

export interface RejectRecommendationRequest {
  reason: string;
  actor?: string;
}

export interface RequestMoreEvidenceRequest {
  notes?: string;
  missingData?: string[];
  assignedTo?: string;
  actor?: string;
}

export interface TaskLifecycleRequest {
  actor?: string;
  notes?: string;
  verificationResult?: 'CONFIRMED' | 'NOT_CONFIRMED' | 'UNCERTAIN';
}

export interface ExecuteDemoScenarioRequest {
  scenarioId: 'A' | 'B' | 'C' | 'D' | 'E';
}

export interface DemoScenarioExecutionResponse {
  scenarioId: string;
  name: string;
  description: string;
  evidenceScore: number;
  evidenceBand: string;
  incidentType: string;
  severityLevel: string;
  recommendationsCount: number;
  tasksCount: number;
  fhirTasksCount: number;
  recommendations: Recommendation[];
  tasks: Task[];
}

export interface ResilienceOverviewResponse {
  scorecards: ReachResilienceScorecard[];
  activeEarlyWarnings: EarlyWarning[];
  summary: {
    totalMonitoredReaches: number;
    highRiskReachesCount: number;
    activeEarlyWarningsCount: number;
    systemEnvironmentalStability: 'HIGH' | 'MODERATE' | 'VOLATILE' | 'DETERIORATING';
  };
}

export interface ReachAnalyticsResponse {
  reach: StreamReach;
  scorecard: ReachResilienceScorecard;
  coverage: MonitoringCoverageBreakdown;
  stats: TimeSeriesStats;
  latestForecast?: ForecastResult;
  activeEarlyWarnings: EarlyWarning[];
}

export interface GenerateForecastRequest {
  indicator?: string;
  horizonHours?: ForecastHorizonHours;
  modelId?: string;
  originTimestamp?: string; // T for historical holdout / backtesting
}

export interface RunScenarioRequest {
  type: ScenarioSimulation['type'];
  name?: string;
  description?: string;
  parameters?: ScenarioParameters;
  horizonHours?: ForecastHorizonHours;
  originTimestamp?: string;
}

export interface CompareScenariosRequest {
  scenarios: Array<{
    type: ScenarioSimulation['type'];
    name?: string;
    parameters?: ScenarioParameters;
  }>;
  horizonHours?: ForecastHorizonHours;
}

export interface ModelEvaluationListResponse {
  metrics: ModelEvaluationMetric[];
  evaluatedModelsCount: number;
  summary: string;
}

export interface TriggerBacktestRequest {
  modelIds?: string[];
  reachId?: string;
  horizons?: ForecastHorizonHours[];
  stepHours?: number;
}

export interface TriggerBacktestResponse {
  metrics: ModelEvaluationMetric[];
  evaluationTimestamp: string;
  summary: string;
}

export interface AnalyticalProvenanceResponse {
  provenance: AnalyticalProvenance;
}



