/**
 * AquaSentinel Evidence Fusion Engine Configuration
 * Defines transparent, configurable weights, thresholds, and operational bands.
 * Conforms to Main PRD Section 20 and Phase 3 PRD Sections 8, 11, 14, 20, 22, 23, 39.
 */

export interface EvidenceFusionConfig {
  scoringVersion: string;

  // Spatial thresholds (meters)
  spatial: {
    maxEvidenceDistanceMeters: number;
    defaultCorrelationRadiusMeters: number;
    satelliteFootprintToleranceMeters: number;
  };

  // Temporal thresholds (hours)
  temporal: {
    satelliteWindowHours: number;
    citizenWindowHours: number;
    weatherWindowHours: number;
    maxTemporalDeltaMinutes: number;
  };

  // Baseline configuration
  baseline: {
    minObservationsForBaseline: number;
    defaultNdciAnomalyThreshold: number;
    extremeNdciAnomalyThreshold: number;
  };

  // Source group contribution caps (prevent volume inflation)
  sourceGroupCaps: {
    REMOTE_SENSING: number;
    CITIZEN: number;
    WEATHER: number;
    HISTORICAL_BASELINE: number;
    IN_SITU: number;
  };

  // Diminishing returns multipliers for observations within the same group
  diminishingReturns: number[];

  // Multi-source corroboration bonuses
  corroborationBonuses: {
    twoGroups: number;
    threeOrMoreGroups: number;
  };

  // Quality and contradiction penalties
  penalties: {
    narrowStreamMixedPixel: number;
    highCloudCover: number;
    lowQualityScore: number;
    contradictoryEvidence: number;
    conflictingNormalReading: number;
  };

  // Confidence Bands (Operational decision thresholds)
  confidenceBands: {
    NORMAL: { min: number; max: number };
    VERIFY: { min: number; max: number };
    INVESTIGATE: { min: number; max: number };
    PRIORITIZE: { min: number; max: number };
  };
}

export const defaultEvidenceConfig: EvidenceFusionConfig = {
  scoringVersion: 'v1.0',

  spatial: {
    maxEvidenceDistanceMeters: 1000,
    defaultCorrelationRadiusMeters: 500,
    satelliteFootprintToleranceMeters: 250,
  },

  temporal: {
    satelliteWindowHours: 48,
    citizenWindowHours: 24,
    weatherWindowHours: 12,
    maxTemporalDeltaMinutes: 1440, // 24 hours
  },

  baseline: {
    minObservationsForBaseline: 3,
    defaultNdciAnomalyThreshold: 0.15, // Deviation above typical baseline
    extremeNdciAnomalyThreshold: 0.35, // Severe bloom indicator
  },

  sourceGroupCaps: {
    REMOTE_SENSING: 35,
    CITIZEN: 30,
    WEATHER: 15,
    HISTORICAL_BASELINE: 20,
    IN_SITU: 35,
  },

  diminishingReturns: [1.0, 0.5, 0.1], // 1st observation: 100%, 2nd: 50%, 3rd+: 10%

  corroborationBonuses: {
    twoGroups: 15,
    threeOrMoreGroups: 25,
  },

  penalties: {
    narrowStreamMixedPixel: 10,
    highCloudCover: 15,
    lowQualityScore: 10,
    contradictoryEvidence: 20,
    conflictingNormalReading: 25,
  },

  confidenceBands: {
    NORMAL: { min: 0, max: 39 },
    VERIFY: { min: 40, max: 59 },
    INVESTIGATE: { min: 60, max: 79 },
    PRIORITIZE: { min: 80, max: 100 },
  },
};
