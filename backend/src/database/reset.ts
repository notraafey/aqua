import { pool, isDatabaseHealthy } from './client.js';
import { getRepositories, createRepositories, setRepositories } from './repositories/index.js';
import { seedBaselineData } from './seed.js';
import { logger } from '../logging/logger.js';
import { config } from '../config/index.js';
import { evidenceFusionService } from '../services/evidence/evidence-fusion-service.js';
import { getOperationalResponseService } from '../services/response/operational-response-service.js';
import { getInteroperabilityService } from '../services/interoperability/interoperability-service.js';

export interface SystemResetResult {
  success: boolean;
  storageMode: 'PostgreSQL' | 'InMemory';
  durationMs: number;
  reachesSeeded: number;
  consumerReset: boolean;
  message: string;
  timestamp: string;
}

export async function resetSystemState(): Promise<SystemResetResult> {
  const startTime = Date.now();
  logger.info('[Reset] Initiating complete deterministic system reset...');

  const dbHealth = await isDatabaseHealthy();
  let repos = getRepositories();
  let reachesSeeded = 0;
  let storageMode: 'PostgreSQL' | 'InMemory' = 'InMemory';

  if (dbHealth.healthy && repos.isPostgres) {
    storageMode = 'PostgreSQL';
    logger.info('[Reset] Truncating PostgreSQL operational and demo tables...');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Truncate tables in cascade order
      await client.query(`
        TRUNCATE TABLE 
          verifications,
          incident_outcomes,
          field_actors,
          task_audit_logs,
          tasks,
          recommendations,
          evidence_assessments,
          incidents,
          observations,
          early_warnings,
          forecasts,
          scenarios,
          model_evaluations,
          outbox_events,
          interoperability_acknowledgements,
          interoperability_audit,
          fhir_subscriptions,
          stream_reaches
        CASCADE;
      `);

      // Re-seed default field actors
      await client.query(`
        INSERT INTO field_actors (actor_id, name, organization, role, contact, active)
        VALUES 
          ('actor-alex-rivera', 'Alex Rivera', 'Volos Municipal Environmental Dept', 'FIELD_INSPECTOR', '+30 24210 12345', TRUE),
          ('actor-elena-vasquez', 'Elena Vasquez', 'Thessaly Regional Water Monitoring Agency', 'ENVIRONMENTAL_SPECIALIST', '+30 24210 54321', TRUE),
          ('actor-nikos-katsaros', 'Nikos Katsaros', 'Pagasetic Gulf Coastal Patrol', 'FIELD_INSPECTOR', '+30 24210 98765', TRUE),
          ('actor-maria-dimitriou', 'Maria Dimitriou', 'Volos Municipal Civil Protection', 'MUNICIPAL_OFFICER', '+30 24210 67890', TRUE)
        ON CONFLICT (actor_id) DO NOTHING;
      `);

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      logger.error('[Reset] Failed to truncate PostgreSQL tables:', { error: err.message });
      throw err;
    } finally {
      client.release();
    }

    reachesSeeded = await seedBaselineData();
  } else {
    storageMode = 'InMemory';
    logger.info('[Reset] Resetting InMemory repository container...');
    const newContainer = createRepositories(true);
    setRepositories(newContainer);
    reachesSeeded = await seedBaselineData();
  }

  // Re-initialize core services
  try {
    evidenceFusionService.initialize();
    getOperationalResponseService().initialize();
    getInteroperabilityService().initialize();
  } catch (err: any) {
    logger.warn('[Reset] Service re-initialization warning:', { error: err.message });
  }

  // Attempt to notify external consumer of reset
  let consumerReset = false;
  try {
    const consumerResetUrl = config.EXTERNAL_CONSUMER_URL.replace(/\/webhook\/fhir.*$/, '/reset');
    const res = await fetch(consumerResetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      consumerReset = true;
      logger.info('[Reset] External consumer reset acknowledged.');
    }
  } catch (_e) {
    // Consumer may not be running, non-fatal
    logger.debug('[Reset] External consumer endpoint unreachable or inactive.');
  }

  const durationMs = Date.now() - startTime;
  logger.info(`[Reset] System reset completed in ${durationMs}ms (mode: ${storageMode}, reaches: ${reachesSeeded})`);

  return {
    success: true,
    storageMode,
    durationMs,
    reachesSeeded,
    consumerReset,
    message: `System successfully reset to clean deterministic demo baseline in ${durationMs}ms.`,
    timestamp: new Date().toISOString(),
  };
}
