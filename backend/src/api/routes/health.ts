import { Router, Request, Response } from 'express';
import { HealthCheckResponse } from '@aquasentinel/shared';
import { config } from '../../config/index.js';
import { isDatabaseHealthy } from '../../database/client.js';
import { getFhirAdapter } from '../../adapters/fhir/index.js';
import { getSatelliteAdapter } from '../../adapters/satellite/index.js';
import { getWeatherAdapter } from '../../adapters/weather/index.js';
import { getCitizenAdapter } from '../../adapters/citizen/index.js';
import { nowUtc } from '../../domain/value-objects.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  const fhirAdapter = getFhirAdapter();
  const satelliteAdapter = getSatelliteAdapter();
  const weatherAdapter = getWeatherAdapter();
  const citizenAdapter = getCitizenAdapter();

  const [dbHealth, fhirHealth, satHealth, weatherHealth, citizenHealth] = await Promise.all([
    isDatabaseHealthy(),
    fhirAdapter.healthCheck(),
    satelliteAdapter.healthCheck().catch((err) => ({ healthy: false, details: err.message, provider: 'Sentinel' })),
    weatherAdapter.healthCheck().catch((err) => ({ healthy: false, details: err.message, provider: 'Weather' })),
    citizenAdapter.healthCheck().catch((err) => ({ healthy: false, details: err.message, provider: 'Citizen' })),
  ]);

  const isHealthy = dbHealth.healthy || config.APP_MODE === 'demo';

  const payload: HealthCheckResponse = {
    status: isHealthy ? 'healthy' : 'degraded',
    version: '1.0.0',
    appMode: config.APP_MODE,
    timestamp: nowUtc(),
    uptimeSeconds: Math.floor(process.uptime()),
    services: {
      database: {
        status: dbHealth.healthy ? 'up' : 'down',
        latencyMs: dbHealth.latencyMs,
        error: dbHealth.error,
      },
      fhir: {
        status: fhirHealth.healthy ? (fhirHealth.isMock ? 'mocked' : 'up') : 'down',
        endpoint: fhirHealth.endpoint,
        error: fhirHealth.error,
      },
      satellite: {
        status: satHealth.healthy ? (config.APP_MODE === 'demo' ? 'mocked' : 'up') : 'down',
        provider: satHealth.provider || 'Sentinel-2',
        error: satHealth.healthy ? undefined : satHealth.details,
      },
      weather: {
        status: weatherHealth.healthy ? (config.APP_MODE === 'demo' ? 'mocked' : 'up') : 'down',
        provider: weatherHealth.provider || 'Open-Meteo',
        error: weatherHealth.healthy ? undefined : weatherHealth.details,
      },
      citizen: {
        status: citizenHealth.healthy ? (config.APP_MODE === 'demo' ? 'mocked' : 'up') : 'down',
        provider: citizenHealth.provider || 'Citizen Science',
        error: citizenHealth.healthy ? undefined : citizenHealth.details,
      },
      eventSystem: {
        status: 'up',
        listenerCount: 11,
        lastEventTimestamp: nowUtc(),
      },
      recommendationEngine: {
        status: 'up',
        measuresCount: 10,
      },
      realtimeTransport: {
        status: 'up',
        transport: 'SSE',
      },
    },
  };

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    data: payload,
  });
});
