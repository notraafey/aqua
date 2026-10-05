/**
 * Resilience Intelligence & Scenario Simulation REST API Router
 * Conforms to Phase 6 PRD Sections 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 23.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ObservationIndicator,
  ScenarioType,
  ForecastHorizonHours,
} from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { getResilienceAnalyticsService } from '../../services/analytics/resilience-analytics-service.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { nowUtc } from '../../domain/value-objects.js';

export const resilienceRouter = Router();

// Validation Schemas
const GenerateForecastSchema = z.object({
  indicator: z.string().default('NDCI'),
  modelId: z.string().optional(),
  horizonHours: z.number().int().min(1).max(720).optional().default(72),
  originTimestamp: z.string().optional(),
});

const RunScenarioSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.enum([
    'CURRENT_CONTINUES',
    'ACCELERATED_DETERIORATION',
    'ATTENUATION',
    'WEATHER_EVENT',
    'OPERATIONAL_INTERVENTION',
  ]),
  indicator: z.string().optional().default('NDCI'),
  horizonHours: z.number().int().min(1).max(720).optional().default(72),
  baselineForecastId: z.string().optional(),
  parameters: z.record(z.string(), z.any()).optional().default({}),
});

const CompareScenariosSchema = z.object({
  scenarioIds: z.array(z.string()).min(1),
  baselineForecastId: z.string().optional(),
});

const AcknowledgeWarningSchema = z.object({
  acknowledgedBy: z.string().min(1).default('Operator'),
  notes: z.string().optional(),
});

const RunBacktestSchema = z.object({
  reachId: z.string().min(1),
  indicator: z.string().default('NDCI'),
  modelIds: z.array(z.string()).optional(),
  horizons: z.array(z.number()).optional(),
});

// ============================================================
// 1. Overview & Scorecards
// ============================================================

/**
 * GET /api/v1/resilience/overview
 * Returns system-wide resilience overview, active warnings, and scorecards.
 */
resilienceRouter.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getResilienceAnalyticsService();
    const overview = await service.getResilienceOverview();

    res.json({
      success: true,
      data: overview,
      meta: {
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/resilience/reaches/:reachId
 * Returns detailed resilience analytics, scorecard, forecasts, and coverage for a single reach.
 */
resilienceRouter.get('/reaches/:reachId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reachId } = req.params;
    const repos = getRepositories();
    const reach = await repos.streamReaches.findById(reachId);
    if (!reach) {
      throw new NotFoundError(`Stream reach not found: ${reachId}`);
    }

    const service = getResilienceAnalyticsService();
    const [scorecard, coverage, forecasts, activeWarnings, scenarios] = await Promise.all([
      service.getScorecard(reachId),
      service.getMonitoringCoverage(reachId),
      service.getLatestForecasts(reachId),
      service.getEarlyWarnings({ reachId, acknowledged: false }),
      service.getScenarios(reachId),
    ]);

    res.json({
      success: true,
      data: {
        reach,
        scorecard,
        coverage,
        forecasts,
        activeWarnings,
        scenarios,
      },
      meta: {
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// 2. Forecasting
// ============================================================

/**
 * POST /api/v1/resilience/reaches/:reachId/forecasts
 * Generates and persists a short-horizon forecast for a reach.
 */
resilienceRouter.post('/reaches/:reachId/forecasts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reachId } = req.params;
    const parsed = GenerateForecastSchema.parse(req.body);

    const service = getResilienceAnalyticsService();
    const forecast = await service.generateForecast({
      reachId,
      indicator: parsed.indicator as ObservationIndicator,
      modelId: parsed.modelId,
      horizonHours: parsed.horizonHours as ForecastHorizonHours,
      originTimestamp: parsed.originTimestamp,
      save: true,
    });

    res.status(201).json({
      success: true,
      data: forecast,
      meta: {
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/resilience/reaches/:reachId/forecasts
 * Retrieves the latest forecasts for a reach.
 */
resilienceRouter.get('/reaches/:reachId/forecasts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reachId } = req.params;
    const indicator = req.query.indicator as ObservationIndicator | undefined;

    const service = getResilienceAnalyticsService();
    const forecasts = await service.getLatestForecasts(reachId, indicator);

    res.json({
      success: true,
      data: forecasts,
      meta: {
        total: forecasts.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/resilience/forecasts/:id
 * Retrieves a single forecast by ID.
 */
resilienceRouter.get('/forecasts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const service = getResilienceAnalyticsService();
    const forecast = await service.getForecastById(id);

    if (!forecast) {
      throw new NotFoundError(`Forecast not found: ${id}`);
    }

    res.json({
      success: true,
      data: forecast,
      meta: {
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// 3. Scenario Simulation & Comparison
// ============================================================

/**
 * POST /api/v1/resilience/reaches/:reachId/scenarios/run
 * Runs and stores a parameterized scenario simulation.
 */
resilienceRouter.post('/reaches/:reachId/scenarios/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reachId } = req.params;
    const parsed = RunScenarioSchema.parse(req.body);

    const service = getResilienceAnalyticsService();
    const simulation = await service.runScenario({
      reachId,
      name: parsed.name,
      description: parsed.description,
      type: parsed.type as ScenarioType,
      indicator: parsed.indicator as ObservationIndicator,
      horizonHours: parsed.horizonHours as ForecastHorizonHours,
      baselineForecastId: parsed.baselineForecastId,
      parameters: parsed.parameters,
    });

    res.status(201).json({
      success: true,
      data: simulation,
      meta: {
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/resilience/reaches/:reachId/scenarios
 * Retrieves saved scenario simulations for a reach.
 */
resilienceRouter.get('/reaches/:reachId/scenarios', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reachId } = req.params;
    const service = getResilienceAnalyticsService();
    const scenarios = await service.getScenarios(reachId);

    res.json({
      success: true,
      data: scenarios,
      meta: {
        total: scenarios.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/resilience/scenarios/:id
 * Retrieves a single scenario simulation by ID.
 */
resilienceRouter.get('/scenarios/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const service = getResilienceAnalyticsService();
    const scenario = await service.getScenarioById(id);

    if (!scenario) {
      throw new NotFoundError(`Scenario not found: ${id}`);
    }

    res.json({
      success: true,
      data: scenario,
      meta: {
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/resilience/reaches/:reachId/scenarios/compare
 * Compares multiple scenario simulations side-by-side against a baseline.
 */
resilienceRouter.post('/reaches/:reachId/scenarios/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reachId } = req.params;
    const parsed = CompareScenariosSchema.parse(req.body);

    const service = getResilienceAnalyticsService();
    const comparison = await service.compareScenarios(reachId, parsed.scenarioIds, parsed.baselineForecastId);

    res.json({
      success: true,
      data: comparison,
      meta: {
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// 4. Early Warning Engine
// ============================================================

/**
 * GET /api/v1/resilience/early-warnings
 * Retrieves early warnings with optional filters.
 */
resilienceRouter.get('/early-warnings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reachId = req.query.reachId as string | undefined;
    const acknowledgedStr = req.query.acknowledged as string | undefined;
    const acknowledged = acknowledgedStr !== undefined ? acknowledgedStr === 'true' : undefined;
    const minSeverity = req.query.minSeverity as string | undefined;

    const service = getResilienceAnalyticsService();
    const warnings = await service.getEarlyWarnings({ reachId, acknowledged, minSeverity });

    res.json({
      success: true,
      data: warnings,
      meta: {
        total: warnings.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/resilience/early-warnings/evaluate
 * Manually triggers an early warning evaluation across reaches.
 */
resilienceRouter.post('/early-warnings/evaluate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reachId = req.body?.reachId as string | undefined;
    const service = getResilienceAnalyticsService();
    const warnings = await service.evaluateEarlyWarnings(reachId);

    res.json({
      success: true,
      data: warnings,
      meta: {
        detectedCount: warnings.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/resilience/early-warnings/:id/acknowledge
 * Acknowledges an early warning.
 */
resilienceRouter.post('/early-warnings/:id/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parsed = AcknowledgeWarningSchema.parse(req.body);

    const service = getResilienceAnalyticsService();
    const updated = await service.acknowledgeEarlyWarning(id, parsed.acknowledgedBy, parsed.notes);

    if (!updated) {
      throw new NotFoundError(`Early warning not found: ${id}`);
    }

    res.json({
      success: true,
      data: updated,
      meta: {
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// 5. Historical Backtesting & Model Performance
// ============================================================

/**
 * GET /api/v1/resilience/models/evaluation
 * Retrieves model evaluation metrics.
 */
resilienceRouter.get('/models/evaluation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reachId = req.query.reachId as string | undefined;
    const indicator = req.query.indicator as ObservationIndicator | undefined;

    const service = getResilienceAnalyticsService();
    const evaluations = await service.getModelEvaluations(reachId, indicator);

    res.json({
      success: true,
      data: evaluations,
      meta: {
        total: evaluations.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/resilience/models/backtest
 * Triggers a rolling holdout backtest for a reach and indicator.
 */
resilienceRouter.post('/models/backtest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RunBacktestSchema.parse(req.body);

    const service = getResilienceAnalyticsService();
    const evaluations = await service.runRollingBacktest(
      parsed.reachId,
      parsed.indicator as ObservationIndicator,
      parsed.modelIds,
      parsed.horizons as ForecastHorizonHours[] | undefined
    );

    res.json({
      success: true,
      data: evaluations,
      meta: {
        evaluatedModels: evaluations.length,
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// 6. Analytical Provenance DAG
// ============================================================

/**
 * GET /api/v1/resilience/provenance/:id
 * Retrieves the full analytical provenance DAG for a forecast.
 */
resilienceRouter.get('/provenance/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const service = getResilienceAnalyticsService();
    const provenance = await service.getProvenance(id);

    res.json({
      success: true,
      data: provenance,
      meta: {
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});
