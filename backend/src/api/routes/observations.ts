import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ObservationFilter } from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { nowUtc } from '../../domain/value-objects.js';
import { ingestionService } from '../../services/ingestion/ingestion-service.js';

export const observationsRouter = Router();

const createObservationSchema = z.object({
  source: z.enum([
    'SATELLITE_SENTINEL2',
    'CITIZEN_REPORT',
    'WEATHER_STATION',
    'IN_SITU_SENSOR',
    'HISTORICAL_BASELINE',
    'FIELD_INSPECTION',
  ]),
  timestamp: z.string().datetime().or(z.string()),
  location: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  streamReachId: z.string().uuid().or(z.string().min(1)).optional().nullable(),
  indicator: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().min(1),
  sourceIdentifier: z.string().optional(),
  processingMethod: z.string().optional(),
  quality: z.enum(['RAW', 'VALIDATED', 'FLAGGED', 'SUSPICIOUS', 'REJECTED']).optional(),
  metadata: z.record(z.any()).optional(),
});

observationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const streamReachId = req.query.streamReachId as string | undefined;
    const source = req.query.source as string | undefined;
    const indicator = req.query.indicator as string | undefined;
    const quality = req.query.quality as any | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const filter: ObservationFilter = {
      streamReachId,
      source,
      indicator,
      quality,
      startDate,
      endDate,
      limit,
    };

    const observations = await repos.observations.find(filter);

    res.json({
      success: true,
      data: observations,
      meta: {
        total: observations.length,
        limit,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

observationsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const obs = await repos.observations.findById(req.params.id);
    if (!obs) {
      throw new NotFoundError(`Observation with id '${req.params.id}' not found`);
    }
    res.json({
      success: true,
      data: obs,
    });
  } catch (err) {
    next(err);
  }
});

observationsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createObservationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid observation payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const result = await ingestionService.ingest({
      source: parsed.data.source,
      timestamp: parsed.data.timestamp,
      location: parsed.data.location,
      streamReachId: parsed.data.streamReachId,
      indicator: parsed.data.indicator,
      value: parsed.data.value,
      unit: parsed.data.unit,
      sourceIdentifier: parsed.data.sourceIdentifier,
      processingMethod: parsed.data.processingMethod,
      metadata: parsed.data.metadata,
    });

    const statusCode = result.isDuplicate ? 200 : 201;

    res.status(statusCode).json({
      success: true,
      data: result.observation,
      meta: {
        isDuplicate: result.isDuplicate,
        streamReachMatched: result.streamReachMatched,
        streamReachName: result.streamReach?.name,
      },
    });
  } catch (err) {
    next(err);
  }
});
