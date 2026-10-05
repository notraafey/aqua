import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../logging/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

pool.on('error', (err) => {
  logger.error('Unexpected idle client error in PostgreSQL pool', { error: err.message });
});

export async function isDatabaseHealthy(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      const latencyMs = Date.now() - start;
      return { healthy: true, latencyMs };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return { healthy: false, latencyMs: Date.now() - start, error: err.message };
  }
}

export async function closeDatabasePool(): Promise<void> {
  await pool.end();
}
