import { describe, it, expect } from 'vitest';
import { SEED_CATALOGUE_MEASURES } from '../../src/domain/catalogue/seed-measures.js';

describe('OneAquaHealth Catalogue Seed Measures Unit Tests', () => {
  it('contains at least 10 OneAquaHealth seed measures with full provenance', () => {
    expect(SEED_CATALOGUE_MEASURES.length).toBeGreaterThanOrEqual(10);

    for (const m of SEED_CATALOGUE_MEASURES) {
      expect(m.measureId).toBeDefined();
      expect(m.title).toBeDefined();
      expect(m.description).toBeDefined();
      expect(m.measureType).toBeDefined();
      expect(m.applicableIncidentTypes.length).toBeGreaterThan(0);
      expect(m.responsibleRole).toBeDefined();
      expect(m.provenance).toBeDefined();
      expect(m.provenance.provenanceStatus).toBeDefined();
      expect(typeof m.humanApprovalRequired).toBe('boolean');
    }
  });

  it('distinguishes official OneAquaHealth measures from derived operational tasks', () => {
    const officialMeasures = SEED_CATALOGUE_MEASURES.filter(
      (m) => m.provenance.provenanceStatus === 'OFFICIAL_OAH_MEASURE'
    );
    const derivedMeasures = SEED_CATALOGUE_MEASURES.filter(
      (m) => m.provenance.provenanceStatus === 'AQUASENTINEL_DERIVED_OPERATIONAL_TASK'
    );

    expect(officialMeasures.length).toBeGreaterThanOrEqual(5);
    expect(derivedMeasures.length).toBeGreaterThanOrEqual(2);

    // Official measures reference OneAquaHealth catalogue directly
    for (const m of officialMeasures) {
      expect(m.measureId.startsWith('OAH-')).toBe(true);
      expect(m.provenance.sourceName).toContain('OneAquaHealth');
    }

    // Derived measures reference operational instrumentation
    for (const m of derivedMeasures) {
      expect(m.provenance.sourceName).toContain('AquaSentinel');
      expect(m.provenance.provenanceStatus).toBe('AQUASENTINEL_DERIVED_OPERATIONAL_TASK');
    }
  });
});
