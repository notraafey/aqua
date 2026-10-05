import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

// Load .env from backend directory or project root if present
const rootEnvPath = path.resolve(process.cwd(), '.env');
const backendEnvPath = path.resolve(process.cwd(), 'backend', '.env');

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_MODE: z.enum(['live', 'demo']).default('demo'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/aquasentinel'),
  DATABASE_TEST_URL: z.string().optional(),
  FHIR_SERVER_URL: z.string().url().default('http://localhost:8080/fhir'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),
  API_SECRET_KEY: z.string().default('aquasentinel-dev-secret-key-replace-in-prod'),
  COPERNICUS_CLIENT_ID: z.string().optional(),
  COPERNICUS_CLIENT_SECRET: z.string().optional(),
  COPERNICUS_AUTH_URL: z.string().url().default('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'),
  COPERNICUS_API_URL: z.string().url().default('https://sh.dataspace.copernicus.eu/api/v1'),
  OPEN_METEO_API_URL: z.string().url().default('https://api.open-meteo.com/v1'),
  CITIZEN_API_URL: z.string().url().optional(),
  // Phase 7: Event-Driven Interoperability
  EXTERNAL_CONSUMER_URL: z.string().url().default('http://localhost:3002/webhook/fhir'),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().default(1000),
  OUTBOX_MAX_RETRIES: z.coerce.number().default(3),
  OUTBOX_RETRY_BACKOFF_MS: z.coerce.number().default(500),
  FHIR_AUTH_MODE: z.enum(['none', 'basic', 'bearer', 'oauth2']).default('none'),
  FHIR_AUTH_TOKEN: z.string().optional(),
});


export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:', result.error.format());
    throw new Error(`Configuration validation failed: ${JSON.stringify(result.error.issues)}`);
  }
  return result.data;
}

export const config = loadConfig();
