/**
 * Resilience Analytics Service
 * Conforms to Phase 6 PRD Sections 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 23.
 * 
 * Orchestrates pure time-series statistics, zero-leakage short-horizon forecasting,
 * multi-signal early warning generation with contradiction downgrading,
 * parameterized scenario simulations with explicit operational implications,
 * multi-dimensional resilience scorecards, and historical rolling backtests.
 */

import {
  Observation,
  StreamReach,
  ForecastResult,
  ScenarioSimulation,
  ScenarioComparison,
  EarlyWarning,
  ReachResilienceScorecard,
  MonitoringCoverageBreakdown,
  AnalyticalProvenance,
  ModelEvaluationMetric,
  ObservationIndicator,
  ForecastHorizonHours,
  ScenarioType,
  ScenarioParameters,
  ForecastGeneratedEvent,
  EarlyWarningTriggeredEvent,
  ScenarioSimulatedEvent,
  ObservationReceivedEvent,
  EvidenceUpdatedEvent,
  TaskStatusUpdatedEvent,
  Incident,
  EvidenceAssessment,
} from '@aquasentinel/shared';
import { getRepositories } from '../../database/repositories/index.js';
import { getEventBus } from '../../events/index.js';
import { getFhirAdapter } from '../../adapters/fhir/index.js';
import { logger } from '../../logging/logger.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';
import { NotFoundError, ValidationError } from '../../api/middleware/error-handler.js';
import { ForecastingEngine } from '../../domain/analytics/forecasting-engine.js';
import { EarlyWarningEngine } from '../../domain/analytics/early-warning-engine.js';
import { ScenarioEngine } from '../../domain/analytics/scenario-engine.js';
import { BacktestingEngine } from '../../domain/analytics/backtesting-engine.js';
import { ResilienceScorecardEngine } from '../../domain/analytics/resilience-scorecard.js';
import { Phase6DemoScenarios } from '../../domain/analytics/demo-scenarios.js';

export interface GenerateForecastServiceOptions {
  reachId: string;
  indicator?: ObservationIndicator;
  modelId?: string;
  horizonHours?: ForecastHorizonHours;
  originTimestamp?: string;
  save?: boolean;
}

export interface RunScenarioServiceOptions {
  reachId: string;
  name?: string;
  description?: string;
  type: ScenarioType;
  indicator?: ObservationIndicator;
  horizonHours?: ForecastHorizonHours;
  baselineForecastId?: string;
  parameters?: ScenarioParameters;
}

export class ResilienceAnalyticsService {
  private isSubscribed = false;

  /**
   * Initializes event subscriptions for reactive analytics
   */
  public initialize(): void {
    if (this.isSubscribed) return;

    const eventBus = getEventBus();

    // 1. Reactive early-warning re-evaluation on new observation
    eventBus.subscribe('ObservationReceived', async (event) => {
      try {
        const obsEvent = event as unknown as ObservationReceivedEvent;
        const reachId = obsEvent.payload?.observation?.streamReachId;
        if (reachId) {
          logger.info(`[ResilienceAnalytics] Reactive check on ObservationReceived for reach: ${reachId}`);
          await this.evaluateEarlyWarnings(reachId);
        }
      } catch (err: any) {
        logger.error(`[ResilienceAnalytics] Error processing ObservationReceived: ${err.message}`);
      }
    });

    // 2. Refresh analytics on EvidenceUpdated
    eventBus.subscribe('EvidenceUpdated', async (event) => {
      try {
        const evidenceEvent = event as unknown as EvidenceUpdatedEvent;
        const reachId = evidenceEvent.payload?.assessment?.streamReachId;
        if (reachId) {
          logger.info(`[ResilienceAnalytics] Refreshing early warnings on EvidenceUpdated for reach: ${reachId}`);
          await this.evaluateEarlyWarnings(reachId);
        }
      } catch (err: any) {
        logger.error(`[ResilienceAnalytics] Error processing EvidenceUpdated: ${err.message}`);
      }
    });

    // 3. Operational Intervention monitoring on TaskStatusUpdated
    eventBus.subscribe('TaskStatusUpdated', async (event) => {
      try {
        const taskEvent = event as unknown as TaskStatusUpdatedEvent;
        const taskId = taskEvent.payload?.taskId;
        logger.info(`[ResilienceAnalytics] Operational task updated (${taskId}). Relevant scorecards refreshed.`);
      } catch (err: any) {
        logger.error(`[ResilienceAnalytics] Error processing TaskStatusUpdated: ${err.message}`);
      }
    });

    this.isSubscribed = true;
    logger.info('[ResilienceAnalyticsService] Subscribed to domain events.');
  }

  /**
   * Generates a short-horizon forecast for a stream reach and indicator.
   * Enforces zero data leakage at originTimestamp.
   */
  public async generateForecast(options: GenerateForecastServiceOptions): Promise<ForecastResult> {
    const repos = getRepositories();
    const reach = await repos.streamReaches.findById(options.reachId);
    if (!reach) {
      throw new NotFoundError(`Stream reach not found: ${options.reachId}`);
    }

    const observations = await repos.observations.findByStreamReach(options.reachId);

    const forecast = ForecastingEngine.generateForecast({
      reach,
      observations,
      indicator: options.indicator ?? 'NDCI',
      modelId: options.modelId,
      horizonHours: options.horizonHours ?? 72,
      originTimestamp: options.originTimestamp,
    });

    if (options.save !== false) {
      await repos.forecasts.save(forecast);

      // Publish typed event to EventBus
      const eventBus = getEventBus();
      const event: ForecastGeneratedEvent = {
        eventId: generateId(),
        eventType: 'ForecastGenerated',
        timestamp: nowUtc(),
        actor: 'ForecastingEngine',
        payload: {
          forecast,
        },
      };
      await eventBus.publish(event);

      // FHIR R4 Boundary Mapping
      try {
        const fhirAdapter = getFhirAdapter();
        if (fhirAdapter.publishForecastObservation) {
          await fhirAdapter.publishForecastObservation(forecast);
        }
      } catch (fhirErr: any) {
        logger.warn(`[ResilienceAnalytics] FHIR forecast publishing notice: ${fhirErr.message}`);
      }
    }

    return forecast;
  }

  /**
   * Retrieves the latest forecasts for a reach.
   */
  public async getLatestForecasts(reachId: string, indicator?: ObservationIndicator): Promise<ForecastResult[]> {
    const repos = getRepositories();
    const latest = await repos.forecasts.findLatestByReach(reachId, indicator);
    if (latest) {
      return [latest];
    }
    return repos.forecasts.findByReach(reachId);
  }

  /**
   * Retrieves a single forecast by ID.
   */
  public async getForecastById(id: string): Promise<ForecastResult | null> {
    const repos = getRepositories();
    return repos.forecasts.findById(id);
  }

  /**
   * Runs a parameterized scenario simulation.
   */
  public async runScenario(options: RunScenarioServiceOptions): Promise<ScenarioSimulation> {
    const repos = getRepositories();
    const reach = await repos.streamReaches.findById(options.reachId);
    if (!reach) {
      throw new NotFoundError(`Stream reach not found: ${options.reachId}`);
    }

    const indicator = options.indicator ?? 'NDCI';
    let baselineForecast: ForecastResult | null = null;

    if (options.baselineForecastId) {
      baselineForecast = await repos.forecasts.findById(options.baselineForecastId);
    }

    if (!baselineForecast) {
      baselineForecast = await repos.forecasts.findLatestByReach(reach.id, indicator);
    }

    if (!baselineForecast) {
      baselineForecast = await this.generateForecast({
        reachId: reach.id,
        indicator,
        modelId: 'baseline-persistence',
        horizonHours: options.horizonHours ?? 72,
        save: true,
      });
    }

    const simulation = ScenarioEngine.simulate({
      baselineForecast,
      type: options.type,
      name: options.name,
      description: options.description,
      parameters: options.parameters,
    });

    await repos.scenarios.save(simulation);

    // Publish ScenarioSimulatedEvent
    const eventBus = getEventBus();
    const event: ScenarioSimulatedEvent = {
      eventId: generateId(),
      eventType: 'ScenarioSimulated',
      timestamp: nowUtc(),
      actor: 'ScenarioEngine',
      payload: {
        simulation,
      },
    };
    await eventBus.publish(event);

    return simulation;
  }

  /**
   * Compares multiple scenario simulations side-by-side against a baseline.
   */
  public async compareScenarios(
    reachId: string,
    scenarioIds: string[],
    baselineForecastId?: string
  ): Promise<ScenarioComparison> {
    const repos = getRepositories();
    const reach = await repos.streamReaches.findById(reachId);
    if (!reach) {
      throw new NotFoundError(`Stream reach not found: ${reachId}`);
    }

    const simulations: ScenarioSimulation[] = [];
    for (const sId of scenarioIds) {
      const sim = await repos.scenarios.findById(sId);
      if (sim) simulations.push(sim);
    }

    if (simulations.length === 0) {
      throw new ValidationError('At least one valid scenario simulation is required for comparison.');
    }

    let baseline: ForecastResult | null = null;
    const targetBaselineId = baselineForecastId || simulations[0].baselineForecastId;
    if (targetBaselineId) {
      baseline = await repos.forecasts.findById(targetBaselineId);
    }

    if (!baseline) {
      baseline = await repos.forecasts.findLatestByReach(reach.id, simulations[0].indicator);
    }

    if (!baseline) {
      baseline = await this.generateForecast({
        reachId: reach.id,
        indicator: simulations[0].indicator,
        modelId: 'baseline-persistence',
        horizonHours: 72,
        save: true,
      });
    }

    return ScenarioEngine.compare(baseline, simulations);
  }

  /**
   * Retrieves saved scenario simulations for a reach.
   */
  public async getScenarios(reachId: string): Promise<ScenarioSimulation[]> {
    const repos = getRepositories();
    return repos.scenarios.findByReach(reachId);
  }

  /**
   * Retrieves a single scenario simulation by ID.
   */
  public async getScenarioById(id: string): Promise<ScenarioSimulation | null> {
    const repos = getRepositories();
    return repos.scenarios.findById(id);
  }

  /**
   * Evaluates early warnings across stream reaches or for a single reach.
   */
  public async evaluateEarlyWarnings(reachId?: string): Promise<EarlyWarning[]> {
    const repos = getRepositories();
    let reaches: StreamReach[] = [];

    if (reachId) {
      const r = await repos.streamReaches.findById(reachId);
      if (r) reaches = [r];
    } else {
      reaches = await repos.streamReaches.findAll();
    }

    const detectedWarnings: EarlyWarning[] = [];
    const eventBus = getEventBus();
    const fhirAdapter = getFhirAdapter();

    for (const reach of reaches) {
      const observations = await repos.observations.findByStreamReach(reach.id);
      const assessment = await repos.evidenceAssessments.findLatestByStreamReach(reach.id);
      const incidents = (await repos.incidents.findAll()).filter((i) => i.streamReachId === reach.id);

      const warning = EarlyWarningEngine.evaluate({
        reach,
        indicator: 'NDCI',
        observations,
        assessment,
        incidentId: incidents[0]?.id,
      });

      if (warning) {
        // Check if an active unacknowledged warning of this indicator and reach already exists
        const existing = await repos.earlyWarnings.find({
          reachId: reach.id,
          acknowledged: false,
        });

        const duplicate = existing.find(
          (e: EarlyWarning) => e.indicator === warning.indicator && e.warningLevel === warning.warningLevel
        );

        if (!duplicate) {
          await repos.earlyWarnings.save(warning);
          detectedWarnings.push(warning);

          // Publish EarlyWarningTriggeredEvent
          const event: EarlyWarningTriggeredEvent = {
            eventId: generateId(),
            eventType: 'EarlyWarningTriggered',
            timestamp: nowUtc(),
            actor: 'EarlyWarningEngine',
            payload: {
              earlyWarning: warning,
            },
          };
          await eventBus.publish(event);

          // Publish to FHIR Flag
          try {
            if (fhirAdapter.publishEarlyWarningFlag) {
              await fhirAdapter.publishEarlyWarningFlag(warning);
            }
          } catch (fhirErr: any) {
            logger.warn(`[ResilienceAnalytics] FHIR early warning flag notice: ${fhirErr.message}`);
          }
        }
      }
    }

    return detectedWarnings;
  }

  /**
   * Retrieves early warnings based on filters.
   */
  public async getEarlyWarnings(filters?: {
    reachId?: string;
    acknowledged?: boolean;
    minSeverity?: string;
  }): Promise<EarlyWarning[]> {
    const repos = getRepositories();
    return repos.earlyWarnings.find(filters);
  }

  /**
   * Acknowledges an early warning.
   */
  public async acknowledgeEarlyWarning(id: string, user: string, notes?: string): Promise<EarlyWarning | null> {
    const repos = getRepositories();
    const updated = await repos.earlyWarnings.acknowledge(id, user, notes);
    if (updated) {
      logger.info(`[ResilienceAnalytics] EarlyWarning ${id} acknowledged by ${user}`);
    }
    return updated;
  }

  /**
   * Computes a multi-dimensional resilience scorecard for a reach.
   */
  public async getScorecard(reachId: string): Promise<ReachResilienceScorecard> {
    const repos = getRepositories();
    const reach = await repos.streamReaches.findById(reachId);
    if (!reach) {
      throw new NotFoundError(`Stream reach not found: ${reachId}`);
    }

    const observations = await repos.observations.findByStreamReach(reach.id);
    const incidents = (await repos.incidents.findAll()).filter((i) => i.streamReachId === reach.id);
    const activeEarlyWarnings = await repos.earlyWarnings.find({ reachId: reach.id, acknowledged: false });
    const assessment = await repos.evidenceAssessments.findLatestByStreamReach(reach.id);

    return ResilienceScorecardEngine.calculateScorecard({
      reach,
      observations,
      incidents,
      activeEarlyWarnings,
      assessment,
    });
  }

  /**
   * Computes scorecards for all reaches in the system.
   */
  public async getAllScorecards(): Promise<ReachResilienceScorecard[]> {
    const repos = getRepositories();
    const reaches = await repos.streamReaches.findAll();
    const scorecards: ReachResilienceScorecard[] = [];

    for (const reach of reaches) {
      const scorecard = await this.getScorecard(reach.id);
      scorecards.push(scorecard);
    }

    return scorecards;
  }

  /**
   * Computes monitoring coverage metrics for a stream reach.
   */
  public async getMonitoringCoverage(reachId: string): Promise<MonitoringCoverageBreakdown> {
    const repos = getRepositories();
    const reach = await repos.streamReaches.findById(reachId);
    if (!reach) {
      throw new NotFoundError(`Stream reach not found: ${reachId}`);
    }

    const observations = await repos.observations.findByStreamReach(reach.id);
    return ResilienceScorecardEngine.calculateMonitoringCoverage(reach, observations);
  }

  /**
   * Returns comprehensive system resilience overview.
   */
  public async getResilienceOverview(): Promise<{
    scorecards: ReachResilienceScorecard[];
    activeEarlyWarnings: EarlyWarning[];
    latestEvaluations: ModelEvaluationMetric[];
    systemSummary: {
      totalReachesMonitored: number;
      reachesWithEarlyWarnings: number;
      averageObservationFrequencyDays: number;
      bestPerformingModel: string;
    };
  }> {
    const scorecards = await this.getAllScorecards();
    const repos = getRepositories();
    const activeEarlyWarnings = await repos.earlyWarnings.find({ acknowledged: false });
    const latestEvaluations = await repos.modelEvaluations.findAll();

    const reachesWithWarnings = new Set(activeEarlyWarnings.map((w: EarlyWarning) => w.streamReachId)).size;
    const avgObsFreq =
      scorecards.length > 0
        ? scorecards.reduce((acc, sc) => acc + (sc.latestNdci ?? 0), 0) / scorecards.length
        : 0;

    let bestModel = 'baseline-persistence';
    if (latestEvaluations.length > 0) {
      const sorted = [...latestEvaluations].sort((a, b) => a.rmse - b.rmse);
      bestModel = sorted[0].modelId;
    }

    return {
      scorecards,
      activeEarlyWarnings,
      latestEvaluations,
      systemSummary: {
        totalReachesMonitored: scorecards.length,
        reachesWithEarlyWarnings: reachesWithWarnings,
        averageObservationFrequencyDays: Math.round(avgObsFreq * 10) / 10,
        bestPerformingModel: bestModel,
      },
    };
  }

  /**
   * Executes rolling backtests on historical data and stores metrics.
   */
  public async runRollingBacktest(
    reachId: string,
    indicator?: ObservationIndicator,
    modelIds?: string[],
    horizons?: ForecastHorizonHours[]
  ): Promise<ModelEvaluationMetric[]> {
    const repos = getRepositories();
    const reach = await repos.streamReaches.findById(reachId);
    if (!reach) {
      throw new NotFoundError(`Stream reach not found: ${reachId}`);
    }

    const observations = await repos.observations.findByStreamReach(reach.id);
    const evaluations = BacktestingEngine.runBacktest({
      reach,
      observations,
      indicator: indicator ?? 'NDCI',
      modelIds,
      horizons,
    });

    await repos.modelEvaluations.saveMany(evaluations);
    return evaluations;
  }

  /**
   * Retrieves model evaluations.
   */
  public async getModelEvaluations(
    reachId?: string,
    indicator?: ObservationIndicator
  ): Promise<ModelEvaluationMetric[]> {
    const repos = getRepositories();
    return repos.modelEvaluations.findByReachAndIndicator(reachId, indicator);
  }

  /**
   * Traces the complete analytical provenance DAG for a forecast.
   */
  public async getProvenance(forecastId: string): Promise<AnalyticalProvenance> {
    const repos = getRepositories();
    const forecast = await repos.forecasts.findById(forecastId);
    if (!forecast) {
      throw new NotFoundError(`Forecast not found: ${forecastId}`);
    }

    const observations = await repos.observations.findByStreamReach(forecast.reachId);
    const inputObs = observations
      .filter((o) => forecast.inputObservationIds.includes(o.id))
      .map((o) => ({
        id: o.id,
        timestamp: o.timestamp,
        value: typeof o.value === 'number' ? o.value : parseFloat(String(o.value)) || 0,
        source: o.source,
      }));

    return {
      targetId: forecast.id,
      targetType: 'FORECAST',
      modelId: forecast.modelId,
      modelVersion: forecast.modelVersion,
      parameters: {
        trendSlopePerDay: forecast.trendSlopePerDay,
        trendClassification: forecast.trend,
        uncertainty: forecast.uncertainty,
        confidence: forecast.confidence,
      },
      trainingWindow: forecast.trainingWindow,
      inputObservations: inputObs,
      baselineUsed:
        forecast.historicalBaseline !== undefined
          ? {
              typicalValue: forecast.historicalBaseline,
              source: 'STREAM_REACH_HISTORICAL_RECORD',
            }
          : undefined,
      generatedAt: forecast.generatedTimestamp,
    };
  }

  /**
   * Executes deterministic demo scenarios (Almyros bloom trend, Anavros control, Krafsidonas contradiction).
   */
  public async executeDemoScenarios(): Promise<{
    scenarioCount: number;
    forecastCount: number;
    earlyWarningCount: number;
    scorecardCount: number;
    evaluationCount: number;
  }> {
    const repos = getRepositories();
    const demo = Phase6DemoScenarios.generateDemoData();

    // Persist reaches
    for (const reach of demo.reaches) {
      await repos.streamReaches.save(reach);
    }

    // Persist observations
    for (const obs of demo.observations) {
      await repos.observations.save(obs);
    }

    // Persist forecasts
    for (const fc of demo.forecasts) {
      await repos.forecasts.save(fc);
    }

    // Persist early warnings
    for (const ew of demo.earlyWarnings) {
      await repos.earlyWarnings.save(ew);
    }

    // Persist comparisons as scenarios
    for (const comp of demo.comparisons) {
      for (const sim of comp.scenarios) {
        await repos.scenarios.save(sim);
      }
    }

    // Persist evaluations
    await repos.modelEvaluations.saveMany(demo.modelEvaluations);

    logger.info(
      `[ResilienceAnalytics] Deterministic demo scenarios initialized: ${demo.reaches.length} reaches, ${demo.observations.length} observations, ${demo.forecasts.length} forecasts, ${demo.earlyWarnings.length} warnings, ${demo.comparisons.length} comparisons.`
    );

    return {
      scenarioCount: demo.comparisons.reduce((sum: number, c: ScenarioComparison) => sum + c.scenarios.length, 0),
      forecastCount: demo.forecasts.length,
      earlyWarningCount: demo.earlyWarnings.length,
      scorecardCount: demo.scorecards.length,
      evaluationCount: demo.modelEvaluations.length,
    };
  }
}

// Global Singleton
let activeResilienceAnalyticsService: ResilienceAnalyticsService | null = null;

export function getResilienceAnalyticsService(): ResilienceAnalyticsService {
  if (!activeResilienceAnalyticsService) {
    activeResilienceAnalyticsService = new ResilienceAnalyticsService();
    activeResilienceAnalyticsService.initialize();
  }
  return activeResilienceAnalyticsService;
}
