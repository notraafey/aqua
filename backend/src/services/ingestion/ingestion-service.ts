import crypto from 'crypto';
import {
  Observation,
  ObservationSource,
  GeoJsonPoint,
  StreamReach,
  ObservationReceivedEvent,
} from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { streamAssociator } from '../../domain/spatial/stream-associator.js';
import { qualityAssessor } from '../../domain/quality/quality-assessor.js';
import { createProvenanceRecord } from '../../domain/provenance.js';
import { generateId, nowUtc, toUtcIso } from '../../domain/value-objects.js';
import { getEventBus } from '../../events/index.js';
import { getFhirAdapter } from '../../adapters/fhir/index.js';
import { logger } from '../../logging/index.js';
import { ValidationError } from '../../api/middleware/error-handler.js';

export interface IngestObservationParams {
  source: ObservationSource;
  timestamp: string;
  location: GeoJsonPoint;
  streamReachId?: string | null;
  indicator: string;
  value: number | string;
  unit: string;
  sourceIdentifier?: string;
  processingMethod?: string;
  cloudCoverFraction?: number;
  hasPhotos?: boolean;
  metadata?: Record<string, unknown>;
}

export interface IngestionPipelineResult {
  observation: Observation;
  isDuplicate: boolean;
  streamReachMatched: boolean;
  streamReach: StreamReach | null;
}

export class ObservationIngestionService {
  /**
   * Generates a deterministic SHA-256 deduplication key from canonical observation identity fields
   */
  public generateDeduplicationHash(params: {
    source: string;
    sourceIdentifier: string;
    timestamp: string;
    indicator: string;
    streamReachId?: string | null;
  }): string {
    const canonicalKey = [
      params.source.toUpperCase(),
      params.sourceIdentifier.trim(),
      new Date(params.timestamp).toISOString(),
      params.indicator.toUpperCase(),
      params.streamReachId || 'UNASSOCIATED',
    ].join(':');

    return crypto.createHash('sha256').update(canonicalKey).digest('hex');
  }

  /**
   * Executes the full 9-step canonical environmental data ingestion pipeline
   */
  public async ingest(params: IngestObservationParams): Promise<IngestionPipelineResult> {
    const repos = getRepositories();

    // 1. Validation
    streamAssociator.validateCoordinates(params.location);
    const parsedTime = new Date(params.timestamp);
    if (isNaN(parsedTime.getTime())) {
      throw new ValidationError(`Invalid timestamp: ${params.timestamp}. Expected valid ISO-8601 UTC date.`);
    }
    const isoTimestamp = toUtcIso(parsedTime);

    // 2. Geospatial Stream Reach Association
    const allReaches = await repos.streamReaches.findAll();
    const spatialResult = streamAssociator.associate(params.location, allReaches);

    // Resolve final stream reach ID (explicit override or spatial match)
    let finalReachId: string | null = null;
    let matchedReach: StreamReach | null = null;

    if (params.streamReachId) {
      // Caller explicitly provided a streamReachId
      const found = allReaches.find((r) => r.id === params.streamReachId);
      if (found) {
        finalReachId = found.id;
        matchedReach = found;
      } else {
        finalReachId = params.streamReachId;
      }
    } else if (spatialResult.matched && spatialResult.streamReach) {
      finalReachId = spatialResult.streamReachId;
      matchedReach = spatialResult.streamReach;
    }

    // 3. Quality Assessment
    const qualityResult = qualityAssessor.assess({
      source: params.source,
      indicator: params.indicator,
      value: params.value,
      timestamp: isoTimestamp,
      cloudCoverFraction: params.cloudCoverFraction,
      narrowStreamWarning: spatialResult.narrowStreamWarning,
      hasPhotos: params.hasPhotos,
      isAssociated: Boolean(finalReachId),
    });

    if (qualityResult.status === 'REJECTED') {
      logger.warn('[IngestionService] Observation rejected by quality gates', {
        source: params.source,
        indicator: params.indicator,
        reasons: qualityResult.reasons,
      });
    }

    // 4. Source Identifier Resolution & Deduplication Hash
    const sourceIdentifier =
      params.sourceIdentifier || `${params.source.slice(0, 4)}-${isoTimestamp.replace(/[:.-]/g, '')}`;

    const dedupHash = this.generateDeduplicationHash({
      source: params.source,
      sourceIdentifier,
      timestamp: isoTimestamp,
      indicator: params.indicator,
      streamReachId: finalReachId,
    });

    // 5. Deduplication Check (Idempotency)
    const existing = await repos.observations.findByDeduplicationHash(dedupHash);
    if (existing) {
      logger.info('[IngestionService] Duplicate observation detected, returning existing record', {
        existingId: existing.id,
        dedupHash,
        sourceIdentifier,
      });
      return {
        observation: existing,
        isDuplicate: true,
        streamReachMatched: Boolean(finalReachId),
        streamReach: matchedReach,
      };
    }

    // 6. Provenance Attachment
    const obsId = generateId();
    const provenance = createProvenanceRecord({
      entityId: obsId,
      entityType: 'OBSERVATION',
      source: params.source,
      sourceIdentifier,
      acquisitionTimestamp: isoTimestamp,
      processingMethod: params.processingMethod || 'AQUASENTINEL_CANONICAL_INGESTION_V2',
      qualityStatus: qualityResult.status,
      metadata: {
        ...params.metadata,
        qualityScore: qualityResult.score,
        qualityReasons: qualityResult.reasons,
        spatialAssociation: spatialResult.metadata,
        narrowStreamWarning: spatialResult.narrowStreamWarning,
      },
    });

    // 7. Canonical Observation Construction
    const canonicalObservation: Observation = {
      id: obsId,
      source: params.source,
      timestamp: isoTimestamp,
      location: params.location,
      streamReachId: finalReachId,
      indicator: params.indicator,
      value: params.value,
      unit: params.unit,
      quality: qualityResult.status,
      provenance,
      deduplicationHash: dedupHash,
      metadata: {
        ...params.metadata,
        deduplicationHash: dedupHash,
        spatialDistanceMeters: spatialResult.distanceMeters,
        narrowStreamWarning: spatialResult.narrowStreamWarning,
        qualityScore: qualityResult.score,
      },
      createdAt: nowUtc(),
    };

    // 8. Persistence
    const saved = await repos.observations.create(canonicalObservation);

    // 9. Event Emission & FHIR Mirroring
    const eventBus = getEventBus();
    const event: ObservationReceivedEvent = {
      eventId: generateId(),
      eventType: 'ObservationReceived',
      timestamp: nowUtc(),
      actor: `ingestion:${params.source.toLowerCase()}`,
      payload: { observation: saved },
    };
    await eventBus.publish(event);

    const fhirAdapter = getFhirAdapter();
    fhirAdapter.publishObservation(saved).catch((err) => {
      logger.debug('[IngestionService] Non-blocking FHIR export notice', { error: err.message });
    });

    logger.info('[IngestionService] Ingested canonical observation successfully', {
      id: saved.id,
      source: saved.source,
      indicator: saved.indicator,
      streamReachId: saved.streamReachId,
      quality: saved.quality,
    });

    return {
      observation: saved,
      isDuplicate: false,
      streamReachMatched: Boolean(finalReachId),
      streamReach: matchedReach,
    };
  }

  /**
   * Ingest a batch of observations with idempotency reporting
   */
  public async ingestBatch(items: IngestObservationParams[]): Promise<{
    total: number;
    ingested: number;
    duplicates: number;
    observations: Observation[];
  }> {
    let ingested = 0;
    let duplicates = 0;
    const observations: Observation[] = [];

    for (const item of items) {
      try {
        const result = await this.ingest(item);
        if (result.isDuplicate) {
          duplicates++;
        } else {
          ingested++;
        }
        observations.push(result.observation);
      } catch (err: any) {
        logger.warn('[IngestionService] Error in batch item ingestion', {
          error: err.message,
          source: item.source,
        });
      }
    }

    return {
      total: items.length,
      ingested,
      duplicates,
      observations,
    };
  }
}

export const ingestionService = new ObservationIngestionService();
