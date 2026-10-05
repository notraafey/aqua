import {
  GeoJsonPoint,
  GeoJsonGeometry,
  StreamReach,
} from '@aquasentinel/shared';
import { calculateDistanceMeters, createPoint } from '../value-objects.js';
import { ValidationError } from '../../api/middleware/error-handler.js';

export interface SpatialAssociationResult {
  matched: boolean;
  streamReach: StreamReach | null;
  streamReachId: string | null;
  distanceMeters: number;
  narrowStreamWarning: boolean;
  confidencePenalty: number;
  metadata: {
    distanceMeters: number;
    bufferMeters: number;
    reachName?: string;
    waterConstraint?: StreamReach['waterCoverageConstraint'];
  };
}

export class StreamAssociator {
  private defaultMaxBufferMeters: number;

  constructor(defaultMaxBufferMeters = 250) {
    this.defaultMaxBufferMeters = defaultMaxBufferMeters;
  }

  /**
   * Validate that GeoJSON coordinates are within valid geographic bounds.
   */
  public validateCoordinates(point: GeoJsonPoint): void {
    if (!point || point.type !== 'Point' || !Array.isArray(point.coordinates) || point.coordinates.length < 2) {
      throw new ValidationError('Invalid location geometry: expected GeoJSON Point with [longitude, latitude]');
    }

    const [lon, lat] = point.coordinates;
    if (typeof lon !== 'number' || isNaN(lon) || lon < -180 || lon > 180) {
      throw new ValidationError(`Invalid longitude: ${lon}. Must be a valid number between -180 and 180`);
    }
    if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
      throw new ValidationError(`Invalid latitude: ${lat}. Must be a valid number between -90 and 90`);
    }
  }

  /**
   * Calculate minimum distance in meters from a GeoJSON point to a GeoJSON geometry.
   */
  public distanceToGeometry(point: GeoJsonPoint, geometry: GeoJsonGeometry): number {
    this.validateCoordinates(point);

    if (geometry.type === 'Point') {
      const targetPoint = createPoint(geometry.coordinates[0], geometry.coordinates[1]);
      return calculateDistanceMeters(point, targetPoint);
    }

    if (geometry.type === 'LineString') {
      return this.distanceToLineString(point, geometry.coordinates);
    }

    if (geometry.type === 'Polygon') {
      // For Polygon, calculate distance to exterior ring or containment
      return this.distanceToPolygon(point, geometry.coordinates);
    }

    return Infinity;
  }

  /**
   * Calculate minimum distance from a point to a LineString represented as array of [lon, lat].
   */
  private distanceToLineString(point: GeoJsonPoint, coordinates: [number, number][]): number {
    if (coordinates.length === 0) return Infinity;
    if (coordinates.length === 1) {
      return calculateDistanceMeters(point, createPoint(coordinates[0][0], coordinates[0][1]));
    }

    let minDistance = Infinity;
    const [px, py] = point.coordinates;

    for (let i = 0; i < coordinates.length - 1; i++) {
      const [p1x, p1y] = coordinates[i];
      const [p2x, p2y] = coordinates[i + 1];

      // Distance to segment using equirectangular projection approximation for local segment
      const nearest = this.closestPointOnSegment(px, py, p1x, p1y, p2x, p2y);
      const dist = calculateDistanceMeters(point, createPoint(nearest[0], nearest[1]));
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    return minDistance;
  }

  /**
   * Calculate minimum distance from a point to a Polygon ring.
   */
  private distanceToPolygon(point: GeoJsonPoint, rings: [number, number][][]): number {
    if (!rings || rings.length === 0) return Infinity;
    const exterior = rings[0];
    return this.distanceToLineString(point, exterior);
  }

  /**
   * Projects point (px, py) onto segment (p1x, p1y)-(p2x, p2y)
   */
  private closestPointOnSegment(
    px: number,
    py: number,
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number
  ): [number, number] {
    const dx = p2x - p1x;
    const dy = p2y - p1y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return [p1x, p1y];

    // Project point onto line: t = dot(p - p1, p2 - p1) / lenSq
    let t = ((px - p1x) * dx + (py - p1y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t)); // clamp to segment

    return [p1x + t * dx, p1y + t * dy];
  }

  /**
   * Find the matching stream reach for an observation point from candidate reaches.
   */
  public associate(
    point: GeoJsonPoint,
    candidates: StreamReach[],
    bufferMeters = this.defaultMaxBufferMeters
  ): SpatialAssociationResult {
    this.validateCoordinates(point);

    let closestReach: StreamReach | null = null;
    let minDistance = Infinity;

    for (const reach of candidates) {
      if (reach.monitoringStatus === 'INACTIVE') continue;
      const dist = this.distanceToGeometry(point, reach.geometry);
      if (dist < minDistance) {
        minDistance = dist;
        closestReach = reach;
      }
    }

    const matched = closestReach !== null && minDistance <= bufferMeters;

    if (matched && closestReach) {
      const constraint = closestReach.waterCoverageConstraint;
      const narrowStreamWarning = Boolean(constraint && constraint.minWidthMeters < 20);
      const confidencePenalty = narrowStreamWarning && constraint ? constraint.confidencePenalty : 0;

      return {
        matched: true,
        streamReach: closestReach,
        streamReachId: closestReach.id,
        distanceMeters: minDistance,
        narrowStreamWarning,
        confidencePenalty,
        metadata: {
          distanceMeters: minDistance,
          bufferMeters,
          reachName: closestReach.name,
          waterConstraint: constraint,
        },
      };
    }

    return {
      matched: false,
      streamReach: null,
      streamReachId: null,
      distanceMeters: minDistance === Infinity ? -1 : minDistance,
      narrowStreamWarning: false,
      confidencePenalty: 0,
      metadata: {
        distanceMeters: minDistance === Infinity ? -1 : minDistance,
        bufferMeters,
      },
    };
  }
}

export const streamAssociator = new StreamAssociator();
