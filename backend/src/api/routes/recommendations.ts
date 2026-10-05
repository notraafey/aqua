/**
 * Recommendations REST API Router
 * Conforms to Phase 4 PRD Section 20.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getRepositories } from '../../database/repositories/index.js';
import { getOperationalResponseService } from '../../services/response/operational-response-service.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { nowUtc } from '../../domain/value-objects.js';
import { FhirMapper } from '../../adapters/fhir/mapper.js';

export const recommendationsRouter = Router();

// GET /api/v1/recommendations
recommendationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const filter = {
      incidentId: req.query.incidentId as string | undefined,
      assessmentId: req.query.assessmentId as string | undefined,
      status: req.query.status as any | undefined,
      measureId: req.query.measureId as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };

    const recommendations = await repos.recommendations.findAll(filter);

    res.json({
      success: true,
      data: recommendations,
      meta: {
        total: recommendations.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/recommendations/incident/:incidentId
recommendationsRouter.get('/incident/:incidentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const recommendations = await repos.recommendations.findByIncidentId(req.params.incidentId);

    res.json({
      success: true,
      data: recommendations,
      meta: {
        total: recommendations.length,
        incidentId: req.params.incidentId,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/recommendations/:id
recommendationsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const rec = await repos.recommendations.findById(req.params.id);
    if (!rec) {
      throw new NotFoundError(`Recommendation with id '${req.params.id}' not found`);
    }

    const fhirTaskDraft = FhirMapper.toFhirTaskDraft(rec);

    res.json({
      success: true,
      data: {
        ...rec,
        recommendation: rec,
        fhirTaskDraft,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/recommendations/:id/approve
recommendationsRouter.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const approveSchema = z.object({
      notes: z.string().optional(),
      assignedTo: z.string().optional(),
      actor: z.string().optional(),
    });

    const parsed = approveSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid approval payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const service = getOperationalResponseService();
    const result = await service.approveRecommendation(req.params.id, {
      notes: parsed.data.notes,
      assignedTo: parsed.data.assignedTo,
      actor: parsed.data.actor,
    });

    res.json({
      success: true,
      data: result,
      message: 'Recommendation approved and operational task dispatched to FHIR.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/recommendations/:id/reject
recommendationsRouter.post('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rejectSchema = z.object({
      reason: z.string().min(3, 'Rejection reason must be at least 3 characters long'),
      actor: z.string().optional(),
    });

    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid rejection payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const service = getOperationalResponseService();
    const result = await service.rejectRecommendation(req.params.id, {
      reason: parsed.data.reason,
      actor: parsed.data.actor,
    });

    res.json({
      success: true,
      data: result,
      message: 'Recommendation rejected with logged rationale.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/recommendations/:id/request-more-evidence
recommendationsRouter.post('/:id/request-more-evidence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const moreEvidenceSchema = z.object({
      notes: z.string().optional(),
      missingData: z.array(z.string()).optional(),
      assignedTo: z.string().optional(),
      actor: z.string().optional(),
    });

    const parsed = moreEvidenceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid request-more-evidence payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const service = getOperationalResponseService();
    const result = await service.requestMoreEvidence(req.params.id, {
      notes: parsed.data.notes,
      missingData: parsed.data.missingData,
      assignedTo: parsed.data.assignedTo,
      actor: parsed.data.actor,
    });

    res.json({
      success: true,
      data: {
        ...result,
        ...result.recommendation,
      },
      message: 'Requested additional evidence and generated targeted verification task.',
    });
  } catch (err) {
    next(err);
  }
});
