/**
 * AquaSentinel Phase 8 - Configurable Geofence & Location Validation Engine
 * PRD Sections 19, 20, 21
 */

import { GeoJsonPoint, LocationValidationStatus, VerificationLocation } from '@aquasentinel/shared';

export interface GeofenceConfig {
  defaultRadiusMeters: number;
  atLocationThresholdMeters: number;
}

export const DEFAULT_GEOFENCE_CONFIG: GeofenceConfig = {
  defaultRadiusMeters: 250, // Acceptable field verification tolerance
  atLocationThresholdMeters: 50, // Close proximity to target coordinate
};

export interface GeofenceValidationResult {
  distanceMeters: number;
  status: LocationValidationStatus;
  isWithinGeofence: boolean;
  targetCoordinates: [number, number]; // [lon, lat]
  actualCoordinates: [number, number]; // [lon, lat]
  acceptableRadiusMeters: number;
}

export class GeofenceValidator {
  /**
   * Computes the great-circle distance between two points in meters using the Haversine formula.
   * Coordinates format: [longitude, latitude]
   */
  public static calculateDistanceMeters(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;

    const R = 6371000; // Earth's radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Validates a field verification location against expected task target location.
   */
  public static validate(
    taskLocation?: GeoJsonPoint | null,
    actualLocation?: VerificationLocation | GeoJsonPoint | null,
    configuredRadius?: number
  ): GeofenceValidationResult {
    const radius = configuredRadius ?? DEFAULT_GEOFENCE_CONFIG.defaultRadiusMeters;

    // Handle missing or incomplete location data safely
    if (
      !taskLocation ||
      !taskLocation.coordinates ||
      taskLocation.coordinates.length < 2 ||
      !actualLocation ||
      !actualLocation.coordinates ||
      actualLocation.coordinates.length < 2
    ) {
      return {
        distanceMeters: -1,
        status: 'UNKNOWN',
        isWithinGeofence: true, // Do not hard-block when GPS is unavailable
        targetCoordinates: taskLocation?.coordinates || [0, 0],
        actualCoordinates: actualLocation?.coordinates || [0, 0],
        acceptableRadiusMeters: radius,
      };
    }

    const target = taskLocation.coordinates as [number, number];
    const actual = actualLocation.coordinates as [number, number];

    const distance = this.calculateDistanceMeters(target, actual);

    let status: LocationValidationStatus;
    if (distance <= DEFAULT_GEOFENCE_CONFIG.atLocationThresholdMeters) {
      status = 'AT_LOCATION';
    } else if (distance <= radius) {
      status = 'NEAR_LOCATION';
    } else {
      status = 'OUTSIDE_EXPECTED_AREA';
    }

    const isWithinGeofence = distance <= radius;

    return {
      distanceMeters: distance,
      status,
      isWithinGeofence,
      targetCoordinates: target,
      actualCoordinates: actual,
      acceptableRadiusMeters: radius,
    };
  }
}
