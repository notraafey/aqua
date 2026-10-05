/**
 * Evidence Assessments API Routes
 * Exposes endpoints for querying assessments, retrieving details, and triggering reassessments.
 * Conforms to Main PRD Section 18.2 and Phase 3 PRD Sections 43, 44.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getRepositories } from '../../database/repositories/index.js';
import { evidenceFusionService } from '../../services/evidence/evidence-fusion-service.js';
import { demoScenariosRunner } from '../../domain/evidence/demo-scenarios.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { nowUtc } from '../../domain/value-objects.js';

export const evidenceAssessmentsRouter = Router();

/**
 * GET /api/v1/evidence-assessments
 * Filterable query endpoint for evidence assessments
 */
evidenceAssessmentsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const querySchema = z.object({
      streamReachId: z.string().optional(),
      confidenceBand: z.enum(['NORMAL', 'VERIFY', 'INVESTIGATE', 'PRIORITIZE', 'LOW', 'MEDIUM', 'HIGH']).optional(),
      minScore: z.string().transform((v) => parseFloat(v)).pipe(z.number().min(0).max(100)).optional(),
      maxScore: z.string().transform((v) => parseFloat(v)).pipe(z.number().min(0).max(100)).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().min(1).max(200)).optional(),
    });

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid query parameters for evidence assessments',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const filter = {
      streamReachId: parsed.data.streamReachId,
      confidenceBand: parsed.data.confidenceBand as any,
      minScore: parsed.data.minScore,
      maxScore: parsed.data.maxScore,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      limit: parsed.data.limit ?? 50,
    };

    const assessments = await repos.evidenceAssessments.findAll(filter);

    res.json({
      success: true,
      data: assessments,
      meta: {
        total: assessments.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/evidence-assessments/demo-scenarios
 * Returns the 5 deterministic demo scenarios for operator and test inspection
 */
evidenceAssessmentsRouter.get('/demo-scenarios', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const scenarios = demoScenariosRunner.runAllScenarios();
    res.json({
      success: true,
      data: scenarios,
      meta: {
        total: scenarios.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/evidence-assessments/:id
 * Retrieve a specific evidence assessment with detailed breakdown
 */
evidenceAssessmentsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const assessment = await repos.evidenceAssessments.findById(req.params.id);

    if (!assessment) {
      throw new NotFoundError(`Evidence assessment with id '${req.params.id}' not found`);
    }

    const reach = await repos.streamReaches.findById(assessment.streamReachId);

    res.json({
      success: true,
      data: {
        assessment,
        streamReach: reach,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/evidence-assessments/reassess
 * Trigger an on-demand reassessment for a stream reach
 */
evidenceAssessmentsRouter.post('/reassess', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bodySchema = z.object({
      streamReachId: z.string().min(1, 'streamReachId is required'),
      candidateId: z.string().optional(),
      force: z.boolean().optional().default(true),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid reassess payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const result = await evidenceFusionService.reassess(
      parsed.data.streamReachId,
      parsed.data.candidateId
    );

    res.status(200).json({
      success: true,
      data: result,
      meta: {
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});
