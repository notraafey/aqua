/**
 * Deterministic Demo Scenarios for AquaSentinel Phase 6 Resilience Intelligence
 * Conforms to Phase 6 PRD Sections 36, 45, 50
 *
 * Implements deterministic historical observations demonstrating:
 * - Stable baseline period
 * - Escalating trend
 * - Anomaly detection
 * - Cross-domain corroboration (citizen reports & meteorological heat)
 * - Contradictory observation test case
 * - Live forecast generation through actual forecasting models
 * - Multi-scenario simulation and comparison
 */

import {
  Observation,
  StreamReach,
  ForecastResult,
  EarlyWarning,
  ScenarioComparison,
  ReachResilienceScorecard,
  MonitoringCoverageBreakdown,
  ModelEvaluationMetric,
} from '@aquasentinel/shared';
import { generateId } from '../value-objects.js';
import { ForecastingEngine } from './forecasting-engine.js';
import { EarlyWarningEngine } from './early-warning-engine.js';
import { ScenarioEngine } from './scenario-engine.js';
import { BacktestingEngine } from './backtesting-engine.js';
import { ResilienceScorecardEngine } from './resilience-scorecard.js';

export interface Phase6DemoData {
  reaches: StreamReach[];
  observations: Observation[];
  forecasts: ForecastResult[];
  earlyWarnings: EarlyWarning[];
  comparisons: ScenarioComparison[];
  scorecards: ReachResilienceScorecard[];
  coverage: Record<string, MonitoringCoverageBreakdown>;
  modelEvaluations: ModelEvaluationMetric[];
}

export class Phase6DemoScenarios {
  // 1. Almyros Stream Reach Alpha
  public static readonly reachAlmyros: StreamReach = {
    id: '7a3b4c12-89de-4f56-9abc-1234567890ab',
    name: 'Almyros Stream - Reach Alpha',
    city: 'Volos',
    region: 'Thessaly, Greece',
    monitoringStatus: 'ACTIVE',
    geometry: {
      type: 'LineString',
      coordinates: [
        [22.751, 39.182],
        [22.7535, 39.1812],
        [22.757, 39.1798],
        [22.761, 39.1785],
      ],
    },
    waterCoverageConstraint: {
      minWidthMeters: 15,
      confidencePenalty: 0.2,
    },
    baselineData: {
      typicalNdci: 0.12,
      typicalTurbidity: 4.5,
      typicalTempC: 18.5,
      lastUpdated: '2026-09-01T00:00:00.000Z',
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  // 2. Anavros Stream Reach
  public static readonly reachAnavros: StreamReach = {
    id: '8b4c5d23-90ef-5a67-0bcd-2345678901bc',
    name: 'Anavros Stream - Urban Outlet',
    city: 'Volos',
    region: 'Thessaly, Greece',
    monitoringStatus: 'ACTIVE',
    geometry: {
      type: 'LineString',
      coordinates: [
        [22.962, 39.351],
        [22.965, 39.349],
        [22.968, 39.346],
      ],
    },
    baselineData: {
      typicalNdci: 0.10,
      typicalTurbidity: 3.8,
      typicalTempC: 17.5,
      lastUpdated: '2026-09-01T00:00:00.000Z',
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  // 3. Krafsidonas Torrent Reach
  public static readonly reachKrafsidonas: StreamReach = {
    id: '9c5d6e34-01fa-6b78-1cde-3456789012cd',
    name: 'Krafsidonas Torrent - Mid Reach',
    city: 'Volos',
    region: 'Thessaly, Greece',
    monitoringStatus: 'ACTIVE',
    geometry: {
      type: 'LineString',
      coordinates: [
        [22.935, 39.372],
        [22.938, 39.368],
        [22.942, 39.363],
      ],
    },
    baselineData: {
      typicalNdci: 0.14,
      typicalTurbidity: 5.2,
      typicalTempC: 19.0,
      lastUpdated: '2026-09-01T00:00:00.000Z',
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  /**
   * Generates complete, connected demo dataset exercising the real Phase 6 analytical engine.
   */
  public static generateDemoData(): Phase6DemoData {
    const reaches = [this.reachAlmyros, this.reachAnavros, this.reachKrafsidonas];
    const observations: Observation[] = [];

    // Helper for synthetic observation creation
    const makeObs = (data: {
      id?: string;
      reachId: string;
      source: Observation['source'];
      indicator: Observation['indicator'];
      value: any;
      timestamp: string;
      qualityScore?: number;
    }): Observation => {
      const id = data.id ?? generateId();
      return {
        id,
        source: data.source,
        indicator: data.indicator,
        value: data.value,
        unit:
          data.indicator === 'TEMPERATURE'
            ? 'Cel'
            : data.indicator === 'PRECIPITATION'
            ? 'mm'
            : 'dimensionless',
        timestamp: data.timestamp,
        location: { type: 'Point', coordinates: [22.7535, 39.1812] },
        streamReachId: data.reachId,
        quality: 'VALIDATED',
        provenance: {
          id: generateId(),
          entityId: id,
          entityType: 'OBSERVATION',
          source: data.source,
          sourceIdentifier: 'DEMO_SYNTHETIC',
          acquisitionTimestamp: data.timestamp,
          ingestionTimestamp: data.timestamp,
          processingTimestamp: data.timestamp,
          processingMethod: 'DEMO_PIPELINE',
          qualityStatus: 'VALIDATED',
        },
        metadata: {
          qualityScore: data.qualityScore ?? 0.9,
        },
        createdAt: data.timestamp,
      };
    };

    // ==========================================
    // 1. Almyros Reach: Stable -> Trend -> Anomaly + Corroboration
    // ==========================================
    // Stable Period
    observations.push(makeObs({ reachId: this.reachAlmyros.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.12, timestamp: '2026-09-01T10:00:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachAlmyros.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.13, timestamp: '2026-09-03T10:00:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachAlmyros.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.12, timestamp: '2026-09-05T10:00:00.000Z' }));

    // Increasing Trend
    observations.push(makeObs({ reachId: this.reachAlmyros.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.18, timestamp: '2026-09-07T10:00:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachAlmyros.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.25, timestamp: '2026-09-09T10:00:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachAlmyros.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.35, timestamp: '2026-09-11T10:00:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachAlmyros.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.46, timestamp: '2026-09-13T10:00:00.000Z' }));

    // Anomaly Peak
    observations.push(makeObs({ reachId: this.reachAlmyros.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.58, timestamp: '2026-09-15T10:00:00.000Z' }));

    // Corroborating Citizen Reports
    observations.push(makeObs({ reachId: this.reachAlmyros.id, source: 'CITIZEN_REPORT', indicator: 'FOAM', value: 'Thick greenish scum accumulating at bank', timestamp: '2026-09-15T11:30:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachAlmyros.id, source: 'CITIZEN_REPORT', indicator: 'ODOR', value: 'Strong stagnant septic odor near weir', timestamp: '2026-09-15T14:15:00.000Z' }));

    // Weather Context
    observations.push(makeObs({ reachId: this.reachAlmyros.id, source: 'WEATHER_STATION', indicator: 'TEMPERATURE', value: 29.5, timestamp: '2026-09-15T12:00:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachAlmyros.id, source: 'WEATHER_STATION', indicator: 'PRECIPITATION', value: 0.0, timestamp: '2026-09-15T12:00:00.000Z' }));

    // ==========================================
    // 2. Anavros Reach: Stable Baseline (Pristine Control)
    // ==========================================
    observations.push(makeObs({ reachId: this.reachAnavros.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.09, timestamp: '2026-09-02T10:00:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachAnavros.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.11, timestamp: '2026-09-06T10:00:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachAnavros.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.10, timestamp: '2026-09-10T10:00:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachAnavros.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.10, timestamp: '2026-09-14T10:00:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachAnavros.id, source: 'WEATHER_STATION', indicator: 'TEMPERATURE', value: 24.0, timestamp: '2026-09-14T10:00:00.000Z' }));

    // ==========================================
    // 3. Krafsidonas Reach: Contradictory Evidence Case
    // ==========================================
    observations.push(makeObs({ reachId: this.reachKrafsidonas.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.14, timestamp: '2026-09-02T10:00:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachKrafsidonas.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.15, timestamp: '2026-09-08T10:00:00.000Z' }));
    observations.push(makeObs({ reachId: this.reachKrafsidonas.id, source: 'SATELLITE_SENTINEL2', indicator: 'NDCI', value: 0.35, timestamp: '2026-09-15T10:00:00.000Z' }));
    // Contradictory in-situ sensor reading 2 hours later
    observations.push(makeObs({ reachId: this.reachKrafsidonas.id, source: 'IN_SITU_SENSOR', indicator: 'NDCI', value: 0.13, timestamp: '2026-09-15T12:00:00.000Z', qualityScore: 0.95 }));

    // ==========================================
    // EXERCISE REAL ANALYTICAL ENGINES
    // ==========================================
    const forecasts: ForecastResult[] = [];
    const earlyWarnings: EarlyWarning[] = [];
    const comparisons: ScenarioComparison[] = [];
    const scorecards: ReachResilienceScorecard[] = [];
    const coverage: Record<string, MonitoringCoverageBreakdown> = {};

    const demoRefTime = '2026-09-15T16:00:00.000Z';

    for (const r of reaches) {
      // 1. Generate Forecast
      const fc = ForecastingEngine.generateForecast({
        reach: r,
        observations,
        indicator: 'NDCI',
        horizonHours: 72,
        originTimestamp: demoRefTime,
        modelId: 'linear-trend-v1',
      });
      forecasts.push(fc);

      // 2. Evaluate Early Warning
      const ew = EarlyWarningEngine.evaluate({
        reach: r,
        observations,
        indicator: 'NDCI',
        referenceTime: demoRefTime,
      });
      if (ew) earlyWarnings.push(ew);

      // 3. Scorecard & Coverage
      const cov = ResilienceScorecardEngine.calculateMonitoringCoverage(r, observations, demoRefTime);
      coverage[r.id] = cov;

      const sc = ResilienceScorecardEngine.calculateScorecard({
        reach: r,
        observations,
        incidents: [],
        activeEarlyWarnings: earlyWarnings,
        referenceTime: demoRefTime,
      });
      scorecards.push(sc);

      // 4. Scenarios for Almyros
      if (r.id === this.reachAlmyros.id && fc.isSufficientData) {
        const simAccel = ScenarioEngine.simulate({
          baselineForecast: fc,
          type: 'ACCELERATED_DETERIORATION',
          parameters: { accelerationMultiplier: 1.6 },
        });

        const simInterv = ScenarioEngine.simulate({
          baselineForecast: fc,
          type: 'OPERATIONAL_INTERVENTION',
          parameters: { interventionEfficacyPercent: 45, interventionLagHours: 12 },
        });

        const simWeather = ScenarioEngine.simulate({
          baselineForecast: fc,
          type: 'WEATHER_EVENT',
          parameters: { rainfallIntensityMm: 35 },
        });

        const comp = ScenarioEngine.compare(fc, [simAccel, simInterv, simWeather]);
        comparisons.push(comp);
      }
    }

    // 5. Backtesting evaluations across Almyros
    const modelEvaluations = BacktestingEngine.runBacktest({
      reach: this.reachAlmyros,
      observations,
      indicator: 'NDCI',
      horizons: [24, 48, 72],
      modelIds: ['linear-trend-v1', 'ewma-damped-trend-v1'],
      minHistoricalPointsRequired: 4,
    });

    return {
      reaches,
      observations,
      forecasts,
      earlyWarnings,
      comparisons,
      scorecards,
      coverage,
      modelEvaluations,
    };
  }
}
