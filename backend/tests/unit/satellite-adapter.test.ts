import { describe, it, expect } from 'vitest';
import {
  DemoSatelliteAdapter,
  CopernicusSatelliteAdapter,
  getSatelliteAdapter,
} from '../../src/adapters/satellite/index.js';

describe('Sentinel-2 Satellite Adapter', () => {
  it('DemoSatelliteAdapter returns deterministic L2A acquisitions with provenance', async () => {
    const adapter = new DemoSatelliteAdapter();
    const obs = await adapter.fetchSentinelObservations({
      streamReachId: '7a3b4c12-89de-4f56-9abc-1234567890ab',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-20T00:00:00.000Z',
      maxCloudCover: 0.30,
    });

    expect(obs.length).toBeGreaterThan(0);
    const first = obs[0];
    expect(first.source).toBe('SATELLITE_SENTINEL2');
    expect(first.indicator).toBe('NDCI');
    expect(typeof first.value).toBe('number');
    expect(first.unit).toBe('ratio');
    expect(first.provenance).toBeDefined();
    expect(first.provenance.sourceIdentifier).toMatch(/^S2[AB]_MSIL2A/);
    expect(first.provenance.processingMethod).toContain('NDCI');
    expect(first.provenance.metadata?.isDemoFixture).toBe(true);
  });

  it('DemoSatelliteAdapter filters scenes exceeding maxCloudCover', async () => {
    const adapter = new DemoSatelliteAdapter();
    // Set cloud threshold very low (0.015 = 1.5%), which should filter out all demo scenes >= 2%
    const obs = await adapter.fetchSentinelObservations({
      streamReachId: '7a3b4c12-89de-4f56-9abc-1234567890ab',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-20T00:00:00.000Z',
      maxCloudCover: 0.015,
    });

    expect(obs.length).toBe(0);
  });

  it('CopernicusSatelliteAdapter reports unconfigured when credentials are missing', async () => {
    const liveAdapter = new CopernicusSatelliteAdapter();
    const health = await liveAdapter.healthCheck();
    expect(health.healthy).toBe(false);
    expect(health.details).toContain('unconfigured');
  });

  it('CopernicusSatelliteAdapter throws informative error when queried without credentials', async () => {
    const liveAdapter = new CopernicusSatelliteAdapter();
    await expect(
      liveAdapter.fetchSentinelObservations({
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-20T00:00:00.000Z',
      })
    ).rejects.toThrow(/credentials missing/i);
  });

  it('getSatelliteAdapter returns healthy adapter instance', async () => {
    const adapter = getSatelliteAdapter();
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
  });
});
