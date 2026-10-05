import {
  OutboxEvent,
  InteroperabilityAcknowledgement,
} from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { logger } from '../../logging/logger.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';

export interface DeliveryWorkerOptions {
  pollIntervalMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  backoffMultiplier?: number;
}

export class OutboxDeliveryWorker {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private options: Required<DeliveryWorkerOptions>;

  constructor(options: DeliveryWorkerOptions = {}) {
    this.options = {
      pollIntervalMs: options.pollIntervalMs || 1000,
      maxRetries: options.maxRetries || 3,
      initialBackoffMs: options.initialBackoffMs || 500,
      backoffMultiplier: options.backoffMultiplier || 2,
    };
  }

  start(): void {
    if (this.timer) return;
    logger.info(`[OutboxDeliveryWorker] Starting delivery worker (Poll interval: ${this.options.pollIntervalMs}ms)`);
    this.timer = setInterval(() => {
      this.processPendingEvents().catch((err) => {
        logger.error('[OutboxDeliveryWorker] Unhandled error during poll iteration:', { error: err.message });
      });
    }, this.options.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[OutboxDeliveryWorker] Stopped delivery worker');
    }
  }

  /**
   * Processes a batch of pending or due retrying events.
   * Can be called directly by demo scripts or scheduled worker.
   */
  async processPendingEvents(batchSize = 20): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isProcessing) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }
    this.isProcessing = true;

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      const repos = getRepositories();
      const events = await repos.outbox.findPending(batchSize);

      for (const event of events) {
        processed++;
        const success = await this.deliverEvent(event);
        if (success) {
          succeeded++;
        } else {
          failed++;
        }
      }
    } catch (err: any) {
      logger.error('[OutboxDeliveryWorker] Error fetching pending outbox events:', { error: err.message });
    } finally {
      this.isProcessing = false;
    }

    return { processed, succeeded, failed };
  }

  /**
   * Attempts delivery of a single outbox event with full audit logging and state transitions.
   */
  async deliverEvent(event: OutboxEvent): Promise<boolean> {
    const repos = getRepositories();

    // 1. Transition to DELIVERING
    await repos.outbox.updateStatus(event.id, 'DELIVERING');
    await repos.interoperabilityAudit.log({
      id: generateId(),
      eventId: event.eventId,
      stage: 'DELIVERY_ATTEMPT',
      status: 'INFO',
      message: `Attempting delivery ${event.retryCount + 1}/${event.maxRetries} to destination: ${event.destination}`,
      details: { attempt: event.retryCount + 1, destination: event.destination },
      timestamp: nowUtc(),
    });

    try {
      logger.info(`[OutboxDeliveryWorker] Delivering event ${event.eventId} (${event.eventType}) to ${event.destination}`);

      const response = await fetch(event.destination, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Event-ID': event.eventId,
          'X-Event-Type': event.eventType,
          'X-Correlation-ID': event.correlationId,
        },
        body: JSON.stringify(event.payload),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown HTTP error');
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
      }

      const resData = (await response.json().catch(() => ({}))) as any;
      let ackId = resData.acknowledgement?.acknowledgementId;

      // If an acknowledgement is returned by the consumer, persist it
      if (resData.acknowledgement) {
        const ack: InteroperabilityAcknowledgement = resData.acknowledgement;
        await repos.acknowledgements.save(ack);
        ackId = ack.acknowledgementId;
      }

      // 2. Transition to DELIVERED
      await repos.outbox.markDelivered(event.id, ackId);

      await repos.interoperabilityAudit.log({
        id: generateId(),
        eventId: event.eventId,
        stage: 'DELIVERED',
        status: 'SUCCESS',
        message: `Event delivered successfully to ${event.destination}. Downstream status: ${resData.status || 'OK'}`,
        details: {
          acknowledgementId: ackId,
          downstreamStatus: resData.status,
          consumerId: resData.acknowledgement?.consumerId,
        },
        timestamp: nowUtc(),
      });

      logger.info(`[OutboxDeliveryWorker] Event ${event.eventId} successfully delivered (ackId: ${ackId || 'none'})`);
      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Delivery request failed';
      logger.warn(`[OutboxDeliveryWorker] Delivery failed for event ${event.eventId}: ${errorMessage}`);

      const nextAttempt = event.retryCount + 1;

      if (nextAttempt >= event.maxRetries) {
        // 3. Max retries exceeded -> DEAD_LETTER
        await repos.outbox.markDeadLetter(event.id, errorMessage);

        await repos.interoperabilityAudit.log({
          id: generateId(),
          eventId: event.eventId,
          stage: 'DEAD_LETTERED',
          status: 'FAILURE',
          message: `Delivery permanently failed after ${nextAttempt} attempts. Moved to Dead-Letter Queue. Error: ${errorMessage}`,
          details: { error: errorMessage, attempts: nextAttempt },
          timestamp: nowUtc(),
        });

        logger.error(`[OutboxDeliveryWorker] Event ${event.eventId} moved to DEAD_LETTER: ${errorMessage}`);
      } else {
        // 4. Schedule Retry with Exponential Backoff
        const backoffMs =
          this.options.initialBackoffMs * Math.pow(this.options.backoffMultiplier, event.retryCount);
        const nextRetryDate = new Date(Date.now() + backoffMs).toISOString();

        await repos.outbox.scheduleRetry(event.id, errorMessage, nextRetryDate);

        await repos.interoperabilityAudit.log({
          id: generateId(),
          eventId: event.eventId,
          stage: 'RETRY_SCHEDULED',
          status: 'INFO',
          message: `Delivery attempt ${nextAttempt} failed. Scheduled retry at ${nextRetryDate} (backoff: ${backoffMs}ms). Error: ${errorMessage}`,
          details: { error: errorMessage, attempt: nextAttempt, nextRetryAt: nextRetryDate },
          timestamp: nowUtc(),
        });

        logger.info(`[OutboxDeliveryWorker] Event ${event.eventId} retry scheduled at ${nextRetryDate}`);
      }

      return false;
    }
  }

  /**
   * Replays a dead-lettered event, preserving the original event ID (Section 41).
   */
  async replayEvent(eventId: string, replayedBy = 'Operator'): Promise<OutboxEvent | null> {
    const repos = getRepositories();
    const event = await repos.outbox.findByEventId(eventId);
    if (!event) {
      throw new Error(`Outbox event with eventId '${eventId}' not found`);
    }

    if (event.status !== 'DEAD_LETTER' && event.status !== 'FAILED') {
      throw new Error(`Only DEAD_LETTER or FAILED events can be replayed. Current status: '${event.status}'`);
    }

    const replayed = await repos.outbox.replay(event.id, replayedBy);

    await repos.interoperabilityAudit.log({
      id: generateId(),
      eventId: event.eventId,
      stage: 'REPLAYED',
      status: 'INFO',
      message: `Dead-letter event manually replayed by ${replayedBy}. Original event ID preserved.`,
      details: { replayedBy, previousError: event.lastError, replayCount: (event.replayCount || 0) + 1 },
      timestamp: nowUtc(),
    });

    logger.info(`[OutboxDeliveryWorker] Replayed dead-letter event ${event.eventId} by ${replayedBy}`);

    // Immediately attempt redelivery
    if (replayed) {
      await this.deliverEvent(replayed).catch((err) => {
        logger.error(`[OutboxDeliveryWorker] Error immediately delivering replayed event:`, { error: err.message });
      });
    }

    return replayed;
  }
}

let activeDeliveryWorker: OutboxDeliveryWorker | null = null;

export function getDeliveryWorker(options?: DeliveryWorkerOptions): OutboxDeliveryWorker {
  if (!activeDeliveryWorker) {
    activeDeliveryWorker = new OutboxDeliveryWorker(options);
  }
  return activeDeliveryWorker;
}

export function setDeliveryWorker(worker: OutboxDeliveryWorker): void {
  activeDeliveryWorker = worker;
}
