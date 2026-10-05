import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { InteroperabilityAcknowledgement } from '@aquasentinel/shared';
import { consumerStore } from './store.js';
import { ConsumerEventRecord, ConsumerHealthStatus } from './types.js';

const startTime = Date.now();
const CONSUMER_ID = 'volos-public-health-portal';
const CONSUMER_NAME = 'Volos Municipal Public Health & Environmental Protection Agency';

export function createConsumerApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health endpoint
  app.get('/health', (_req: Request, res: Response) => {
    const isFailing = consumerStore.isFailureModeActive();
    const stats = consumerStore.getStats();
    const status: ConsumerHealthStatus = {
      status: isFailing ? 'offline' : 'healthy',
      consumerId: CONSUMER_ID,
      consumerName: CONSUMER_NAME,
      version: '1.0.0',
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      totalEventsReceived: stats.total,
      uniqueEventsCount: stats.unique,
      duplicateEventsCount: stats.duplicate,
      simulatedFailure: stats.failureActive,
    };

    if (isFailing) {
      res.status(503).json(status);
      return;
    }
    res.json(status);
  });

  // Query received events
  app.get('/events', (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
    const events = consumerStore.getEvents(limit);
    res.json({
      consumerId: CONSUMER_ID,
      count: events.length,
      events,
    });
  });

  // Query specific received event
  app.get('/events/:id', (req: Request, res: Response) => {
    const event = consumerStore.getEventById(req.params.id);
    if (!event) {
      res.status(404).json({ error: `Event '${req.params.id}' not found in consumer store` });
      return;
    }
    res.json(event);
  });

  // Main REST-hook Webhook receiver
  app.post('/webhook/fhir', (req: Request, res: Response) => {
    // 1. Check simulated failure
    if (consumerStore.shouldFail()) {
      console.warn(`[${CONSUMER_ID}] Simulated outage active: Rejecting incoming webhook with HTTP 503`);
      res.status(503).json({
        error: 'Service Unavailable: Municipal consumer portal experiencing transient network partition or downtime',
        simulated: true,
        consumerId: CONSUMER_ID,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const body = req.body || {};
    // Extract logical identifiers
    const eventId: string =
      body.eventId ||
      (req.headers['x-event-id'] as string) ||
      (req.headers['x-fhir-subscription-id'] ? `${req.headers['x-fhir-subscription-id']}-${body.id}` : null) ||
      body.id ||
      randomUUID();

    const resourceType: string =
      body.resourceType ||
      body.resource?.resourceType ||
      (body.eventType ? 'DomainEvent' : 'Unknown');

    const resourceId: string =
      body.resourceId ||
      body.resource?.id ||
      body.id ||
      'unknown';

    // 2. Check Idempotency / Duplicate Detection (Section 40)
    const isDuplicate = consumerStore.isDuplicate(eventId);

    if (isDuplicate) {
      const ack: InteroperabilityAcknowledgement = {
        acknowledgementId: randomUUID(),
        eventId,
        receivedAt: new Date().toISOString(),
        consumerId: CONSUMER_ID,
        status: 'DUPLICATE',
        details: `Event ${eventId} has already been received and processed by ${CONSUMER_NAME}. Duplicate downstream action skipped.`,
        processedResourceType: resourceType,
        processedResourceId: resourceId,
      };

      const record: ConsumerEventRecord = {
        id: randomUUID(),
        eventId,
        receivedAt: new Date().toISOString(),
        resourceType,
        resourceId,
        payload: body,
        isDuplicate: true,
        downstreamActionTaken: 'SKIPPED_DUPLICATE: Identical event previously ingested; idempotency maintained.',
        acknowledgement: ack,
      };

      consumerStore.recordEvent(record);
      console.info(`[${CONSUMER_ID}] Duplicate event received: ${eventId} -> Status: DUPLICATE (idempotent)`);

      res.status(200).json({
        status: 'DUPLICATE',
        acknowledgement: ack,
        message: 'Duplicate event received and acknowledged without duplicate downstream execution',
      });
      return;
    }

    // 3. Process new event and determine downstream public health operational action
    let downstreamActionTaken = '';
    if (resourceType === 'Flag') {
      downstreamActionTaken =
        'PUBLIC_HEALTH_ADVISORY: Evaluated environmental hazard flag. Notification dispatched to Volos Municipal Water Utility for intake monitoring.';
    } else if (resourceType === 'Task') {
      downstreamActionTaken =
        'FIELD_INSPECTION_DISPATCH: Operational task logged. Scheduled certified municipal environmental inspector for in-situ site verification.';
    } else if (resourceType === 'Observation') {
      downstreamActionTaken =
        'WATER_QUALITY_TELEMETRY_RECORDED: Remote-sensing observation ingested into municipal geographic information database.';
    } else {
      downstreamActionTaken = `GENERAL_INTEROPERABILITY_EVENT_RECORDED: Processed ${resourceType}/${resourceId}.`;
    }

    const ack: InteroperabilityAcknowledgement = {
      acknowledgementId: randomUUID(),
      eventId,
      receivedAt: new Date().toISOString(),
      consumerId: CONSUMER_ID,
      status: 'ACCEPTED',
      details: `Resource ${resourceType}/${resourceId} accepted and validated by ${CONSUMER_NAME}.`,
      processedResourceType: resourceType,
      processedResourceId: resourceId,
    };

    const record: ConsumerEventRecord = {
      id: randomUUID(),
      eventId,
      receivedAt: new Date().toISOString(),
      resourceType,
      resourceId,
      payload: body,
      isDuplicate: false,
      downstreamActionTaken,
      acknowledgement: ack,
    };

    consumerStore.recordEvent(record);
    console.info(`[${CONSUMER_ID}] Webhook processed successfully: ${eventId} (${resourceType}/${resourceId}) -> Status: ACCEPTED`);

    res.status(200).json({
      status: 'ACCEPTED',
      acknowledgement: ack,
      message: 'Resource processed successfully by Volos Public Health Portal',
      downstreamActionTaken,
    });
  });

  // Failure simulation controls (Section 39)
  app.post('/simulate-failure', (req: Request, res: Response) => {
    const failNext = req.body.failNext ? parseInt(String(req.body.failNext), 10) : 0;
    const continuous = req.body.continuous !== false && failNext === 0;
    consumerStore.setSimulatedFailure(continuous, failNext);
    res.json({
      message: continuous
        ? 'Continuous simulated failure enabled (HTTP 503)'
        : `Simulated failure enabled for next ${failNext} requests`,
      status: consumerStore.getStats(),
    });
  });

  app.post('/simulate-restore', (_req: Request, res: Response) => {
    consumerStore.setSimulatedFailure(false, 0);
    res.json({
      message: 'Simulated consumer service restored to healthy state (HTTP 200)',
      status: consumerStore.getStats(),
    });
  });

  app.post('/reset', (_req: Request, res: Response) => {
    consumerStore.reset();
    res.json({ message: 'Consumer store reset successfully', status: consumerStore.getStats() });
  });

  return app;
}
