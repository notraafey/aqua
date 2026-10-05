# AquaSentinel Phase 6 Handoff: Resilience Intelligence & Scenario Simulation

## 1. Phase Objective
Phase 6 transitions AquaSentinel from reactive incident mitigation (Phases 3–5) to proactive, predictive resilience intelligence and counterfactual scenario modeling. It equips municipal water utilities, environmental engineers, and emergency planners with:
- Deterministic empirical time-series analytics (OLS linear trend, EWMA smoothing, rolling statistics, and baseline deviation metrics).
- Short-horizon forecasting (24h, 48h, 72h) with explicit prediction uncertainty intervals and strict temporal anti-data-leakage barriers at forecast origin timestamp $T$.
- Multi-signal early-warning intelligence with environmental corroboration/contradiction matrices and structured factual rationale.
- Interactive counterfactual scenario simulation across 5 canonical archetypes (`STATUS_QUO`, `ACCELERATED_DETERIORATION`, `NATURAL_ATTENUATION`, `METEOROLOGICAL_SHOCK`, `OPERATIONAL_INTERVENTION`) with step-by-step differential matrix comparison.
- Multi-dimensional resilience scorecards and monitoring coverage breakdowns without collapsing into arbitrary single composite scores.
- Historical rolling holdout backtesting benchmarked against persistence baselines to compute MAE, RMSE, and directional accuracy.
- Complete analytical provenance DAG tracing model configurations, versions, parameters, and input observation IDs.
- HL7 FHIR R4 interoperability mapping early warnings to `Flag` resources and projected forecast points to `Observation` resources.
- Interactive Municipal Command Console integration with accessible SVG charting, parameter tuning sliders, provenance inspection, and warning acknowledgment.

---

## 2. Implemented Functionality
1. **Time-Series Engine (`backend/src/domain/analytics/time-series-engine.ts`)**:
   - Ordinary Least Squares (OLS) regression over normalized timestamps ($t$ in days) yielding slope ($\beta$), intercept ($\alpha$), $R^2$, and categorical trend (`ACCELERATING`, `INCREASING`, `DECREASING`, `STABLE`).
   - Exponentially Weighted Moving Average (EWMA) with configurable $\alpha \in (0, 1]$ (default 0.30).
   - Rolling window sample mean ($\mu$), sample standard deviation ($s$), median, interquartile range (IQR), minimum, and maximum.
   - Baseline deviation calculation in percentage ($\%$) and standard deviation units ($Z$-score $\sigma$).
2. **Short-Horizon Forecasting Models & Engine (`backend/src/domain/analytics/forecast-models.ts`, `forecasting-engine.ts`)**:
   - `baseline-persistence` (Reference Model): Flat projection $\hat{y}_{T+h} = y_T$ with expanding confidence bounds $\sigma(h) = s \sqrt{1 + h/24}$.
   - `linear-trend-v1`: Extrapolates OLS trend $\hat{y}_{T+h} = \alpha + \beta (t_T + h)$ with heteroskedastic prediction standard error $\text{SE}(\hat{y}_{T+h})$.
   - `ewma-damped-trend-v1`: Combines current EWMA level with geometrically damped velocity (damping factor $\phi = 0.85$) to prevent compounding linear runaway.
   - Strict Anti-Data Leakage: Enforced temporal filter discarding any observation where $t > T$ prior to training or feature computation.
3. **Multi-Signal Early-Warning Engine (`backend/src/domain/analytics/early-warning-engine.ts`)**:
   - Evaluates trajectory breach rules: Value $> 0.18$ (Advisory) or $> 0.28$ (Warning), velocity $> 0.02$/day with $R^2 \ge 0.50$, or baseline deviation $Z \ge 2.0\sigma$.
   - Signal Corroboration: Multi-sensor context cross-referencing high temperature ($>22^\circ\text{C}$), depressed dissolved oxygen ($<6.0\text{ mg/L}$), and upstream reach optical proxy escalation.
   - Contradiction / Confounding: Automatic confidence downgrading and false-positive flagging when heavy rainfall ($>25\text{ mm/24h}$) or high turbidity plumes suggest mineral sediment runoff rather than biogenic blooms.
   - Factual trigger rationale formatted as structured bullet points.
4. **Scenario Simulation Engine (`backend/src/domain/analytics/scenario-engine.ts`)**:
   - Generates counterfactual trajectories for 5 canonical scenario types.
   - Dynamic simulation parameters (temperature anomaly $\Delta^\circ\text{C}$, flow reduction $\%$, runoff multiplier, mitigation effectiveness $\%$).
   - Step-by-step differential matrix output comparing simulated steps to baseline forecast ($\Delta y_k$ and $\% \text{ Change}$).
   - Stated operational assumptions stored explicitly with every simulation record.
5. **Multi-Dimensional Resilience Scorecards (`backend/src/domain/analytics/resilience-scorecard.ts`)**:
   - Independent ratings across 5 orthogonal dimensions: Alert Exposure, Trend Velocity, Monitoring Coverage, Historical Volatility, and Recovery Capability.
   - Detailed monitoring coverage breakdown (frequency, temporal gap statistics, freshness, completeness).
6. **Rolling Holdout Backtesting Engine (`backend/src/domain/analytics/backtesting-engine.ts`)**:
   - Temporal walk-forward evaluation across historical origins $T_k$.
   - Evaluation metrics: MAE, RMSE, Directional Accuracy, and relative skill score percentage improvement over `baseline-persistence`.
7. **Persistence & Data Schema (`backend/src/database/migrations/005_phase6_resilience_analytics.sql`)**:
   - Tables: `forecast_runs`, `scenario_simulations`, `early_warnings`, `model_evaluations`.
   - Full InMemory and PostgreSQL repository implementations.
8. **FHIR R4 Interoperability Extensions (`backend/src/adapters/fhir/mapper.ts`)**:
   - Early warning $\rightarrow$ FHIR R4 `Flag` (safety category, early-warning code, reach extension).
   - Projected forecast point $\rightarrow$ FHIR R4 `Observation` (preliminary status, projected-water-quality-ndci code, target horizon timestamp, referenceRange uncertainty bounds).
9. **Municipal Command Console Integration (`frontend/src/`)**:
   - `ResiliencePage.tsx`: Integrated multi-tab workspace (System Overview, Reach Forecasts, Scenario Simulator, Model Backtesting).
   - `ForecastChartView.tsx`: Pure SVG chart rendering historical observed points, vertical barrier line at origin $T$, dashed projected trajectory, shaded uncertainty polygon, and typical baseline reference.
   - `ScenarioSimulatorView.tsx`: Interactive parameter sliders, dual-curve SVG visualization, explicit assumptions panel, and comparison matrix table.
   - `EarlyWarningBanner.tsx`: High-visibility notification cards with corroboration pills and operator acknowledgment modal.
   - `ModelPerformanceView.tsx`: Backtest benchmark table and live rolling backtest trigger.
   - `ResilienceOverview.tsx`: Scorecard table with dimension badges and system monitoring KPI cards.
   - `AnalyticalProvenanceModal.tsx`: Traceable DAG lineage modal showing model ID, version, parameters, and input observation IDs.
   - Navigation & Badges: `Sidebar.tsx` and `App.tsx` wired with active early warning counter badges and reach deep-linking.

---

## 3. Analytical Architecture
The analytical pipeline resides in `backend/src/domain/analytics/` and is orchestrated by `backend/src/services/analytics/resilience-analytics-service.ts`:
```
                                +---------------------------+
                                | Ingested Sensor Telemetry |
                                | & Sentinel-2 NDCI Proxies |
                                +-------------+-------------+
                                              |
                                              v
                              +---------------+---------------+
                              |    Time-Series Engine         |
                              |  - OLS Trend & R²             |
                              |  - EWMA Smoothing             |
                              |  - Rolling Stats & Dispersion |
                              |  - Baseline Deviation (Z-Score|
                              +---------------+---------------+
                                              |
                    +-------------------------+-------------------------+
                    |                                                   |
                    v                                                   v
   +----------------+----------------+                 +----------------+----------------+
   |   Forecasting Engine            |                 |   Multi-Signal Early-Warning    |
   |   (Zero Leakage Barrier at T)   |                 |   Engine                        |
   |   - baseline-persistence        |                 |   - Trajectory Thresholds       |
   |   - linear-trend-v1             |                 |   - Multi-Sensor Corroboration  |
   |   - ewma-damped-trend-v1        |                 |   - Confounding Downgrades      |
   +----------------+----------------+                 +----------------+----------------+
                    |                                                   |
                    v                                                   v
   +----------------+----------------+                 +----------------+----------------+
   |  Scenario Simulation Engine     |                 |  Resilience Scorecard &         |
   |  - 5 Canonical Archetypes       |                 |  Monitoring Coverage Engine     |
   |  - Differential Step Matrix     |                 |  - 5 Orthogonal Dimensions      |
   |  - Explicit Assumptions & Levers|                 |  - Gap & Freshness Breakdown    |
   +----------------+----------------+                 +----------------+----------------+
                    |                                                   |
                    +-------------------------+-------------------------+
                                              |
                                              v
                              +---------------+---------------+
                              |  Analytical Provenance DAG    |
                              |  - Model ID & Version         |
                              |  - Input Observation IDs      |
                              |  - Fitted Parameters          |
                              +---------------+---------------+
                                              |
                        +---------------------+---------------------+
                        |                                           |
                        v                                           v
         +--------------+--------------+             +--------------+--------------+
         | REST API & EventBus Stream   |             | HL7 FHIR R4 Extensions      |
         | (/api/v1/resilience/*)       |             | - Flag (Early Warnings)     |
         |                              |             | - Observation (Projections) |
         +--------------+--------------+             +-----------------------------+
                        |
                        v
         +--------------+--------------+
         | Frontend Command Console     |
         | - Accessible SVG Charts      |
         | - Anti-Leakage Visual Barrier|
         | - Scenario Sliders & Matrix  |
         +-----------------------------+
```

---

## 4. Feature Engineering
The engine extracts deterministic features from filtered time-series subsets:
- **Timestamp Normalization**: Elapsed time $t_i = (T_i - T_0) / 86,400,000$ days from the first observation in the window.
- **Sampling Regularization**: Observations within an hourly cluster are aggregated or indexed sequentially to handle irregular revisit times typical of optical satellite passes.
- **Dispersion Extraction**: Mean $\mu$, variance $s^2$, standard deviation $s$, interquartile range $\text{IQR} = Q_3 - Q_1$, and median.
- **Velocity Feature**: Empirical rate of change $\Delta y / \Delta t$ computed across adjacent observations and smoothed via OLS slope $\beta$.
- **Acceleration Feature**: Second difference or change in trend slope across sequential rolling windows.

---

## 5. Baseline Implementation
- **Reference Model (`baseline-persistence`)**:
  * Carries the latest verified observation at origin $T$ forward flatly: $\hat{y}_{T+h} = y_T$.
  * Serves as the zero-skill benchmark for all backtesting evaluations.
  * Explicitly reflects information decay: uncertainty interval widens as a function of the square root of forecast horizon:
    $$\text{CI}_{95\%}(h) = \left[ y_T - 1.96 \cdot s_y \sqrt{1 + \frac{h}{24}}, \; y_T + 1.96 \cdot s_y \sqrt{1 + \frac{h}{24}} \right]$$
- **Historical Baseline Comparison**:
  * Computes reach baseline mean $\mu_{\text{baseline}}$ and standard deviation $\sigma_{\text{baseline}}$ over standard 90-day seasonal windows.
  * Expresses current and projected values in standard deviation anomalies ($Z$-score units) to identify non-stationary regime shifts.

---

## 6. Trend Engine
Implemented in `TimeSeriesEngine.calculateLinearTrend`:
- Fits $y = \alpha + \beta t$ using Ordinary Least Squares.
- Returns slope $\beta$ (units per day), intercept $\alpha$, correlation coefficient $r$, and goodness of fit $R^2$.
- Categorical classification:
  * `ACCELERATING`: $\beta > 0.015$ / day and $R^2 \ge 0.50$ (indicates compounding exponential-like growth phase).
  * `INCREASING`: $\beta > 0.003$ / day.
  * `DECREASING`: $\beta < -0.003$ / day.
  * `STABLE`: $|\beta| \le 0.003$ / day.

---

## 7. Forecasting Models
All models implement `IForecastingModel` in `backend/src/domain/analytics/forecast-models.ts`:
1. **`baseline-persistence` (v1.0.0)**:
   * Assumes static equilibrium.
   * Parameter-free.
2. **`linear-trend-v1` (v1.0.0)**:
   * Extrapolates OLS slope and intercept over target horizon $h \in [1, 72\text{ hours}]$.
   * Clips negative values to physical floor (0.00).
   * Calculates residual mean square error $\text{RMSE} = \sqrt{\frac{1}{N-2} \sum (y_i - \hat{y}_i)^2}$.
3. **`ewma-damped-trend-v1` (v1.0.0)**:
   * Initializes level $\hat{s}_0 = y_0$ with smoothing factor $\alpha = 0.30$.
   * Derives trend velocity $b_T$ from OLS or EWMA step differences.
   * Applies geometric damping $\phi = 0.85$:
     $$\hat{y}_{T+h} = \hat{s}_T + b_T \sum_{k=1}^h \phi^k = \hat{s}_T + b_T \frac{\phi(1 - \phi^h)}{1 - \phi}$$
   * Effectively models natural growth limits and hydraulic resistance.

---

## 8. Forecast Validation
- Every forecast execution validates:
  * Minimum observation requirement ($N \ge 3$ observations).
  * Temporal monotonicity ($t_1 \le t_2 \le \dots \le t_N$).
  * Value range physical bounds (NDCI $\in [-1.0, 1.0]$, physical proxy $\ge 0.0$).
  * Forecast horizon bounds ($h \in [1, 168\text{ hours}]$).
  * Non-empty output projections array matching requested horizon steps.

---

## 9. Uncertainty Methodology
- **Heteroskedastic Prediction Intervals**:
  Forecast intervals are not constant width; they account for:
  1. Historical residual variance ($\text{RMSE}^2$).
  2. Sample size uncertainty ($1/N$).
  3. Distance of the target projection point from the center of mass of historical observations $\bar{t}$:
     $$\text{SE}(\hat{y}_{T+h}) = \text{RMSE} \sqrt{1 + \frac{1}{N} + \frac{(t_{T+h} - \bar{t})^2}{\sum_{i=1}^N (t_i - \bar{t})^2}}$$
- **Confidence Rating**:
  * `HIGH`: $N \ge 10$, $R^2 \ge 0.70$, max temporal gap $< 48\text{ hours}$.
  * `MEDIUM`: $5 \le N < 10$, $0.40 \le R^2 < 0.70$.
  * `LOW`: $N < 5$, $R^2 < 0.40$, or large observation gaps.
- **Physical Truncation**: Uncertainty intervals are clamped so `valueLow` never falls below 0.00 for non-negative indicators.

---

## 10. Early-Warning Engine
Implemented in `EarlyWarningEngine.evaluate`:
- **Warning Levels**:
  * `WARNING` (High Urgency): Projected or current value $> 0.28$, or velocity $> 0.03$/day with high corroboration.
  * `ADVISORY` (Medium Urgency): Projected or current value $> 0.18$, or baseline anomaly $Z \ge 2.0\sigma$.
  * `WATCH` (Low Urgency): Modest elevation above baseline with increasing trend.
- **Corroborating Signals**:
  * Water temperature $> 22^\circ\text{C}$ (promotes cyanobacteria kinetics).
  * Dissolved oxygen $< 6.0\text{ mg/L}$ (hypoxia indicator).
  * Upstream reach showing elevated proxy.
- **Contradiction / Confounding**:
  * Rainfall $> 25\text{ mm/24h}$ or turbidity $> 50\text{ NTU}$ indicates sediment transport and optical scattering rather than biogenic chlorophyll. Confidence is automatically downgraded and an explicit warning flag is attached.
- **State Management**: Warnings support operator acknowledgment with notes via `POST /api/v1/resilience/early-warnings/:id/acknowledge`.

---

## 11. Scenario Engine
Implemented in `ScenarioEngine.simulateScenario`:
- Takes a baseline forecast and counterfactual parameter perturbations.
- Computes trajectory step-by-step applying calibrated response coefficients.
- Generates structured assumptions list, summary narrative, and comparison delta against baseline.
- Persists simulations with full cryptographic and parameter provenance.

---

## 12. Scenario Assumptions
1. **`STATUS_QUO`**:
   * Assumes environmental forcing (solar radiation, water temperature, streamflow) continues along current seasonal trajectory.
   * Assumes no upstream point or non-point source shock occurs.
   * Assumes no municipal operational interventions are deployed.
2. **`ACCELERATED_DETERIORATION`**:
   * Assumes ambient temperature rises $+2.0^\circ\text{C}$ to $+4.0^\circ\text{C}$.
   * Assumes streamflow diminishes by $30\% - 50\%$, extending hydraulic residence time.
   * Assumes biogenic growth rates accelerate by $15\% - 35\%$.
3. **`NATURAL_ATTENUATION`**:
   * Assumes environmental temperature falls and solar irradiance declines.
   * Assumes natural bacterial grazing and hydraulic flushing dilute biomass at $5\% - 15\%$ per day.
4. **`METEOROLOGICAL_SHOCK`**:
   * Assumes high precipitation storm event ($>35\text{ mm/24h}$).
   * Assumes immediate optical scattering spike from suspended mineral sediment followed by hydraulic washout.
5. **`OPERATIONAL_INTERVENTION`**:
   * Assumes targeted physical or biological response (e.g. aeration, ultrasound, flow augmentation, intake diversion).
   * Models intervention delay (default 6–12h) followed by exponential decay of excess proxy value at rate dictated by mitigation effectiveness parameter.

---

## 13. Scenario Outputs
For every simulation run:
- Metadata: `scenarioType`, `name`, `description`, `reachId`, `baselineForecastId`, `simulatedAt`.
- Trajectory: Array of `ScenarioStep` objects with `stepHours`, `timestamp`, `value`, `deltaFromBaseline`, and `percentChangeFromBaseline`.
- Assumptions: Explicit array of string assumptions.
- Summary: Peak simulated value, time to peak, cumulative deviation from baseline, and final horizon value.

---

## 14. Monitoring Coverage
Implemented in `ResilienceScorecardEngine.evaluateMonitoringCoverage`:
- **Observation Frequency**: Average observations per week over a 30-day window.
- **Temporal Gaps**: Mean gap (hours) and maximum gap (hours) between successive valid data points.
- **Freshness**: Hours elapsed since the most recent observation. Categorized as `EXCELLENT` ($<24\text{h}$), `GOOD` ($<72\text{h}$), `FAIR` ($<168\text{h}$), or `POOR` ($\ge 168\text{h}$).
- **Sensor Health**: Active sensor operational status and data completeness percentage.

---

## 15. Resilience Scorecard
Implemented in `ResilienceScorecardEngine.computeScorecard`:
Evaluates 5 orthogonal dimensions without collapsing into an arbitrary single composite score:
1. **Alert Exposure**: `LOW` (no active warnings), `MODERATE` (WATCH/ADVISORY), `HIGH` (active WARNING).
2. **Trend Velocity**: `STABLE`, `MODERATE`, or `RAPID` based on OLS slope magnitude.
3. **Monitoring Coverage**: `ROBUST`, `ADEQUATE`, or `DEFICIENT` based on observation density and gap statistics.
4. **Historical Volatility**: `LOW`, `MODERATE`, or `HIGH` based on rolling 90-day coefficient of variation ($s / \mu$).
5. **Recovery Capability**: `HIGH`, `MEDIUM`, or `LOW` based on hydraulic flushing time and historical return-to-baseline rates.

---

## 16. Model Versioning
All model instances declare immutable semantic versions in their metadata:
- `baseline-persistence@1.0.0`
- `linear-trend-v1@1.0.0`
- `ewma-damped-trend-v1@1.0.0`

When models are evaluated in backtesting or persisted in database records, the exact `modelId` and version are stored in `forecast_runs.model_id` and `model_evaluations.model_id`.

---

## 17. Analytical Provenance
Every analytical artifact generates an `AnalyticalProvenance` record:
- `provenanceId`: UUIDv4 identifier.
- `targetEntityId`: ID of the forecast or scenario.
- `targetEntityType`: `'FORECAST'` | `'SCENARIO'` | `'SCORECARD'`.
- `modelId` & `modelVersion`.
- `parameters`: Hash of fitted coefficients ($\alpha, \beta, R^2, \text{RMSE}, \phi$).
- `inputObservationIds`: Complete array of observation IDs used to fit the model.
- `computedAt`: ISO-8601 UTC timestamp.
- `executionDurationMs`: Computational duration in milliseconds.
- `lineageNodes`: Directed Acyclic Graph nodes representing input data sources, intermediate feature transforms, and downstream consumers.

---

## 18. Backtesting
Implemented in `BacktestingEngine.runBacktest`:
- Evaluates candidate models on historical data using rolling origins $T_1 < T_2 < \dots < T_K$.
- Requires at least 10 observations to form valid training and holdout windows.
- Automatically benchmarks candidate models against `baseline-persistence`.
- Outputs:
  * `mae`: Mean Absolute Error.
  * `rmse`: Root Mean Square Error.
  * `directionalAccuracy`: Percentage of steps where sign of predicted change matches actual change.
  * `baselineModelComparison`: Ratio of candidate MAE to baseline MAE and percentage skill improvement.
  * `holdoutSampleSize`: Number of out-of-sample steps evaluated.

---

## 19. Data Leakage Protections
- **Temporal Barrier**:
  `ForecastingEngine.generateForecast` executes strict filtering:
  ```ts
  const eligibleObs = observations.filter(
    (obs) => new Date(obs.timestamp).getTime() <= new Date(originTimestamp).getTime()
  );
  ```
- **Holdout Validation Isolation**:
  `BacktestingEngine` slices the historical series at each test origin $T_k$, ensuring the training dataset contains strictly $t \le T_k$, and holdout evaluation evaluates against points with $t > T_k$ that were never provided to the model fitting routine.
- **Verification Tests**:
  Dedicated test suite `backend/tests/unit/data-leakage.test.ts` injects future poison spikes ($t > T$) and verifies they exert zero influence on trend slope, projected values, or uncertainty bounds.

---

## 20. API Endpoints
All endpoints mounted at `/api/v1/resilience` with Zod validation:
1. `GET /api/v1/resilience/overview`: System-wide resilience overview, KPI metrics, and all reach scorecards.
2. `GET /api/v1/resilience/scorecard/:reachId`: Multi-dimensional scorecard and monitoring coverage for a specific stream reach.
3. `POST /api/v1/resilience/forecast`: Generates a short-horizon forecast for a reach. Body: `{ reachId, modelId?, horizonHours?, originTimestamp? }`.
4. `GET /api/v1/resilience/forecast/:reachId`: Retrieves historical and active forecasts for a reach.
5. `POST /api/v1/resilience/scenarios/simulate`: Runs a counterfactual scenario simulation. Body: `{ reachId, scenarioType, name, horizonHours, parameters }`.
6. `GET /api/v1/resilience/scenarios/:reachId`: Retrieves saved scenario simulations for a reach.
7. `GET /api/v1/resilience/early-warnings`: Lists active early warnings with filtering by reachId and acknowledgment status.
8. `POST /api/v1/resilience/early-warnings/:id/acknowledge`: Operator acknowledgment with notes. Body: `{ acknowledgedBy, notes? }`.
9. `POST /api/v1/resilience/backtest`: Executes rolling holdout backtests. Body: `{ reachId, indicator?, modelIds?, horizons? }`.
10. `GET /api/v1/resilience/models/performance/:reachId`: Retrieves model evaluation metrics for a reach.
11. `GET /api/v1/resilience/provenance/:targetId`: Retrieves analytical provenance record and lineage DAG for a forecast or scenario.
12. `POST /api/v1/demo/phase6/execute`: Triggers end-to-end Phase 6 demonstration workflow populating forecasts, early warnings, scenarios, and backtest evaluations across Volos stream reaches.

---

## 21. Event Architecture
The `EventBus` (`backend/src/events/event-bus.ts`) is extended with Phase 6 domain events:
1. `ForecastGeneratedEvent` (`forecast.generated`):
   - Payload: `{ forecast: ForecastResult }`.
   - Published whenever a short-horizon forecast is calculated.
2. `EarlyWarningTriggeredEvent` (`early_warning.triggered`):
   - Payload: `{ earlyWarning: EarlyWarning }`.
   - Published when multi-signal rules detect impending hazard conditions.
3. `ScenarioSimulatedEvent` (`scenario.simulated`):
   - Payload: `{ simulation: ScenarioSimulation }`.
   - Published when counterfactual simulations are executed.
- **Reactive Subscriptions**:
  `ResilienceAnalyticsService` subscribes to:
  * `ObservationReceived`: Triggers incremental early-warning check and refreshes reach time-series features.
  * `EvidenceUpdated`: Re-evaluates resilience scorecards.
  * `TaskStatusUpdated`: Re-evaluates operational recovery dimension upon task completion.

---

## 22. Frontend Architecture
The frontend extends the municipal command console with modular, accessible resilience components:
- **Location**: `frontend/src/pages/ResiliencePage.tsx` and `frontend/src/components/resilience/`.
- **Zero Frontend Calculation Invariant**: All statistical regressions, horizon projections, confidence intervals, and scenario delta matrices are computed strictly on the backend.
- **SVG Cartography & Charting**: Custom accessible SVG charts with zero external charting library dependencies.
- **Responsive Layout**: Tailwind CSS flex/grid layouts with dark-mode aesthetic consistent with the Command Console.

---

## 23. Resilience UI
Component: `frontend/src/components/resilience/ResilienceOverview.tsx`
- System-wide resilience KPI summary cards (Total Monitored Reaches, Active Early Warnings, Average Observation Cadence, Best Performing Model).
- Multi-dimensional scorecard table displaying independent dimension badges (`Alert Exposure`, `Trend Velocity`, `Coverage`, `Volatility`, `Recovery`).
- Reach selector with instant transition to reach-specific forecast and scenario tabs.

---

## 24. Forecast UI
Component: `frontend/src/components/resilience/ForecastChartView.tsx`
- Pure SVG visualization:
  * Historical observations as connected solid cyan lines and circular data points labeled `OBSERVED`.
  * Vertical dashed amber line at forecast origin $T$ labeled `FORECAST ORIGIN T`.
  * Projected steps as dashed cyan lines and square points labeled `PROJECTED`.
  * Shaded translucent polygon representing the $95\%$ prediction uncertainty interval.
  * Horizontal dashed emerald reference line displaying typical reach baseline.
- Model selector dropdown (`linear-trend-v1`, `ewma-damped-trend-v1`, `baseline-persistence`).
- Forecast horizon selector (+24h, +48h, +72h).
- Forecast history switcher dropdown for navigating past forecast runs.
- Provenance DAG inspector button opening `AnalyticalProvenanceModal`.
- Scientific proxy disclosure banner explaining NDCI optical characteristics.

---

## 25. Scenario UI
Component: `frontend/src/components/resilience/ScenarioSimulatorView.tsx`
- Scenario archetype selector cards with distinct iconography and descriptions.
- Dynamic parameter controls:
  * Temperature Anomaly Slider ($-2^\circ\text{C}$ to $+5^\circ\text{C}$).
  * Flow Reduction Slider ($0\%$ to $70\%$).
  * Runoff Multiplier Slider ($1.0\times$ to $3.0\times$).
  * Mitigation Effectiveness Slider ($10\%$ to $90\%$).
- Dual-trajectory SVG chart comparing baseline forecast vs simulated trajectory.
- Explicit assumptions list highlighting operational caveats.
- Side-by-side step comparison matrix table with absolute $\Delta$ and percentage change columns.

---

## 26. Demo Data
Implemented in `backend/src/domain/analytics/demo-scenarios.ts`:
- **Reach Seed**: Seeded with historical NDCI, water temperature, dissolved oxygen, and turbidity observations across Volos reaches (Krafsidonas, Anavros, Xirias).
- **Canonical Scenarios**:
  * Anavros Accelerated Bloom (elevated temperature, low flow, escalating NDCI).
  * Krafsidonas Attenuation (seasonal cooling, flow recovery).
  * Xirias Runoff Shock (turbidity plume, false-positive handling).
  * Operational Aeration & Intake Shutdown simulation runs.
- **One-Click Execution**: `POST /api/v1/demo/phase6/execute` generates complete live demo state in memory or Postgres.

---

## 27. Live Mode
- Connects to Postgres database using migration `005_phase6_resilience_analytics.sql`.
- Reads real stream reaches and observations from Phase 2 ingestion pipelines (Copernicus Sentinel-2, Open-Meteo weather, USGS/municipal flow).
- Evaluates live early warnings and updates scorecards on incoming telemetry.
- Persists forecast runs and scenario simulations to SQL tables.

---

## 28. Tests
The automated test suite covers all Phase 6 engines and integration points:
- `backend/tests/unit/time-series-engine.test.ts` (8 tests): OLS regression, EWMA, rolling stats, IQR, baseline deviation.
- `backend/tests/unit/forecasting-engine.test.ts` (5 tests): All three forecast models, horizon projections, uncertainty calculations.
- `backend/tests/unit/data-leakage.test.ts` (1 test): Strict verification that future observations do not leak into origin $T$ forecasts.
- `backend/tests/unit/early-warning-engine.test.ts` (4 tests): Warning levels, multi-sensor corroboration, rainfall confounding downgrades, trigger rationale.
- `backend/tests/unit/scenario-engine.test.ts` (5 tests): Canonical scenario generation, parameter sensitivity, step comparison matrices.
- `backend/tests/unit/backtesting-engine.test.ts` (2 tests): Historical holdout backtesting and skill score comparison.
- `backend/tests/unit/demo-scenarios-phase6.test.ts` (1 test): Complete execution of Phase 6 demo dataset.
- `backend/tests/integration/resilience-api.test.ts` (12 tests): Full REST API endpoint suite, Zod validation, and error handling.

---

## 29. Test Results
- **Test Command**: `npm test -- --run`
- **Result**:
  * **Test Files**: 45 passed (45)
  * **Tests**: 185 passed (185)
  * **Failures**: 0
  * **Phase 1–5 Regressions**: 0 (all 147 baseline tests pass without modification).

---

## 30. Build Results
- **Build Command**: `npm run build`
- **Result**:
  * `@aquasentinel/shared`: TypeScript compile succeeded (0 errors).
  * `@aquasentinel/backend`: TypeScript compile succeeded (0 errors).
  * `@aquasentinel/frontend`: TypeScript compile + Vite production bundle succeeded (0 errors, bundle size 420.78 kB, gzip 106.15 kB).

---

## 31. Known Limitations
1. **Satellite Revisit Revisit Latency**: Optical Sentinel-2 passes over Volos occur every 3–5 days. Cloud cover can introduce irregular multi-day observation gaps. The forecasting engine gracefully handles these via the monitoring coverage indicator and wider uncertainty bounds, but cannot synthesize missing optical data during cloud events.
2. **Simplified Hydraulic Routing**: The scenario engine uses calibrated reach-level residence time approximations rather than 2D Saint-Venant hydraulic routing equations.

---

## 32. Technical Debt
- Pure in-memory SQLite / mock repositories mirror Postgres schema perfectly, but production deployment with high-concurrency scenario runs will benefit from database-level write partitioning for `forecast_runs`.
- Additional forecast models (e.g. ARIMA or vector autoregression with weather covariates) can be plugged in via the established `IForecastingModel` interface.

---

## 33. Files Created
### Domain & Shared
- `shared/src/types/analytics.ts`: Comprehensive analytical domain contracts.
- `backend/src/domain/analytics/time-series-engine.ts`: OLS, EWMA, and statistical routines.
- `backend/src/domain/analytics/forecast-models.ts`: Model implementations (`baseline-persistence`, `linear-trend-v1`, `ewma-damped-trend-v1`).
- `backend/src/domain/analytics/forecasting-engine.ts`: Horizon projection and uncertainty manager.
- `backend/src/domain/analytics/early-warning-engine.ts`: Multi-signal early-warning rule evaluator.
- `backend/src/domain/analytics/scenario-engine.ts`: Counterfactual scenario simulation engine.
- `backend/src/domain/analytics/resilience-scorecard.ts`: 5-dimensional scorecard and coverage engine.
- `backend/src/domain/analytics/backtesting-engine.ts`: Rolling holdout backtesting engine.
- `backend/src/domain/analytics/demo-scenarios.ts`: Phase 6 demo dataset generator.

### Persistence & Database
- `backend/src/database/migrations/005_phase6_resilience_analytics.sql`: SQL DDL schema for analytics tables.

### Services & API
- `backend/src/services/analytics/resilience-analytics-service.ts`: Analytical domain orchestrator.
- `backend/src/api/routes/resilience.ts`: Express router for `/api/v1/resilience/*`.

### Frontend
- `frontend/src/pages/ResiliencePage.tsx`: Top-level Resilience & Scenarios page.
- `frontend/src/components/resilience/EarlyWarningBanner.tsx`: Predictive early-warning banner and acknowledgment modal.
- `frontend/src/components/resilience/ForecastChartView.tsx`: Pure SVG chart with origin barrier $T$ and uncertainty polygon.
- `frontend/src/components/resilience/ScenarioSimulatorView.tsx`: Interactive scenario simulator and differential matrix.
- `frontend/src/components/resilience/ModelPerformanceView.tsx`: Rolling holdout benchmark table.
- `frontend/src/components/resilience/ResilienceOverview.tsx`: Resilience scorecard table and KPI summary cards.
- `frontend/src/components/resilience/AnalyticalProvenanceModal.tsx`: Analytical provenance lineage DAG modal.

### Documentation
- `docs/ANALYTICS.md`: Technical and mathematical guide for Phase 6.
- `prd/PHASE_6_HANDOFF.md`: This comprehensive handoff document.

### Tests
- `backend/tests/unit/time-series-engine.test.ts`
- `backend/tests/unit/forecasting-engine.test.ts`
- `backend/tests/unit/data-leakage.test.ts`
- `backend/tests/unit/early-warning-engine.test.ts`
- `backend/tests/unit/scenario-engine.test.ts`
- `backend/tests/unit/backtesting-engine.test.ts`
- `backend/tests/unit/demo-scenarios-phase6.test.ts`
- `backend/tests/integration/resilience-api.test.ts`

---

## 34. Files Modified
- `shared/src/types/index.ts`: Exported analytics types.
- `shared/src/types/events.ts`: Added Phase 6 domain events.
- `shared/src/types/api.ts`: Added Phase 6 API request/response types.
- `backend/src/database/repositories/types.ts`: Added analytics repository interfaces (`IForecastRepository`, `IScenarioRepository`, `IEarlyWarningRepository`, `IModelEvaluationRepository`).
- `backend/src/database/repositories/in-memory-repositories.ts`: Implemented in-memory analytics repositories.
- `backend/src/database/repositories/postgres-repositories.ts`: Implemented PostgreSQL analytics repositories.
- `backend/src/database/repositories/index.ts`: Wired analytics repositories.
- `backend/src/adapters/fhir/mapper.ts`: Added FHIR R4 Flag and Observation mappings.
- `backend/src/adapters/fhir/types.ts`: Added FHIR early warning and forecast publishing methods.
- `backend/src/adapters/fhir/demo-adapter.ts`: Implemented demo FHIR early warning and forecast publishing.
- `backend/src/adapters/fhir/hapi-adapter.ts`: Implemented HAPI FHIR early warning and forecast publishing.
- `backend/src/api/server.ts`: Mounted `/api/v1/resilience` routes.
- `backend/src/api/routes/demo.ts`: Added `POST /api/v1/demo/phase6/execute`.
- `frontend/src/api/client.ts`: Added resilience API client methods.
- `frontend/src/layout/Sidebar.tsx`: Added Resilience & Scenarios tab and warning counter badge.
- `frontend/src/App.tsx`: Mounted `ResiliencePage` and wired early-warning counter state.
- `docs/ARCHITECTURE.md`: Added Section 9: Phase 6 Architecture.
- `docs/DEVELOPMENT.md`: Added Section 7: Phase 6 Development.
- `README.md`: Added Phase 6 feature summary and documentation links.

---

## 35. Environment Variables
No new mandatory third-party credentials are required for Phase 6. The deterministic analytics engines run in pure TypeScript. Optional environment flags:
- `PHASE6_DEMO_AUTO_SEED` (optional, default `true`): Automatically seeds Phase 6 resilience demo data on startup when running in demo mode.
- `DATABASE_URL` (existing): PostgreSQL connection string when running in live database mode.
- `FHIR_BASE_URL` (existing): Target HAPI FHIR R4 server endpoint for synchronized FHIR resource exports.

---

## 36. Phase 7 Starting State
- **Full Phase 1–6 Foundation Available**:
  * Phase 1: Shared contracts, value objects, domain entities.
  * Phase 2: Environmental adapters (Copernicus Sentinel-2, Open-Meteo, USGS/municipal water), ingestion service, and idempotency pipeline.
  * Phase 3: Evidence Fusion Engine, multi-factor scoring, contradiction logic, and cryptographic provenance lineage.
  * Phase 4: Operational response engine, OneAquaHealth interventions catalogue, suitability scoring, and supervised human review gate.
  * Phase 5: Municipal Command Console, accessible SVG geospatial map, real-time SSE streaming, and HL7 FHIR R4 task synchronization.
  * Phase 6: Deterministic time-series engine, short-horizon forecasting with anti-data leakage, multi-signal early warnings, 5 canonical counterfactual scenarios, multi-dimensional resilience scorecards, rolling holdout backtests, and provenance DAG.
- **Repository State**:
  * 45 test files, 185 tests passing.
  * Zero build errors across `@aquasentinel/shared`, `@aquasentinel/backend`, and `@aquasentinel/frontend`.

---

## 37. What Phase 7 Should Reuse
- **`TimeSeriesEngine`**: All numerical time-series statistics, OLS regression, EWMA, and baseline deviation functions.
- **`IForecastingModel` & `ForecastingEngine`**: Extensible forecasting harness with built-in zero data leakage enforcement.
- **`ScenarioEngine`**: Scenario simulation framework and differential step matrix comparison.
- **`AnalyticalProvenance`**: Provenance recording and lineage graph tracking.
- **`ResilienceScorecard`**: 5-dimensional orthogonal resilience evaluation.
- **`EarlyWarningEngine`**: Multi-sensor corroboration and contradiction logic.
- **Frontend Components**: `ForecastChartView`, `ScenarioSimulatorView`, `ModelPerformanceView`, and `ResilienceOverview`.

---

## 38. What Phase 7 Must Not Rewrite
- **Do NOT rewrite the Evidence Fusion Engine (Phase 3)**: It remains the canonical authority for multi-source evidence synthesis.
- **Do NOT rewrite the Supervised Human Review Gate or Task State Machine (Phase 4/5)**: The operational lifecycle (`REQUESTED` $\rightarrow$ `VERIFIED`) is strictly governed.
- **Do NOT collapse the 5 resilience scorecard dimensions into a single scalar score**: Orthogonal transparency is a core requirement of the platform.
- **Do NOT violate the Zero Data Leakage Temporal Barrier**: Any predictive or evaluation model must strictly exclude observations with $t > T$.
- **Do NOT violate the Scientific Proxy Disclosure Invariant**: NDCI and optical indices must always remain clearly identified as optical proxies rather than confirmed clinical toxins or pathogens.

---

## 39. Exact Extension Points for Phase 7
1. **Multi-Variate Covariate Forecasting**:
   - Extend `IForecastingModel` in `backend/src/domain/analytics/forecast-models.ts` to consume weather covariates (air temperature, solar irradiance, precipitation) alongside water quality time-series.
2. **Coupled Hydrodynamic-Water Quality Modeling**:
   - Enhance `backend/src/domain/analytics/scenario-engine.ts` by connecting reach-to-reach advection-dispersion equations across the stream network DAG.
3. **Automated Intervention Recommendation Triggering**:
   - Wire `EarlyWarningTriggeredEvent` to automatically generate `PENDING_REVIEW` proactive recommendations in the Phase 4 Response Engine before an incident officially triggers.
4. **Export to Standard Formats**:
   - Add export utilities for water utility compliance reports (GeoJSON, WaterML 2.0, PDF executive resilience briefs).
5. **Mobile Push & Webhook Dispatch**:
   - Extend notification service to dispatch SMS / Webhook alerts to municipal utility on-call personnel when high-severity `EarlyWarningTriggeredEvent` occurs.
