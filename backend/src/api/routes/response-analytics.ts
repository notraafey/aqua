/**
 * Response Analytics REST API Router
 * Conforms to Phase 8 PRD Sections 41, 42.
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  Task,
  Verification,
  FieldActor,
  IncidentOutcome,
  VerificationLocation,
} from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { nowUtc } from '../../domain/value-objects.js';

export const responseAnalyticsRouter = Router();

// GET /api/v1/analytics/response
responseAnalyticsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();

    // Fetch all data sets in parallel
    const [tasks, verifications, actors]: [Task[], Verification[], FieldActor[]] = await Promise.all([
      repos.tasks.findAll(),
      repos.verifications.findAll(),
      repos.fieldActors.findAll(),
    ]);

    // Collect outcomes across all incidents that have verifications
    const incidentIds = [...new Set(verifications.map((v: Verification) => v.incidentId))];
    const outcomes: IncidentOutcome[] = [];
    for (const incId of incidentIds) {
      const incOutcomes = await repos.incidentOutcomes.findByIncidentId(incId);
      outcomes.push(...incOutcomes);
    }

    const totalTasks = tasks.length;
    const verifiedTasks = tasks.filter((t: Task) => t.status === 'VERIFIED' || t.status === 'COMPLETED').length;
    const pendingTasks = tasks.filter((t: Task) =>
      ['REQUESTED', 'APPROVED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'AWAITING_VERIFICATION'].includes(t.status)
    ).length;

    // Outcome counts
    const outcomeCounts: Record<string, number> = {
      CONFIRMED: 0,
      NOT_CONFIRMED: 0,
      UNCERTAIN: 0,
      ESCALATE: 0,
      ADDITIONAL_VERIFICATION_REQUIRED: 0,
    };

    outcomes.forEach((o: IncidentOutcome) => {
      const key = o.confirmedOutcome || o.proposedOutcome;
      outcomeCounts[key] = (outcomeCounts[key] || 0) + 1;
    });

    const confirmedCount = outcomeCounts.CONFIRMED || 0;
    const notConfirmedCount = outcomeCounts.NOT_CONFIRMED || 0;
    const totalConcluded = confirmedCount + notConfirmedCount;
    const falseAlarmRate = totalConcluded > 0 ? Number(((notConfirmedCount / totalConcluded) * 100).toFixed(1)) : 0;

    // Geofence compliance
    let geofenceCompliantCount = 0;
    verifications.forEach((v: Verification) => {
      const loc = v.location as VerificationLocation;
      if (loc?.validationStatus === 'AT_LOCATION' || loc?.validationStatus === 'NEAR_LOCATION' || loc?.isWithinGeofence) {
        geofenceCompliantCount++;
      }
    });
    const geofenceComplianceRate = verifications.length > 0
      ? Number(((geofenceCompliantCount / verifications.length) * 100).toFixed(1))
      : 100;

    // Average response latency (from task createdAt to verification timestamp)
    let totalLatencyHours = 0;
    let latencySamples = 0;

    for (const v of verifications) {
      const task = tasks.find((t: Task) => t.id === v.taskId);
      if (task?.createdAt && v.timestamp) {
        const diffMs = new Date(v.timestamp).getTime() - new Date(task.createdAt).getTime();
        if (diffMs > 0) {
          totalLatencyHours += diffMs / (1000 * 60 * 60);
          latencySamples++;
        }
      }
    }

    const avgResponseTimeHours = latencySamples > 0
      ? Number((totalLatencyHours / latencySamples).toFixed(2))
      : 0;

    // Inspector workload summary
    const actorMetrics = actors.map((actor: FieldActor) => {
      const actorVerifications = verifications.filter((v: Verification) => {
        const insp: any = v.inspector;
        return insp?.id === actor.actorId || insp?.actorId === actor.actorId || v.observer === actor.name;
      });
      const actorTasks = tasks.filter((t: Task) => t.assignedTo === actor.name || t.assignedTo === actor.actorId);

      return {
        actorId: actor.actorId,
        name: actor.name,
        role: actor.role,
        organization: actor.organization,
        active: actor.active,
        tasksAssigned: actorTasks.length,
        verificationsSubmitted: actorVerifications.length,
      };
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalTasks,
          verifiedTasks,
          pendingTasks,
          totalVerifications: verifications.length,
          totalOutcomes: outcomes.length,
          confirmedCount,
          falseAlarmCount: notConfirmedCount,
          falseAlarmRate,
          geofenceComplianceRate,
          avgResponseTimeHours,
        },
        outcomeBreakdown: outcomeCounts,
        actorMetrics,
        recentOutcomes: outcomes.slice(0, 10),
      },
      meta: {
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});
