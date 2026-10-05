import { describe, it, expect } from 'vitest';
import {
  DemoCitizenAdapter,
  OahCitizenAdapter,
  getCitizenAdapter,
} from '../../src/adapters/citizen/index.js';

describe('Citizen Science Adapter', () => {
  it('DemoCitizenAdapter normalizes reports and preserves media references', async () => {
    const adapter = new DemoCitizenAdapter();
    const photoUrl = 'https://storage.aquasentinel.local/evidence/20260917_foam.jpg';

    const obs = await adapter.submitReport({
      reporterName: 'Maria G.',
      timestamp: '2026-09-17T11:00:00.000Z',
      location: {
        type: 'Point',
        coordinates: [22.7535, 39.1812],
      },
      streamReachId: '7a3b4c12-89de-4f56-9abc-1234567890ab',
      indicator: 'FOAM',
      value: 'Thick white foam',
      description: 'Persistent foaming near the storm drain outlet.',
      photos: [photoUrl],
    });

    expect(obs.source).toBe('CITIZEN_REPORT');
    expect(obs.indicator).toBe('FOAM');
    expect(obs.value).toBe('Thick white foam');
    expect(obs.provenance).toBeDefined();
    expect(obs.provenance.metadata?.photos).toEqual([photoUrl]);
    expect(obs.metadata?.photos).toEqual([photoUrl]);
    expect(obs.provenance.metadata?.mediaReferenceCount).toBe(1);
    expect(obs.provenance.processingMethod).toContain('CITIZEN');
  });

  it('DemoCitizenAdapter retrieves deterministic community reports', async () => {
    const adapter = new DemoCitizenAdapter();
    const reports = await adapter.getRecentReports({
      streamReachId: '7a3b4c12-89de-4f56-9abc-1234567890ab',
    });

    expect(reports.length).toBeGreaterThan(0);
    const first = reports[0];
    expect(first.source).toBe('CITIZEN_REPORT');
    expect(first.quality).toBe('VALIDATED');
  });

  it('OahCitizenAdapter normalizes reports and tags non-demo provenance', async () => {
    const adapter = new OahCitizenAdapter();
    const obs = await adapter.submitReport({
      reporterName: 'Nikolaos',
      location: {
        type: 'Point',
        coordinates: [22.7570, 39.1798],
      },
      indicator: 'WATER_COLOR',
      value: 'Turbid brown',
      description: 'Runoff causing heavy brown turbidity.',
    });

    expect(obs.source).toBe('CITIZEN_REPORT');
    expect(obs.provenance.metadata?.isDemoFixture).toBe(false);
  });

  it('getCitizenAdapter returns operational adapter instance', async () => {
    const adapter = getCitizenAdapter();
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
  });
});
