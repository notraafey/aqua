import { describe, it, expect, beforeEach } from 'vitest';
import { ingestionService } from '../../src/services/ingestion/ingestion-service.js';
import { getRepositories, resetRepositories } from '../../src/database/repositories/index.js';
import { getEventBus } from '../../src/events/index.js';
import { StreamReach } from '@aquasentinel/shared';

describe('Observation Ingestion Service & Idempotency Pipeline', () => {
  const almyrosReach: StreamReach = {
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
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    resetRepositories();
    const repos = getRepositories();
    await repos.streamReaches.create(almyrosReach);
  });

  it('successfully executes the 9-step ingestion pipeline for valid observation', async () => {
    let eventReceived = false;
    const eventBus = getEventBus();
    const handler = async (event: any) => {
      if (event.payload.observation.indicator === 'NDCI') {
        eventReceived = true;
      }
    };
    eventBus.subscribe('ObservationReceived', handler);

    const result = await ingestionService.ingest({
      source: 'SATELLITE_SENTINEL2',
      timestamp: '2026-09-17T09:30:00.000Z',
      location: {
        type: 'Point',
        coordinates: [22.7535, 39.1812],
      },
      indicator: 'NDCI',
      value: 0.52,
      unit: 'ratio',
      sourceIdentifier: 'S2B_MSIL2A_TEST_001',
      processingMethod: 'NDCI_NORMALIZED_DIFFERENCE_CHLOROPHYLL_INDEX_V1',
      cloudCoverFraction: 0.03,
    });

    eventBus.unsubscribe('ObservationReceived', handler);

    expect(result.isDuplicate).toBe(false);
    expect(result.streamReachMatched).toBe(true);
    expect(result.observation.streamReachId).toBe(almyrosReach.id);
    expect(result.observation.quality).toBe('FLAGGED'); // 15m narrow stream penalty applies
    expect(result.observation.deduplicationHash).toBeDefined();
    expect(result.observation.provenance).toBeDefined();
    expect(result.observation.provenance.sourceIdentifier).toBe('S2B_MSIL2A_TEST_001');
    expect(eventReceived).toBe(true);
  });

  it('guarantees idempotency: repeated ingestion of identical observation produces no duplicate', async () => {
    const payload = {
      source: 'WEATHER_STATION' as const,
      timestamp: '2026-09-17T10:00:00.000Z',
      location: {
        type: 'Point' as const,
        coordinates: [22.7535, 39.1812] as [number, number],
      },
      indicator: 'PRECIPITATION',
      value: 12.5,
      unit: 'mm',
      sourceIdentifier: 'METEO-STATION-VOLOS-01',
      processingMethod: 'OPEN_METEO_HOURLY_INGESTION_V1',
    };

    // First ingestion
    const first = await ingestionService.ingest(payload);
    expect(first.isDuplicate).toBe(false);

    // Second ingestion with identical parameters
    const second = await ingestionService.ingest(payload);
    expect(second.isDuplicate).toBe(true);
    expect(second.observation.id).toBe(first.observation.id);

    // Verify repository count is exactly 1
    const repos = getRepositories();
    const count = await repos.observations.count();
    expect(count).toBe(1);
  });

  it('handles unmatched observations gracefully when coordinates are far from monitored reaches', async () => {
    const result = await ingestionService.ingest({
      source: 'CITIZEN_REPORT',
      timestamp: '2026-09-17T12:00:00.000Z',
      location: {
        type: 'Point',
        coordinates: [25.5000, 38.0000], // Middle of Aegean Sea
      },
      indicator: 'WATER_COLOR',
      value: 'Brownish oil sheen',
      unit: 'categorical',
      sourceIdentifier: 'CITIZEN-OFFSHORE-099',
    });

    expect(result.isDuplicate).toBe(false);
    expect(result.streamReachMatched).toBe(false);
    expect(result.observation.streamReachId).toBeNull();
    expect(result.observation.quality).toBe('FLAGGED'); // Unmatched citizen report is flagged
  });

  it('rejects observation with invalid coordinates', async () => {
    await expect(
      ingestionService.ingest({
        source: 'SATELLITE_SENTINEL2',
        timestamp: '2026-09-17T10:00:00.000Z',
        location: {
          type: 'Point',
          coordinates: [200.0, 45.0], // Lon > 180
        },
        indicator: 'NDCI',
        value: 0.1,
        unit: 'ratio',
      })
    ).rejects.toThrow();
  });
});
