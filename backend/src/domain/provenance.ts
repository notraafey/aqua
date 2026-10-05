import { ProvenanceRecord, ObservationSource, QualityStatus } from '@aquasentinel/shared';
import { generateId, nowUtc, toUtcIso } from './value-objects.js';

export interface CreateProvenanceParams {
  entityId: string;
  entityType: ProvenanceRecord['entityType'];
  source: ObservationSource | string;
  sourceIdentifier: string;
  acquisitionTimestamp: string | Date;
  processingMethod: string;
  qualityStatus?: QualityStatus;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a fully validated immutable ProvenanceRecord
 */
export function createProvenanceRecord(params: CreateProvenanceParams): ProvenanceRecord {
  const now = nowUtc();
  return {
    id: generateId(),
    entityId: params.entityId,
    entityType: params.entityType,
    source: params.source,
    sourceIdentifier: params.sourceIdentifier,
    acquisitionTimestamp: toUtcIso(params.acquisitionTimestamp),
    ingestionTimestamp: now,
    processingTimestamp: now,
    processingMethod: params.processingMethod,
    qualityStatus: params.qualityStatus || 'VALIDATED',
    metadata: params.metadata || {},
  };
}
