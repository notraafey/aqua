/**
 * Spatial Correlation Service for AquaSentinel Evidence Fusion Engine
 * Correlates observations against stream reaches and each other.
 * Conforms to Main PRD Section 20.6 and Phase 3 PRD Sections 7, 8, 9.
 */

import { GeoJsonPoint, Observation, StreamReach, EvidenceRelevance } from '@aquasentinel/shared';
import { streamAssociator } from '../spatial/stream-associator.js';
import { calculateDistanceMeters } from '../value-objects.js';
import { defaultEvidenceConfig, EvidenceFusionConfig } from './config.js';

export interface SpatialCorrelationResult {
  isMatch: boolean;
  distanceMeters: number;
  relevance: EvidenceRelevance;
  flags: string[];
  penalty: number;
}

export class SpatialCorrelator {
  private config: EvidenceFusionConfig;

  constructor(config: EvidenceFusionConfig = defaultEvidenceConfig) {
    this.config = config;
  }

  /**
   * Correlates an observation against a target stream reach.
   */
  public correlateToReach(
    observation: Observation,
    reach: StreamReach,
    customRadiusMeters?: number
  ): SpatialCorrelationResult {
    const maxRadius = customRadiusMeters ?? this.config.spatial.maxEvidenceDistanceMeters;
    const distanceMeters = Math.round(
      streamAssociator.distanceToGeometry(observation.location, reach.geometry)
    );

    const flags: string[] = [];
    let penalty = 0;

    // Check narrow stream mixed-pixel constraint for satellite observations
    if (observation.source === 'SATELLITE_SENTINEL2') {
      const minWidth = reach.waterCoverageConstraint?.minWidthMeters ?? 30;
      if (minWidth < 20) {
        flags.push('narrow_stream_mixed_pixel');
        penalty += this.config.penalties.narrowStreamMixedPixel;
      }
    }

    // Determine spatial match and relevance
    const isMatch = distanceMeters <= maxRadius;

    let relevance: EvidenceRelevance = 'LOW';
    if (distanceMeters <= this.config.spatial.satelliteFootprintToleranceMeters) {
      relevance = 'HIGH';
    } else if (distanceMeters <= this.config.spatial.defaultCorrelationRadiusMeters) {
      relevance = 'MEDIUM';
    } else if (isMatch) {
      relevance = 'LOW';
    }

    return {
      isMatch,
      distanceMeters,
      relevance,
      flags,
      penalty,
    };
  }

  /**
   * Calculates distance and correlation between two individual observations.
   */
  public correlateObservations(
    obsA: Observation,
    obsB: Observation,
    customRadiusMeters?: number
  ): { isMatch: boolean; distanceMeters: number } {
    const maxRadius = customRadiusMeters ?? this.config.spatial.defaultCorrelationRadiusMeters;
    const distanceMeters = Math.round(
      calculateDistanceMeters(obsA.location, obsB.location)
    );

    return {
      isMatch: distanceMeters <= maxRadius,
      distanceMeters,
    };
  }
}

export const spatialCorrelator = new SpatialCorrelator();
