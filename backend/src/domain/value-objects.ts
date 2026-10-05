import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { GeoJsonPoint } from '@aquasentinel/shared';

/**
 * Generate a canonical RFC 4122 UUIDv4
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Verify if string is a valid UUID
 */
export function isValidId(id: string): boolean {
  return uuidValidate(id);
}

/**
 * Return current timestamp as canonical ISO-8601 UTC string
 */
export function nowUtc(): string {
  return new Date().toISOString();
}

/**
 * Convert Date or string to canonical ISO-8601 UTC string
 */
export function toUtcIso(date: Date | string | number): string {
  return new Date(date).toISOString();
}

/**
 * Create a GeoJSON Point value object
 * Note: GeoJSON uses [longitude, latitude]
 */
export function createPoint(longitude: number, latitude: number): GeoJsonPoint {
  if (longitude < -180 || longitude > 180) {
    throw new Error(`Invalid longitude: ${longitude}. Must be between -180 and 180.`);
  }
  if (latitude < -90 || latitude > 90) {
    throw new Error(`Invalid latitude: ${latitude}. Must be between -90 and 90.`);
  }
  return {
    type: 'Point',
    coordinates: [longitude, latitude],
  };
}

/**
 * Calculate Great-Circle distance in meters between two GeoJSON points using the Haversine formula
 */
export function calculateDistanceMeters(pointA: GeoJsonPoint, pointB: GeoJsonPoint): number {
  const [lon1, lat1] = pointA.coordinates;
  const [lon2, lat2] = pointB.coordinates;

  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
