/**
 * Time-Series Analysis Engine & Data Quality Gating for AquaSentinel
 * Conforms to Phase 6 PRD Sections 5, 6, 8, 43
 *
 * Deterministic, testable, pure mathematical and statistical routines:
 * - Chronological ordering & timestamp normalization
 * - Missing-data / gap detection
 * - Rolling statistics (mean, median, standard deviation, variance)
 * - Baseline deviation & percentage change
 * - Trend slope (Ordinary Least Squares) & acceleration classification
 * - Multi-criteria data quality gating with explicit insufficient data reasoning
 */

import {
  Observation,
  ObservationIndicator,
  TimeSeriesPoint,
  TimeSeriesStats,
  TrendClassification,
  DataQualityGateResult,
  ForecastConfidenceBand,
} from '@aquasentinel/shared';

export interface QualityGateOptions {
  minObservations?: number;
  minSpanHours?: number;
  maxRecencyHours?: number;
  maxGapHours?: number;
  minQualityScore?: number;
}

export const DEFAULT_QUALITY_GATE_OPTIONS: QualityGateOptions = {
  minObservations: 3,
  minSpanHours: 24, // At least 24 hours of temporal span
  maxRecencyHours: 336, // 14 days max staleness
  maxGapHours: 360, // 15 days max gap between consecutive points
  minQualityScore: 0.35,
};

export class TimeSeriesEngine {
  /**
   * Sorts observations chronologically (ascending by timestamp).
   * Throws if timestamp is invalid.
   */
  public static sortChronologically<T extends { timestamp: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      if (isNaN(ta) || isNaN(tb)) {
        throw new Error(`Invalid ISO timestamp detected: "${a.timestamp}" or "${b.timestamp}"`);
      }
      return ta - tb;
    });
  }

  /**
   * Extracts clean numeric TimeSeriesPoint array from general observations for a given indicator.
   */
  public static extractSeries(
    observations: Observation[],
    indicator: ObservationIndicator
  ): TimeSeriesPoint[] {
    const matching = observations.filter((o) => o.indicator === indicator);
    const sorted = this.sortChronologically(matching);

    const points: TimeSeriesPoint[] = [];
    const seenTimestamps = new Set<string>();

    for (const obs of sorted) {
      const val = typeof obs.value === 'number' ? obs.value : parseFloat(String(obs.value));
      if (isNaN(val)) continue;

      // Handle duplicate timestamp deduplication gracefully (keep highest quality)
      const key = `${obs.source}_${obs.timestamp}`;
      if (seenTimestamps.has(key)) continue;
      seenTimestamps.add(key);

      points.push({
        observationId: obs.id,
        timestamp: obs.timestamp,
        value: val,
        source: obs.source,
        qualityScore:
          (obs.metadata?.qualityScore as number) ??
          (obs.quality === 'VALIDATED' ? 0.95 : obs.quality === 'RAW' ? 0.8 : 0.6),
      });
    }

    return points;
  }

  /**
   * Identifies gaps exceeding expected interval between consecutive chronological points.
   */
  public static detectMissingPeriods(
    points: TimeSeriesPoint[],
    maxAllowedGapHours: number
  ): Array<{ gapStart: string; gapEnd: string; gapHours: number }> {
    if (points.length < 2) return [];

    const gaps: Array<{ gapStart: string; gapEnd: string; gapHours: number }> = [];
    for (let i = 0; i < points.length - 1; i++) {
      const tCurrent = new Date(points[i].timestamp).getTime();
      const tNext = new Date(points[i + 1].timestamp).getTime();
      const diffHours = (tNext - tCurrent) / (1000 * 60 * 60);

      if (diffHours > maxAllowedGapHours) {
        gaps.push({
          gapStart: points[i].timestamp,
          gapEnd: points[i + 1].timestamp,
          gapHours: Math.round(diffHours * 10) / 10,
        });
      }
    }
    return gaps;
  }

  /**
   * Computes rolling mean for a numeric array over window size k.
   */
  public static calculateRollingMean(values: number[], windowSize: number): number[] {
    if (windowSize <= 0 || values.length === 0) return [];
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      const sum = window.reduce((acc, v) => acc + v, 0);
      result.push(sum / window.length);
    }
    return result;
  }

  /**
   * Computes rolling median for a numeric array over window size k.
   */
  public static calculateRollingMedian(values: number[], windowSize: number): number[] {
    if (windowSize <= 0 || values.length === 0) return [];
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = [...values.slice(start, i + 1)].sort((a, b) => a - b);
      const mid = Math.floor(window.length / 2);
      if (window.length % 2 !== 0) {
        result.push(window[mid]);
      } else {
        result.push((window[mid - 1] + window[mid]) / 2);
      }
    }
    return result;
  }

  /**
   * Computes rolling standard deviation.
   */
  public static calculateRollingStdDev(values: number[], windowSize: number): number[] {
    if (windowSize <= 0 || values.length === 0) return [];
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      if (window.length < 2) {
        result.push(0);
        continue;
      }
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const variance =
        window.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (window.length - 1);
      result.push(Math.sqrt(Math.max(0, variance)));
    }
    return result;
  }

  /**
   * Calculates baseline deviation and percentage difference.
   */
  public static calculateBaselineDeviation(
    currentValue: number,
    baselineValue: number
  ): {
    baselineValue: number;
    absoluteDiff: number;
    percentageDiff: number;
    status: 'NORMAL' | 'ELEVATED' | 'SUPPRESSED';
  } {
    const absoluteDiff = currentValue - baselineValue;
    const percentageDiff =
      baselineValue !== 0
        ? Math.round(((currentValue - baselineValue) / baselineValue) * 1000) / 10
        : 0;

    let status: 'NORMAL' | 'ELEVATED' | 'SUPPRESSED' = 'NORMAL';
    if (percentageDiff >= 25) {
      status = 'ELEVATED';
    } else if (percentageDiff <= -25) {
      status = 'SUPPRESSED';
    }

    return {
      baselineValue,
      absoluteDiff: Math.round(absoluteDiff * 1000) / 1000,
      percentageDiff,
      status,
    };
  }

  /**
   * Ordinary Least Squares linear regression slope per day.
   * x = time in days relative to first point, y = observation value.
   */
  public static calculateTrendSlopePerDay(points: TimeSeriesPoint[]): number {
    if (points.length < 2) return 0;

    const t0 = new Date(points[0].timestamp).getTime();
    const data = points.map((p) => {
      const days = (new Date(p.timestamp).getTime() - t0) / (1000 * 60 * 60 * 24);
      return { x: days, y: p.value };
    });

    const n = data.length;
    const xSum = data.reduce((s, d) => s + d.x, 0);
    const ySum = data.reduce((s, d) => s + d.y, 0);
    const xMean = xSum / n;
    const yMean = ySum / n;

    let numerator = 0;
    let denominator = 0;
    for (const d of data) {
      numerator += (d.x - xMean) * (d.y - yMean);
      denominator += Math.pow(d.x - xMean, 2);
    }

    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 10000) / 10000;
  }

  /**
   * Classifies trend into STABLE, INCREASING, DECREASING, ACCELERATING, DECELERATING, VOLATILE, INSUFFICIENT_DATA.
   */
  public static classifyTrend(
    points: TimeSeriesPoint[],
    baselineValue?: number
  ): {
    classification: TrendClassification;
    slopePerDay: number;
    acceleration: number;
    volatility: number;
  } {
    if (points.length < 3) {
      return {
        classification: 'INSUFFICIENT_DATA',
        slopePerDay: 0,
        acceleration: 0,
        volatility: 0,
      };
    }

    const slope = this.calculateTrendSlopePerDay(points);

    // Compute detrended volatility (residual standard error relative to mean)
    const values = points.map((p) => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const t0 = new Date(points[0].timestamp).getTime();
    const xMean =
      points.reduce((s, p) => s + (new Date(p.timestamp).getTime() - t0) / (1000 * 3600 * 24), 0) /
      points.length;
    const intercept = mean - slope * xMean;

    let residualSumSq = 0;
    for (const p of points) {
      const x = (new Date(p.timestamp).getTime() - t0) / (1000 * 3600 * 24);
      const fitted = intercept + slope * x;
      residualSumSq += Math.pow(p.value - fitted, 2);
    }
    const residualStdDev = Math.sqrt(residualSumSq / Math.max(1, points.length - 2));
    const detrendedVolatility = mean !== 0 ? Math.abs(residualStdDev / mean) : 0;

    // Split into first half and second half to detect acceleration (second derivative)
    const midIdx = Math.floor(points.length / 2);
    const earlyHalf = points.slice(0, midIdx + 1);
    const lateHalf = points.slice(midIdx);

    const earlySlope = this.calculateTrendSlopePerDay(earlyHalf);
    const lateSlope = this.calculateTrendSlopePerDay(lateHalf);
    const acceleration = Math.round((lateSlope - earlySlope) * 10000) / 10000;

    // High detrended volatility check (noisy erratic fluctuations around trend line)
    if (detrendedVolatility > 0.45 && points.length >= 4 && Math.abs(slope) < 0.02) {
      return {
        classification: 'VOLATILE',
        slopePerDay: slope,
        acceleration,
        volatility: detrendedVolatility,
      };
    }

    // Significant slope threshold (e.g. 0.01 change in NDCI/index per day)
    const significantSlopeThreshold = 0.008;

    let classification: TrendClassification = 'STABLE';

    if (slope > significantSlopeThreshold) {
      if (acceleration > 0.005) {
        classification = 'ACCELERATING';
      } else if (acceleration < -0.005) {
        classification = 'DECELERATING';
      } else {
        classification = 'INCREASING';
      }
    } else if (slope < -significantSlopeThreshold) {
      if (acceleration < -0.005) {
        classification = 'ACCELERATING'; // Accelerating downward
      } else if (acceleration > 0.005) {
        classification = 'DECELERATING';
      } else {
        classification = 'DECREASING';
      }
    } else {
      classification = 'STABLE';
    }

    return {
      classification,
      slopePerDay: slope,
      acceleration,
      volatility: detrendedVolatility,
    };
  }

  /**
   * Computes comprehensive time series summary statistics.
   */
  public static computeStats(
    points: TimeSeriesPoint[],
    baselineValue?: number
  ): TimeSeriesStats {
    if (points.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        variance: 0,
        firstTimestamp: '',
        lastTimestamp: '',
        spanHours: 0,
        observationDensityPerWeek: 0,
        trendSlopePerDay: 0,
        trendClassification: 'INSUFFICIENT_DATA',
        acceleration: 0,
      };
    }

    const values = points.map((p) => p.value);
    const count = values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = Math.round((sum / count) * 1000) / 1000;

    const sortedVals = [...values].sort((a, b) => a - b);
    const mid = Math.floor(count / 2);
    const median =
      count % 2 !== 0
        ? sortedVals[mid]
        : Math.round(((sortedVals[mid - 1] + sortedVals[mid]) / 2) * 1000) / 1000;

    const variance =
      count > 1
        ? values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (count - 1)
        : 0;
    const stdDev = Math.round(Math.sqrt(variance) * 1000) / 1000;

    const firstTimestamp = points[0].timestamp;
    const lastTimestamp = points[points.length - 1].timestamp;
    const t0 = new Date(firstTimestamp).getTime();
    const t1 = new Date(lastTimestamp).getTime();
    const spanHours = Math.round(((t1 - t0) / (1000 * 60 * 60)) * 10) / 10;

    const weeks = Math.max(1, spanHours / (24 * 7));
    const observationDensityPerWeek = Math.round((count / weeks) * 10) / 10;

    const trend = this.classifyTrend(points, baselineValue);

    let baselineDeviation;
    if (baselineValue !== undefined) {
      const latestValue = points[points.length - 1].value;
      baselineDeviation = this.calculateBaselineDeviation(latestValue, baselineValue);
    }

    return {
      count,
      min,
      max,
      mean,
      median,
      stdDev,
      variance: Math.round(variance * 10000) / 10000,
      firstTimestamp,
      lastTimestamp,
      spanHours,
      observationDensityPerWeek,
      trendSlopePerDay: trend.slopePerDay,
      trendClassification: trend.classification,
      acceleration: trend.acceleration,
      baselineDeviation,
    };
  }

  /**
   * Evaluates data quality gating before forecasting.
   * Conforms to Phase 6 PRD Section 6 & 39:
   * "If data is insufficient: Return a structured insufficient-data result. Do not fabricate a forecast."
   */
  public static evaluateDataQualityGate(
    points: TimeSeriesPoint[],
    options: QualityGateOptions = DEFAULT_QUALITY_GATE_OPTIONS,
    referenceTime: string = new Date().toISOString()
  ): DataQualityGateResult {
    const opts = { ...DEFAULT_QUALITY_GATE_OPTIONS, ...options };
    const failureReasons: string[] = [];
    const warnings: string[] = [];

    // 1. Min observations
    if (points.length < opts.minObservations!) {
      failureReasons.push(
        `Insufficient observations: found ${points.length}, minimum required is ${opts.minObservations}.`
      );
    }

    if (points.length === 0) {
      return {
        passed: false,
        confidenceBand: 'INSUFFICIENT',
        reasons: failureReasons,
        metrics: {
          observationCount: 0,
          observationDensityPerWeek: 0,
          maxGapHours: 0,
          recencyHours: 9999,
          contradictionPenalty: 0,
          qualityScoreAvg: 0,
        },
      };
    }

    // 2. Temporal span
    const t0 = new Date(points[0].timestamp).getTime();
    const tLast = new Date(points[points.length - 1].timestamp).getTime();
    const spanHours = (tLast - t0) / (1000 * 60 * 60);

    if (spanHours < opts.minSpanHours!) {
      failureReasons.push(
        `Temporal span too short: ${Math.round(spanHours)}h covered, minimum required is ${opts.minSpanHours}h.`
      );
    }

    // 3. Recency of latest observation relative to reference time
    const tRef = new Date(referenceTime).getTime();
    const recencyHours = Math.max(0, (tRef - tLast) / (1000 * 60 * 60));

    if (recencyHours > opts.maxRecencyHours!) {
      failureReasons.push(
        `Stale historical data: last observation was ${Math.round(recencyHours / 24)} days ago (max allowed: ${Math.round(opts.maxRecencyHours! / 24)} days).`
      );
    }

    // 4. Large gaps between observations
    const gaps = this.detectMissingPeriods(points, opts.maxGapHours!);
    const maxGapHours = gaps.length > 0 ? Math.max(...gaps.map((g) => g.gapHours)) : 0;
    if (gaps.length > 0) {
      failureReasons.push(
        `Observation gaps detected: ${gaps.length} gap(s) exceeding ${Math.round(opts.maxGapHours! / 24)} days (max gap: ${Math.round(maxGapHours / 24)} days).`
      );
    }

    // 5. Average source quality score
    const avgQuality =
      points.reduce((acc, p) => acc + p.qualityScore, 0) / points.length;
    if (avgQuality < opts.minQualityScore!) {
      failureReasons.push(
        `Mean observation quality too low: ${Math.round(avgQuality * 100)}% (minimum: ${Math.round(opts.minQualityScore! * 100)}%).`
      );
    }

    // 6. Contradiction penalty (concurrent readings with high variance)
    let contradictionPenalty = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dt = Math.abs(
        new Date(points[i + 1].timestamp).getTime() - new Date(points[i].timestamp).getTime()
      ) / (1000 * 60 * 60);
      if (dt <= 6) {
        // Within 6 hours
        const diff = Math.abs(points[i + 1].value - points[i].value);
        if (diff > 0.3) {
          contradictionPenalty += 0.25;
          warnings.push(
            `Contradictory observations within 6h window: values ${points[i].value} vs ${points[i + 1].value}.`
          );
        }
      }
    }

    const weeks = Math.max(1, spanHours / (24 * 7));
    const densityPerWeek = Math.round((points.length / weeks) * 10) / 10;

    const passed = failureReasons.length === 0;
    const allReasons = [...failureReasons, ...warnings];

    let confidenceBand: ForecastConfidenceBand = 'HIGH';
    if (!passed) {
      confidenceBand = 'INSUFFICIENT';
    } else if (contradictionPenalty > 0 || avgQuality < 0.6 || densityPerWeek < 1.0) {
      confidenceBand = 'LOW';
    } else if (points.length < 5 || densityPerWeek < 2.0) {
      confidenceBand = 'MEDIUM';
    }

    return {
      passed,
      confidenceBand,
      reasons: allReasons,
      metrics: {
        observationCount: points.length,
        observationDensityPerWeek: densityPerWeek,
        maxGapHours,
        recencyHours: Math.round(recencyHours * 10) / 10,
        contradictionPenalty,
        qualityScoreAvg: Math.round(avgQuality * 100) / 100,
      },
    };
  }
}
