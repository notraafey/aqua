import http from 'http';
import { createServer } from './api/server.js';
import { config } from './config/index.js';
import { logger } from './logging/logger.js';
import { isDatabaseHealthy, closeDatabasePool } from './database/client.js';
import { runMigrations } from './database/migrator.js';
import { seedBaselineData } from './database/seed.js';
import { setRepositories, createRepositories } from './database/repositories/index.js';
import { evidenceFusionService } from './services/evidence/evidence-fusion-service.js';
import { getOperationalResponseService } from './services/response/operational-response-service.js';
import { getInteroperabilityService } from './services/interoperability/interoperability-service.js';

async function bootstrap() {
  logger.info(`Starting AquaSentinel Backend in [${config.APP_MODE.toUpperCase()}] mode...`);
  logger.info(`Environment: ${config.NODE_ENV}, Port: ${config.PORT}`);

  // 1. Check Database Connectivity
  const dbHealth = await isDatabaseHealthy();
  if (dbHealth.healthy) {
    logger.info(`PostgreSQL connected successfully (${dbHealth.latencyMs}ms). Initializing schema...`);
    try {
      const migrationResult = await runMigrations();
      logger.info(`Database migrations up to date. (Applied: ${migrationResult.applied.length}, Skipped: ${migrationResult.skipped.length})`);
      const seeded = await seedBaselineData();
      logger.info(`Database baseline seeded (${seeded} new items).`);
    } catch (err: any) {
      logger.error('Error running migrations/seeds on Postgres:', { error: err.message });
    }
  } else {
    if (config.APP_MODE === 'demo' || config.NODE_ENV === 'development') {
      logger.warn(
        `PostgreSQL not reachable at ${config.DATABASE_URL}. Operating in DEMO/FALLBACK InMemory mode for rapid development.`
      );
      // Fallback to in-memory repositories
      const inMemoryContainer = createRepositories(true);
      setRepositories(inMemoryContainer);
      await seedBaselineData();
    } else {
      logger.error(`PostgreSQL connection failed in LIVE production mode: ${dbHealth.error}`);
      process.exit(1);
    }
  }

  // 2. Initialize Evidence Fusion Engine, Operational Response Engine & Interoperability Layer
  evidenceFusionService.initialize();
  getOperationalResponseService().initialize();
  getInteroperabilityService().initialize();


  // 3. Start HTTP Server
  const app = createServer();
  const server = http.createServer(app);

  server.listen(config.PORT, config.HOST, () => {
    logger.info(`AquaSentinel API server is running on http://${config.HOST}:${config.PORT}`);
    logger.info(`Health check available at http://${config.HOST}:${config.PORT}/api/health`);
    logger.info(`Stream reaches endpoint: http://${config.HOST}:${config.PORT}/api/v1/stream-reaches`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down AquaSentinel backend gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await closeDatabasePool();
      logger.info('Database pool terminated.');
      process.exit(0);
    });

    // Force shutdown after 10s if hung
    setTimeout(() => {
      logger.error('Forceful shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal backend bootstrap failure:', { error: err.message, stack: err.stack });
  process.exit(1);
});
