import { describe, it, expect } from 'vitest';
import { missingEvidenceAnalyzer } from '../../src/domain/evidence/missing-evidence-analyzer.js';

describe('Missing Evidence Analyzer Unit Tests', () => {
  it('identifies missing citizen science reports when only remote sensing is active', () => {
    const res = missingEvidenceAnalyzer.analyze({
      activeGroups: ['REMOTE_SENSING'],
      baselineStatus: 'AVAILABLE',
      hasFieldVerification: false,
    });

    expect(res.missingItems.some((m) => m.includes('citizen science'))).toBe(true);
    expect(res.recommendedDataGathering.some((r) => r.includes('citizen science'))).toBe(true);
  });

  it('explicitly identifies missing baseline when baseline status is UNAVAILABLE', () => {
    const res = missingEvidenceAnalyzer.analyze({
      activeGroups: ['REMOTE_SENSING', 'CITIZEN'],
      baselineStatus: 'UNAVAILABLE',
      hasFieldVerification: false,
    });

    expect(res.missingItems.some((m) => m.includes('Historical baseline unavailable'))).toBe(true);
  });

  it('identifies missing weather context when meteorological station data is absent', () => {
    const res = missingEvidenceAnalyzer.analyze({
      activeGroups: ['REMOTE_SENSING', 'CITIZEN'],
      baselineStatus: 'AVAILABLE',
      hasFieldVerification: false,
    });

    expect(res.missingItems.some((m) => m.includes('meteorological context'))).toBe(true);
    expect(res.recommendedDataGathering.some((r) => r.includes('Open-Meteo'))).toBe(true);
  });

  it('identifies missing field verification across all incomplete scenarios', () => {
    const res = missingEvidenceAnalyzer.analyze({
      activeGroups: ['REMOTE_SENSING', 'CITIZEN', 'WEATHER'],
      baselineStatus: 'AVAILABLE',
      hasFieldVerification: false,
    });

    expect(res.missingItems.some((m) => m.includes('No physical field verification'))).toBe(true);
    expect(res.recommendedDataGathering.some((r) => r.includes('water sampling'))).toBe(true);
  });
});
