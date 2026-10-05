/**
 * Analytical & Resilience Intelligence Domain Types for AquaSentinel
 * Conforms to Phase 6 PRD Sections 4–24, 38–40, 43
 *
 * CRITICAL SCIENTIFIC PRINCIPLES:
 * - Proxy indicators (e.g. NDCI), not confirmed pathogens or health diagnoses.
 * - Explicit categorical labels: OBSERVED, INFERRED, PROJECTED, SIMULATED.
 * - No data leakage at forecast origin timestamp T.
 * - Deterministic, reproducible, uncertainty-aware projections.
 */

import { ObservationIndicator, ObservationSource } from './domain.js';

export type TrendClassification =
  | 'STABLE'
  | 'INCREASING'
  | 'DECREASING'
  | 'ACCELERATING'
  | 'DECELERATING'
  | 'VOLATILE'
  | 'INSUFFICIENT_DATA';

export type ForecastHorizonHours = 24 | 48 | 72 | 168;

export type ForecastUncertainty =
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'EXTREME'
  | 'INSUFFICIENT';

export type ForecastConfidenceBand =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INSUFFICIENT';

export interface TimeSeriesPoint {
  observationId: string;
  timestamp: string;
  value: number;
  source: ObservationSource;
  qualityScore: number;
}

export interface TimeSeriesStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  firstTimestamp: string;
  lastTimestamp: string;
  spanHours: number;
  observationDensityPerWeek: number;
  trendSlopePerDay: number;
  trendClassification: TrendClassification;
  acceleration: number;
  baselineDeviation?: {
    baselineValue: number;
    absoluteDiff: number;
    percentageDiff: number;
    status: 'NORMAL' | 'ELEVATED' | 'SUPPRESSED';
  };
}

export interface DataQualityGateResult {
  passed: boolean;
  confidenceBand: ForecastConfidenceBand;
  reasons: string[];
  metrics: {
    observationCount: number;
    observationDensityPerWeek: number;
    maxGapHours: number;
    recencyHours: number;
    contradictionPenalty: number;
    qualityScoreAvg: number;
  };
}

export interface ProjectionPoint {
  targetTimestamp: string;
  stepHours: number;
  projectedValue: number;
  lowerBound: number;
  upperBound: number;
  confidenceInterval: number; // e.g. 0.95
}

export interface ForecastResult {
  id: string;
  reachId: string;
  reachName: string;
  indicator: ObservationIndicator;
  originTimestamp: string; // T: only data <= T was used
  horizonHours: number;
  currentValue: number;
  historicalBaseline?: number;
  baselineDeviationPercent?: number;
  projections: ProjectionPoint[];
  trend: TrendClassification;
  trendSlopePerDay: number;
  uncertainty: ForecastUncertainty;
  confidence: ForecastConfidenceBand;
  modelId: string;
  modelVersion: string;
  modelName: string;
  trainingWindow: {
    start: string;
    end: string;
    observationCount: number;
  };
  inputObservationIds: string[];
  generatedTimestamp: string;
  explanation: string;
  labels: Array<'PROJECTED' | 'UNCERTAIN' | 'INSUFFICIENT_DATA' | 'BASELINE_PROJECTION'>;
  isSufficientData: boolean;
  dataQualityReasons?: string[];
}

export type EarlyWarningLevel = 'WATCH' | 'ADVISORY' | 'WARNING';

export interface EarlyWarning {
  id: string;
  streamReachId: string;
  reachName: string;
  indicator: ObservationIndicator;
  warningLevel: EarlyWarningLevel;
  triggerReason: string;
  contributingFactors: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedAction: string;
  timestamp: string;
  incidentId?: string;
  evidenceAssessmentId?: string;
  labels: Array<'EARLY_WARNING' | 'MULTI_SIGNAL' | 'INFERRED'>;
}

export type ScenarioType =
  | 'CURRENT_CONTINUES'
  | 'ACCELERATED_DETERIORATION'
  | 'ATTENUATION'
  | 'WEATHER_EVENT'
  | 'OPERATIONAL_INTERVENTION';

export interface ScenarioParameters {
  accelerationMultiplier?: number; // e.g. 1.5x
  attenuationRatePerDay?: number; // e.g. 0.05/day
  rainfallIntensityMm?: number; // e.g. 35mm
  runoffCoefficient?: number; // 0.0 to 1.0
  interventionEfficacyPercent?: number; // 10% to 70%
  interventionLagHours?: number; // hours before effect manifests
  approvedTaskId?: string;
  approvedRecommendationId?: string;
}

export interface ScenarioSimulation {
  scenarioId: string;
  name: string;
  type: ScenarioType;
  description: string;
  streamReachId: string;
  reachName: string;
  indicator: ObservationIndicator;
  originTimestamp: string;
  horizonHours: number;
  baselineForecastId: string;
  changedParameters: ScenarioParameters;
  assumptions: string[];
  projections: ProjectionPoint[];
  uncertainty: ForecastUncertainty;
  confidence: ForecastConfidenceBand;
  modelVersion: string;
  generatedTimestamp: string;
  isHypothetical: true;
  labels: Array<'SIMULATED' | 'HYPOTHETICAL' | 'MODELLED_EFFECT'>;
}

export interface ScenarioComparisonPoint {
  stepHours: number;
  targetTimestamp: string;
  baselineValue: number;
  scenarioValues: Record<string, number>;
  deltas: Record<string, { absolute: number; percent: number }>;
}

export interface ScenarioComparison {
  reachId: string;
  reachName: string;
  indicator: ObservationIndicator;
  horizonHours: number;
  baselineForecast: ForecastResult;
  scenarios: ScenarioSimulation[];
  comparisonPoints: ScenarioComparisonPoint[];
  summary: string;
  operationalImplications: string[];
}

export type EnvironmentalStabilityRating = 'STABLE' | 'MODERATE' | 'VOLATILE' | 'DETERIORATING';
export type CoverageRating = 'HIGH' | 'MODERATE' | 'LOW' | 'POOR';
export type ResponseReadinessRating = 'HIGH' | 'MODERATE' | 'LOW';

export interface ReachResilienceScorecard {
  reachId: string;
  reachName: string;
  environmentalStability: EnvironmentalStabilityRating;
  evidenceCoverage: 'HIGH' | 'MODERATE' | 'LOW';
  monitoringCoverage: CoverageRating;
  activeIncidentCount: number;
  maxActiveIncidentSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  responseReadiness: ResponseReadinessRating;
  currentTrend: TrendClassification;
  latestNdci?: number;
  baselineNdci?: number;
  activeEarlyWarningsCount: number;
  lastAssessedTimestamp: string;
}

export interface SourceCoverageDetail {
  count: number;
  lastTimestamp?: string;
  status: 'HIGH' | 'MODERATE' | 'LOW' | 'NONE';
}

export interface MonitoringCoverageBreakdown {
  reachId: string;
  reachName: string;
  overallRating: CoverageRating;
  observationCount30Days: number;
  observationCount7Days: number;
  observationFrequencyPerWeek: number;
  daysSinceLastObservation: number;
  lastObservationTimestamp?: string;
  sourceBreakdown: {
    satellite: SourceCoverageDetail;
    citizen: SourceCoverageDetail;
    weather: SourceCoverageDetail;
    sensor: SourceCoverageDetail;
  };
}

export interface ModelEvaluationMetric {
  id: string;
  modelId: string;
  modelName: string;
  modelVersion: string;
  horizonHours: number;
  sampleSize: number;
  mae: number;
  rmse: number;
  mape?: number;
  directionalAccuracy: number; // percentage (0-100)
  evaluationPeriod: {
    start: string;
    end: string;
  };
  baselineModelComparison?: {
    baselineModelId: string;
    baselineMae: number;
    baselineRmse: number;
    improvementPercentMae: number;
  };
  evaluatedAt: string;
}

export interface AnalyticalProvenance {
  targetId: string;
  targetType: 'FORECAST' | 'SCENARIO';
  modelId: string;
  modelVersion: string;
  parameters: Record<string, any>;
  trainingWindow: {
    start: string;
    end: string;
    observationCount: number;
  };
  inputObservations: Array<{
    id: string;
    timestamp: string;
    value: number;
    source: ObservationSource;
  }>;
  baselineUsed?: {
    typicalValue: number;
    source: string;
  };
  evidenceAssessmentId?: string;
  generatedAt: string;
}
