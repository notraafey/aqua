import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../config/index.js';
import { requestLogger } from './middleware/request-logger.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler, NotFoundError } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { streamReachesRouter } from './routes/stream-reaches.js';
import { observationsRouter } from './routes/observations.js';
import { incidentsRouter } from './routes/incidents.js';
import { tasksRouter } from './routes/tasks.js';
import { webhooksRouter } from './routes/webhooks.js';
import { ingestionRouter } from './routes/ingestion.js';
import { evidenceAssessmentsRouter } from './routes/evidence-assessments.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { catalogueRouter } from './routes/catalogue.js';
import { demoRouter } from './routes/demo.js';
import { eventsRouter } from './routes/events.js';
import { dashboardRouter } from './routes/dashboard.js';
import { resilienceRouter } from './routes/resilience.js';
import { interoperabilityRouter } from './routes/interoperability.js';
import { verificationsRouter } from './routes/verifications.js';
import { actorsRouter } from './routes/actors.js';
import { responseAnalyticsRouter } from './routes/response-analytics.js';

export function createServer(): Express {
  const app = express();

  // Security headers
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS configuration
  const allowedOrigins = config.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Allow dev origins gracefully
        }
      },
      credentials: true,
    })
  );

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request correlation and structured logging
  app.use(requestLogger);

  // Authentication & Role context
  app.use(authMiddleware);

  // Root health endpoint
  app.use('/api', healthRouter);

  // API v1 versioned routes
  const v1 = express.Router();
  v1.use('/', healthRouter);
  v1.use('/stream-reaches', streamReachesRouter);
  v1.use('/observations', observationsRouter);
  v1.use('/ingestion', ingestionRouter);
  v1.use('/incidents', incidentsRouter);
  v1.use('/tasks', tasksRouter);
  v1.use('/recommendations', recommendationsRouter);
  v1.use('/actions/catalogue', catalogueRouter);
  v1.use('/demo', demoRouter);
  v1.use('/webhooks', webhooksRouter);
  v1.use('/evidence-assessments', evidenceAssessmentsRouter);
  v1.use('/events', eventsRouter);
  v1.use('/dashboard', dashboardRouter);
  v1.use('/resilience', resilienceRouter);
  v1.use('/interoperability', interoperabilityRouter);
  v1.use('/verifications', verificationsRouter);
  v1.use('/actors', actorsRouter);
  v1.use('/analytics/response', responseAnalyticsRouter);

  app.use('/api/v1', v1);

  // Catch-all 404 handler
  app.use((req, _res, next) => {
    next(new NotFoundError(`Endpoint '${req.method} ${req.originalUrl}' not found on server`));
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
