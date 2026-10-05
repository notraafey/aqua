/**
 * Real-Time Event Streaming Router (Server-Sent Events)
 * Conforms to AquaSentinel Phase 5 PRD Sections 23, 24, 29, 35.
 * 
 * Provides a clean real-time SSE transport abstraction streaming domain events
 * (ObservationReceived, EvidenceUpdated, IncidentCreated, IncidentStateChanged,
 * RecommendationGenerated, RecommendationReviewed, TaskCreated, TaskStatusUpdated,
 * VerificationSubmitted, etc.) to connected clients without polling.
 */

import { Router, Request, Response } from 'express';
import { getEventBus, EventHandler } from '../../events/index.js';
import { DomainEvent } from '@aquasentinel/shared';
import { logger } from '../../logging/logger.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';

export const eventsRouter = Router();

interface SseClient {
  id: string;
  res: Response;
  connectedAt: string;
}

const connectedClients = new Map<string, SseClient>();
let lastEventTimestamp: string | null = null;
let eventListenerInitialized = false;

// Broadcast helper for domain events
function broadcastDomainEvent(event: DomainEvent): void {
  lastEventTimestamp = event.timestamp || nowUtc();
  const payload = `event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`;

  for (const [clientId, client] of connectedClients.entries()) {
    try {
      client.res.write(payload);
    } catch (err: any) {
      logger.warn(`[SSE] Failed writing event to client ${clientId}:`, { error: err.message });
      connectedClients.delete(clientId);
    }
  }
}

// Global subscription to all AquaSentinel domain events
function initializeGlobalEventBroadcaster(): void {
  if (eventListenerInitialized) return;

  const eventBus = getEventBus();
  const domainEventTypes = [
    'ObservationReceived',
    'EvidenceUpdated',
    'IncidentCreated',
    'IncidentStateChanged',
    'RecommendationCreated',
    'RecommendationGenerated',
    'RecommendationReviewed',
    'TaskCreated',
    'TaskStatusUpdated',
    'VerificationSubmitted',
    'IncidentResolved',
  ];

  const handler: EventHandler<any> = (event: DomainEvent) => {
    broadcastDomainEvent(event);
  };

  for (const eventType of domainEventTypes) {
    eventBus.subscribe(eventType, handler);
  }

  eventListenerInitialized = true;
  logger.info('[SSE] Global real-time event broadcaster initialized for domain events.');
}

// GET /api/v1/events/stream - Primary SSE endpoint
eventsRouter.get('/stream', (req: Request, res: Response) => {
  initializeGlobalEventBroadcaster();

  const clientId = generateId();

  // Set SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  const client: SseClient = {
    id: clientId,
    res,
    connectedAt: nowUtc(),
  };

  connectedClients.set(clientId, client);
  logger.info(`[SSE] Client connected: ${clientId}. Total active clients: ${connectedClients.size}`);

  // Send initial handshake frame
  const handshake = {
    eventType: 'ConnectionEstablished',
    clientId,
    timestamp: nowUtc(),
    totalActiveClients: connectedClients.size,
  };
  res.write(`event: ConnectionEstablished\ndata: ${JSON.stringify(handshake)}\n\n`);

  // Periodic heartbeat comment (every 25 seconds) to prevent socket timeouts
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeatInterval);
      connectedClients.delete(clientId);
    }
  }, 25000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    connectedClients.delete(clientId);
    logger.info(`[SSE] Client disconnected: ${clientId}. Total active clients: ${connectedClients.size}`);
  });
});

// GET /api/v1/events/status - Real-time transport diagnostics
eventsRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      transport: 'SSE',
      healthy: true,
      connectedClients: connectedClients.size,
      lastEventTimestamp,
      serverTime: nowUtc(),
    },
  });
});
