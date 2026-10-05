import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getSatelliteAdapter } from '../../adapters/satellite/index.js';
import { getWeatherAdapter } from '../../adapters/weather/index.js';
import { getCitizenAdapter } from '../../adapters/citizen/index.js';
import { ingestionService } from '../../services/ingestion/ingestion-service.js';
import { getRepositories } from '../../database/repositories/index.js';
import { ValidationError, NotFoundError } from '../middleware/error-handler.js';
import { nowUtc } from '../../domain/value-objects.js';
import { logger } from '../../logging/index.js';

export const ingestionRouter = Router();

const satelliteIngestSchema = z.object({
  streamReachId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  maxCloudCover: z.number().min(0).max(1).optional(),
});

const weatherIngestSchema = z.object({
  streamReachId: z.string().optional(),
  location: z
    .object({
      type: z.literal('Point'),
      coordinates: z.tuple([z.number(), z.number()]),
    })
    .optional(),
  timestamp: z.string().optional(),
});

const citizenIngestSchema = z.object({
  streamReachId: z.string().optional(),
  location: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  timestamp: z.string().optional(),
  indicator: z.string().min(1),
  value: z.union([z.number(), z.string()]).optional(),
  description: z.string().min(1),
  reporterName: z.string().optional(),
  photos: z.array(z.string().url().or(z.string().min(1))).optional(),
});

/**
 * POST /api/v1/ingestion/satellite
 * Ingest Sentinel-2 L2A satellite observations (NDCI, cloud filtering)
 */
ingestionRouter.post('/satellite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = satelliteIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid satellite ingestion parameters',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const repos = getRepositories();
    const reaches = await repos.streamReaches.findAll();
    const targetReachId = parsed.data.streamReachId || reaches[0]?.id;

    if (!targetReachId) {
      throw new NotFoundError('No monitored stream reaches available for satellite query');
    }

    const reach = reaches.find((r) => r.id === targetReachId);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const satelliteAdapter = getSatelliteAdapter();
    const rawObs = await satelliteAdapter.fetchSentinelObservations({
      streamReachId: targetReachId,
      reach,
      startDate: parsed.data.startDate || sevenDaysAgo.toISOString(),
      endDate: parsed.data.endDate || now.toISOString(),
      maxCloudCover: parsed.data.maxCloudCover ?? 0.30,
    });

    const itemsToIngest = rawObs.map((obs) => ({
      source: obs.source,
      timestamp: obs.timestamp,
      location: obs.location,
      streamReachId: targetReachId,
      indicator: obs.indicator,
      value: obs.value,
      unit: obs.unit,
      sourceIdentifier: obs.provenance.sourceIdentifier,
      processingMethod: obs.provenance.processingMethod,
      cloudCoverFraction: (obs.metadata?.cloudCoverPercentage as number) ?? 0.05,
      metadata: obs.provenance.metadata,
    }));

    const result = await ingestionService.ingestBatch(itemsToIngest);

    res.status(200).json({
      success: true,
      data: {
        streamReachId: targetReachId,
        reachName: reach?.name,
        totalRetrieved: rawObs.length,
        newlyIngested: result.ingested,
        duplicatesSkipped: result.duplicates,
        observations: result.observations,
      },
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/ingestion/weather
 * Ingest hourly meteorological time series (precipitation, temperature, cloud cover)
 */
ingestionRouter.post('/weather', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = weatherIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid weather ingestion parameters',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const repos = getRepositories();
    const reaches = await repos.streamReaches.findAll();

    let targetLocation = parsed.data.location;
    let targetReachId = parsed.data.streamReachId;

    if (!targetLocation) {
      const reach = targetReachId ? reaches.find((r) => r.id === targetReachId) : reaches[0];
      if (reach && reach.geometry.type === 'LineString') {
        const coords = reach.geometry.coordinates[0];
        targetLocation = { type: 'Point', coordinates: [coords[0], coords[1]] };
        targetReachId = reach.id;
      } else {
        targetLocation = { type: 'Point', coordinates: [22.7535, 39.1812] };
      }
    }

    const weatherAdapter = getWeatherAdapter();
    const now = new Date();
    const rawObs = await weatherAdapter.fetchWeatherData({
      location: targetLocation,
      startDate: parsed.data.timestamp || new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
      endDate: now.toISOString(),
      streamReachId: targetReachId,
    });

    const itemsToIngest = rawObs.map((obs) => ({
      source: obs.source,
      timestamp: obs.timestamp,
      location: obs.location,
      streamReachId: obs.streamReachId,
      indicator: obs.indicator,
      value: obs.value,
      unit: obs.unit,
      sourceIdentifier: obs.provenance.sourceIdentifier,
      processingMethod: obs.provenance.processingMethod,
      metadata: obs.provenance.metadata,
    }));

    const result = await ingestionService.ingestBatch(itemsToIngest);

    res.status(200).json({
      success: true,
      data: {
        location: targetLocation,
        streamReachId: targetReachId,
        totalRetrieved: rawObs.length,
        newlyIngested: result.ingested,
        duplicatesSkipped: result.duplicates,
        observations: result.observations,
      },
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/ingestion/citizen
 * Ingest a citizen observation with optional photos/media references
 */
ingestionRouter.post('/citizen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = citizenIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid citizen report payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const citizenAdapter = getCitizenAdapter();
    const normalizedObs = await citizenAdapter.submitReport({
      reporterName: parsed.data.reporterName,
      timestamp: parsed.data.timestamp,
      location: parsed.data.location,
      streamReachId: parsed.data.streamReachId,
      indicator: parsed.data.indicator as any,
      value: parsed.data.value,
      description: parsed.data.description,
      photos: parsed.data.photos,
    });

    const result = await ingestionService.ingest({
      source: 'CITIZEN_REPORT',
      timestamp: normalizedObs.timestamp,
      location: normalizedObs.location,
      streamReachId: normalizedObs.streamReachId,
      indicator: normalizedObs.indicator,
      value: normalizedObs.value,
      unit: normalizedObs.unit,
      sourceIdentifier: normalizedObs.provenance.sourceIdentifier,
      processingMethod: normalizedObs.provenance.processingMethod,
      hasPhotos: Array.isArray(parsed.data.photos) && parsed.data.photos.length > 0,
      metadata: normalizedObs.provenance.metadata,
    });

    const statusCode = result.isDuplicate ? 200 : 201;

    res.status(statusCode).json({
      success: true,
      data: result.observation,
      meta: {
        isDuplicate: result.isDuplicate,
        streamReachMatched: result.streamReachMatched,
        streamReachName: result.streamReach?.name,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/ingestion/trigger-all
 * Triggers multi-source ingestion (Satellite + Weather + Citizen) for demonstration and testing
 */
ingestionRouter.post('/trigger-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const streamReachId = req.body?.streamReachId as string | undefined;
    const repos = getRepositories();
    const reaches = await repos.streamReaches.findAll();
    const targetReach = (streamReachId ? reaches.find((r) => r.id === streamReachId) : reaches[0]) || reaches[0];

    if (!targetReach) {
      throw new NotFoundError('No stream reaches available for multi-source ingestion');
    }

    logger.info('[IngestionRouter] Triggering multi-source ingestion run', {
      reachId: targetReach.id,
      reachName: targetReach.name,
    });

    // 1. Satellite
    const satelliteAdapter = getSatelliteAdapter();
    const satObs = await satelliteAdapter.fetchSentinelObservations({
      streamReachId: targetReach.id,
      reach: targetReach,
      startDate: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      endDate: new Date().toISOString(),
    });

    // 2. Weather
    const weatherAdapter = getWeatherAdapter();
    const weatherObs = await weatherAdapter.fetchWeatherData({
      location: {
        type: 'Point',
        coordinates: targetReach.geometry.type === 'LineString' ? targetReach.geometry.coordinates[0] : [22.7535, 39.1812],
      },
      streamReachId: targetReach.id,
    });

    // 3. Citizen
    const citizenAdapter = getCitizenAdapter();
    const citizenObs = await citizenAdapter.getRecentReports({ streamReachId: targetReach.id });

    // Ingest all through canonical IngestionService
    const allRaw = [
      ...satObs.map((o) => ({
        source: o.source,
        timestamp: o.timestamp,
        location: o.location,
        streamReachId: targetReach.id,
        indicator: o.indicator,
        value: o.value,
        unit: o.unit,
        sourceIdentifier: o.provenance.sourceIdentifier,
        processingMethod: o.provenance.processingMethod,
        cloudCoverFraction: (o.metadata?.cloudCoverPercentage as number) ?? 0.05,
        metadata: o.provenance.metadata,
      })),
      ...weatherObs.map((o) => ({
        source: o.source,
        timestamp: o.timestamp,
        location: o.location,
        streamReachId: targetReach.id,
        indicator: o.indicator,
        value: o.value,
        unit: o.unit,
        sourceIdentifier: o.provenance.sourceIdentifier,
        processingMethod: o.provenance.processingMethod,
        metadata: o.provenance.metadata,
      })),
      ...citizenObs.map((o) => ({
        source: o.source,
        timestamp: o.timestamp,
        location: o.location,
        streamReachId: targetReach.id,
        indicator: o.indicator,
        value: o.value,
        unit: o.unit,
        sourceIdentifier: o.provenance.sourceIdentifier,
        processingMethod: o.provenance.processingMethod,
        hasPhotos: Array.isArray((o.metadata as any)?.photos) && (o.metadata as any).photos.length > 0,
        metadata: o.provenance.metadata,
      })),
    ];

    const result = await ingestionService.ingestBatch(allRaw);

    res.status(200).json({
      success: true,
      data: {
        reachId: targetReach.id,
        reachName: targetReach.name,
        sourcesExecuted: ['SATELLITE_SENTINEL2', 'WEATHER_STATION', 'CITIZEN_REPORT'],
        totalObservationsProcessed: allRaw.length,
        newlyIngested: result.ingested,
        duplicatesSkipped: result.duplicates,
        observations: result.observations,
      },
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});
