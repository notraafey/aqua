import { describe, it, expect } from 'vitest';
import {
  generateId,
  isValidId,
  createPoint,
  calculateDistanceMeters,
  nowUtc,
} from '../../src/domain/value-objects.js';
import { createProvenanceRecord } from '../../src/domain/provenance.js';

describe('Domain Value Objects & Helpers', () => {
  it('generates and validates canonical UUIDv4 identifiers', () => {
    const id = generateId();
    expect(isValidId(id)).toBe(true);
    expect(isValidId('invalid-uuid-123')).toBe(false);
  });

  it('produces valid ISO-8601 UTC timestamps', () => {
    const ts = nowUtc();
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });

  it('creates valid GeoJSON Point objects and rejects invalid coordinates', () => {
    const validPoint = createPoint(22.75, 39.18);
    expect(validPoint.type).toBe('Point');
    expect(validPoint.coordinates).toEqual([22.75, 39.18]);

    expect(() => createPoint(190, 0)).toThrow(/Invalid longitude/);
    expect(() => createPoint(0, -95)).toThrow(/Invalid latitude/);
  });

  it('calculates spatial distance between two coordinates accurately using Haversine formula', () => {
    // Almyros reach points
    const p1 = createPoint(22.751, 39.182);
    const p2 = createPoint(22.761, 39.178);

    const distance = calculateDistanceMeters(p1, p2);
    // Approximate distance should be ~970 meters
    expect(distance).toBeGreaterThan(800);
    expect(distance).toBeLessThan(1200);
  });
});

describe('Provenance Foundation', () => {
  it('creates immutable provenance records with all mandatory fields', () => {
    const entityId = generateId();
    const acqTime = '2026-09-17T10:00:00.000Z';

    const prov = createProvenanceRecord({
      entityId,
      entityType: 'OBSERVATION',
      source: 'SATELLITE_SENTINEL2',
      sourceIdentifier: 'S2A_MSIL2A_20260917T100031_N0500_R122',
      acquisitionTimestamp: acqTime,
      processingMethod: 'NDCI_ALGORITHM_V1.2',
      qualityStatus: 'VALIDATED',
      metadata: { cloudCoverage: 0.04 },
    });

    expect(isValidId(prov.id)).toBe(true);
    expect(prov.entityId).toBe(entityId);
    expect(prov.entityType).toBe('OBSERVATION');
    expect(prov.source).toBe('SATELLITE_SENTINEL2');
    expect(prov.sourceIdentifier).toBe('S2A_MSIL2A_20260917T100031_N0500_R122');
    expect(prov.acquisitionTimestamp).toBe(acqTime);
    expect(prov.processingMethod).toBe('NDCI_ALGORITHM_V1.2');
    expect(prov.qualityStatus).toBe('VALIDATED');
    expect(prov.metadata?.cloudCoverage).toBe(0.04);
  });
});
