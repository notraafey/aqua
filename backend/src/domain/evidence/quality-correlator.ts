/**
 * Quality & Source Assessment for AquaSentinel Evidence Fusion Engine
 * Distinguishes source credibility, observation quality, and explicit penalties.
 * Conforms to Main PRD Section 17.4 and Phase 3 PRD Sections 15, 31.
 */

import { Observation, ObservationSource } from '@aquasentinel/shared';
import { defaultEvidenceConfig, EvidenceFusionConfig } from './config.js';

export interface QualityAssessmentResult {
  sourceReliability: number; // 0.0 to 1.0
  observationQuality: number; // 0.0 to 1.0
  effectiveQuality: number; // Combined quality score 0.0 to 1.0
  penalties: {
    rule: string;
    points: number;
    reason: string;
  }[];
  totalPenalty: number;
  qualityFlags: string[];
}

export class QualityCorrelator {
  private config: EvidenceFusionConfig;

  constructor(config: EvidenceFusionConfig = defaultEvidenceConfig) {
    this.config = config;
  }

  /**
   * Assesses quality for an individual observation within the evidence context.
   */
  public assess(observation: Observation): QualityAssessmentResult {
    const sourceReliability = this.getSourceReliability(observation.source, observation);
    const observationQuality = typeof observation.metadata?.qualityScore === 'number'
      ? (observation.metadata.qualityScore as number)
      : observation.quality === 'VALIDATED'
      ? 1.0
      : observation.quality === 'FLAGGED' || observation.quality === 'SUSPICIOUS'
      ? 0.5
      : 0.2;

    const penalties: { rule: string; points: number; reason: string }[] = [];
    const flags: string[] = [];

    // Check existing metadata quality reasons/flags from Phase 2
    const qualityReasons: string[] = Array.isArray(observation.metadata?.qualityReasons)
      ? (observation.metadata.qualityReasons as string[])
      : [];

    // 1. Narrow stream mixed-pixel penalty (applies only to satellite optical imagery)
    if (
      observation.source === 'SATELLITE_SENTINEL2' &&
      (qualityReasons.includes('narrow_stream_mixed_pixel') ||
        observation.metadata?.narrowStreamWarning === true)
    ) {
      flags.push('narrow_stream_mixed_pixel');
      penalties.push({
        rule: 'NARROW_STREAM_MIXED_PIXEL_PENALTY',
        points: this.config.penalties.narrowStreamMixedPixel,
        reason: 'Monitored reach is narrower than Sentinel-2 effective resolution (<20m), creating mixed-pixel boundary risk.',
      });
    }

    // 2. High cloud cover uncertainty penalty (applies only to satellite optical imagery)
    if (
      observation.source === 'SATELLITE_SENTINEL2' &&
      (qualityReasons.includes('high_cloud_cover_uncertainty') ||
        (typeof observation.metadata?.cloudCoverFraction === 'number' &&
          (observation.metadata.cloudCoverFraction as number) > 0.15))
    ) {
      flags.push('high_cloud_cover_uncertainty');
      penalties.push({
        rule: 'HIGH_CLOUD_COVER_PENALTY',
        points: this.config.penalties.highCloudCover,
        reason: 'Cloud cover exceeds 15%, reducing optical reflectance confidence.',
      });
    }

    // 3. Low observation quality score penalty
    if (observationQuality < 0.6) {
      flags.push('low_observation_quality');
      penalties.push({
        rule: 'LOW_QUALITY_SCORE_PENALTY',
        points: this.config.penalties.lowQualityScore,
        reason: `Observation quality score is substandard (${observationQuality.toFixed(2)}).`,
      });
    }

    // 4. Low source reliability penalty (e.g. unverified citizen without media)
    if (sourceReliability < 0.5) {
      flags.push('low_source_reliability');
      penalties.push({
        rule: 'LOW_SOURCE_RELIABILITY_PENALTY',
        points: 5,
        reason: 'Observation submitted by unverified source with no corroborating attachments.',
      });
    }

    const totalPenalty = penalties.reduce((sum, p) => sum + p.points, 0);
    const effectiveQuality = Math.max(0.1, sourceReliability * 0.4 + observationQuality * 0.6);

    return {
      sourceReliability,
      observationQuality,
      effectiveQuality,
      penalties,
      totalPenalty,
      qualityFlags: flags,
    };
  }

  private getSourceReliability(source: ObservationSource, observation: Observation): number {
    switch (source) {
      case 'IN_SITU_SENSOR':
        return 0.98;
      case 'SATELLITE_SENTINEL2':
        return 0.92;
      case 'WEATHER_STATION':
        return 0.90;
      case 'HISTORICAL_BASELINE':
        return 0.85;
      case 'CITIZEN_REPORT': {
        const hasPhotos =
          (Array.isArray(observation.metadata?.photos) &&
            (observation.metadata.photos as string[]).length > 0) ||
          (typeof observation.metadata?.mediaReferenceCount === 'number' &&
            (observation.metadata.mediaReferenceCount as number) > 0);
        return hasPhotos ? 0.75 : 0.45;
      }
      default:
        return 0.50;
    }
  }
}

export const qualityCorrelator = new QualityCorrelator();
