import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/api/server.js';
import { setRepositories, createRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';
import { getEventBus } from '../../src/events/index.js';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';

describe('Real-Time Events & SSE Transport API', () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();
    app = createServer();
  });

  it('GET /api/v1/events/status returns transport status and health', async () => {
    const res = await request(app).get('/api/v1/events/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transport).toBe('SSE');
    expect(res.body.data.healthy).toBe(true);
    expect(typeof res.body.data.connectedClients).toBe('number');
  });

  it('GET /api/health includes extended event and realtime transport services', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.services.eventSystem).toBeDefined();
    expect(res.body.data.services.eventSystem.status).toBe('up');
    expect(res.body.data.services.recommendationEngine).toBeDefined();
    expect(res.body.data.services.recommendationEngine.status).toBe('up');
    expect(res.body.data.services.realtimeTransport).toBeDefined();
    expect(res.body.data.services.realtimeTransport.status).toBe('up');
  });

  it('Domain EventBus publishes events without error', async () => {
    const eventBus = getEventBus();
    let eventReceived = false;

    eventBus.subscribe('IncidentCreated', (evt) => {
      if (evt.actor === 'test-sse-suite') {
        eventReceived = true;
      }
    });

    await eventBus.publish({
      eventId: generateId(),
      eventType: 'IncidentCreated',
      timestamp: nowUtc(),
      actor: 'test-sse-suite',
      payload: {
        incident: {
          id: generateId(),
          streamReachId: 'reach-test',
          hazardType: 'UNKNOWN',
          evidenceConfidence: 50,
          severity: 'MEDIUM',
          status: 'DETECTED',
          verificationStatus: 'UNVERIFIED',
          createdAt: nowUtc(),
          updatedAt: nowUtc(),
        },
      },
    });

    expect(eventReceived).toBe(true);
  });
});
