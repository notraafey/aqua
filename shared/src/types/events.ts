/**
 * AquaSentinel Internal Event Architecture Types
 * Based on Main PRD Section 16.3 and Phase 1 PRD Section 24
 */

import { Observation, EvidenceItem, EvidenceAssessment, Incident, Recommendation, Task, Verification, IncidentEventType } from './domain.js';
import { ForecastResult, EarlyWarning, ScenarioSimulation } from './analytics.js';

export interface BaseDomainEvent<T = Record<string, unknown>> {
  eventId: string; // UUIDv4
  eventType: string;
  timestamp: string; // ISO-8601 UTC
  correlationId?: string;
  actor: string;
  payload: T;
}

export interface ObservationReceivedEvent extends BaseDomainEvent<{ observation: Observation }> {
  eventType: 'ObservationReceived';
}

export interface EvidenceUpdatedPayload {
  assessment: EvidenceAssessment;
  streamReachId: string;
  triggerObservationId?: string;
  evidenceItem?: EvidenceItem;
  incidentId?: string;
}

export interface EvidenceUpdatedEvent extends BaseDomainEvent<EvidenceUpdatedPayload> {
  eventType: 'EvidenceUpdated';
}

export interface IncidentCreatedEvent extends BaseDomainEvent<{ incident: Incident }> {
  eventType: 'IncidentCreated';
}

export interface IncidentStateChangedEvent extends BaseDomainEvent<{
  incidentId: string;
  previousStatus: Incident['status'];
  newStatus: Incident['status'];
  reason?: string;
}> {
  eventType: 'IncidentStateChanged';
}

export interface RecommendationCreatedEvent extends BaseDomainEvent<{ recommendation: Recommendation }> {
  eventType: 'RecommendationCreated';
}

export interface RecommendationGeneratedEvent extends BaseDomainEvent<{
  incidentId: string;
  assessmentId?: string;
  streamReachId: string;
  recommendations: Recommendation[];
}> {
  eventType: 'RecommendationGenerated';
}

export interface RecommendationReviewedEvent extends BaseDomainEvent<{
  recommendationId: string;
  incidentId: string;
  action: 'APPROVED' | 'REJECTED' | 'MORE_EVIDENCE_REQUESTED';
  actor: string;
  notes?: string;
  generatedTaskId?: string;
}> {
  eventType: 'RecommendationReviewed';
}

export interface TaskCreatedEvent extends BaseDomainEvent<{ task: Task }> {
  eventType: 'TaskCreated';
}

export interface TaskStatusUpdatedEvent extends BaseDomainEvent<{
  taskId: string;
  incidentId: string;
  previousStatus: Task['status'];
  newStatus: Task['status'];
  actor: string;
  reason?: string;
  task: Task;
}> {
  eventType: 'TaskStatusUpdated';
}

export interface VerificationSubmittedEvent extends BaseDomainEvent<{ verification: Verification }> {
  eventType: 'VerificationSubmitted';
}

export interface VerificationCompletedEvent extends BaseDomainEvent<{
  verification: Verification;
  task: Task;
  incidentId: string;
  reassessmentTriggered: boolean;
}> {
  eventType: 'VerificationCompleted';
}

export interface IncidentConfirmedEvent extends BaseDomainEvent<{
  incidentId: string;
  verificationId: string;
  confidence: number;
  reason: string;
  actor: string;
}> {
  eventType: 'IncidentConfirmed';
}

export interface IncidentNotConfirmedEvent extends BaseDomainEvent<{
  incidentId: string;
  verificationId: string;
  reason: string;
  actor: string;
}> {
  eventType: 'IncidentNotConfirmed';
}

export interface IncidentEscalatedEvent extends BaseDomainEvent<{
  incidentId: string;
  previousSeverity: string;
  newSeverity: string;
  reason: string;
  actor: string;
}> {
  eventType: 'IncidentEscalated';
}

export interface AdditionalVerificationRequiredEvent extends BaseDomainEvent<{
  incidentId: string;
  verificationId?: string;
  newTaskId?: string;
  reason: string;
  actor: string;
}> {
  eventType: 'AdditionalVerificationRequired';
}

export interface IncidentResolvedEvent extends BaseDomainEvent<{ incidentId: string; resolution: string; actor?: string }> {
  eventType: 'IncidentResolved';
}

export interface ForecastGeneratedEvent extends BaseDomainEvent<{ forecast: ForecastResult }> {
  eventType: 'ForecastGenerated';
}

export interface EarlyWarningTriggeredEvent extends BaseDomainEvent<{ earlyWarning: EarlyWarning }> {
  eventType: 'EarlyWarningTriggered';
}

export interface ScenarioSimulatedEvent extends BaseDomainEvent<{ simulation: ScenarioSimulation }> {
  eventType: 'ScenarioSimulated';
}

export type DomainEvent =
  | ObservationReceivedEvent
  | EvidenceUpdatedEvent
  | IncidentCreatedEvent
  | IncidentStateChangedEvent
  | RecommendationCreatedEvent
  | RecommendationGeneratedEvent
  | RecommendationReviewedEvent
  | TaskCreatedEvent
  | TaskStatusUpdatedEvent
  | VerificationSubmittedEvent
  | VerificationCompletedEvent
  | IncidentConfirmedEvent
  | IncidentNotConfirmedEvent
  | IncidentEscalatedEvent
  | IncidentResolvedEvent
  | AdditionalVerificationRequiredEvent
  | ForecastGeneratedEvent
  | EarlyWarningTriggeredEvent
  | ScenarioSimulatedEvent;

/**
 * Phase 7 & 8: External Interoperability Event Taxonomy
 * Defined in Phase 7 PRD Section 7 & Phase 8 PRD Section 38
 */
export type InteroperabilityEventType =
  | 'ObservationCreated'
  | 'EvidenceAssessmentUpdated'
  | 'IncidentCreated'
  | 'IncidentSeverityChanged'
  | 'RecommendationApproved'
  | 'TaskCreated'
  | 'TaskCompleted'
  | 'VerificationCompleted'
  | 'IncidentConfirmed'
  | 'IncidentNotConfirmed'
  | 'IncidentEscalated'
  | 'IncidentResolved'
  | 'AdditionalVerificationRequired'
  | 'EarlyWarningCreated'
  | 'ForecastUpdated'
  | 'ScenarioCompleted';

export interface EventProvenance {
  provenanceId: string;
  sourceEntityId: string;
  sourceEntityType: string;
  originatingSource: string;
  processingPipeline: string;
  scientificDisclaimer: string;
  timestamp: string;
}

export interface InteroperabilityEventEnvelope<T = any> {
  eventId: string; // UUIDv4
  eventType: InteroperabilityEventType;
  eventVersion: string; // Semantic version e.g. '1.0.0'
  occurredAt: string; // ISO-8601 UTC
  producer: string; // 'aquasentinel-decision-engine'
  subject: string; // Reference e.g. 'StreamReach/krafsidonas-1'
  resource: T; // FHIR Resource or domain payload
  resourceType: string; // 'Observation' | 'Flag' | 'Task' | 'CommunicationRequest'
  resourceId: string;
  correlationId: string; // Links entire causal chain
  causationId: string; // Direct predecessor trigger ID
  provenance: EventProvenance;
  severity?: string;
  qualificationReason?: string;
  replayedFromEventId?: string;
  replayedAt?: string;
  replayCount?: number;
}

export type OutboxDeliveryStatus =
  | 'PENDING'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETRYING'
  | 'DEAD_LETTER';

export interface OutboxEvent {
  id: string; // Internal outbox database row ID
  eventId: string; // Canonical external event ID
  eventType: InteroperabilityEventType;
  eventVersion: string;
  occurredAt: string;
  producer: string;
  subject: string;
  resourceType: string;
  resourceId: string;
  correlationId: string;
  causationId: string;
  payload: InteroperabilityEventEnvelope;
  destination: string;
  status: OutboxDeliveryStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  lastError?: string;
  deadLetterAt?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  acknowledgementId?: string;
  replayCount?: number;
}

export interface InteroperabilityAcknowledgement {
  acknowledgementId: string;
  eventId: string;
  receivedAt: string;
  consumerId: string;
  status: 'ACCEPTED' | 'DUPLICATE' | 'REJECTED';
  details?: string;
  processedResourceType?: string;
  processedResourceId?: string;
}

export type InteroperabilityAuditStage =
  | 'CREATED'
  | 'QUALIFIED'
  | 'FHIR_MAPPED'
  | 'VALIDATED'
  | 'OUTBOX_QUEUED'
  | 'DELIVERY_ATTEMPT'
  | 'DELIVERED'
  | 'RETRY_SCHEDULED'
  | 'DEAD_LETTERED'
  | 'REPLAYED'
  | 'ACKNOWLEDGED';

export interface InteroperabilityAuditEntry {
  id: string;
  eventId: string;
  stage: InteroperabilityAuditStage;
  status: 'SUCCESS' | 'FAILURE' | 'INFO';
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface FhirSubscription {
  id: string;
  status: 'requested' | 'active' | 'error' | 'off';
  reason: string;
  criteria: string;
  channel: {
    type: 'rest-hook' | 'websocket' | 'email' | 'message';
    endpoint: string;
    payload?: string;
    header?: string[];
  };
  createdAt?: string;
  lastTriggeredAt?: string;
  error?: string;
}


