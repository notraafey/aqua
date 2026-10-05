import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getRepositories } from '../../database/repositories/index.js';
import { getInteroperabilityService } from '../../services/interoperability/interoperability-service.js';
import { getDeliveryWorker } from '../../services/interoperability/delivery-worker.js';
import { getFhirAdapter } from '../../adapters/fhir/index.js';
import {
  InteroperabilityFilter,
  InteroperabilityAcknowledgementSchema,
} from '@aquasentinel/shared';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';

export const interoperabilityRouter = Router();

// 1. Telemetry and System Overview (PRD Section 47, 48)
interoperabilityRouter.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const overview = await getInteroperabilityService().getOverview();
    res.json({
      success: true,
      data: {
        ...overview,
        totalEvents: overview.outbox.total,
        deliveredCount: overview.outbox.delivered,
        retryingCount: overview.outbox.retrying,
        deadLetterCount: overview.outbox.deadLetter,
        pendingCount: overview.outbox.pending,
        subscriptionsCount: overview.subscriptions.total,
        activeSubscriptionsCount: overview.subscriptions.active,
        consumerStatus: overview.consumer.healthy ? 'CONNECTED' : 'DISCONNECTED',
        queueHealth: overview.outbox.deadLetter > 0 ? 'DEGRADED' : 'HEALTHY',
      },
    });
  } catch (err) {
    next(err);
  }
});

// 2. Query Event Stream (PRD Section 33, 34, 36)
interoperabilityRouter.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const filter: InteroperabilityFilter = {
      status: req.query.status as any,
      eventType: req.query.eventType as any,
      correlationId: req.query.correlationId as string,
      resourceType: req.query.resourceType as string,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : 50,
      offset: req.query.offset ? parseInt(String(req.query.offset), 10) : 0,
      since: req.query.since as string,
    };

    const events = await repos.outbox.find(filter);
    const counts = await repos.outbox.count();

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          limit: filter.limit,
          offset: filter.offset,
          total: counts.total,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// 3. Event Detail Inspector (PRD Section 35)
interoperabilityRouter.get('/events/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const event =
      (await repos.outbox.findById(req.params.id)) ||
      (await repos.outbox.findByEventId(req.params.id));

    if (!event) {
      throw new NotFoundError(`Interoperability event '${req.params.id}' not found`);
    }

    const auditTrail = await repos.interoperabilityAudit.findByEventId(event.eventId);
    const acknowledgements = await repos.acknowledgements.findByEventId(event.eventId);

    res.json({
      success: true,
      data: {
        event,
        auditTrail,
        acknowledgements,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 4. Delivery Queue Monitor (PRD Section 36)
interoperabilityRouter.get('/deliveries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const pending = await repos.outbox.findPending(req.query.limit ? parseInt(String(req.query.limit), 10) : 50);
    const counts = await repos.outbox.count();

    res.json({
      success: true,
      data: {
        queue: pending,
        counts,
      },
    });
  } catch (err) {
    next(err);
  }
});

interoperabilityRouter.get('/deliveries/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const event =
      (await repos.outbox.findById(req.params.id)) ||
      (await repos.outbox.findByEventId(req.params.id));

    if (!event) {
      throw new NotFoundError(`Delivery record for event '${req.params.id}' not found`);
    }

    const auditTrail = await repos.interoperabilityAudit.findByEventId(event.eventId);

    res.json({
      success: true,
      data: {
        deliveryStatus: event.status,
        retryCount: event.retryCount,
        maxRetries: event.maxRetries,
        nextRetryAt: event.nextRetryAt,
        deliveredAt: event.deliveredAt,
        lastError: event.lastError,
        acknowledgementId: event.acknowledgementId,
        auditTrail,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5. Manual Retry for Failed / Retrying Events (PRD Section 33)
interoperabilityRouter.post('/events/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const event =
      (await repos.outbox.findById(req.params.id)) ||
      (await repos.outbox.findByEventId(req.params.id));

    if (!event) {
      throw new NotFoundError(`Outbox event '${req.params.id}' not found`);
    }

    // Reset status to PENDING and trigger immediate delivery
    await repos.outbox.updateStatus(event.id, 'PENDING');
    const updated = await repos.outbox.findById(event.id);

    if (updated) {
      getDeliveryWorker().deliverEvent(updated).catch(() => {});
    }

    res.json({
      success: true,
      message: `Manual retry initiated for event ${event.eventId}`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// 6. Dead-Letter Queue & Replay (PRD Section 16, 41)
interoperabilityRouter.get('/dead-letter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const deadLetterEvents = await repos.outbox.findDeadLetter(limit);

    res.json({
      success: true,
      data: {
        count: deadLetterEvents.length,
        events: deadLetterEvents,
      },
    });
  } catch (err) {
    next(err);
  }
});

interoperabilityRouter.post('/dead-letter/:id/replay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const replayedBy = req.body.replayedBy || 'Command Console Operator';
    const replayed = await getDeliveryWorker().replayEvent(req.params.id, replayedBy);

    res.json({
      success: true,
      message: `Dead-letter event ${req.params.id} successfully queued for replay`,
      data: replayed,
    });
  } catch (err) {
    next(err);
  }
});

// 7. Subscriptions List and Registration (PRD Section 17)
interoperabilityRouter.get('/subscriptions', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const subscriptions = await repos.fhirSubscriptions.findAll();

    res.json({
      success: true,
      data: {
        count: subscriptions.length,
        subscriptions,
      },
    });
  } catch (err) {
    next(err);
  }
});

const RegisterSubscriptionBody = z.object({
  id: z.string().optional(),
  reason: z.string().min(3),
  criteria: z.string().min(1),
  endpoint: z.string().url(),
  payload: z.string().optional(),
});

interoperabilityRouter.post(['/subscriptions', '/subscriptions/register'], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RegisterSubscriptionBody.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid subscription registration payload', parsed.error.issues);
    }

    const { id, reason, criteria, endpoint, payload } = parsed.data;
    const repos = getRepositories();
    const fhir = getFhirAdapter();

    const sub = {
      id: id || `sub-${generateId().slice(0, 8)}`,
      status: 'active' as const,
      reason,
      criteria,
      channel: {
        type: 'rest-hook' as const,
        endpoint,
        payload: payload || 'application/fhir+json',
      },
      createdAt: nowUtc(),
    };

    const saved = await repos.fhirSubscriptions.save(sub);
    await fhir.registerSubscription(saved);

    res.status(201).json({
      success: true,
      message: `Subscription ${saved.id} registered successfully`,
      data: saved,
    });
  } catch (err) {
    next(err);
  }
});

// 8. Consumer Acknowledgement Callback (PRD Section 16, 19)
interoperabilityRouter.post('/consumer/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = InteroperabilityAcknowledgementSchema.safeParse(req.body.acknowledgement || req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid acknowledgement structure', parsed.error.issues);
    }

    const ack = parsed.data;
    const repos = getRepositories();
    await repos.acknowledgements.save(ack);

    const outboxEvent = await repos.outbox.findByEventId(ack.eventId);
    if (outboxEvent) {
      await repos.outbox.markDelivered(outboxEvent.id, ack.acknowledgementId);
    }

    await repos.interoperabilityAudit.log({
      id: generateId(),
      eventId: ack.eventId,
      stage: 'ACKNOWLEDGED',
      status: ack.status === 'REJECTED' ? 'FAILURE' : 'SUCCESS',
      message: `Consumer ${ack.consumerId} acknowledged event: Status: ${ack.status}`,
      details: { acknowledgementId: ack.acknowledgementId, details: ack.details },
      timestamp: nowUtc(),
    });

    res.json({
      success: true,
      message: `Acknowledgement ${ack.acknowledgementId} recorded successfully`,
      data: ack,
    });
  } catch (err) {
    next(err);
  }
});

// 9. Outbox Aliases (PRD compliance & REST consistency)
interoperabilityRouter.get('/outbox', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const filter: InteroperabilityFilter = {
      status: req.query.status as any,
      eventType: req.query.eventType as any,
      correlationId: req.query.correlationId as string,
      resourceType: req.query.resourceType as string,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : 50,
      offset: req.query.offset ? parseInt(String(req.query.offset), 10) : 0,
      since: req.query.since as string,
    };

    const events = await repos.outbox.find(filter);
    res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
});

interoperabilityRouter.get('/outbox/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const event =
      (await repos.outbox.findById(req.params.id)) ||
      (await repos.outbox.findByEventId(req.params.id));

    if (!event) {
      throw new NotFoundError(`Outbox event '${req.params.id}' not found`);
    }

    res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
});

interoperabilityRouter.post('/outbox/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const event =
      (await repos.outbox.findById(req.params.id)) ||
      (await repos.outbox.findByEventId(req.params.id));

    if (!event) {
      throw new NotFoundError(`Outbox event '${req.params.id}' not found`);
    }

    await repos.outbox.updateStatus(event.id, 'PENDING');
    const updated = await repos.outbox.findById(event.id);
    if (updated) {
      getDeliveryWorker().deliverEvent(updated).catch(() => {});
    }

    res.json({ success: true, message: `Manual retry initiated for event ${event.eventId}`, data: updated });
  } catch (err) {
    next(err);
  }
});

interoperabilityRouter.post('/outbox/:id/replay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const operatorId = req.body.operatorId || 'Command Console Operator';
    const replayed = await getDeliveryWorker().replayEvent(req.params.id, operatorId);
    res.json({ success: true, message: `Event ${req.params.id} replayed`, data: replayed });
  } catch (err) {
    next(err);
  }
});

// 10. Audit Log Retrieval
interoperabilityRouter.get('/audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const eventId = req.query.eventId as string | undefined;
    const auditLogs = eventId
      ? await repos.interoperabilityAudit.findByEventId(eventId)
      : await repos.interoperabilityAudit.findAll(limit);
    res.json({ success: true, data: auditLogs });
  } catch (err) {
    next(err);
  }
});

// 11. Acknowledgements Log Retrieval
interoperabilityRouter.get('/acknowledgements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const eventId = req.query.eventId as string | undefined;
    const acks = eventId
      ? await repos.acknowledgements.findByEventId(eventId)
      : await repos.acknowledgements.findAll(limit);
    res.json({ success: true, data: acks });
  } catch (err) {
    next(err);
  }
});

