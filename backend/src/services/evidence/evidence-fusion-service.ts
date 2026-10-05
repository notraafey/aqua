/**
 * Evidence Fusion Service for AquaSentinel
 * Orchestrates the end-to-end intelligence pipeline from ObservationReceived to EvidenceUpdated.
 * Conforms to Main PRD Section 20 and Phase 3 PRD Sections 25, 26, 38, 44.
 */

import {
  Observation,
  StreamReach,
  EvidenceAssessment,
  EvidenceUpdatedEvent,
  ObservationReceivedEvent,
} from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { getEventBus } from '../../events/index.js';
import { logger } from '../../logging/logger.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';
import { NotFoundError } from '../../api/middleware/error-handler.js';
import { defaultEvidenceConfig, EvidenceFusionConfig } from '../../domain/evidence/config.js';
import { scoringEngine } from '../../domain/evidence/scoring-engine.js';
import { spatialCorrelator } from '../../domain/evidence/spatial-correlator.js';

export interface AssessReachOptions {
  triggerObservationId?: string;
  candidateId?: string;
  force?: boolean;
}

export class EvidenceFusionService {
  private config: EvidenceFusionConfig;
  private isSubscribed = false;

  constructor(config: EvidenceFusionConfig = defaultEvidenceConfig) {
    this.config = config;
  }

  /**
   * Initializes event subscription to ObservationReceived on the event bus.
   */
  public initialize(): void {
    if (this.isSubscribed) return;

    const eventBus = getEventBus();
    eventBus.subscribe<ObservationReceivedEvent>('ObservationReceived', async (event) => {
      try {
        await this.handleObservationReceived(event.payload.observation);
      } catch (err: any) {
        logger.error('[EvidenceFusionService] Error handling ObservationReceived event:', {
          error: err.message,
          observationId: event.payload.observation?.id,
        });
      }
    });

    this.isSubscribed = true;
    logger.info('[EvidenceFusionService] Subscribed to ObservationReceived event.');
  }

  /**
   * Processes an incoming observation and triggers evidence assessment for associated stream reach.
   */
  public async handleObservationReceived(observation: Observation): Promise<EvidenceAssessment | null> {
    logger.info('[EvidenceFusionService] Handling received observation for evidence fusion', {
      observationId: observation.id,
      source: observation.source,
      streamReachId: observation.streamReachId,
    });

    let targetReachId = observation.streamReachId;

    // If stream reach is not directly attached, find closest spatially matching reach
    if (!targetReachId) {
      const repos = getRepositories();
      const allReaches = await repos.streamReaches.findAll();
      for (const reach of allReaches) {
        const spatial = spatialCorrelator.correlateToReach(observation, reach);
        if (spatial.isMatch) {
          targetReachId = reach.id;
          break;
        }
      }
    }

    if (!targetReachId) {
      logger.debug('[EvidenceFusionService] Observation not correlated to any monitored reach. Skipping assessment.', {
        observationId: observation.id,
      });
      return null;
    }

    return this.assessReach(targetReachId, {
      triggerObservationId: observation.id,
    });
  }

  /**
   * Performs an explainable evidence assessment for a specific stream reach.
   */
  public async assessReach(
    streamReachId: string,
    options: AssessReachOptions = {}
  ): Promise<EvidenceAssessment> {
    const repos = getRepositories();
    const reach = await repos.streamReaches.findById(streamReachId);

    if (!reach) {
      throw new NotFoundError(`Stream reach with id '${streamReachId}' not found for evidence assessment.`);
    }

    // 1. Gather relevant candidate observations within temporal and spatial window
    const windowStart = new Date(
      Date.now() - this.config.temporal.satelliteWindowHours * 60 * 60 * 1000
    ).toISOString();

    const candidateObservations = await repos.observations.find({
      streamReachId,
      startDate: windowStart,
      limit: 100,
    });

    // If trigger observation was provided and not in the query, include it
    let triggerObs: Observation | undefined;
    if (options.triggerObservationId) {
      triggerObs = await repos.observations.findById(options.triggerObservationId) ?? undefined;
      if (triggerObs && !candidateObservations.some((o) => o.id === triggerObs!.id)) {
        candidateObservations.push(triggerObs);
      }
    }

    // 2. Fetch historical observations for empirical baseline calculations
    const historicalObservations = await repos.observations.find({
      streamReachId,
      limit: 200,
    });

    // 3. Evaluate observations using the deterministic Scoring Engine
    const assessment = scoringEngine.evaluate({
      streamReach: reach,
      triggerObservation: triggerObs,
      candidateObservations,
      historicalObservations,
      candidateId: options.candidateId,
    });

    // 4. Idempotency check: Check existing latest assessment for identical evidence footprint
    if (!options.force) {
      const latest = await repos.evidenceAssessments.findLatestByStreamReach(streamReachId);
      if (latest) {
        const sameScore = latest.score === assessment.score;
        const sameBand = latest.confidenceBand === assessment.confidenceBand;
        const getSig = (items: typeof assessment.supportingEvidence) =>
          items
            .map((e) => `${e.observationId || 'synth'}:${e.indicator}:${e.value}`)
            .sort()
            .join('|');

        const sameSupporting = getSig(latest.supportingEvidence) === getSig(assessment.supportingEvidence);
        const sameContradicting = getSig(latest.contradictingEvidence) === getSig(assessment.contradictingEvidence);

        if (sameScore && sameBand && sameSupporting && sameContradicting) {
          logger.debug('[EvidenceFusionService] Assessment identical to latest record. Skipping redundant write.', {
            streamReachId,
            existingId: latest.id,
          });
          return latest;
        }
      }
    }

    // 5. Persist the newly calculated assessment
    const saved = await repos.evidenceAssessments.save(assessment);

    // 6. Emit EvidenceUpdated event on domain event bus
    const eventBus = getEventBus();
    const event: EvidenceUpdatedEvent = {
      eventId: generateId(),
      eventType: 'EvidenceUpdated',
      timestamp: nowUtc(),
      actor: 'service:evidence_fusion',
      payload: {
        assessment: saved,
        streamReachId,
        triggerObservationId: options.triggerObservationId,
      },
    };

    await eventBus.publish(event);

    logger.info('[EvidenceFusionService] Generated and published evidence assessment', {
      assessmentId: saved.id,
      streamReachId,
      score: saved.score,
      confidenceBand: saved.confidenceBand,
      supportingCount: saved.supportingEvidenceIds.length,
      contradictingCount: saved.contradictingEvidenceIds.length,
    });

    return saved;
  }

  /**
   * On-demand reassessment for a stream reach.
   */
  public async reassess(streamReachId: string, candidateId?: string): Promise<{
    assessment: EvidenceAssessment;
    reassessed: boolean;
    previousScore?: number;
    currentScore: number;
    previousBand?: string;
    currentBand: string;
  }> {
    const repos = getRepositories();
    const previous = await repos.evidenceAssessments.findLatestByStreamReach(streamReachId);

    const assessment = await this.assessReach(streamReachId, {
      candidateId,
      force: true,
    });

    return {
      assessment,
      reassessed: true,
      previousScore: previous?.score,
      currentScore: assessment.score,
      previousBand: previous?.confidenceBand,
      currentBand: assessment.confidenceBand,
    };
  }
}

export const evidenceFusionService = new EvidenceFusionService();
