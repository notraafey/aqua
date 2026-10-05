import { z } from 'zod';
import {
  InteroperabilityEventType,
  OutboxDeliveryStatus,
  OutboxEvent,
  FhirSubscription,
} from './events.js';

export interface InteroperabilityFilter {
  status?: OutboxDeliveryStatus;
  eventType?: InteroperabilityEventType;
  correlationId?: string;
  resourceType?: string;
  destination?: string;
  limit?: number;
  offset?: number;
  since?: string;
}

export interface InteroperabilityOverviewResponse {
  fhir: {
    healthy: boolean;
    endpoint: string;
    isMock: boolean;
    version: string;
    error?: string;
  };
  outbox: {
    pending: number;
    delivering: number;
    delivered: number;
    retrying: number;
    deadLetter: number;
    total: number;
  };
  consumer: {
    healthy: boolean;
    endpoint: string;
    consumerId: string;
    lastSeen?: string;
    error?: string;
  };
  subscriptions: {
    total: number;
    active: number;
    list: FhirSubscription[];
  };
  recentEvents: OutboxEvent[];
  recentDeadLetter: OutboxEvent[];
}

export interface RetryEventRequest {
  force?: boolean;
}

export interface ReplayDeadLetterRequest {
  replayedBy?: string;
  reason?: string;
}

export interface AcknowledgeWebhookRequest {
  acknowledgement: {
    acknowledgementId: string;
    eventId: string;
    receivedAt: string;
    consumerId: string;
    status: 'ACCEPTED' | 'DUPLICATE' | 'REJECTED';
    details?: string;
    processedResourceType?: string;
    processedResourceId?: string;
  };
}

export interface RegisterSubscriptionRequest {
  reason: string;
  criteria: string;
  endpoint: string;
  payload?: string;
}

// Zod validation schemas for runtime contract verification
export const EventProvenanceSchema = z.object({
  provenanceId: z.string().uuid(),
  sourceEntityId: z.string(),
  sourceEntityType: z.string(),
  originatingSource: z.string(),
  processingPipeline: z.string(),
  scientificDisclaimer: z.string(),
  timestamp: z.string(),
});

export const InteroperabilityEventTypeSchema = z.enum([
  'ObservationCreated',
  'EvidenceAssessmentUpdated',
  'IncidentCreated',
  'IncidentSeverityChanged',
  'RecommendationApproved',
  'TaskCreated',
  'TaskCompleted',
  'EarlyWarningCreated',
  'ForecastUpdated',
  'ScenarioCompleted',
]);

export const InteroperabilityEventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: InteroperabilityEventTypeSchema,
  eventVersion: z.string(),
  occurredAt: z.string(),
  producer: z.string(),
  subject: z.string(),
  resource: z.record(z.any()),
  resourceType: z.string(),
  resourceId: z.string(),
  correlationId: z.string(),
  causationId: z.string(),
  provenance: EventProvenanceSchema,
  severity: z.string().optional(),
  qualificationReason: z.string().optional(),
  replayedFromEventId: z.string().optional(),
  replayedAt: z.string().optional(),
  replayCount: z.number().optional(),
});

export const InteroperabilityAcknowledgementSchema = z.object({
  acknowledgementId: z.string().uuid(),
  eventId: z.string().uuid(),
  receivedAt: z.string(),
  consumerId: z.string(),
  status: z.enum(['ACCEPTED', 'DUPLICATE', 'REJECTED']),
  details: z.string().optional(),
  processedResourceType: z.string().optional(),
  processedResourceId: z.string().optional(),
});
