import { describe, it, expect } from 'vitest';
import { streamAssociator } from '../../src/domain/spatial/stream-associator.js';
import { StreamReach, GeoJsonPoint } from '@aquasentinel/shared';

describe('Geospatial Stream Reach Association', () => {
  const sampleReaches: StreamReach[] = [
    {
      id: 'reach-almyros-001',
      name: 'Almyros Stream - Reach Alpha',
      city: 'Volos',
      region: 'Thessaly, Greece',
      monitoringStatus: 'ACTIVE',
      geometry: {
        type: 'LineString',
        coordinates: [
          [22.7510, 39.1820],
          [22.7535, 39.1812],
          [22.7570, 39.1798],
          [22.7610, 39.1785],
        ],
      },
      waterCoverageConstraint: {
        minWidthMeters: 15,
        confidencePenalty: 0.2,
      },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'reach-kladissos-002',
      name: 'Kladissos River - Estuary Segment',
      city: 'Chania',
      region: 'Crete, Greece',
      monitoringStatus: 'ACTIVE',
      geometry: {
        type: 'LineString',
        coordinates: [
          [24.0020, 35.5140],
          [24.0050, 35.5132],
          [24.0090, 35.5115],
        ],
      },
      waterCoverageConstraint: {
        minWidthMeters: 25,
        confidencePenalty: 0.05,
      },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ];

  it('correctly associates an observation point located on/near stream reach', () => {
    // Point very close to the second vertex of Almyros Stream
    const point: GeoJsonPoint = {
      type: 'Point',
      coordinates: [22.7536, 39.1813],
    };

    const result = streamAssociator.associate(point, sampleReaches, 250);
    expect(result.matched).toBe(true);
    expect(result.streamReachId).toBe('reach-almyros-001');
    expect(result.streamReach?.name).toBe('Almyros Stream - Reach Alpha');
    expect(result.distanceMeters).toBeLessThan(50);
    expect(result.narrowStreamWarning).toBe(true); // minWidth 15m < 20m
    expect(result.confidencePenalty).toBe(0.2);
  });

  it('marks an observation as unmatched when coordinates exceed buffer distance', () => {
    // Coordinate 15km away in the Aegean Sea
    const point: GeoJsonPoint = {
      type: 'Point',
      coordinates: [23.1000, 39.3000],
    };

    const result = streamAssociator.associate(point, sampleReaches, 250);
    expect(result.matched).toBe(false);
    expect(result.streamReachId).toBeNull();
    expect(result.streamReach).toBeNull();
    expect(result.distanceMeters).toBeGreaterThan(250);
  });

  it('associates with the closest reach when multiple reaches exist', () => {
    // Point closer to Kladissos in Chania
    const point: GeoJsonPoint = {
      type: 'Point',
      coordinates: [24.0052, 35.5131],
    };

    const result = streamAssociator.associate(point, sampleReaches, 250);
    expect(result.matched).toBe(true);
    expect(result.streamReachId).toBe('reach-kladissos-002');
    expect(result.narrowStreamWarning).toBe(false); // minWidth 25m >= 20m
    expect(result.confidencePenalty).toBe(0);
  });

  it('rejects invalid longitude and latitude coordinates with ValidationError', () => {
    const invalidLon: GeoJsonPoint = {
      type: 'Point',
      coordinates: [195.0, 39.18],
    };
    expect(() => streamAssociator.validateCoordinates(invalidLon)).toThrow();

    const invalidLat: GeoJsonPoint = {
      type: 'Point',
      coordinates: [22.75, -95.0],
    };
    expect(() => streamAssociator.validateCoordinates(invalidLat)).toThrow();

    const nonNumeric: any = {
      type: 'Point',
      coordinates: ['invalid', NaN],
    };
    expect(() => streamAssociator.validateCoordinates(nonNumeric)).toThrow();
  });
});
