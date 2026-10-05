/**
 * Field Actors REST API Router
 * Conforms to Phase 8 PRD Sections 13, 14, 27.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getRepositories } from '../../database/repositories/index.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { nowUtc } from '../../domain/value-objects.js';

export const actorsRouter = Router();

// GET /api/v1/actors
actorsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    // IFieldActorRepository.findAll() takes no filter argument
    const allActors = await repos.fieldActors.findAll();

    // Client-side filtering by query params
    let actors = allActors;
    if (req.query.role) {
      actors = actors.filter((a) => a.role === req.query.role);
    }
    if (req.query.status) {
      const isActive = req.query.status === 'active';
      actors = actors.filter((a) => a.active === isActive);
    }
    if (req.query.organization) {
      actors = actors.filter((a) => a.organization === req.query.organization);
    }

    res.json({
      success: true,
      data: actors,
      meta: {
        total: actors.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/actors/:id
actorsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const actor = await repos.fieldActors.findById(req.params.id);
    if (!actor) {
      throw new NotFoundError(`Field actor with id '${req.params.id}' not found`);
    }

    res.json({
      success: true,
      data: actor,
    });
  } catch (err) {
    next(err);
  }
});
