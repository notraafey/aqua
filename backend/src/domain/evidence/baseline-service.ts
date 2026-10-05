/**
 * Baseline Comparison Service for AquaSentinel Evidence Fusion Engine
 * Deterministic statistical comparison against historical observations or reach baselines.
 * Conforms to Main PRD Section 20.2 & 20.3 and Phase 3 PRD Sections 12, 13, 14.
 */

import { Observation, StreamReach, BaselineStatus, BaselineDeviation } from '@aquasentinel/shared';
import { defaultEvidenceConfig, EvidenceFusionConfig } from './config.js';

export interface BaselineComparisonResult {
  status: BaselineStatus;
  deviation?: BaselineDeviation;
  isAnomaly: boolean;
  anomalyStrength: number; // 0.0 to 1.0
  reason: string;
}

export class BaselineService {
  private config: EvidenceFusionConfig;

  constructor(config: EvidenceFusionConfig = defaultEvidenceConfig) {
    this.config = config;
  }

  /**
   * Evaluates an observation against available historical observations and/or stream reach baseline data.
   */
  public evaluate(
    observation: Observation,
    historicalObservations: Observation[],
    reach?: StreamReach | null
  ): BaselineComparisonResult {
    const val = typeof observation.value === 'number' ? observation.value : parseFloat(String(observation.value));
    if (isNaN(val)) {
      return {
        status: 'UNAVAILABLE',
        isAnomaly: false,
        anomalyStrength: 0,
        reason: 'Observation value is not numeric.',
      };
    }

    // Filter historical observations matching the same indicator
    const matchingHistorical = historicalObservations.filter(
      (h) => h.indicator === observation.indicator && h.id !== observation.id
    );

    const numericHistorical = matchingHistorical
      .map((h) => (typeof h.value === 'number' ? h.value : parseFloat(String(h.value))))
      .filter((v) => !isNaN(v));

    // Case 1: Sufficient empirical history in database
    if (numericHistorical.length >= this.config.baseline.minObservationsForBaseline) {
      return this.computeFromHistorical(val, numericHistorical, observation.indicator);
    }

    // Case 2: Seed reach baselineData exists (e.g., typicalNdci, typicalTurbidity)
    const seedTypical = this.getTypicalFromReach(observation.indicator, reach);
    if (seedTypical !== null) {
      const deviation = val - seedTypical;
      const isAnomaly = deviation >= this.config.baseline.defaultNdciAnomalyThreshold;
      const anomalyStrength = Math.min(
        1.0,
        Math.max(0.0, deviation / this.config.baseline.extremeNdciAnomalyThreshold)
      );

      return {
        status: 'AVAILABLE',
        deviation: {
          expected: seedTypical,
          actual: val,
          deviation: Math.round(deviation * 1000) / 1000,
          sampleCount: numericHistorical.length + 1,
          baselinePeriod: reach?.baselineData?.lastUpdated || 'Historical reach baseline standard',
        },
        isAnomaly,
        anomalyStrength,
        reason: `Value (${val}) compared against established reach baseline (${seedTypical}). Deviation: ${deviation > 0 ? '+' : ''}${deviation.toFixed(3)}.`,
      };
    }

    // Case 3: Insufficient empirical data (< minObservationsForBaseline and no reach baseline)
    if (numericHistorical.length > 0) {
      return {
        status: 'INSUFFICIENT',
        isAnomaly: false,
        anomalyStrength: 0,
        reason: `Insufficient historical baseline observations (${numericHistorical.length} available, minimum required: ${this.config.baseline.minObservationsForBaseline}). Historical comparison cannot be established.`,
      };
    }

    // Case 4: Zero historical data
    return {
      status: 'UNAVAILABLE',
      isAnomaly: false,
      anomalyStrength: 0,
      reason: 'Baseline unavailable: no prior observations or reach baseline parameters recorded for this indicator.',
    };
  }

  private computeFromHistorical(
    currentVal: number,
    history: number[],
    indicator: string
  ): BaselineComparisonResult {
    // Sort to compute median and standard deviation
    const sorted = [...history].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    // Compute standard deviation
    const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
    const variance = history.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);

    const deviation = currentVal - median;
    const zScore = stdDev > 0 ? (currentVal - mean) / stdDev : 0;

    const threshold =
      indicator === 'NDCI'
        ? this.config.baseline.defaultNdciAnomalyThreshold
        : Math.max(0.2 * median, 1.0);

    const isAnomaly = deviation >= threshold;
    const anomalyStrength = Math.min(1.0, Math.max(0.0, deviation / (threshold * 2)));

    return {
      status: 'AVAILABLE',
      deviation: {
        expected: Math.round(median * 1000) / 1000,
        actual: currentVal,
        deviation: Math.round(deviation * 1000) / 1000,
        standardDeviations: Math.round(zScore * 100) / 100,
        sampleCount: history.length,
      },
      isAnomaly,
      anomalyStrength,
      reason: `Historical median is ${median.toFixed(3)} (stdDev: ${stdDev.toFixed(3)}, n=${history.length}). Current observation deviation is ${deviation > 0 ? '+' : ''}${deviation.toFixed(3)} (${zScore.toFixed(2)} σ).`,
    };
  }

  private getTypicalFromReach(indicator: string, reach?: StreamReach | null): number | null {
    if (!reach?.baselineData) return null;
    switch (indicator) {
      case 'NDCI':
      case 'CHLOROPHYLL_A':
        return reach.baselineData.typicalNdci ?? null;
      case 'TURBIDITY':
        return reach.baselineData.typicalTurbidity ?? null;
      case 'WATER_TEMP':
      case 'AIR_TEMP':
        return reach.baselineData.typicalTempC ?? null;
      default:
        return null;
    }
  }
}

export const baselineService = new BaselineService();
