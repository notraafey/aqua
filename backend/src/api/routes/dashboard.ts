/**
 * Dashboard Summary API Router
 * Conforms to AquaSentinel Phase 5 PRD Section 6 & Section 35.
 * 
 * Provides unified, top-level operational metrics:
 * - Active incidents count
 * - High-priority incidents count
 * - Pending human reviews count
 * - Tasks in progress count
 * - Tasks awaiting verification count
 * - Environmental reaches monitored count
 * - Last ingestion timestamp
 * - System health status
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getRepositories } from '../../database/repositories/index.js';
import { isDatabaseHealthy } from '../../database/client.js';
import { config } from '../../config/index.js';

export const dashboardRouter = Router();

// GET /api/v1/dashboard/summary
dashboardRouter.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repos = getRepositories();
    const [incidents, tasks, reaches, observations, recommendations] = await Promise.all([
      repos.incidents.findAll().catch(() => []),
      repos.tasks.findAll().catch(() => []),
      repos.streamReaches.findAll().catch(() => []),
      repos.observations.findAll(50).catch(() => []),
      repos.recommendations.findAll().catch(() => []),
    ]);

    const activeIncidents = incidents.filter(
      (i) => i.status !== 'RESOLVED' && i.status !== 'DISMISSED'
    );
    const highPriorityIncidents = activeIncidents.filter(
      (i) => i.severity === 'CRITICAL' || i.severity === 'HIGH'
    );
    const pendingReviews = recommendations.filter((r) => r.status === 'PENDING_REVIEW');
    const tasksInProgress = tasks.filter(
      (t) => t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED'
    );
    const tasksAwaitingVerification = tasks.filter((t) => t.status === 'COMPLETED');
    const lastObservation = observations.length > 0 ? observations[0] : null;

    const dbHealth = await isDatabaseHealthy();
    const isHealthy = dbHealth.healthy || config.APP_MODE === 'demo';

    res.json({
      success: true,
      data: {
        activeIncidentsCount: activeIncidents.length,
        highPriorityIncidentsCount: highPriorityIncidents.length,
        pendingHumanReviewsCount: pendingReviews.length,
        tasksInProgressCount: tasksInProgress.length,
        tasksAwaitingVerificationCount: tasksAwaitingVerification.length,
        environmentalReachesMonitoredCount: reaches.length,
        lastIngestionTimestamp: lastObservation ? lastObservation.timestamp : null,
        systemHealth: isHealthy ? 'healthy' : 'degraded',
        recentIncidents: incidents.slice(0, 10),
        recentTasks: tasks.slice(0, 10),
        recentObservations: observations.slice(0, 10),
      },
    });
  } catch (err) {
    next(err);
  }
});
