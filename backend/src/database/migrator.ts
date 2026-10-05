import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './client.js';
import { logger } from '../logging/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at: ${migrationsDir}`);
  }

  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    // 1. Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Query already applied migrations
    const res = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
    const appliedVersions = new Set(res.rows.map((r: { version: string }) => r.version));

    // 3. Find and sort all .sql files
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedVersions.has(file)) {
        skipped.push(file);
        continue;
      }

      logger.info(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        logger.info(`Successfully applied migration: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error(`Failed to apply migration ${file}:`, { error: (err as Error).message });
        throw err;
      }
    }

    return { applied, skipped };
  } finally {
    client.release();
  }
}

// Support direct CLI execution: tsx src/database/migrator.ts migrate
if (process.argv[1] === __filename || process.argv.includes('migrate')) {
  logger.info('Starting database migration...');
  runMigrations()
    .then((result) => {
      logger.info('Migration run completed', result);
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration failed:', { error: err.message });
      process.exit(1);
    });
}
