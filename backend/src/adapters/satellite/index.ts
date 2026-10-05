import {
  Observation,
  ObservationSource,
  GeoJsonPoint,
  StreamReach,
} from '@aquasentinel/shared';
import { config } from '../../config/index.js';
import { logger } from '../../logging/index.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';
import { createProvenanceRecord } from '../../domain/provenance.js';
import { qualityAssessor } from '../../domain/quality/quality-assessor.js';

export interface SatelliteQueryOptions {
  streamReachId?: string;
  reach?: StreamReach;
  location?: GeoJsonPoint;
  startDate: string;
  endDate: string;
  maxCloudCover?: number;
}

export interface RawSatelliteObservation {
  source: ObservationSource;
  timestamp: string;
  location: GeoJsonPoint;
  streamReachId?: string | null;
  indicator: 'NDCI';
  value: number;
  unit: string;
  sourceIdentifier: string;
  processingMethod: string;
  cloudCoverFraction: number;
  metadata: Record<string, unknown>;
}

export interface ISatelliteAdapter {
  fetchSentinelObservations(options: SatelliteQueryOptions): Promise<Observation[]>;
  healthCheck(): Promise<{ healthy: boolean; details?: string; provider?: string }>;
}

/**
 * Deterministic Sentinel-2 L2A Demo Adapter
 * Returns realistic observations for Greek pilot reaches (Almyros Stream and Kladissos River)
 */
export class DemoSatelliteAdapter implements ISatelliteAdapter {
  async fetchSentinelObservations(options: SatelliteQueryOptions): Promise<Observation[]> {
    logger.info('[DemoSatelliteAdapter] Fetching deterministic Sentinel-2 L2A observations', {
      reachId: options.streamReachId,
      startDate: options.startDate,
      endDate: options.endDate,
    });

    // Pilot coordinate defaults
    const isAlmyros = !options.streamReachId || options.streamReachId.startsWith('7a3b4c12');
    const centerPoint: GeoJsonPoint = isAlmyros
      ? { type: 'Point', coordinates: [22.7535, 39.1812] }
      : { type: 'Point', coordinates: [24.0050, 35.5132] };

    const reachId = options.streamReachId || (isAlmyros ? '7a3b4c12-89de-4f56-9abc-1234567890ab' : '8b4c5d23-90ef-5a67-abcd-2345678901bc');

    // Deterministic acquisitions within timeframe
    const fixtureTemplates = [
      {
        tileId: 'S2B_MSIL2A_20260910T091029_N0500_R050_T34SFG_20260910T121545',
        timestamp: '2026-09-10T09:10:29.000Z',
        ndci: isAlmyros ? 0.118 : 0.076,
        cloudCover: 0.02,
        validPixelsFraction: 0.98,
      },
      {
        tileId: 'S2A_MSIL2A_20260915T091031_N0500_R050_T34SFG_20260915T121802',
        timestamp: '2026-09-15T09:10:31.000Z',
        ndci: isAlmyros ? 0.584 : 0.092, // High chlorophyll anomaly on Almyros
        cloudCover: 0.04,
        validPixelsFraction: 0.96,
      },
      {
        tileId: 'S2B_MSIL2A_20260917T091019_N0500_R050_T34SFG_20260917T122010',
        timestamp: '2026-09-17T09:10:19.000Z',
        ndci: isAlmyros ? 0.612 : 0.088, // Sustained bloom level
        cloudCover: 0.03,
        validPixelsFraction: 0.97,
      },
    ];

    const start = new Date(options.startDate).getTime();
    const end = new Date(options.endDate).getTime();
    const maxCloud = options.maxCloudCover ?? 0.30;

    const filtered = fixtureTemplates.filter((f) => {
      const t = new Date(f.timestamp).getTime();
      return t >= start && t <= end && f.cloudCover <= maxCloud;
    });

    return filtered.map((f) => {
      const obsId = generateId();
      const assessment = qualityAssessor.assess({
        source: 'SATELLITE_SENTINEL2',
        indicator: 'NDCI',
        value: f.ndci,
        timestamp: f.timestamp,
        cloudCoverFraction: f.cloudCover,
        narrowStreamWarning: isAlmyros, // 15m width triggers constraint warning
      });

      const provenance = createProvenanceRecord({
        entityId: obsId,
        entityType: 'OBSERVATION',
        source: 'SATELLITE_SENTINEL2',
        sourceIdentifier: f.tileId,
        acquisitionTimestamp: f.timestamp,
        processingMethod: 'NDCI_NORMALIZED_DIFFERENCE_CHLOROPHYLL_INDEX_V1',
        qualityStatus: assessment.status,
        metadata: {
          satellite: 'Sentinel-2B/2A',
          instrument: 'MSI',
          processingLevel: 'L2A',
          bandFormula: '(B05 - B04) / (B05 + B04)',
          bandsUsed: ['B04 (665nm)', 'B05 (705nm)'],
          cloudCoverPercentage: f.cloudCover,
          validPixelsFraction: f.validPixelsFraction,
          isDemoFixture: true,
          qualityScore: assessment.score,
          qualityReasons: assessment.reasons,
        },
      });

      return {
        id: obsId,
        source: 'SATELLITE_SENTINEL2' as const,
        timestamp: f.timestamp,
        location: centerPoint,
        streamReachId: reachId,
        indicator: 'NDCI' as const,
        value: f.ndci,
        unit: 'ratio',
        quality: assessment.status,
        provenance,
        createdAt: nowUtc(),
        metadata: {
          cloudCoverPercentage: f.cloudCover,
          isDemoFixture: true,
          qualityScore: assessment.score,
        },
      };
    });
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string; provider?: string }> {
    return {
      healthy: true,
      provider: 'Demo Sentinel-2 Fixture Provider',
      details: 'Deterministic Sentinel-2 L2A mock adapter operational (Demo Mode)',
    };
  }
}

/**
 * Live Copernicus Data Space / Sentinel Hub Adapter
 * Connects to CDSE OAuth and Statistical/Processing APIs for Sentinel-2 L2A
 */
export class CopernicusSatelliteAdapter implements ISatelliteAdapter {
  private accessToken: string | null = null;
  private tokenExpiryTime = 0;

  private async getAuthToken(): Promise<string> {
    const clientId = config.COPERNICUS_CLIENT_ID;
    const clientSecret = config.COPERNICUS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Copernicus credentials missing. Please set COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET.');
    }

    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiryTime - 60000) {
      return this.accessToken;
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      });

      const res = await fetch(config.COPERNICUS_AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Copernicus authentication failed with HTTP ${res.status}: ${errorText}`);
      }

      const data = (await res.json()) as { access_token: string; expires_in: number };
      this.accessToken = data.access_token;
      this.tokenExpiryTime = now + data.expires_in * 1000;
      return this.accessToken;
    } catch (err: any) {
      logger.error('[CopernicusSatelliteAdapter] Authentication request failed', { error: err.message });
      throw err;
    }
  }

  async fetchSentinelObservations(options: SatelliteQueryOptions): Promise<Observation[]> {
    try {
      const token = await this.getAuthToken();
      logger.info('[CopernicusSatelliteAdapter] Live query initiated for Sentinel-2 L2A', {
        reachId: options.streamReachId,
        startDate: options.startDate,
        endDate: options.endDate,
      });

      // Construct Statistical API request evaluating NDCI = (B05 - B04) / (B05 + B04)
      const location = options.location || {
        type: 'Point',
        coordinates: [22.7535, 39.1812],
      };

      const [lon, lat] = location.coordinates;
      const delta = 0.005; // ~500m bounding box around coordinate
      const bbox = [lon - delta, lat - delta, lon + delta, lat + delta];

      const evalscript = `//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B04", "B05", "SCL", "dataMask"],
      units: "DN"
    }],
    output: [
      { id: "default", bands: 1 },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(samples) {
  let b04 = samples.B04;
  let b05 = samples.B05;
  let denom = b05 + b04;
  let ndci = denom !== 0 ? (b05 - b04) / denom : 0;
  return {
    default: [ndci],
    dataMask: [samples.dataMask]
  };
}`;

      const requestPayload = {
        input: {
          bounds: {
            bbox,
            properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
          },
          data: [
            {
              type: 'sentinel-2-l2a',
              dataFilter: {
                timeRange: {
                  from: options.startDate,
                  to: options.endDate,
                },
                maxCloudCoverage: (options.maxCloudCover ?? 0.30) * 100,
              },
            },
          ],
        },
        aggregation: {
          timeRange: {
            from: options.startDate,
            to: options.endDate,
          },
          aggregationInterval: { of: 'P1D' },
          evalscript,
        },
      };

      const res = await fetch(`${config.COPERNICUS_API_URL}/statistics`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        logger.warn('[CopernicusSatelliteAdapter] Statistics API error response', {
          status: res.status,
          response: errText,
        });
        throw new Error(`Copernicus Statistics API returned HTTP ${res.status}: ${errText}`);
      }

      const statsData = (await res.json()) as any;
      const observations: Observation[] = [];

      if (Array.isArray(statsData?.data)) {
        for (const interval of statsData.data) {
          const meanNdci = interval?.outputs?.default?.bands?.B0?.stats?.mean;
          if (typeof meanNdci === 'number' && !isNaN(meanNdci)) {
            const obsId = generateId();
            const timestamp = interval.interval?.from || options.startDate;
            const assessment = qualityAssessor.assess({
              source: 'SATELLITE_SENTINEL2',
              indicator: 'NDCI',
              value: meanNdci,
              timestamp,
              cloudCoverFraction: (options.maxCloudCover ?? 0.30) / 2,
            });

            const provenance = createProvenanceRecord({
              entityId: obsId,
              entityType: 'OBSERVATION',
              source: 'SATELLITE_SENTINEL2',
              sourceIdentifier: `CDSE-S2L2A-${timestamp.slice(0, 10)}`,
              acquisitionTimestamp: timestamp,
              processingMethod: 'COPERNICUS_CDSE_STATISTICAL_NDCI_V1',
              qualityStatus: assessment.status,
              metadata: {
                provider: 'Copernicus Data Space Ecosystem (CDSE)',
                apiUrl: config.COPERNICUS_API_URL,
                stats: interval?.outputs?.default?.bands?.B0?.stats,
              },
            });

            observations.push({
              id: obsId,
              source: 'SATELLITE_SENTINEL2',
              timestamp,
              location,
              streamReachId: options.streamReachId || null,
              indicator: 'NDCI',
              value: Math.round(meanNdci * 1000) / 1000,
              unit: 'ratio',
              quality: assessment.status,
              provenance,
              createdAt: nowUtc(),
            });
          }
        }
      }

      return observations;
    } catch (err: any) {
      logger.error('[CopernicusSatelliteAdapter] Live satellite query failed, falling back safely', {
        error: err.message,
      });
      throw err;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string; provider?: string }> {
    if (!config.COPERNICUS_CLIENT_ID || !config.COPERNICUS_CLIENT_SECRET) {
      return {
        healthy: false,
        provider: 'Copernicus Data Space Ecosystem',
        details: 'Credentials unconfigured (COPERNICUS_CLIENT_ID or COPERNICUS_CLIENT_SECRET not set)',
      };
    }

    try {
      await this.getAuthToken();
      return {
        healthy: true,
        provider: 'Copernicus Data Space Ecosystem',
        details: 'Copernicus OAuth token acquired successfully',
      };
    } catch (err: any) {
      return {
        healthy: false,
        provider: 'Copernicus Data Space Ecosystem',
        details: `Connection check failed: ${err.message}`,
      };
    }
  }
}

let satelliteAdapterInstance: ISatelliteAdapter | null = null;

export function getSatelliteAdapter(): ISatelliteAdapter {
  if (!satelliteAdapterInstance) {
    if (
      config.APP_MODE === 'live' &&
      config.COPERNICUS_CLIENT_ID &&
      config.COPERNICUS_CLIENT_SECRET
    ) {
      satelliteAdapterInstance = new CopernicusSatelliteAdapter();
    } else {
      satelliteAdapterInstance = new DemoSatelliteAdapter();
    }
  }
  return satelliteAdapterInstance;
}

export function resetSatelliteAdapter(): void {
  satelliteAdapterInstance = null;
}
