/**
 * AquaSentinel Canonical Domain Types
 * Based on Main PRD Sections 10 & 17
 */

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude] per GeoJSON RFC 7946
}

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export type GeoJsonGeometry = GeoJsonPoint | GeoJsonLineString | GeoJsonPolygon;

export type MonitoringStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface StreamReach {
  id: string; // UUIDv4
  name: string;
  geometry: GeoJsonGeometry;
  city: string;
  region: string;
  monitoringStatus: MonitoringStatus;
  waterCoverageConstraint?: {
    minWidthMeters: number;
    confidencePenalty: number;
  };
  baselineData?: {
    typicalNdci?: number;
    typicalTurbidity?: number;
    typicalTempC?: number;
    lastUpdated?: string;
  };
  createdAt: string; // ISO-8601 UTC
  updatedAt: string; // ISO-8601 UTC
}

export type ObservationSource =
  | 'SATELLITE_SENTINEL2'
  | 'CITIZEN_REPORT'
  | 'WEATHER_STATION'
  | 'IN_SITU_SENSOR'
  | 'HISTORICAL_BASELINE'
  | 'FIELD_INSPECTION';

export type ObservationIndicator =
  | 'NDCI'
  | 'TURBIDITY'
  | 'CHLOROPHYLL_A'
  | 'DISSOLVED_OXYGEN'
  | 'WATER_TEMP'
  | 'PH'
  | 'WATER_COLOR'
  | 'ODOR'
  | 'DEAD_FISH'
  | 'FOAM'
  | 'PRECIPITATION'
  | 'AIR_TEMP'
  | 'CLOUD_COVER'
  | 'RELATIVE_HUMIDITY'
  | 'WIND_SPEED';

export type QualityStatus =
  | 'RAW'
  | 'VALIDATED'
  | 'FLAGGED'
  | 'SUSPICIOUS'
  | 'REJECTED';

export interface ProvenanceRecord {
  id: string; // UUIDv4
  entityId: string;
  entityType: 'OBSERVATION' | 'EVIDENCE_ITEM' | 'INCIDENT' | 'ASSESSMENT' | 'TASK' | 'VERIFICATION' | 'RECOMMENDATION';
  source: ObservationSource | string;
  sourceIdentifier: string; // External raw id (e.g. Sentinel-2 L2A tile ID, citizen record ID)
  acquisitionTimestamp: string; // Time signal was captured in real world (ISO-8601 UTC)
  ingestionTimestamp: string; // Time system ingested the signal (ISO-8601 UTC)
  processingTimestamp: string; // Time normalized/derived (ISO-8601 UTC)
  processingMethod: string; // Algorithm or ingestion pipeline used
  qualityStatus: QualityStatus;
  metadata?: Record<string, unknown>;
}

export interface Observation {
  id: string; // UUIDv4
  source: ObservationSource;
  timestamp: string; // Observation capture time (ISO-8601 UTC)
  location: GeoJsonPoint;
  streamReachId: string | null; // Nullable if unmatched to a monitored stream reach
  indicator: ObservationIndicator | string;
  value: number | string;
  unit: string;
  quality: QualityStatus;
  provenance: ProvenanceRecord;
  deduplicationHash?: string;
  metadata?: Record<string, unknown>;
  createdAt: string; // Ingestion time in DB (ISO-8601 UTC)
}

export interface ObservationFilter {
  streamReachId?: string | null;
  source?: ObservationSource | string;
  indicator?: ObservationIndicator | string;
  quality?: QualityStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export type EvidenceRelevance = 'HIGH' | 'MEDIUM' | 'LOW';
export type EvidenceContribution = 'SUPPORTING' | 'CONTRADICTING' | 'NEUTRAL';
export type CorroborationGroup =
  | 'REMOTE_SENSING'
  | 'CITIZEN'
  | 'WEATHER'
  | 'HISTORICAL_BASELINE'
  | 'IN_SITU';

export interface EvidenceItem {
  id: string; // UUIDv4
  assessmentId?: string | null;
  incidentId?: string | null;
  source: ObservationSource;
  observationId: string;
  indicator?: ObservationIndicator | string;
  value?: number | string;
  unit?: string;
  timestamp?: string;
  corroborationGroup?: CorroborationGroup;
  relevance: EvidenceRelevance;
  spatialMatch: {
    isMatch: boolean;
    distanceMeters: number;
  };
  temporalMatch: {
    isMatch: boolean;
    deltaMinutes: number;
  };
  qualityScore: number; // 0.0 to 1.0
  qualityFlags?: string[];
  contribution: EvidenceContribution;
  scoreDelta?: number;
  reason?: string;
  rule?: string;
  provenance: ProvenanceRecord;
  createdAt: string; // ISO-8601 UTC
}

export type IncidentStatus =
  | 'DETECTED'
  | 'CORROBORATED'
  | 'ASSESSED'
  | 'ACTION_RECOMMENDED'
  | 'PENDING_APPROVAL'
  | 'ACTION_APPROVED'
  | 'ACTION_IN_PROGRESS'
  | 'FIELD_VERIFICATION_PENDING'
  | 'RESOLVED'
  | 'DISMISSED';

export type HazardType =
  | 'ALGAL_BLOOM'
  | 'CHEMICAL_SPILL'
  | 'SEWAGE_OVERFLOW'
  | 'EUTROPHICATION'
  | 'UNKNOWN';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'CONFIRMED' | 'NOT_CONFIRMED' | 'UNCERTAIN';

export interface Incident {
  id: string; // UUIDv4
  streamReachId: string;
  createdAt: string; // ISO-8601 UTC
  updatedAt: string; // ISO-8601 UTC
  status: IncidentStatus;
  hazardType: HazardType;
  evidenceConfidence: number; // 0 to 100
  severity: SeverityLevel;
  verificationStatus: VerificationStatus;
  resolution?: string;
}

export type EvidenceConfidenceBand =
  | 'NORMAL'
  | 'VERIFY'
  | 'INVESTIGATE'
  | 'PRIORITIZE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'; // backward compatibility

export type BaselineStatus = 'AVAILABLE' | 'INSUFFICIENT' | 'UNAVAILABLE';

export interface BaselineDeviation {
  expected: number;
  actual: number;
  deviation: number;
  standardDeviations?: number;
  sampleCount?: number;
  baselinePeriod?: string;
  isAnomalous?: boolean;
  deviationMagnitude?: number;
}

export interface ScoreBreakdown {
  anomalyContribution: number;
  baselineContribution: number;
  corroborationContribution: number;
  spatialContribution: number;
  temporalContribution: number;
  contextContribution: number;
  qualityPenalty: number;
  contradictionPenalty: number;
}

export interface AssessmentRationale {
  summary: string;
  whatChanged: string;
  whatCorroborates: string;
  whatWeakens: string;
  whatIsMissing: string;
}

export interface EvidenceAssessment {
  id: string; // UUIDv4
  streamReachId: string;
  candidateId?: string | null;
  incidentId?: string | null;
  score: number; // 0 to 100 bounded
  confidenceBand: EvidenceConfidenceBand;
  scoringVersion: string; // e.g. 'v1.0'
  baselineStatus: BaselineStatus;
  baselineDeviation?: BaselineDeviation;
  scoreBreakdown: ScoreBreakdown;
  independentSourceGroups: CorroborationGroup[];
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  supportingEvidence: EvidenceItem[];
  contradictingEvidence: EvidenceItem[];
  missingEvidence: string[];
  rationale: AssessmentRationale;
  createdAt: string; // ISO-8601 UTC
  updatedAt: string; // ISO-8601 UTC
}

export interface EvidenceAssessmentFilter {
  streamReachId?: string;
  confidenceBand?: EvidenceConfidenceBand;
  minScore?: number;
  maxScore?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export type IncidentClassificationType =
  | 'POSSIBLE_EUTROPHICATION'
  | 'POSSIBLE_CYANOBLOOM'
  | 'POSSIBLE_SEWAGE_CONTAMINATION'
  | 'POSSIBLE_INDUSTRIAL_DISCHARGE'
  | 'POSSIBLE_STORMWATER_EVENT'
  | 'UNKNOWN_WATER_QUALITY_ANOMALY';

export interface IncidentClassification {
  type: IncidentClassificationType;
  confidenceBand: EvidenceConfidenceBand;
  confidence?: number;
  primaryIndicators?: string[];
  stressorEvidence?: string[];
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  missingEvidence: string[];
  rationale: string;
  classifiedAt?: string;
}

export type OperationalSeverityLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface SeverityFactor {
  factor: string;
  weight: number;
  score: number;
  description: string;
}

export interface OperationalSeverityFactorsRecord {
  confidenceFactor?: number;
  hazardProfile?: number;
  exposurePotential?: number;
  publicVisibility?: number;
  ecologicalImpact?: number;
  [key: string]: any;
}

export type OperationalSeverityFactors = SeverityFactor[] & OperationalSeverityFactorsRecord;

export interface OperationalSeverity {
  level: OperationalSeverityLevel;
  score: number; // 0-100
  factors: OperationalSeverityFactors | SeverityFactor[] | any;
  explanations?: string[];
  calculatedAt: string;
}

export type CatalogueMeasureType =
  | 'NATURE_BASED_SOLUTION'
  | 'SOURCE_CONTROL'
  | 'MONITORING'
  | 'PUBLIC_ADVISORY'
  | 'OPERATIONAL_DISPATCH'
  | 'FIELD_INVESTIGATION';

export type ResponsibleRole =
  | 'ENVIRONMENTAL_INSPECTOR'
  | 'WATER_QUALITY_ANALYST'
  | 'MUNICIPAL_OPERATOR'
  | 'PUBLIC_HEALTH_OFFICER'
  | 'RIVER_BASIN_MANAGER';

export type ProvenanceStatus =
  | 'OFFICIAL_OAH_MEASURE'
  | 'AQUASENTINEL_DERIVED_OPERATIONAL_TASK';

export interface MeasureSpatialRequirements {
  maxReachWidthMeters?: number;
  minReachWidthMeters?: number;
  urbanOnly?: boolean;
  ruralOnly?: boolean;
  notes?: string;
}

export interface MeasureTemporalRequirements {
  maxActionDelayHours: number;
  seasonality?: string[];
}

export interface CatalogueMeasure {
  measureId: string;
  title: string;
  description: string;
  measureType: CatalogueMeasureType;
  applicableIncidentTypes: IncidentClassificationType[];
  applicableStressors: string[];
  applicableIndicators: ObservationIndicator[];
  minimumEvidenceBand: EvidenceConfidenceBand;
  requiredVerification: string[];
  spatialRequirements?: MeasureSpatialRequirements;
  temporalRequirements?: MeasureTemporalRequirements;
  implementationComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedTimeToInitiate: string;
  responsibleStakeholder: string;
  responsibleRole: ResponsibleRole;
  contraindications: string[];
  prerequisites: string[];
  sourceReference: string;
  provenance: {
    sourceName: string;
    sourceDocument: string;
    sourceSection?: string;
    catalogueIdentifier: string;
    ingestionDate: string;
    version: string;
    provenanceStatus: ProvenanceStatus;
  };
  humanApprovalRequired: boolean;
}

export type ActionType =
  | 'FIELD_VERIFY'
  | 'COLLECT_WATER_SAMPLE'
  | 'REVIEW_SENSOR_DATA'
  | 'REQUEST_CITIZEN_VALIDATION'
  | 'INSPECT_UPSTREAM_SOURCE'
  | 'MONITOR_REACH'
  | 'ISSUE_INTERNAL_ADVISORY_DRAFT'
  | 'PREPARE_REMEDIATION_PLAN'
  | 'REVIEW_NATURE_BASED_SOLUTION'
  | 'ESCALATE_TO_AUTHORITY'
  | 'FIELD_INSPECTION'
  | 'PRECAUTIONARY_ADVISORY'
  | 'WATER_SAMPLING'
  | 'BARRIER_DEPLOYMENT'
  | 'SOURCE_INVESTIGATION'
  | 'PUBLIC_WARNING';

export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type RecommendationStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'EXECUTED'
  | 'VERIFIED'
  | 'PROPOSED';

export interface RecommendationSuitabilityBreakdown {
  evidenceCompatibility: number;
  incidentCompatibility: number;
  siteCompatibility: number;
  temporalCompatibility: number;
  verificationReadiness: number;
  operationalFeasibility: number;
  contraindicationPenalty: number;
}

export interface RecommendationRationale {
  whyThis: string;
  whyNow: string;
  whatSupportsIt: string[];
  whatWeakensIt: string[];
  whatIsMissing: string[];
}

export interface Recommendation {
  id: string; // UUIDv4
  incidentId: string;
  assessmentId?: string;
  measureId: string;
  actionType: ActionType;
  title: string;
  description: string;
  rank: number;
  suitabilityScore: number; // 0-100
  scoreBreakdown: RecommendationSuitabilityBreakdown;
  rationaleDetails: RecommendationRationale;
  rationale: string;
  sourceRule?: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  missingPrerequisites: string[];
  contraindications: string[];
  requiredVerification: string[];
  responsibleRole: ResponsibleRole | string;
  requiresApproval: boolean;
  humanApprovalRequired: boolean;
  status: RecommendationStatus;
  priority: RecommendationPriority;
  rejectionReason?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  idempotencyKey: string;
  generatedTaskId?: string;
  provenance: ProvenanceRecord;
  createdAt: string; // ISO-8601 UTC
  updatedAt: string; // ISO-8601 UTC
}

export interface RecommendationFilter {
  incidentId?: string;
  assessmentId?: string;
  status?: RecommendationStatus;
  measureId?: string;
  limit?: number;
}

export type TaskStatus =
  | 'DRAFT'
  | 'APPROVED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'AWAITING_VERIFICATION'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REQUESTED';

export interface FieldActor {
  actorId: string;
  name: string;
  organization: string;
  role: 'FIELD_INSPECTOR' | 'MUNICIPAL_OFFICER' | 'ENVIRONMENTAL_SPECIALIST' | string;
  contact?: string;
  active: boolean;
}

export interface Task {
  id: string; // UUIDv4
  taskId?: string; // Phase 8 alias
  incidentId: string;
  recommendationId?: string;
  assessmentId?: string;
  taskType?: ActionType;
  title: string;
  description?: string;
  assignedRole?: ResponsibleRole | string;
  assignedTo: string;
  assignedOrganization?: string;
  assignedActorId?: string;
  location: GeoJsonPoint;
  priority: RecommendationPriority;
  instructions: string;
  requiredEvidence?: string[];
  completionRequirements?: string;
  status: TaskStatus;
  verificationStatus?: VerificationStatus;
  fhirTaskId?: string;
  fhirTaskIdentifier?: string;
  provenance?: ProvenanceRecord;
  createdAt: string; // ISO-8601 UTC
  dueAt?: string;
  startedAt?: string;
  acceptedAt?: string;
  inProgressAt?: string;
  completedAt?: string; // ISO-8601 UTC
  verifiedAt?: string;
  notes?: string;
}

export interface TaskFilter {
  incidentId?: string;
  recommendationId?: string;
  status?: TaskStatus;
  assignedTo?: string;
  assignedOrganization?: string;
  assignedActorId?: string;
  limit?: number;
}

export interface TaskAuditEvent {
  id: string; // UUIDv4
  taskId?: string;
  recommendationId?: string;
  incidentId?: string;
  eventType: string;
  timestamp: string; // ISO-8601 UTC
  actor: string;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export type VerificationResult = 'CONFIRMED' | 'NOT_CONFIRMED' | 'UNCERTAIN';
export type VerificationStatusType = 'CONFIRMED' | 'NOT_CONFIRMED' | 'UNCERTAIN' | 'PARTIALLY_CONFIRMED' | 'REQUIRES_FOLLOW_UP';

export interface PhotoEvidence {
  evidenceId: string;
  verificationId: string;
  timestamp: string; // ISO-8601 UTC
  location?: GeoJsonPoint;
  filename: string;
  mediaType: string; // e.g. 'image/jpeg'
  description?: string;
  source: string;
  provenance?: ProvenanceRecord;
  dataUrl?: string;
  storagePath?: string;
}

export type LaboratoryResultStatus = 'PENDING' | 'AVAILABLE' | 'NOT_AVAILABLE';

export interface SampleEvidence {
  sampleId: string;
  verificationId: string;
  sampleType: 'SURFACE_WATER' | 'SEDIMENT' | 'BENTHIC' | 'EFFLUENT' | string;
  collectionTime: string; // ISO-8601 UTC
  collectionLocation: GeoJsonPoint;
  collector: string;
  containerReferenceId: string;
  laboratoryStatus: LaboratoryResultStatus;
  result?: number | string;
  parameter?: string;
  unit?: string;
  method?: string;
  laboratorySource?: string;
  notes?: string;
}

export interface StructuredFieldObservations {
  waterColour?: 'CLEAR' | 'GREEN_TINT' | 'DENSE_GREEN' | 'BROWN' | 'MILKY' | 'RUST' | string;
  surfaceAppearance?: 'CLEAR' | 'SCUM' | 'FOAM' | 'SHEEN' | 'ALGAL_MAT' | string;
  odour?: 'NONE' | 'EARTHY' | 'FISHY' | 'SEPTIC' | 'CHEMICAL' | 'ROTTEN' | string;
  foam?: boolean;
  visibleAlgae?: boolean;
  deadFish?: number | boolean;
  debris?: 'NONE' | 'LIGHT' | 'MODERATE' | 'HEAVY' | string;
  flowConditions?: 'STAGNANT' | 'LOW' | 'NORMAL' | 'TORRENTIAL' | string;
  weatherConditions?: 'SUNNY' | 'OVERCAST' | 'RAIN' | 'POST_STORM' | string;
  humanActivity?: string;
  visiblePollutionSource?: string;
  inSituProbeTurbidityNtu?: number;
  inSituProbeDoMgL?: number;
  inSituProbePh?: number;
  inSituProbeTempC?: number;
}

export type LocationValidationStatus = 'AT_LOCATION' | 'NEAR_LOCATION' | 'OUTSIDE_EXPECTED_AREA' | 'UNKNOWN';

export interface VerificationLocation {
  type: 'Point';
  coordinates: [number, number]; // [lon, lat]
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  timestamp?: string;
  validationStatus?: LocationValidationStatus;
  distanceMeters?: number;
  isWithinGeofence?: boolean;
}

export type VerificationSyncStatus = 'LOCAL_ONLY' | 'PENDING_SYNC' | 'SYNCING' | 'SYNCED' | 'SYNC_FAILED';
export type VerificationConflictStatus = 'NONE' | 'DUPLICATE_IGNORED' | 'CONFLICT_DETECTED';

export interface Verification {
  id: string; // UUIDv4
  verificationId?: string; // Phase 8 alias
  taskId: string;
  incidentId: string;
  observer?: string; // Backward compatibility
  inspector: FieldActor | { name: string; organization?: string; role?: string; contact?: string; actorId?: string };
  timestamp: string; // ISO-8601 UTC
  location: VerificationLocation | GeoJsonPoint;
  status: VerificationStatusType;
  result?: VerificationResult; // Backward compatibility alias
  observations: StructuredFieldObservations;
  notes: string;
  evidence: {
    photos: PhotoEvidence[];
    samples: SampleEvidence[];
  };
  photos?: string[]; // Backward compatibility alias
  sampleCollected?: boolean; // Backward compatibility alias
  assessment?: string;
  submittedAt?: string;
  syncStatus?: VerificationSyncStatus;
  conflictStatus?: VerificationConflictStatus;
  clientSubmissionId?: string; // Unique client UUID for deduplication
  createdAt: string; // ISO-8601 UTC
  updatedAt?: string;
}

export interface VerificationFilter {
  taskId?: string;
  incidentId?: string;
  status?: VerificationStatusType;
  inspectorId?: string;
  limit?: number;
}

export type OperationalOutcomeType =
  | 'CONFIRMED'
  | 'NOT_CONFIRMED'
  | 'UNCERTAIN'
  | 'RESOLVED'
  | 'ESCALATE'
  | 'ADDITIONAL_VERIFICATION_REQUIRED';

export interface IncidentOutcome {
  id: string; // UUIDv4
  incidentId: string;
  verificationId?: string;
  proposedOutcome: OperationalOutcomeType;
  confirmedOutcome?: OperationalOutcomeType;
  reason: string;
  supportingEvidence: EvidenceItem[] | string[];
  confidence: number; // 0 - 100
  determinedAt: string; // ISO-8601 UTC
  determinedBy: string; // e.g. 'system:outcome_engine_v1'
  confirmedAt?: string;
  confirmedBy?: string; // e.g. 'Human Supervisor'
  ruleVersion: string; // 'OUTCOME_RULE_V1'
  notes?: string;
}

export type IncidentEventType =
  | 'INCIDENT_CREATED'
  | 'EVIDENCE_ADDED'
  | 'SCORE_UPDATED'
  | 'STATE_CHANGED'
  | 'RECOMMENDATION_CREATED'
  | 'RECOMMENDATION_GENERATED'
  | 'RECOMMENDATION_APPROVED'
  | 'RECOMMENDATION_REJECTED'
  | 'RECOMMENDATION_MORE_EVIDENCE_REQUESTED'
  | 'TASK_CREATED'
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS_UPDATED'
  | 'TASK_COMPLETED'
  | 'VERIFICATION_RECEIVED'
  | 'VERIFICATION_COMPLETED'
  | 'INCIDENT_REASSESSED'
  | 'OUTCOME_PROPOSED'
  | 'OUTCOME_CONFIRMED'
  | 'INCIDENT_CONFIRMED'
  | 'INCIDENT_NOT_CONFIRMED'
  | 'INCIDENT_ESCALATED'
  | 'INCIDENT_RESOLVED'
  | 'ADDITIONAL_VERIFICATION_REQUESTED';

export interface IncidentEvent {
  id: string; // UUIDv4
  incidentId: string;
  eventType: IncidentEventType;
  timestamp: string; // ISO-8601 UTC
  actor: string;
  metadata: Record<string, unknown>;
}
