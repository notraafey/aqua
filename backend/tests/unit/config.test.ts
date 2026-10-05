import { describe, it, expect } from 'vitest';
import { config } from '../../src/config/index.js';

describe('Configuration Foundation', () => {
  it('loads validated configuration with appropriate defaults', () => {
    expect(config).toBeDefined();
    expect(['development', 'test', 'production']).toContain(config.NODE_ENV);
    expect(['live', 'demo']).toContain(config.APP_MODE);
    expect(typeof config.PORT).toBe('number');
    expect(config.DATABASE_URL).toBeDefined();
    expect(config.FHIR_SERVER_URL).toMatch(/^http/);
    expect(['error', 'warn', 'info', 'http', 'debug']).toContain(config.LOG_LEVEL);
  });
});
