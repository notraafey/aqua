import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { StreamReach } from '@aquasentinel/shared';
import { getRepositories } from './repositories/index.js';
import { logger } from '../logging/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedBaselineData(): Promise<number> {
  const seedPath = path.resolve(__dirname, '../../../data/seed/stream_reaches.json');
  if (!fs.existsSync(seedPath)) {
    logger.warn(`Seed file not found at: ${seedPath}`);
    return 0;
  }

  const raw = fs.readFileSync(seedPath, 'utf-8');
  const reaches: StreamReach[] = JSON.parse(raw);

  const repos = getRepositories();
  let inserted = 0;

  for (const reach of reaches) {
    const existing = await repos.streamReaches.findById(reach.id);
    if (!existing) {
      await repos.streamReaches.create(reach);
      inserted++;
      logger.info(`Seeded stream reach: ${reach.name} (${reach.city})`);
    } else {
      logger.debug(`Stream reach already exists: ${reach.name}`);
    }
  }

  return inserted;
}

if (process.argv[1] === __filename || process.argv.includes('seed')) {
  logger.info('Starting database seeding...');
  seedBaselineData()
    .then((count) => {
      logger.info(`Database seeding completed. Inserted ${count} reaches.`);
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Seeding failed:', { error: err.message });
      process.exit(1);
    });
}
