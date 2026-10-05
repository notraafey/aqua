/**
 * Forecasting Models for AquaSentinel Resilience Intelligence
 * Conforms to Phase 6 PRD Sections 9, 10, 12, 23, 24
 *
 * Implements:
 * 1. Persistence Baseline Model (naive benchmark with expanding error)
 * 2. Linear Trend Model (Ordinary Least Squares with prediction intervals)
 * 3. EWMA Damped Trend Model (Holt exponential smoothing with damping)
 *
 * All models are deterministic, uncertainty-aware, and version-tracked.
 */

import {
  TimeSeriesPoint,
  ForecastHorizonHours,
  ForecastUncertainty,
  ProjectionPoint,
} from '@aquasentinel/shared';
import { TimeSeriesEngine } from './time-series-engine.js';

export interface ModelPredictionOptions {
  horizonHours: ForecastHorizonHours;
  baselineValue?: number;
  stepsCount?: number; // default: 4 steps (e.g. 6h, 12h, 18h, 24h)
}

export interface ModelPredictionOutput {
  projections: ProjectionPoint[];
  uncertainty: ForecastUncertainty;
  trendSlopePerDay: number;
}

export interface IForecastModel {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  predict(points: TimeSeriesPoint[], options: ModelPredictionOptions): ModelPredictionOutput;
}

/**
 * 1. Persistence Baseline Model (Persistence / Naive)
 * Assumes the future environmental state remains equal to the latest observed state.
 * Uncertainty interval expands monotonically with time: σ * sqrt(1 + h / 24).
 */
export class PersistenceBaselineModel implements IForecastModel {
  public readonly id = 'persistence-baseline-v1';
  public readonly name = 'Persistence Baseline';
  public readonly version = '1.0.0';
  public readonly description =
    'Standard persistence reference model assuming zero future change from the last known state.';

  public predict(points: TimeSeriesPoint[], options: ModelPredictionOptions): ModelPredictionOutput {
    if (points.length === 0) {
      return { projections: [], uncertainty: 'INSUFFICIENT', trendSlopePerDay: 0 };
    }

    const lastPoint = points[points.length - 1];
    const lastVal = lastPoint.value;
    const values = points.map((p) => p.value);

    // Compute historical standard deviation for uncertainty estimation
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.length > 1
        ? values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1)
        : 0.02;
    const baseStdDev = Math.max(0.015, Math.sqrt(variance));

    const totalHours = options.horizonHours;
    const stepsCount = options.stepsCount ?? (totalHours <= 48 ? 4 : 7);
    const stepInterval = totalHours / stepsCount;

    const projections: ProjectionPoint[] = [];
    const tOrigin = new Date(lastPoint.timestamp).getTime();

    for (let i = 1; i <= stepsCount; i++) {
      const stepHours = Math.round(i * stepInterval);
      const targetTime = new Date(tOrigin + stepHours * 3600 * 1000).toISOString();

      // Variance expands with horizon
      const horizonFactor = Math.sqrt(1 + stepHours / 24);
      const margin = 1.96 * baseStdDev * horizonFactor;

      projections.push({
        targetTimestamp: targetTime,
        stepHours,
        projectedValue: Math.round(lastVal * 1000) / 1000,
        lowerBound: Math.max(0, Math.round((lastVal - margin) * 1000) / 1000),
        upperBound: Math.round((lastVal + margin) * 1000) / 1000,
        confidenceInterval: 0.95,
      });
    }

    let uncertainty: ForecastUncertainty = 'MODERATE';
    if (baseStdDev < 0.03) uncertainty = 'LOW';
    else if (baseStdDev > 0.1) uncertainty = 'HIGH';

    return {
      projections,
      uncertainty,
      trendSlopePerDay: 0,
    };
  }
}

/**
 * 2. Linear Trend Model
 * Ordinary Least Squares linear regression extrapolation with formal prediction intervals.
 */
export class LinearTrendModel implements IForecastModel {
  public readonly id = 'linear-trend-v1';
  public readonly name = 'Linear Trend';
  public readonly version = '1.0.0';
  public readonly description =
    'Ordinary Least Squares linear extrapolation with standard prediction intervals.';

  public predict(points: TimeSeriesPoint[], options: ModelPredictionOptions): ModelPredictionOutput {
    if (points.length < 2) {
      return { projections: [], uncertainty: 'INSUFFICIENT', trendSlopePerDay: 0 };
    }

    const t0 = new Date(points[0].timestamp).getTime();
    const data = points.map((p) => ({
      x: (new Date(p.timestamp).getTime() - t0) / (1000 * 3600 * 24), // days
      y: p.value,
    }));

    const n = data.length;
    const xSum = data.reduce((s, d) => s + d.x, 0);
    const ySum = data.reduce((s, d) => s + d.y, 0);
    const xMean = xSum / n;
    const yMean = ySum / n;

    let ssXx = 0;
    let ssXy = 0;
    for (const d of data) {
      ssXx += Math.pow(d.x - xMean, 2);
      ssXy += (d.x - xMean) * (d.y - yMean);
    }

    const slope = ssXx !== 0 ? ssXy / ssXx : 0;
    const intercept = yMean - slope * xMean;

    // Residual variance s_e^2
    let ssRes = 0;
    for (const d of data) {
      const pred = intercept + slope * d.x;
      ssRes += Math.pow(d.y - pred, 2);
    }
    const residualStdError =
      n > 2 ? Math.sqrt(ssRes / (n - 2)) : Math.max(0.02, Math.sqrt(ssRes / Math.max(1, n)));

    const lastPoint = points[points.length - 1];
    const tOrigin = new Date(lastPoint.timestamp).getTime();
    const xLast = (tOrigin - t0) / (1000 * 3600 * 24);

    const totalHours = options.horizonHours;
    const stepsCount = options.stepsCount ?? (totalHours <= 48 ? 4 : 7);
    const stepInterval = totalHours / stepsCount;

    const projections: ProjectionPoint[] = [];

    for (let i = 1; i <= stepsCount; i++) {
      const stepHours = Math.round(i * stepInterval);
      const stepDays = stepHours / 24;
      const xTarget = xLast + stepDays;
      const targetTime = new Date(tOrigin + stepHours * 3600 * 1000).toISOString();

      const projectedValue = intercept + slope * xTarget;

      // Prediction standard error formula
      const leverage = ssXx > 0 ? Math.pow(xTarget - xMean, 2) / ssXx : 1;
      const predStdError = residualStdError * Math.sqrt(1 + 1 / n + leverage);
      const margin = 1.96 * predStdError;

      projections.push({
        targetTimestamp: targetTime,
        stepHours,
        projectedValue: Math.max(0, Math.round(projectedValue * 1000) / 1000),
        lowerBound: Math.max(0, Math.round((projectedValue - margin) * 1000) / 1000),
        upperBound: Math.round((projectedValue + margin) * 1000) / 1000,
        confidenceInterval: 0.95,
      });
    }

    let uncertainty: ForecastUncertainty = 'MODERATE';
    if (residualStdError < 0.025 && n >= 5) uncertainty = 'LOW';
    else if (residualStdError > 0.08 || n < 4) uncertainty = 'HIGH';

    return {
      projections,
      uncertainty,
      trendSlopePerDay: Math.round(slope * 10000) / 10000,
    };
  }
}

/**
 * 3. Exponentially Weighted Moving Average (EWMA) with Damped Trend
 * Holt-style linear exponential smoothing with a damping parameter (phi = 0.88).
 * Highly resilient to observational noise and prevents unconstrained linear runaway.
 */
export class EwmaDampedTrendModel implements IForecastModel {
  public readonly id = 'ewma-damped-trend-v1';
  public readonly name = 'EWMA Damped Trend';
  public readonly version = '1.0.0';
  public readonly description =
    'Exponentially weighted state smoothing with damped trend extrapolation for noise resilience.';

  private readonly alpha = 0.4; // Level smoothing
  private readonly beta = 0.25; // Trend smoothing
  private readonly phi: number = 0.88; // Damping parameter

  public predict(points: TimeSeriesPoint[], options: ModelPredictionOptions): ModelPredictionOutput {
    if (points.length < 2) {
      return { projections: [], uncertainty: 'INSUFFICIENT', trendSlopePerDay: 0 };
    }

    // Initialize level and trend
    let level = points[0].value;
    let trend =
      (points[1].value - points[0].value) /
      Math.max(
        0.5,
        (new Date(points[1].timestamp).getTime() - new Date(points[0].timestamp).getTime()) /
          (1000 * 3600 * 24)
      );

    const residuals: number[] = [];

    for (let i = 1; i < points.length; i++) {
      const dtDays = Math.max(
        0.1,
        (new Date(points[i].timestamp).getTime() - new Date(points[i - 1].timestamp).getTime()) /
          (1000 * 3600 * 24)
      );
      const actual = points[i].value;
      const forecastOneStep = level + this.phi * trend * dtDays;
      residuals.push(actual - forecastOneStep);

      const prevLevel = level;
      level = this.alpha * actual + (1 - this.alpha) * (level + this.phi * trend * dtDays);
      trend = this.beta * ((level - prevLevel) / dtDays) + (1 - this.beta) * this.phi * trend;
    }

    // Estimate residual variance
    const resVariance =
      residuals.length > 0
        ? residuals.reduce((s, r) => s + Math.pow(r, 2), 0) / residuals.length
        : 0.001;
    const residualStdError = Math.max(0.015, Math.sqrt(resVariance));

    const lastPoint = points[points.length - 1];
    const tOrigin = new Date(lastPoint.timestamp).getTime();

    const totalHours = options.horizonHours;
    const stepsCount = options.stepsCount ?? (totalHours <= 48 ? 4 : 7);
    const stepInterval = totalHours / stepsCount;

    const projections: ProjectionPoint[] = [];

    for (let i = 1; i <= stepsCount; i++) {
      const stepHours = Math.round(i * stepInterval);
      const stepDays = stepHours / 24;
      const targetTime = new Date(tOrigin + stepHours * 3600 * 1000).toISOString();

      // Damped trend accumulation: sum_{k=1}^h phi^k
      const dampingSum =
        this.phi !== 1 ? (this.phi * (1 - Math.pow(this.phi, stepDays))) / (1 - this.phi) : stepDays;
      const projectedValue = level + dampingSum * trend;

      // Forecast error grows with horizon
      const horizonMultiplier = Math.sqrt(1 + stepDays * (1 - this.phi + 0.2));
      const margin = 1.96 * residualStdError * horizonMultiplier;

      projections.push({
        targetTimestamp: targetTime,
        stepHours,
        projectedValue: Math.max(0, Math.round(projectedValue * 1000) / 1000),
        lowerBound: Math.max(0, Math.round((projectedValue - margin) * 1000) / 1000),
        upperBound: Math.round((projectedValue + margin) * 1000) / 1000,
        confidenceInterval: 0.95,
      });
    }

    let uncertainty: ForecastUncertainty = 'MODERATE';
    if (residualStdError < 0.02) uncertainty = 'LOW';
    else if (residualStdError > 0.06) uncertainty = 'HIGH';

    return {
      projections,
      uncertainty,
      trendSlopePerDay: Math.round(trend * 10000) / 10000,
    };
  }
}

/**
 * Model Registry maintaining available forecast models.
 */
export class ModelRegistry {
  private static models: Map<string, IForecastModel> = new Map<string, IForecastModel>([
    ['persistence-baseline-v1', new PersistenceBaselineModel()],
    ['linear-trend-v1', new LinearTrendModel()],
    ['ewma-damped-trend-v1', new EwmaDampedTrendModel()],
  ]);

  public static getModel(id: string): IForecastModel | undefined {
    return this.models.get(id);
  }

  public static getDefaultModel(): IForecastModel {
    return this.models.get('linear-trend-v1')!;
  }

  public static getBaselineModel(): IForecastModel {
    return this.models.get('persistence-baseline-v1')!;
  }

  public static listModels(): IForecastModel[] {
    return Array.from(this.models.values());
  }
}
