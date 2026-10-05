import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StreamReach } from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';

export const streamReachesRouter = Router();

const createStreamReachSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  region: z.string().min(2),
  monitoringStatus: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  geometry: z.object({
    type: z.enum(['Point', 'LineString', 'Polygon']),
    coordinates: z.any(),
  }),
  waterCoverageConstraint: z
    .object({
      minWidthMeters: z.number(),
      confidencePenalty: z.number(),
    })
    .optional(),
  baselineData: z.record(z.any()).optional(),
});

streamReachesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const reaches = await repos.streamReaches.findAll();
    res.json({
      success: true,
      data: reaches,
      meta: {
        total: reaches.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

streamReachesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const reach = await repos.streamReaches.findById(req.params.id);
    if (!reach) {
      throw new NotFoundError(`Stream reach with id '${req.params.id}' not found`);
    }
    res.json({
      success: true,
      data: reach,
    });
  } catch (err) {
    next(err);
  }
});

streamReachesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createStreamReachSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid stream reach input', parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })));
    }

    const repos = getRepositories();
    const now = nowUtc();
    const newReach: StreamReach = {
      id: generateId(),
      name: parsed.data.name,
      city: parsed.data.city,
      region: parsed.data.region,
      monitoringStatus: parsed.data.monitoringStatus,
      geometry: parsed.data.geometry as any,
      waterCoverageConstraint: parsed.data.waterCoverageConstraint,
      baselineData: parsed.data.baselineData,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await repos.streamReaches.create(newReach);
    res.status(201).json({
      success: true,
      data: saved,
    });
  } catch (err) {
    next(err);
  }
});
