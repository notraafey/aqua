import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/api/server.js';
import { getRepositories, resetRepositories } from '../../src/database/repositories/index.js';
import { StreamReach } from '@aquasentinel/shared';

describe('Environmental Data Ingestion API Endpoints', () => {
  const app = createServer();

  const testReach: StreamReach = {
    id: '7a3b4c12-89de-4f56-9abc-1234567890ab',
    name: 'Almyros Stream - Reach Alpha',
    city: 'Volos',
    region: 'Thessaly, Greece',
    monitoringStatus: 'ACTIVE',
    geometry: {
      type: 'LineString',
      coordinates: [
        [22.7510, 39.1820],
        [22.7535, 39.1812],
        [22.7570, 39.1798],
      ],
    },
    waterCoverageConstraint: {
      minWidthMeters: 15,
      confidencePenalty: 0.2,
    },
    baselineData: {
      typicalNdci: 0.12,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  beforeAll(async () => {
    resetRepositories();
    const repos = getRepositories();
    await repos.streamReaches.create(testReach);
  });

  it('POST /api/v1/ingestion/satellite retrieves and ingests Sentinel-2 observations', async () => {
    const res = await request(app)
      .post('/api/v1/ingestion/satellite')
      .send({
        streamReachId: testReach.id,
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-20T00:00:00.000Z',
        maxCloudCover: 0.30,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.streamReachId).toBe(testReach.id);
    expect(res.body.data.newlyIngested).toBeGreaterThan(0);
    expect(res.body.data.observations.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/ingestion/weather retrieves and ingests hourly weather series', async () => {
    const res = await request(app)
      .post('/api/v1/ingestion/weather')
      .send({
        streamReachId: testReach.id,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.newlyIngested).toBeGreaterThan(0);
    expect(res.body.data.observations.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/ingestion/citizen ingests citizen report with photo media reference', async () => {
    const res = await request(app)
      .post('/api/v1/ingestion/citizen')
      .send({
        streamReachId: testReach.id,
        location: {
          type: 'Point',
          coordinates: [22.7535, 39.1812],
        },
        indicator: 'WATER_COLOR',
        value: 'Murky green scum',
        description: 'Noticeable algae accumulation near bridge.',
        reporterName: 'Community Volunteer',
        photos: ['https://storage.aquasentinel.local/evidence/photo-01.jpg'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.indicator).toBe('WATER_COLOR');
    expect(res.body.data.provenance.metadata.photos).toHaveLength(1);
    expect(res.body.meta.streamReachMatched).toBe(true);
  });

  it('POST /api/v1/ingestion/trigger-all runs multi-source ingestion cleanly', async () => {
    const res = await request(app)
      .post('/api/v1/ingestion/trigger-all')
      .send({
        streamReachId: testReach.id,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sourcesExecuted).toEqual([
      'SATELLITE_SENTINEL2',
      'WEATHER_STATION',
      'CITIZEN_REPORT',
    ]);
    expect(res.body.data.totalObservationsProcessed).toBeGreaterThan(5);
  });

  it('GET /api/v1/observations supports filtering by source, reach, and quality', async () => {
    // Filter by satellite source
    const satRes = await request(app)
      .get(`/api/v1/observations?source=SATELLITE_SENTINEL2&streamReachId=${testReach.id}`);

    expect(satRes.status).toBe(200);
    expect(satRes.body.success).toBe(true);
    expect(satRes.body.data.every((o: any) => o.source === 'SATELLITE_SENTINEL2')).toBe(true);

    // Filter by indicator
    const precipRes = await request(app)
      .get('/api/v1/observations?indicator=PRECIPITATION');

    expect(precipRes.status).toBe(200);
    expect(precipRes.body.success).toBe(true);
    expect(precipRes.body.data.every((o: any) => o.indicator === 'PRECIPITATION')).toBe(true);
  });

  it('POST /api/v1/observations returns 200 with isDuplicate: true on redundant submission', async () => {
    const payload = {
      source: 'WEATHER_STATION',
      timestamp: '2026-09-17T15:00:00.000Z',
      location: {
        type: 'Point',
        coordinates: [22.7535, 39.1812],
      },
      streamReachId: testReach.id,
      indicator: 'AIR_TEMP',
      value: 23.5,
      unit: 'celsius',
      sourceIdentifier: 'TEMP-SENSOR-VOLOS-99',
    };

    const firstRes = await request(app).post('/api/v1/observations').send(payload);
    expect(firstRes.status).toBe(201);
    expect(firstRes.body.meta.isDuplicate).toBe(false);

    // Resubmit identical payload
    const secondRes = await request(app).post('/api/v1/observations').send(payload);
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.meta.isDuplicate).toBe(true);
    expect(secondRes.body.data.id).toBe(firstRes.body.data.id);
  });

  it('GET /api/health includes satellite, weather, and citizen adapter telemetry', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.services.satellite).toBeDefined();
    expect(res.body.data.services.weather).toBeDefined();
    expect(res.body.data.services.citizen).toBeDefined();
  });
});
