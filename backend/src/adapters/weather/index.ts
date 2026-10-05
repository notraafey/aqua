import {
  Observation,
  GeoJsonPoint,
} from '@aquasentinel/shared';
import { config } from '../../config/index.js';
import { logger } from '../../logging/index.js';
import { generateId, nowUtc, toUtcIso } from '../../domain/value-objects.js';
import { createProvenanceRecord } from '../../domain/provenance.js';
import { qualityAssessor } from '../../domain/quality/quality-assessor.js';

export interface WeatherQueryOptions {
  location: GeoJsonPoint;
  timestamp: string;
}

export interface WeatherDataQueryOptions {
  location: GeoJsonPoint;
  startDate?: string;
  endDate?: string;
  streamReachId?: string | null;
  variables?: ('precipitation' | 'temperature' | 'cloudcover' | 'humidity' | 'wind')[];
}

export interface IWeatherAdapter {
  fetchPrecipitation(options: WeatherQueryOptions): Promise<Observation | null>;
  fetchWeatherData(options: WeatherDataQueryOptions): Promise<Observation[]>;
  healthCheck(): Promise<{ healthy: boolean; details?: string; provider?: string }>;
}

/**
 * Deterministic Weather Adapter
 * Generates realistic hourly time-series observations for testing and demo execution
 */
export class DemoWeatherAdapter implements IWeatherAdapter {
  async fetchPrecipitation(options: WeatherQueryOptions): Promise<Observation | null> {
    const list = await this.fetchWeatherData({
      location: options.location,
      startDate: options.timestamp,
      endDate: options.timestamp,
      variables: ['precipitation'],
    });
    return list.find((o) => o.indicator === 'PRECIPITATION') || null;
  }

  async fetchWeatherData(options: WeatherDataQueryOptions): Promise<Observation[]> {
    logger.info('[DemoWeatherAdapter] Generating deterministic hourly weather series', {
      coords: options.location.coordinates,
      startDate: options.startDate,
      endDate: options.endDate,
    });

    const baseTime = options.startDate ? new Date(options.startDate) : new Date(Date.now() - 24 * 3600 * 1000);
    const observations: Observation[] = [];

    // Produce 6 hours of time-series context
    const hours = 6;
    for (let h = 0; h < hours; h++) {
      const stepTime = new Date(baseTime.getTime() + h * 3600 * 1000);
      const isoTime = stepTime.toISOString();

      // Deterministic precipitation pulse simulation (simulating runoff event)
      const precipValue = h === 2 ? 14.5 : h === 3 ? 22.8 : h === 4 ? 6.2 : 0.0;
      const tempValue = Math.round((21.5 - h * 0.4) * 10) / 10;
      const cloudValue = h >= 2 && h <= 4 ? 90 : 35;

      // 1. Precipitation observation
      const precipId = generateId();
      const precipAssessment = qualityAssessor.assess({
        source: 'WEATHER_STATION',
        indicator: 'PRECIPITATION',
        value: precipValue,
        timestamp: isoTime,
      });

      const precipProv = createProvenanceRecord({
        entityId: precipId,
        entityType: 'OBSERVATION',
        source: 'WEATHER_STATION',
        sourceIdentifier: `DEMO-METEO-PRECIP-${isoTime.slice(0, 13)}`,
        acquisitionTimestamp: isoTime,
        processingMethod: 'OPEN_METEO_HOURLY_NORMALIZATION_V1',
        qualityStatus: precipAssessment.status,
        metadata: {
          isDemoFixture: true,
          stationModel: 'Open-Meteo European Weather Model (Deterministic Demo)',
          temporalResolution: '1 hour',
        },
      });

      observations.push({
        id: precipId,
        source: 'WEATHER_STATION',
        timestamp: isoTime,
        location: options.location,
        streamReachId: options.streamReachId || null,
        indicator: 'PRECIPITATION',
        value: precipValue,
        unit: 'mm',
        quality: precipAssessment.status,
        provenance: precipProv,
        createdAt: nowUtc(),
        metadata: { isDemoFixture: true, temporalStep: 'hourly' },
      });

      // 2. Ambient Temperature observation
      const tempId = generateId();
      const tempAssessment = qualityAssessor.assess({
        source: 'WEATHER_STATION',
        indicator: 'AIR_TEMP',
        value: tempValue,
        timestamp: isoTime,
      });

      const tempProv = createProvenanceRecord({
        entityId: tempId,
        entityType: 'OBSERVATION',
        source: 'WEATHER_STATION',
        sourceIdentifier: `DEMO-METEO-TEMP-${isoTime.slice(0, 13)}`,
        acquisitionTimestamp: isoTime,
        processingMethod: 'OPEN_METEO_HOURLY_NORMALIZATION_V1',
        qualityStatus: tempAssessment.status,
        metadata: {
          isDemoFixture: true,
          temporalResolution: '1 hour',
        },
      });

      observations.push({
        id: tempId,
        source: 'WEATHER_STATION',
        timestamp: isoTime,
        location: options.location,
        streamReachId: options.streamReachId || null,
        indicator: 'AIR_TEMP',
        value: tempValue,
        unit: 'celsius',
        quality: tempAssessment.status,
        provenance: tempProv,
        createdAt: nowUtc(),
        metadata: { isDemoFixture: true, temporalStep: 'hourly' },
      });

      // 3. Cloud Cover observation
      const cloudId = generateId();
      const cloudAssessment = qualityAssessor.assess({
        source: 'WEATHER_STATION',
        indicator: 'CLOUD_COVER',
        value: cloudValue,
        timestamp: isoTime,
      });

      const cloudProv = createProvenanceRecord({
        entityId: cloudId,
        entityType: 'OBSERVATION',
        source: 'WEATHER_STATION',
        sourceIdentifier: `DEMO-METEO-CLOUD-${isoTime.slice(0, 13)}`,
        acquisitionTimestamp: isoTime,
        processingMethod: 'OPEN_METEO_HOURLY_NORMALIZATION_V1',
        qualityStatus: cloudAssessment.status,
        metadata: {
          isDemoFixture: true,
          temporalResolution: '1 hour',
        },
      });

      observations.push({
        id: cloudId,
        source: 'WEATHER_STATION',
        timestamp: isoTime,
        location: options.location,
        streamReachId: options.streamReachId || null,
        indicator: 'CLOUD_COVER',
        value: cloudValue,
        unit: 'percent',
        quality: cloudAssessment.status,
        provenance: cloudProv,
        createdAt: nowUtc(),
        metadata: { isDemoFixture: true, temporalStep: 'hourly' },
      });
    }

    return observations;
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string; provider?: string }> {
    return {
      healthy: true,
      provider: 'Demo Open-Meteo Fixture Provider',
      details: 'Deterministic Open-Meteo weather adapter operational (Demo Mode)',
    };
  }
}

/**
 * Live Open-Meteo Weather Adapter
 * Queries free public Open-Meteo weather API endpoints with hourly resolution
 */
export class OpenMeteoWeatherAdapter implements IWeatherAdapter {
  private baseUrl: string;

  constructor(baseUrl = config.OPEN_METEO_API_URL) {
    this.baseUrl = baseUrl;
  }

  async fetchPrecipitation(options: WeatherQueryOptions): Promise<Observation | null> {
    const data = await this.fetchWeatherData({
      location: options.location,
      startDate: options.timestamp,
      endDate: options.timestamp,
      variables: ['precipitation'],
    });
    return data.find((o) => o.indicator === 'PRECIPITATION') || null;
  }

  async fetchWeatherData(options: WeatherDataQueryOptions): Promise<Observation[]> {
    const [lon, lat] = options.location.coordinates;
    const url = new URL(`${this.baseUrl}/forecast`);
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lon.toFixed(4));
    url.searchParams.set(
      'hourly',
      'precipitation,temperature_2m,cloudcover,relativehumidity_2m,windspeed_10m'
    );
    url.searchParams.set('timezone', 'UTC');

    logger.info('[OpenMeteoWeatherAdapter] Fetching live weather data', {
      lat,
      lon,
      url: url.toString(),
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Open-Meteo API returned HTTP ${res.status}: ${res.statusText}`);
      }

      const json = (await res.json()) as any;
      const hourly = json?.hourly;
      if (!hourly || !Array.isArray(hourly.time)) {
        throw new Error('Malformed response from Open-Meteo: missing hourly time array');
      }

      const observations: Observation[] = [];
      const times: string[] = hourly.time;
      const precipList: number[] = hourly.precipitation || [];
      const tempList: number[] = hourly.temperature_2m || [];
      const cloudList: number[] = hourly.cloudcover || [];
      const humidityList: number[] = hourly.relativehumidity_2m || [];
      const windList: number[] = hourly.windspeed_10m || [];

      // Limit to past/requested window (take up to 12 most recent hours)
      const count = Math.min(times.length, 12);
      for (let i = 0; i < count; i++) {
        const timeIso = toUtcIso(times[i]);

        // Precipitation
        if (precipList[i] !== undefined && precipList[i] !== null) {
          const obsId = generateId();
          const assessment = qualityAssessor.assess({
            source: 'WEATHER_STATION',
            indicator: 'PRECIPITATION',
            value: precipList[i],
            timestamp: timeIso,
          });

          const prov = createProvenanceRecord({
            entityId: obsId,
            entityType: 'OBSERVATION',
            source: 'WEATHER_STATION',
            sourceIdentifier: `OPEN-METEO-PRECIP-${timeIso.slice(0, 13)}`,
            acquisitionTimestamp: timeIso,
            processingMethod: 'OPEN_METEO_HOURLY_INGESTION_V1',
            qualityStatus: assessment.status,
            metadata: {
              provider: 'Open-Meteo API',
              elevation: json.elevation,
              timezone: json.timezone,
            },
          });

          observations.push({
            id: obsId,
            source: 'WEATHER_STATION',
            timestamp: timeIso,
            location: options.location,
            streamReachId: options.streamReachId || null,
            indicator: 'PRECIPITATION',
            value: precipList[i],
            unit: 'mm',
            quality: assessment.status,
            provenance: prov,
            createdAt: nowUtc(),
          });
        }

        // Temperature
        if (tempList[i] !== undefined && tempList[i] !== null) {
          const obsId = generateId();
          const assessment = qualityAssessor.assess({
            source: 'WEATHER_STATION',
            indicator: 'AIR_TEMP',
            value: tempList[i],
            timestamp: timeIso,
          });

          const prov = createProvenanceRecord({
            entityId: obsId,
            entityType: 'OBSERVATION',
            source: 'WEATHER_STATION',
            sourceIdentifier: `OPEN-METEO-TEMP-${timeIso.slice(0, 13)}`,
            acquisitionTimestamp: timeIso,
            processingMethod: 'OPEN_METEO_HOURLY_INGESTION_V1',
            qualityStatus: assessment.status,
            metadata: { provider: 'Open-Meteo API' },
          });

          observations.push({
            id: obsId,
            source: 'WEATHER_STATION',
            timestamp: timeIso,
            location: options.location,
            streamReachId: options.streamReachId || null,
            indicator: 'AIR_TEMP',
            value: tempList[i],
            unit: 'celsius',
            quality: assessment.status,
            provenance: prov,
            createdAt: nowUtc(),
          });
        }

        // Cloud Cover
        if (cloudList[i] !== undefined && cloudList[i] !== null) {
          const obsId = generateId();
          const assessment = qualityAssessor.assess({
            source: 'WEATHER_STATION',
            indicator: 'CLOUD_COVER',
            value: cloudList[i],
            timestamp: timeIso,
          });

          const prov = createProvenanceRecord({
            entityId: obsId,
            entityType: 'OBSERVATION',
            source: 'WEATHER_STATION',
            sourceIdentifier: `OPEN-METEO-CLOUD-${timeIso.slice(0, 13)}`,
            acquisitionTimestamp: timeIso,
            processingMethod: 'OPEN_METEO_HOURLY_INGESTION_V1',
            qualityStatus: assessment.status,
            metadata: { provider: 'Open-Meteo API' },
          });

          observations.push({
            id: obsId,
            source: 'WEATHER_STATION',
            timestamp: timeIso,
            location: options.location,
            streamReachId: options.streamReachId || null,
            indicator: 'CLOUD_COVER',
            value: cloudList[i],
            unit: 'percent',
            quality: assessment.status,
            provenance: prov,
            createdAt: nowUtc(),
          });
        }
      }

      return observations;
    } catch (err: any) {
      logger.error('[OpenMeteoWeatherAdapter] Live weather query failed', { error: err.message });
      throw err;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string; provider?: string }> {
    try {
      const url = `${this.baseUrl}/forecast?latitude=39.18&longitude=22.75&hourly=precipitation&forecast_days=1`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      return {
        healthy: res.ok,
        provider: 'Open-Meteo Weather API',
        details: res.ok ? 'Open-Meteo reachable and healthy' : `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        healthy: false,
        provider: 'Open-Meteo Weather API',
        details: `Failed connecting to Open-Meteo: ${err.message}`,
      };
    }
  }
}

let weatherAdapterInstance: IWeatherAdapter | null = null;

export function getWeatherAdapter(): IWeatherAdapter {
  if (!weatherAdapterInstance) {
    if (config.APP_MODE === 'live') {
      weatherAdapterInstance = new OpenMeteoWeatherAdapter();
    } else {
      weatherAdapterInstance = new DemoWeatherAdapter();
    }
  }
  return weatherAdapterInstance;
}

export function resetWeatherAdapter(): void {
  weatherAdapterInstance = null;
}
