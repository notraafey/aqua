/**
 * Model Evaluation & Historical Backtesting Engine for AquaSentinel
 * Conforms to Phase 6 PRD Sections 11, 40, 42, 43
 *
 * CRITICAL SCIENTIFIC PRINCIPLES:
 * - Anti-Data Leakage: At each historical backtest point T_k, strictly zero observations
 *   occurring after T_k are visible to the feature generator or model.
 * - Rigorous Metrics: Calculates MAE, RMSE, and Directional Accuracy.
 * - Benchmark Comparison: Candidate models are explicitly benchmarked against
 *   the Persistence Baseline reference model.
 */

import {
  Observation,
  StreamReach,
  ObservationIndicator,
  ForecastHorizonHours,
  ModelEvaluationMetric,
  TimeSeriesPoint,
} from '@aquasentinel/shared';
import { generateId, nowUtc } from '../value-objects.js';
import { TimeSeriesEngine } from './time-series-engine.js';
import { ModelRegistry, IForecastModel } from './forecast-models.js';
import { ForecastingEngine } from './forecasting-engine.js';

export interface BacktestOptions {
  reach: StreamReach;
  indicator?: ObservationIndicator;
  observations: Observation[];
  modelIds?: string[];
  horizons?: ForecastHorizonHours[];
  minHistoricalPointsRequired?: number;
}

export class BacktestingEngine {
  /**
   * Executes rolling backtest across historical observations.
   */
  public static runBacktest(options: BacktestOptions): ModelEvaluationMetric[] {
    const indicator = options.indicator ?? 'NDCI';
    const horizons = options.horizons ?? [24, 48, 72];
    const modelIds = options.modelIds ?? ['linear-trend-v1', 'ewma-damped-trend-v1'];
    const minPoints = options.minHistoricalPointsRequired ?? 4;

    const allMatching = options.observations.filter(
      (o) => o.streamReachId === options.reach.id && o.indicator === indicator
    );
    const sortedObs = TimeSeriesEngine.sortChronologically(allMatching);

    if (sortedObs.length < minPoints + 2) {
      return []; // Not enough temporal depth for holdout evaluation
    }

    const baselineModel = ModelRegistry.getBaselineModel();
    const evaluationMetrics: ModelEvaluationMetric[] = [];

    for (const horizon of horizons) {
      const horizonMs = horizon * 3600 * 1000;

      // 1. Run Baseline Model evaluation first
      const baselinePairs = this.evaluateModelOnHistory(
        baselineModel,
        sortedObs,
        options.reach,
        indicator,
        horizon,
        minPoints
      );

      const baselineMetrics = this.computeMetrics(baselinePairs);

      // Record baseline model metrics
      const baselineEval: ModelEvaluationMetric = {
        id: generateId(),
        modelId: baselineModel.id,
        modelName: baselineModel.name,
        modelVersion: baselineModel.version,
        horizonHours: horizon,
        sampleSize: baselinePairs.length,
        mae: baselineMetrics.mae,
        rmse: baselineMetrics.rmse,
        directionalAccuracy: baselineMetrics.directionalAccuracy,
        evaluationPeriod: {
          start: sortedObs[0].timestamp,
          end: sortedObs[sortedObs.length - 1].timestamp,
        },
        evaluatedAt: nowUtc(),
      };
      evaluationMetrics.push(baselineEval);

      // 2. Evaluate each candidate model and benchmark against baseline
      for (const modelId of modelIds) {
        if (modelId === baselineModel.id) continue;
        const model = ModelRegistry.getModel(modelId);
        if (!model) continue;

        const candidatePairs = this.evaluateModelOnHistory(
          model,
          sortedObs,
          options.reach,
          indicator,
          horizon,
          minPoints
        );

        const candMetrics = this.computeMetrics(candidatePairs);

        const improvementPercentMae =
          baselineMetrics.mae > 0
            ? Math.round(((baselineMetrics.mae - candMetrics.mae) / baselineMetrics.mae) * 1000) / 10
            : 0;

        evaluationMetrics.push({
          id: generateId(),
          modelId: model.id,
          modelName: model.name,
          modelVersion: model.version,
          horizonHours: horizon,
          sampleSize: candidatePairs.length,
          mae: candMetrics.mae,
          rmse: candMetrics.rmse,
          directionalAccuracy: candMetrics.directionalAccuracy,
          evaluationPeriod: {
            start: sortedObs[0].timestamp,
            end: sortedObs[sortedObs.length - 1].timestamp,
          },
          baselineModelComparison: {
            baselineModelId: baselineModel.id,
            baselineMae: baselineMetrics.mae,
            baselineRmse: baselineMetrics.rmse,
            improvementPercentMae,
          },
          evaluatedAt: nowUtc(),
        });
      }
    }

    return evaluationMetrics;
  }

  /**
   * Performs rolling point evaluation for a single model at horizon h.
   * STRICT ANTI-DATA LEAKAGE: Passes ONLY observations <= T_k into ForecastingEngine.
   */
  private static evaluateModelOnHistory(
    model: IForecastModel,
    allObs: Observation[],
    reach: StreamReach,
    indicator: ObservationIndicator,
    horizonHours: ForecastHorizonHours,
    minPoints: number
  ): Array<{ yActual: number; yPred: number; yPrevious: number }> {
    const horizonMs = horizonHours * 3600 * 1000;
    const pairs: Array<{ yActual: number; yPred: number; yPrevious: number }> = [];

    // Rolling origin loop: T_k moves from minPoints to length - 1
    for (let k = minPoints; k < allObs.length; k++) {
      const originObs = allObs[k - 1];
      const Tk = originObs.timestamp;
      const tOriginMs = new Date(Tk).getTime();
      const targetTimeMs = tOriginMs + horizonMs;

      // Find an actual observation occurring closest to targetTimeMs (within +/- 36h tolerance)
      let closestObs: Observation | null = null;
      let minDiffMs = Infinity;

      for (let j = k; j < allObs.length; j++) {
        const obsTimeMs = new Date(allObs[j].timestamp).getTime();
        const diff = Math.abs(obsTimeMs - targetTimeMs);
        if (diff < minDiffMs && diff <= 36 * 3600 * 1000) {
          minDiffMs = diff;
          closestObs = allObs[j];
        }
      }

      if (!closestObs) continue;

      // STRICT DATA LEAKAGE ENFORCEMENT:
      // We pass all observations to generateForecast with originTimestamp: Tk.
      // ForecastingEngine filters out strictly anything > Tk.
      const forecast = ForecastingEngine.generateForecast({
        observations: allObs,
        reach,
        indicator,
        horizonHours,
        modelId: model.id,
        originTimestamp: Tk, // Strict temporal barrier
      });

      if (!forecast.isSufficientData || forecast.projections.length === 0) {
        continue;
      }

      const lastProj = forecast.projections[forecast.projections.length - 1];
      const yActual = typeof closestObs.value === 'number' ? closestObs.value : parseFloat(String(closestObs.value));

      if (!isNaN(yActual)) {
        pairs.push({
          yActual,
          yPred: lastProj.projectedValue,
          yPrevious: forecast.currentValue,
        });
      }
    }

    return pairs;
  }

  /**
   * Computes MAE, RMSE, and Directional Accuracy from holdout pairs.
   */
  private static computeMetrics(
    pairs: Array<{ yActual: number; yPred: number; yPrevious: number }>
  ): { mae: number; rmse: number; directionalAccuracy: number } {
    if (pairs.length === 0) {
      return { mae: 0, rmse: 0, directionalAccuracy: 0 };
    }

    const n = pairs.length;
    let absErrorSum = 0;
    let sqErrorSum = 0;
    let directionalCorrectCount = 0;

    for (const p of pairs) {
      const error = p.yPred - p.yActual;
      absErrorSum += Math.abs(error);
      sqErrorSum += Math.pow(error, 2);

      const actualDelta = p.yActual - p.yPrevious;
      const predDelta = p.yPred - p.yPrevious;

      if (
        (actualDelta >= 0 && predDelta >= 0) ||
        (actualDelta <= 0 && predDelta <= 0)
      ) {
        directionalCorrectCount++;
      }
    }

    const mae = Math.round((absErrorSum / n) * 10000) / 10000;
    const rmse = Math.round(Math.sqrt(sqErrorSum / n) * 10000) / 10000;
    const directionalAccuracy = Math.round((directionalCorrectCount / n) * 1000) / 10;

    return { mae, rmse, directionalAccuracy };
  }
}
