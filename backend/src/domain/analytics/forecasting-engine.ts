/**
 * Forecasting Engine for AquaSentinel Resilience Intelligence
 * Conforms to Phase 6 PRD Sections 9, 10, 12, 21, 22, 23, 24, 38, 39, 43
 *
 * CRITICAL SCIENTIFIC PRINCIPLES:
 * - Zero Data Leakage: Strictly filters out observations occurring after originTimestamp T.
 * - Data Quality Gating: Returns structured insufficient-data result if criteria fail; never fabricates numbers.
 * - Proxy Indicators: Clearly notes remote sensing indices are proxies and do not diagnose pathogens.
 * - Complete Traceability: Links all input observation IDs, baseline, model ID, and version.
 */

import {
  Observation,
  StreamReach,
  ObservationIndicator,
  ForecastResult,
  ForecastHorizonHours,
  TimeSeriesPoint,
} from '@aquasentinel/shared';
import { generateId, nowUtc } from '../value-objects.js';
import { TimeSeriesEngine } from './time-series-engine.js';
import { ModelRegistry, IForecastModel } from './forecast-models.js';

export interface GenerateForecastOptions {
  observations: Observation[];
  reach: StreamReach;
  indicator?: ObservationIndicator;
  horizonHours?: ForecastHorizonHours;
  modelId?: string;
  originTimestamp?: string; // T: Forecast origin barrier. Zero data after T may be used!
  stepsCount?: number;
}

export class ForecastingEngine {
  /**
   * Generates an uncertainty-aware short-horizon environmental forecast.
   * Strictly enforces anti-data leakage barrier at originTimestamp.
   */
  public static generateForecast(options: GenerateForecastOptions): ForecastResult {
    const indicator = options.indicator ?? 'NDCI';
    const horizonHours = options.horizonHours ?? 72;
    const model = ModelRegistry.getModel(options.modelId ?? 'linear-trend-v1') ?? ModelRegistry.getDefaultModel();

    // 1. DATA LEAKAGE BARRIER:
    // Determine forecast origin T
    const allMatching = options.observations.filter(
      (o) => o.streamReachId === options.reach.id && o.indicator === indicator
    );
    let originTimestamp = options.originTimestamp;

    if (!originTimestamp) {
      if (allMatching.length > 0) {
        const sortedAll = TimeSeriesEngine.sortChronologically(allMatching);
        originTimestamp = sortedAll[sortedAll.length - 1].timestamp;
      } else {
        originTimestamp = nowUtc();
      }
    }

    const tOriginMs = new Date(originTimestamp).getTime();

    // STRICT FILTER: Exclude any observation strictly after T
    const validObservations = allMatching.filter((obs) => {
      const tObsMs = new Date(obs.timestamp).getTime();
      return tObsMs <= tOriginMs;
    });

    // 2. Extract clean chronological time series points
    const points = TimeSeriesEngine.extractSeries(validObservations, indicator);

    // Baseline value from reach
    const baselineValue =
      indicator === 'NDCI'
        ? options.reach.baselineData?.typicalNdci ?? 0.14
        : indicator === 'TURBIDITY'
        ? options.reach.baselineData?.typicalTurbidity ?? 5.0
        : undefined;

    // 3. DATA QUALITY GATING
    const qualityGate = TimeSeriesEngine.evaluateDataQualityGate(
      points,
      { minObservations: 3, minSpanHours: 24, maxRecencyHours: 336 },
      originTimestamp
    );

    const stats = TimeSeriesEngine.computeStats(points, baselineValue);

    // If gating fails: return structured insufficient data result (DO NOT FABRICATE)
    if (!qualityGate.passed || points.length === 0) {
      return {
        id: generateId(),
        reachId: options.reach.id,
        reachName: options.reach.name,
        indicator,
        originTimestamp,
        horizonHours,
        currentValue: points.length > 0 ? points[points.length - 1].value : 0,
        historicalBaseline: baselineValue,
        baselineDeviationPercent: stats.baselineDeviation?.percentageDiff,
        projections: [],
        trend: 'INSUFFICIENT_DATA',
        trendSlopePerDay: 0,
        uncertainty: 'INSUFFICIENT',
        confidence: 'INSUFFICIENT',
        modelId: model.id,
        modelVersion: model.version,
        modelName: model.name,
        trainingWindow: {
          start: points.length > 0 ? points[0].timestamp : originTimestamp,
          end: points.length > 0 ? points[points.length - 1].timestamp : originTimestamp,
          observationCount: points.length,
        },
        inputObservationIds: points.map((p) => p.observationId),
        generatedTimestamp: nowUtc(),
        explanation: `Insufficient evidence for projection. Reasons: ${qualityGate.reasons.join(' ')}`,
        labels: ['PROJECTED', 'INSUFFICIENT_DATA'],
        isSufficientData: false,
        dataQualityReasons: qualityGate.reasons,
      };
    }

    // 4. Run Forecasting Model
    const modelOutput = model.predict(points, {
      horizonHours,
      baselineValue,
      stepsCount: options.stepsCount,
    });

    const lastPoint = points[points.length - 1];
    const currentValue = lastPoint.value;

    // Baseline deviation
    let deviationPercent = 0;
    if (baselineValue !== undefined && baselineValue > 0) {
      deviationPercent = Math.round(((currentValue - baselineValue) / baselineValue) * 1000) / 10;
    }

    // 5. Generate structured, factual explanation (NO HALLUCINATIONS)
    const explanation = this.buildExplanation({
      indicator,
      points,
      baselineValue,
      currentValue,
      deviationPercent,
      trendClassification: stats.trendClassification,
      trendSlopePerDay: modelOutput.trendSlopePerDay,
      horizonHours,
      projections: modelOutput.projections,
      reasons: qualityGate.reasons,
    });

    return {
      id: generateId(),
      reachId: options.reach.id,
      reachName: options.reach.name,
      indicator,
      originTimestamp,
      horizonHours,
      currentValue,
      historicalBaseline: baselineValue,
      baselineDeviationPercent: deviationPercent,
      projections: modelOutput.projections,
      trend: stats.trendClassification,
      trendSlopePerDay: modelOutput.trendSlopePerDay,
      uncertainty: modelOutput.uncertainty,
      confidence: qualityGate.confidenceBand,
      modelId: model.id,
      modelVersion: model.version,
      modelName: model.name,
      trainingWindow: {
        start: points[0].timestamp,
        end: points[points.length - 1].timestamp,
        observationCount: points.length,
      },
      inputObservationIds: points.map((p) => p.observationId),
      generatedTimestamp: nowUtc(),
      explanation,
      labels: ['PROJECTED', 'UNCERTAIN'],
      isSufficientData: true,
      dataQualityReasons: qualityGate.reasons.length > 0 ? qualityGate.reasons : undefined,
    };
  }

  /**
   * Generates a factual explanation based strictly on mathematical facts.
   * Conforms to Phase 6 PRD Section 21 & 38.
   */
  private static buildExplanation(ctx: {
    indicator: ObservationIndicator;
    points: TimeSeriesPoint[];
    baselineValue?: number;
    currentValue: number;
    deviationPercent: number;
    trendClassification: string;
    trendSlopePerDay: number;
    horizonHours: number;
    projections: any[];
    reasons: string[];
  }): string {
    const parts: string[] = [];

    // Fact 1: Recent observations vs baseline
    if (ctx.baselineValue !== undefined) {
      const aboveCount = ctx.points.filter((p) => p.value > ctx.baselineValue!).length;
      parts.push(
        `The indicator ${ctx.indicator} exceeded historical baseline (${ctx.baselineValue}) in ${aboveCount} of the last ${ctx.points.length} observations (currently ${ctx.currentValue}, ${ctx.deviationPercent >= 0 ? '+' : ''}${ctx.deviationPercent}% deviation).`
      );
    } else {
      parts.push(
        `The indicator ${ctx.indicator} current value is ${ctx.currentValue} across ${ctx.points.length} observations.`
      );
    }

    // Fact 2: Trend & Slope
    const slopeStr =
      ctx.trendSlopePerDay >= 0
        ? `+${ctx.trendSlopePerDay}/day`
        : `${ctx.trendSlopePerDay}/day`;
    parts.push(
      `Recent trajectory is classified as ${ctx.trendClassification} with an estimated linear rate of ${slopeStr}.`
    );

    // Fact 3: Projection range
    if (ctx.projections.length > 0) {
      const finalProj = ctx.projections[ctx.projections.length - 1];
      parts.push(
        `The ${ctx.horizonHours}-hour projected value is ${finalProj.projectedValue} (uncertainty range: ${finalProj.lowerBound} to ${finalProj.upperBound}).`
      );
    }

    // Fact 4: Data quality notes
    if (ctx.reasons.length > 0) {
      parts.push(`Quality caveats: ${ctx.reasons.join(' ')}`);
    }

    // Scientific rule disclaimer
    parts.push(
      'Notice: Environmental indices are optical proxies and do not independently establish confirmed pathogens or health events.'
    );

    return parts.join(' ');
  }
}
