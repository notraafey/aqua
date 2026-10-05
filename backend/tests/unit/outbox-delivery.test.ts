import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboxDeliveryWorker } from '../../src/services/interoperability/delivery-worker.js';
import { getRepositories } from '../../src/database/repositories/index.js';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';

describe('OutboxDeliveryWorker Unit Tests (Phase 7)', () => {
  const repos = getRepositories();
  let worker: OutboxDeliveryWorker;

  beforeEach(() => {
    vi.restoreAllMocks();
    worker = new OutboxDeliveryWorker({
      maxRetries: 3,
      initialBackoffMs: 100,
      backoffMultiplier: 2,
    });
  });

  it('delivers event successfully and records acknowledgement + audit trail', async () => {
    const eventId = generateId();
    const ackId = generateId();

    // Mock successful consumer response
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({
        status: 'RECEIVED',
        acknowledgement: {
          acknowledgementId: ackId,
          eventId,
          status: 'PROCESSED',
          consumerId: 'volos-public-health-portal',
          receivedAt: nowUtc(),
          processedAt: nowUtc(),
        },
      }),
    } as any);

    const outboxEvent = await repos.outbox.save({
      id: generateId(),
      eventId,
      eventType: 'EarlyWarningCreated',
      eventVersion: '1.0.0',
      occurredAt: nowUtc(),
      producer: 'aquasentinel-decision-engine',
      subject: 'Location/krafsidonas-1',
      resourceType: 'Flag',
      resourceId: 'flag-1',
      payload: { test: true },
      destination: 'http://localhost:3002/webhook/fhir',
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    });

    const success = await worker.deliverEvent(outboxEvent);
    expect(success).toBe(true);

    const updated = await repos.outbox.findById(outboxEvent.id);
    expect(updated?.status).toBe('DELIVERED');
    expect(updated?.acknowledgementId).toBe(ackId);
    expect(updated?.deliveredAt).toBeDefined();

    // Check audit trail and acknowledgement storage
    const auditLogs = await repos.interoperabilityAudit.findByEventId(eventId);
    expect(auditLogs.some((l) => l.stage === 'DELIVERED')).toBe(true);

    const acks = await repos.acknowledgements.findByEventId(eventId);
    expect(acks.length).toBeGreaterThan(0);
    expect(acks[0].consumerId).toBe('volos-public-health-portal');
  });

  it('transitions to RETRYING with exponential backoff on delivery failure', async () => {
    const eventId = generateId();

    // Mock 503 Service Unavailable
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: { get: () => 'text/plain' },
      text: async () => 'Downstream service overloaded',
    } as any);

    const outboxEvent = await repos.outbox.save({
      id: generateId(),
      eventId,
      eventType: 'IncidentCreated',
      eventVersion: '1.0.0',
      occurredAt: nowUtc(),
      producer: 'aquasentinel-decision-engine',
      subject: 'Location/krafsidonas-1',
      resourceType: 'Flag',
      resourceId: 'flag-2',
      payload: { test: true },
      destination: 'http://localhost:3002/webhook/fhir',
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    });

    const success = await worker.deliverEvent(outboxEvent);
    expect(success).toBe(false);

    const updated = await repos.outbox.findById(outboxEvent.id);
    expect(updated?.status).toBe('RETRYING');
    expect(updated?.retryCount).toBe(1);
    expect(updated?.nextRetryAt).toBeDefined();
    expect(updated?.lastError).toContain('503');

    // Audit trail should record RETRY_SCHEDULED
    const auditLogs = await repos.interoperabilityAudit.findByEventId(eventId);
    expect(auditLogs.some((l) => l.stage === 'RETRY_SCHEDULED')).toBe(true);
  });

  it('transitions to DEAD_LETTER when retry attempts reach maxRetries', async () => {
    const eventId = generateId();

    // Mock network error
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:3002'));

    const outboxEvent = await repos.outbox.save({
      id: generateId(),
      eventId,
      eventType: 'TaskCreated',
      eventVersion: '1.0.0',
      occurredAt: nowUtc(),
      producer: 'aquasentinel-decision-engine',
      subject: 'Location/krafsidonas-1',
      resourceType: 'Task',
      resourceId: 'task-1',
      payload: { test: true },
      destination: 'http://localhost:3002/webhook/fhir',
      status: 'RETRYING',
      retryCount: 2, // 2 prior retries + 1 attempt = 3 (maxRetries)
      maxRetries: 3,
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    });

    const success = await worker.deliverEvent(outboxEvent);
    expect(success).toBe(false);

    const updated = await repos.outbox.findById(outboxEvent.id);
    expect(updated?.status).toBe('DEAD_LETTER');
    expect(updated?.deadLetterAt).toBeDefined();

    const auditLogs = await repos.interoperabilityAudit.findByEventId(eventId);
    expect(auditLogs.some((l) => l.stage === 'DEAD_LETTERED')).toBe(true);
  });

  it('replays dead-lettered event non-destructively preserving event ID', async () => {
    const eventId = generateId();

    const deadLetterEvent = await repos.outbox.save({
      id: generateId(),
      eventId,
      eventType: 'EarlyWarningCreated',
      eventVersion: '1.0.0',
      occurredAt: nowUtc(),
      producer: 'aquasentinel-decision-engine',
      subject: 'Location/krafsidonas-1',
      resourceType: 'Flag',
      resourceId: 'flag-3',
      payload: { test: true },
      destination: 'http://localhost:3002/webhook/fhir',
      status: 'DEAD_LETTER',
      retryCount: 3,
      maxRetries: 3,
      deadLetterAt: nowUtc(),
      lastError: 'HTTP 503',
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    });

    // Mock recovery on replay
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        status: 'RECEIVED',
        acknowledgement: {
          acknowledgementId: 'ack-replay-1',
          eventId,
          status: 'PROCESSED',
          consumerId: 'volos-public-health-portal',
          receivedAt: nowUtc(),
          processedAt: nowUtc(),
        },
      }),
    } as any);

    const replayed = await worker.replayEvent(eventId, 'Supervisor Dimitris');
    expect(replayed).toBeDefined();
    expect(replayed?.eventId).toBe(eventId); // Event ID preserved

    const auditLogs = await repos.interoperabilityAudit.findByEventId(eventId);
    expect(auditLogs.some((l) => l.stage === 'REPLAYED')).toBe(true);
  });
});
