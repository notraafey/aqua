/**
 * OneAquaHealth Catalogue of Measures REST API Router
 * Conforms to Phase 4 PRD Section 20.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getRepositories } from '../../database/repositories/index.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { nowUtc } from '../../domain/value-objects.js';

export const catalogueRouter = Router();

// GET /api/v1/actions/catalogue
catalogueRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const incidentType = req.query.incidentType as string | undefined;

    const measures = incidentType
      ? await repos.catalogue.findByIncidentType(incidentType)
      : await repos.catalogue.findAll();

    res.json({
      success: true,
      data: measures,
      meta: {
        total: measures.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/actions/catalogue/:measureId
catalogueRouter.get('/:measureId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const measure = await repos.catalogue.findById(req.params.measureId);
    if (!measure) {
      throw new NotFoundError(`Catalogue measure with id '${req.params.measureId}' not found`);
    }

    res.json({
      success: true,
      data: measure,
    });
  } catch (err) {
    next(err);
  }
});
