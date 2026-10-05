/**
 * Temporal Correlation Service for AquaSentinel Evidence Fusion Engine
 * Multi-scale temporal context evaluation across satellite, citizen, and weather data.
 * Conforms to Main PRD Section 20.6 and Phase 3 PRD Sections 10, 11.
 */

import { Observation, EvidenceRelevance } from '@aquasentinel/shared';
import { defaultEvidenceConfig, EvidenceFusionConfig } from './config.js';

export interface TemporalCorrelationResult {
  isMatch: boolean;
  deltaMinutes: number;
  relevance: EvidenceRelevance;
  flags: string[];
}

export class TemporalCorrelator {
  private config: EvidenceFusionConfig;

  constructor(config: EvidenceFusionConfig = defaultEvidenceConfig) {
    this.config = config;
  }

  /**
   * Correlates an observation against a reference timestamp (typically the triggering observation or evaluation time).
   */
  public correlate(
    observation: Observation,
    referenceTimestamp: string,
    customWindowMinutes?: number
  ): TemporalCorrelationResult {
    const obsTime = new Date(observation.timestamp).getTime();
    const refTime = new Date(referenceTimestamp).getTime();

    if (isNaN(obsTime) || isNaN(refTime)) {
      return {
        isMatch: false,
        deltaMinutes: Infinity,
        relevance: 'LOW',
        flags: ['invalid_timestamp'],
      };
    }

    const deltaMs = Math.abs(obsTime - refTime);
    const deltaMinutes = Math.round(deltaMs / (60 * 1000));

    // Get max allowed window based on source type
    const maxWindowMinutes = customWindowMinutes ?? this.getMaxWindowMinutesForSource(observation.source);

    const isMatch = deltaMinutes <= maxWindowMinutes;
    const flags: string[] = [];

    if (!isMatch) {
      flags.push('temporal_window_exceeded');
    }

    let relevance: EvidenceRelevance = 'LOW';
    if (deltaMinutes <= 180) { // <= 3 hours
      relevance = 'HIGH';
    } else if (deltaMinutes <= 720) { // <= 12 hours
      relevance = 'MEDIUM';
    } else if (isMatch) {
      relevance = 'LOW';
    }

    return {
      isMatch,
      deltaMinutes,
      relevance,
      flags,
    };
  }

  /**
   * Determines appropriate temporal context window in minutes for a specific source.
   */
  public getMaxWindowMinutesForSource(source: string): number {
    switch (source) {
      case 'WEATHER_STATION':
        return this.config.temporal.weatherWindowHours * 60; // 12 hours
      case 'CITIZEN_REPORT':
        return this.config.temporal.citizenWindowHours * 60; // 24 hours
      case 'SATELLITE_SENTINEL2':
        return this.config.temporal.satelliteWindowHours * 60; // 48 hours
      default:
        return this.config.temporal.maxTemporalDeltaMinutes; // 24 hours
    }
  }

  /**
   * Determines whether two observations are temporally aligned within a custom or default window.
   */
  public areAligned(obsA: Observation, obsB: Observation, maxDeltaMinutes = 1440): boolean {
    const tA = new Date(obsA.timestamp).getTime();
    const tB = new Date(obsB.timestamp).getTime();
    if (isNaN(tA) || isNaN(tB)) return false;
    return Math.abs(tA - tB) <= maxDeltaMinutes * 60 * 1000;
  }
}

export const temporalCorrelator = new TemporalCorrelator();
