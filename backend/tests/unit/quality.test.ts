import { describe, it, expect } from 'vitest';
import { qualityAssessor } from '../../src/domain/quality/quality-assessor.js';

describe('Environmental Data Quality Assessor', () => {
  it('validates normal Sentinel-2 observation with clear sky', () => {
    const result = qualityAssessor.assess({
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.12,
      timestamp: new Date().toISOString(),
      cloudCoverFraction: 0.03,
      narrowStreamWarning: false,
    });

    expect(result.status).toBe('VALIDATED');
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.metadata.physicalBoundsValid).toBe(true);
    expect(result.metadata.temporalSanityValid).toBe(true);
  });

  it('flags Sentinel-2 observation with moderate cloud contamination and narrow stream', () => {
    const result = qualityAssessor.assess({
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.45,
      timestamp: new Date().toISOString(),
      cloudCoverFraction: 0.22,
      narrowStreamWarning: true,
    });

    expect(result.status).toBe('FLAGGED');
    expect(result.score).toBeLessThan(0.7);
    expect(result.reasons.some((r) => r.includes('cloud contamination'))).toBe(true);
    expect(result.reasons.some((r) => r.includes('Stream width constraint'))).toBe(true);
  });

  it('rejects Sentinel-2 observation with excessive cloud contamination (>40%)', () => {
    const result = qualityAssessor.assess({
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.35,
      timestamp: new Date().toISOString(),
      cloudCoverFraction: 0.65,
    });

    expect(result.status).toBe('REJECTED');
    expect(result.score).toBeLessThan(0.3);
    expect(result.reasons.some((r) => r.includes('Severe cloud contamination'))).toBe(true);
  });

  it('rejects observations with impossible physical values', () => {
    // NDCI outside [-1, 1]
    const impossibleNdci = qualityAssessor.assess({
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 2.5,
      timestamp: new Date().toISOString(),
    });
    expect(impossibleNdci.status).toBe('REJECTED');

    // Negative precipitation
    const negativePrecip = qualityAssessor.assess({
      source: 'WEATHER_STATION',
      indicator: 'PRECIPITATION',
      value: -15,
      timestamp: new Date().toISOString(),
    });
    expect(negativePrecip.status).toBe('REJECTED');

    // Extreme temperature
    const extremeTemp = qualityAssessor.assess({
      source: 'WEATHER_STATION',
      indicator: 'AIR_TEMP',
      value: 120,
      timestamp: new Date().toISOString(),
    });
    expect(extremeTemp.status).toBe('REJECTED');
  });

  it('rejects observation with future timestamp beyond grace window', () => {
    const futureTime = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const result = qualityAssessor.assess({
      source: 'WEATHER_STATION',
      indicator: 'PRECIPITATION',
      value: 5.0,
      timestamp: futureTime,
    });

    expect(result.status).toBe('REJECTED');
    expect(result.metadata.temporalSanityValid).toBe(false);
  });

  it('scores citizen observation higher when accompanied by photos', () => {
    const withPhoto = qualityAssessor.assess({
      source: 'CITIZEN_REPORT',
      indicator: 'WATER_COLOR',
      value: 'Green scum',
      timestamp: new Date().toISOString(),
      hasPhotos: true,
      isAssociated: true,
    });

    const withoutPhoto = qualityAssessor.assess({
      source: 'CITIZEN_REPORT',
      indicator: 'WATER_COLOR',
      value: 'Green scum',
      timestamp: new Date().toISOString(),
      hasPhotos: false,
      isAssociated: true,
    });

    expect(withPhoto.score).toBeGreaterThan(withoutPhoto.score);
  });
});
