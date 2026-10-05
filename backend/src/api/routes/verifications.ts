/**
 * Field Verifications REST API Router
 * Conforms to Phase 8 PRD Sections 11, 13, 20, 27, 30, 39, 40.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  Verification,
  VerificationFilter,
  StructuredFieldObservations,
  VerificationLocation,
  VerificationStatusType,
  PhotoEvidence,
  SampleEvidence,
} from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { getOperationalResponseService, SubmitVerificationInput } from '../../services/response/operational-response-service.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';

export const verificationsRouter = Router();

// Validation schemas
const structuredObservationsSchema = z.object({
  waterColour: z.string().optional(),
  surfaceAppearance: z.string().optional(),
  odour: z.string().optional(),
  foam: z.boolean().optional(),
  visibleAlgae: z.boolean().optional(),
  deadFish: z.union([z.number(), z.boolean()]).optional(),
  debris: z.string().optional(),
  flowConditions: z.string().optional(),
  weatherConditions: z.string().optional(),
  humanActivity: z.string().optional(),
  visiblePollutionSource: z.string().optional(),
  inSituProbeTurbidityNtu: z.number().optional(),
  inSituProbeDoMgL: z.number().optional(),
  inSituProbePh: z.number().optional(),
  inSituProbeTempC: z.number().optional(),
  estimatedWidthMeters: z.number().optional(),
  estimatedDepthMeters: z.number().optional(),
}).passthrough();

const verificationLocationSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracyMeters: z.number().optional(),
  timestamp: z.string().optional(),
  validationStatus: z.enum(['AT_LOCATION', 'NEAR_LOCATION', 'OUTSIDE_EXPECTED_AREA', 'UNKNOWN']).optional(),
  distanceMeters: z.number().optional(),
  isWithinGeofence: z.boolean().optional(),
});

// GET /api/v1/verifications
verificationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const filter: VerificationFilter = {
      taskId: req.query.taskId as string | undefined,
      incidentId: req.query.incidentId as string | undefined,
      status: req.query.status as VerificationStatusType | undefined,
      inspectorId: req.query.inspectorId as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };

    const verifications = await repos.verifications.findAll(filter);

    res.json({
      success: true,
      data: verifications,
      meta: {
        total: verifications.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/verifications/:id
verificationsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const verification = await repos.verifications.findById(req.params.id);
    if (!verification) {
      throw new NotFoundError(`Verification with id '${req.params.id}' not found`);
    }

    res.json({
      success: true,
      data: verification,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/verifications
// Creates an initial draft verification record for a task
verificationsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const createSchema = z.object({
      taskId: z.string().min(1),
      incidentId: z.string().min(1),
      inspector: z.object({
        id: z.string().optional(),
        actorId: z.string().optional(),
        name: z.string().min(1),
        role: z.string().optional(),
        organization: z.string().optional(),
        contact: z.string().optional(),
      }),
      location: verificationLocationSchema,
      observations: structuredObservationsSchema.optional().default({}),
      notes: z.string().optional().default(''),
      clientSubmissionId: z.string().optional(),
    });

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid verification draft payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const repos = getRepositories();
    const now = nowUtc();
    const verification: Verification = {
      id: generateId(),
      taskId: parsed.data.taskId,
      incidentId: parsed.data.incidentId,
      inspector: parsed.data.inspector as any,
      timestamp: now,
      location: parsed.data.location as any,
      status: 'UNCERTAIN', // Draft status until fully submitted
      observations: parsed.data.observations as StructuredFieldObservations,
      notes: parsed.data.notes,
      evidence: {
        photos: [],
        samples: [],
      },
      clientSubmissionId: parsed.data.clientSubmissionId,
      syncStatus: 'LOCAL_ONLY',
      conflictStatus: 'NONE',
      createdAt: now,
      updatedAt: now,
    };

    const saved = await repos.verifications.create(verification);

    res.status(201).json({
      success: true,
      data: saved,
      message: 'Verification draft created',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/verifications/:id/evidence
// Attaches photos or samples to an ongoing verification
verificationsRouter.post('/:id/evidence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const existing = await repos.verifications.findById(req.params.id);
    if (!existing) {
      throw new NotFoundError(`Verification with id '${req.params.id}' not found`);
    }

    const photos = req.body.photos || [];
    const samples = req.body.samples || [];
    const notes = req.body.notes;

    const updatedPhotos: PhotoEvidence[] = [...(existing.evidence?.photos || []), ...photos] as PhotoEvidence[];
    const updatedSamples: SampleEvidence[] = [...(existing.evidence?.samples || []), ...samples] as SampleEvidence[];
    const updatedNotes = notes
      ? (existing.notes ? `${existing.notes}\n${notes}` : notes)
      : existing.notes;

    const updated = await repos.verifications.update(existing.id, {
      evidence: { photos: updatedPhotos, samples: updatedSamples },
      notes: updatedNotes,
      updatedAt: nowUtc(),
    });

    res.json({
      success: true,
      data: updated,
      message: 'Evidence attached successfully',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/verifications/:id/submit
// Submits a verification through the closed-loop pipeline:
// geofence validation → observation ingestion → reassessment → outcome proposal → domain events
verificationsRouter.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const submitSchema = z.object({
      inspector: z.object({
        name: z.string().min(1),
        role: z.string().optional(),
        organization: z.string().optional(),
        contact: z.string().optional(),
        actorId: z.string().optional(),
      }),
      status: z.enum(['CONFIRMED', 'NOT_CONFIRMED', 'UNCERTAIN', 'PARTIALLY_CONFIRMED', 'REQUIRES_FOLLOW_UP']),
      location: verificationLocationSchema,
      observations: structuredObservationsSchema,
      notes: z.string().optional().default(''),
      photos: z.array(z.any()).optional(),
      samples: z.array(z.any()).optional(),
      clientSubmissionId: z.string().optional(),
      actor: z.string().optional(),
    });

    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid verification submission payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    // Look up the existing draft verification to get the taskId
    const repos = getRepositories();
    const existingVerification = await repos.verifications.findById(req.params.id);
    if (!existingVerification) {
      throw new NotFoundError(`Verification with id '${req.params.id}' not found`);
    }

    const input: SubmitVerificationInput = {
      taskId: existingVerification.taskId,
      inspector: parsed.data.inspector as any,
      location: parsed.data.location as any,
      status: parsed.data.status as VerificationStatusType,
      observations: parsed.data.observations as StructuredFieldObservations,
      notes: parsed.data.notes,
      photos: parsed.data.photos as PhotoEvidence[] | undefined,
      samples: parsed.data.samples as SampleEvidence[] | undefined,
      clientSubmissionId: parsed.data.clientSubmissionId,
      actor: parsed.data.actor,
    };

    const service = getOperationalResponseService();
    const result = await service.submitVerification(input);

    res.json({
      success: true,
      data: result,
      message: 'Verification submitted and closed-loop response processed',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/verifications/sync
// Batch offline sync endpoint supporting idempotent queued uploads
verificationsRouter.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const syncBatchSchema = z.object({
      items: z.array(
        z.object({
          taskId: z.string().min(1),
          inspector: z.object({
            name: z.string().min(1),
            role: z.string().optional(),
            organization: z.string().optional(),
            contact: z.string().optional(),
            actorId: z.string().optional(),
          }),
          status: z.enum(['CONFIRMED', 'NOT_CONFIRMED', 'UNCERTAIN', 'PARTIALLY_CONFIRMED', 'REQUIRES_FOLLOW_UP']),
          location: verificationLocationSchema,
          observations: structuredObservationsSchema,
          notes: z.string().optional().default(''),
          photos: z.array(z.any()).optional(),
          samples: z.array(z.any()).optional(),
          clientSubmissionId: z.string().min(1),
          actor: z.string().optional(),
        })
      ),
    });

    const parsed = syncBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid sync batch payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const service = getOperationalResponseService();
    const results: Array<{
      clientSubmissionId: string;
      status: string;
      verification?: Verification;
      outcome?: any;
      error?: string;
    }> = [];

    for (const item of parsed.data.items) {
      try {
        const input: SubmitVerificationInput = {
          taskId: item.taskId,
          inspector: item.inspector as any,
          location: item.location as any,
          status: item.status as VerificationStatusType,
          observations: item.observations as StructuredFieldObservations,
          notes: item.notes,
          photos: item.photos as PhotoEvidence[] | undefined,
          samples: item.samples as SampleEvidence[] | undefined,
          clientSubmissionId: item.clientSubmissionId,
          actor: item.actor,
        };

        const resSubmission = await service.submitVerification(input);
        results.push({
          clientSubmissionId: item.clientSubmissionId,
          status: 'SUCCESS',
          verification: resSubmission.verification,
          outcome: resSubmission.outcome,
        });
      } catch (subErr: any) {
        results.push({
          clientSubmissionId: item.clientSubmissionId,
          status: 'FAILED',
          error: subErr.message,
        });
      }
    }

    res.json({
      success: true,
      data: results,
      meta: {
        total: parsed.data.items.length,
        synced: results.filter((r) => r.status === 'SUCCESS').length,
        failed: results.filter((r) => r.status === 'FAILED').length,
      },
    });
  } catch (err) {
    next(err);
  }
});
