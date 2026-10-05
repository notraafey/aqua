import { describe, it, expect } from 'vitest';
import {
  DemoWeatherAdapter,
  OpenMeteoWeatherAdapter,
  getWeatherAdapter,
} from '../../src/adapters/weather/index.js';
import { GeoJsonPoint } from '@aquasentinel/shared';

describe('Weather Adapter (Open-Meteo & Demo)', () => {
  const testLocation: GeoJsonPoint = {
    type: 'Point',
    coordinates: [22.7535, 39.1812],
  };

  it('DemoWeatherAdapter produces distinct hourly time series without collapsing', async () => {
    const adapter = new DemoWeatherAdapter();
    const obs = await adapter.fetchWeatherData({
      location: testLocation,
      startDate: '2026-09-17T06:00:00.000Z',
      endDate: '2026-09-17T12:00:00.000Z',
    });

    expect(obs.length).toBeGreaterThan(5);

    // Verify hourly timestamps are preserved and distinct
    const timestamps = new Set(obs.map((o) => o.timestamp));
    expect(timestamps.size).toBeGreaterThan(1);

    // Verify supported indicators
    const indicators = new Set(obs.map((o) => o.indicator));
    expect(indicators.has('PRECIPITATION')).toBe(true);
    expect(indicators.has('AIR_TEMP')).toBe(true);
    expect(indicators.has('CLOUD_COVER')).toBe(true);

    // Check provenance
    const first = obs[0];
    expect(first.provenance.source).toBe('WEATHER_STATION');
    expect(first.provenance.processingMethod).toContain('OPEN_METEO');
  });

  it('DemoWeatherAdapter supports single precipitation query for backward compatibility', async () => {
    const adapter = new DemoWeatherAdapter();
    const result = await adapter.fetchPrecipitation({
      location: testLocation,
      timestamp: '2026-09-17T08:00:00.000Z',
    });

    expect(result).not.toBeNull();
    expect(result?.indicator).toBe('PRECIPITATION');
    expect(result?.unit).toBe('mm');
  });

  it('OpenMeteoWeatherAdapter handles invalid endpoint without crashing application', async () => {
    const badAdapter = new OpenMeteoWeatherAdapter('http://127.0.0.1:59999'); // Unreachable port
    await expect(
      badAdapter.fetchWeatherData({
        location: testLocation,
      })
    ).rejects.toThrow();
  });

  it('getWeatherAdapter returns healthy adapter instance', async () => {
    const adapter = getWeatherAdapter();
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
  });
});
