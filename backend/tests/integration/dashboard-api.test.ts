import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/api/server.js';
import { setRepositories, createRepositories, getRepositories } from '../../src/database/repositories/index.js';
import { seedBaselineData } from '../../src/database/seed.js';
import { generateId, nowUtc } from '../../src/domain/value-objects.js';

describe('Dashboard Summary API Integration Tests', () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(async () => {
    const container = createRepositories(true);
    setRepositories(container);
    await seedBaselineData();
    app = createServer();

    const repos = getRepositories();
    const reaches = await repos.streamReaches.findAll();

    // Create an incident
    await repos.incidents.create({
      id: generateId(),
      streamReachId: reaches[0]?.id || 'reach-1',
      hazardType: 'SEWAGE_OVERFLOW',
      evidenceConfidence: 78,
      severity: 'HIGH',
      status: 'ACTION_RECOMMENDED',
      verificationStatus: 'UNVERIFIED',
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
    });
  });

  it('GET /api/v1/dashboard/summary returns operational summary statistics', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const summary = res.body.data;
    expect(typeof summary.activeIncidentsCount).toBe('number');
    expect(summary.activeIncidentsCount).toBeGreaterThanOrEqual(1);
    expect(typeof summary.highPriorityIncidentsCount).toBe('number');
    expect(typeof summary.pendingHumanReviewsCount).toBe('number');
    expect(typeof summary.tasksInProgressCount).toBe('number');
    expect(typeof summary.tasksAwaitingVerificationCount).toBe('number');
    expect(typeof summary.environmentalReachesMonitoredCount).toBe('number');
    expect(summary.environmentalReachesMonitoredCount).toBeGreaterThanOrEqual(1);
    expect(['healthy', 'degraded', 'unhealthy']).toContain(summary.systemHealth);
  });
});
