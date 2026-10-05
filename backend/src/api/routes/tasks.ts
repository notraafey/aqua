/**
 * Operational Tasks REST API Router
 * Conforms to Phase 4 PRD Sections 15, 17, 20, 23, 27.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Task } from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { getOperationalResponseService } from '../../services/response/operational-response-service.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';
import { getEventBus } from '../../events/index.js';
import { getFhirAdapter } from '../../adapters/fhir/index.js';
import { FhirMapper } from '../../adapters/fhir/mapper.js';

export const tasksRouter = Router();

// GET /api/v1/tasks
tasksRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const filter = {
      incidentId: req.query.incidentId as string | undefined,
      recommendationId: req.query.recommendationId as string | undefined,
      status: req.query.status as any | undefined,
      assignedTo: req.query.assignedTo as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };

    const tasks = await repos.tasks.findAll(filter);

    res.json({
      success: true,
      data: tasks,
      meta: {
        total: tasks.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tasks/:id
tasksRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const task = await repos.tasks.findById(req.params.id);
    if (!task) {
      throw new NotFoundError(`Task with id '${req.params.id}' not found`);
    }
    res.json({
      success: true,
      data: task,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tasks/:id/audit-trail
tasksRouter.get('/:id/audit-trail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const events = await repos.auditLogs.findByTaskId(req.params.id);

    res.json({
      success: true,
      data: events,
      meta: {
        total: events.length,
        taskId: req.params.id,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tasks/:id/fhir
tasksRouter.get('/:id/fhir', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const task = await repos.tasks.findById(req.params.id);
    if (!task) {
      throw new NotFoundError(`Task with id '${req.params.id}' not found`);
    }

    const fhir = getFhirAdapter();
    const fhirResource = await fhir.fetchTask(task.fhirTaskId || task.id) || FhirMapper.toFhirTask(task);

    res.json({
      success: true,
      data: fhirResource,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks
tasksRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const createTaskSchema = z.object({
      incidentId: z.string().min(1),
      recommendationId: z.string().optional(),
      assessmentId: z.string().optional(),
      taskType: z.string().optional(),
      title: z.string().optional(),
      assignedRole: z.string().optional(),
      assignedTo: z.string().min(1),
      location: z.object({
        type: z.literal('Point'),
        coordinates: z.tuple([z.number(), z.number()]),
      }),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
      instructions: z.string().min(1),
      requiredEvidence: z.array(z.string()).optional(),
    });

    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid task payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const repos = getRepositories();
    const now = nowUtc();
    const task: Task = {
      id: generateId(),
      incidentId: parsed.data.incidentId,
      recommendationId: parsed.data.recommendationId,
      assessmentId: parsed.data.assessmentId,
      taskType: parsed.data.taskType as any,
      title: parsed.data.title || parsed.data.instructions,
      assignedRole: parsed.data.assignedRole,
      assignedTo: parsed.data.assignedTo,
      location: parsed.data.location,
      priority: parsed.data.priority,
      instructions: parsed.data.instructions,
      requiredEvidence: parsed.data.requiredEvidence,
      status: 'REQUESTED',
      createdAt: now,
    };

    const saved = await repos.tasks.create(task);

    // Event bus notification
    const eventBus = getEventBus();
    await eventBus.publish({
      eventId: generateId(),
      eventType: 'TaskCreated',
      timestamp: now,
      actor: 'system:task_engine',
      payload: { task: saved },
    });

    // Mirror to FHIR adapter
    const fhir = getFhirAdapter();
    fhir.publishTask(saved).then((fhirId) => {
      repos.tasks.update(saved.id, { fhirTaskId: fhirId }).catch(() => {});
    }).catch(() => {});

    res.status(201).json({
      success: true,
      data: saved,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks/:id/accept
tasksRouter.post('/:id/accept', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = req.body.actor || 'Human Operator';
    const notes = req.body.notes;
    const service = getOperationalResponseService();
    const updated = await service.transitionTaskStatus(req.params.id, 'ACCEPTED', actor, notes);

    res.json({
      success: true,
      data: updated,
      message: 'Task accepted for execution.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks/:id/start
tasksRouter.post('/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = req.body.actor || 'Human Operator';
    const notes = req.body.notes;
    const service = getOperationalResponseService();
    const updated = await service.transitionTaskStatus(req.params.id, 'IN_PROGRESS', actor, notes);

    res.json({
      success: true,
      data: updated,
      message: 'Task marked in progress.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks/:id/complete
tasksRouter.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = req.body.actor || 'Human Operator';
    const notes = req.body.notes || 'Completed field actions';
    const service = getOperationalResponseService();
    const updated = await service.transitionTaskStatus(req.params.id, 'COMPLETED', actor, notes);

    res.json({
      success: true,
      data: updated,
      message: 'Task successfully marked completed.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks/:id/verify
tasksRouter.post('/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = req.body.actor || 'Supervisor';
    const notes = req.body.notes || 'Task execution verified by supervisor';
    const service = getOperationalResponseService();
    const updated = await service.transitionTaskStatus(req.params.id, 'VERIFIED', actor, notes);

    res.json({
      success: true,
      data: updated,
      message: 'Task successfully verified.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks/:id/cancel
tasksRouter.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = req.body.actor || 'Human Operator';
    const reason = req.body.reason || req.body.notes || 'Cancelled by operator';
    const service = getOperationalResponseService();
    const updated = await service.transitionTaskStatus(req.params.id, 'CANCELLED', actor, reason);

    res.json({
      success: true,
      data: updated,
      message: 'Task cancelled.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks/:id/assign
tasksRouter.post('/:id/assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignSchema = z.object({
      actorId: z.string().min(1),
      assignedBy: z.string().optional(),
      notes: z.string().optional(),
    });

    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid task assignment payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const service = getOperationalResponseService();
    const updated = await service.assignTask(
      req.params.id,
      parsed.data.actorId,
      parsed.data.assignedBy || 'Supervisor',
      parsed.data.notes
    );

    res.json({
      success: true,
      data: updated,
      message: `Task successfully assigned to actor ${parsed.data.actorId}`,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/tasks/:id
tasksRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updateSchema = z.object({
      status: z.enum([
        'DRAFT',
        'APPROVED',
        'ASSIGNED',
        'ACCEPTED',
        'IN_PROGRESS',
        'AWAITING_VERIFICATION',
        'COMPLETED',
        'VERIFIED',
        'REJECTED',
        'CANCELLED',
        'REQUESTED',
      ]).optional(),
      assignedTo: z.string().optional(),
      instructions: z.string().optional(),
      notes: z.string().optional(),
    });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid task patch payload',
        parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
      );
    }

    const service = getOperationalResponseService();
    const repos = getRepositories();
    if (parsed.data.status) {
      const updated = await service.transitionTaskStatus(
        req.params.id,
        parsed.data.status,
        'API Client',
        parsed.data.notes
      );
      return res.json({ success: true, data: updated });
    }

    const updated = await repos.tasks.update(req.params.id, parsed.data);
    if (!updated) {
      throw new NotFoundError(`Task with id '${req.params.id}' not found`);
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});
