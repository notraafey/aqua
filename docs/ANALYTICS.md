# AquaSentinel Phase 6: Resilience Intelligence & Scenario Simulation

## 1. Overview & Scientific Philosophy

AquaSentinel Phase 6 expands the platform from near-real-time situational awareness and operational remediation (Phases 3–5) to forward-looking predictive resilience intelligence.

### 1.1 Scientific Proxy Invariant
Remote sensing indices such as the Normalized Difference Chlorophyll Index (NDCI) are **optical proxies** for phytoplankton pigment density and trophic state. In strict accordance with environmental remote sensing standards:
- NDCI is **never** presented as definitive clinical presence of cyanotoxins, pathogens, or regulatory water safety violations.
- All analytical outputs, UI displays, and exported artifacts enforce strict provenance labeling:
  * `OBSERVED`: Raw sensor telemetry or validated remote sensing optical proxy retrievals.
  * `INFERRED`: Multi-criteria evidence assessments fused across streams.
  * `PROJECTED`: Statistically forecasted horizon values conditioned on historical observations up to origin timestamp $T$.
  * `SIMULATED`: Counterfactual hypothetical trajectories generated under explicit operator-specified assumptions.

---

## 2. Deterministic Time-Series Engine

The time-series engine (`backend/src/domain/analytics/time-series-engine.ts`) provides numerical routines implemented in pure deterministic TypeScript without black-box external dependencies.

### 2.1 Ordinary Least Squares (OLS) Linear Trend
Given $N$ time-value pairs $(t_i, y_i)$ where $t_i$ is normalized in days from the series start:
$$\bar{t} = \frac{1}{N} \sum_{i=1}^N t_i, \quad \bar{y} = \frac{1}{N} \sum_{i=1}^N y_i$$
$$\text{Slope } \beta = \frac{\sum_{i=1}^N (t_i - \bar{t})(y_i - \bar{y})}{\sum_{i=1}^N (t_i - \bar{t})^2}$$
$$\text{Intercept } \alpha = \bar{y} - \beta \bar{t}$$
$$\text{Coefficient of Determination } R^2 = \frac{\left(\sum (t_i - \bar{t})(y_i - \bar{y})\right)^2}{\sum (t_i - \bar{t})^2 \sum (y_i - \bar{y})^2}$$

Trend classification:
- `ACCELERATING`: $\beta > 0.015$ / day and $R^2 \ge 0.50$
- `INCREASING`: $\beta > 0.003$ / day
- `DECREASING`: $\beta < -0.003$ / day
- `STABLE`: $|\beta| \le 0.003$ / day

### 2.2 Exponentially Weighted Moving Average (EWMA)
For smoothing parameter $\alpha \in (0, 1]$ (default $\alpha = 0.30$):
$$\hat{s}_0 = y_0$$
$$\hat{s}_i = \alpha y_i + (1 - \alpha) \hat{s}_{i-1} \quad \text{for } i \ge 1$$

### 2.3 Rolling Statistics & Dispersion
- **Sample Mean ($\bar{y}$)** and **Sample Standard Deviation ($s$)**:
  $$s = \sqrt{\frac{1}{N-1} \sum_{i=1}^N (y_i - \bar{y})^2}$$
- **Median & Interquartile Range (IQR)**:
  Computed on sorted observations; robust to sensor telemetry outliers.
- **Baseline Deviation**:
  $$\Delta_{\text{baseline}} = \frac{y_{\text{latest}} - \mu_{\text{baseline}}}{\mu_{\text{baseline}}} \times 100\%$$
  $$Z_{\text{score}} = \frac{y_{\text{latest}} - \mu_{\text{baseline}}}{s_{\text{baseline}}}$$

---

## 3. Short-Horizon Forecasting Engine

The forecasting engine (`backend/src/domain/analytics/forecasting-engine.ts`) generates projected trajectories over horizons $h \in \{24, 48, 72\text{ hours}\}$ with zero data leakage.

### 3.1 Strict Zero Data Leakage Contract
For any forecast generated at origin timestamp $T$:
$$\mathcal{D}_{\text{train}} = \{ (t_i, y_i) \in \mathcal{D} \mid t_i \le T \}$$
Any observation with $t_i > T$ is strictly discarded prior to feature extraction, trend fitting, and parameter estimation.

### 3.2 Candidate Models
1. **`baseline-persistence` (Reference Model)**:
   $$\hat{y}_{T+h} = y_T$$
   Uncertainty expands proportional to $\sqrt{h}$ scaled by residual historical variance:
   $$\sigma(h) = s_y \sqrt{1 + \frac{h}{24}}$$
2. **`linear-trend-v1`**:
   $$\hat{y}_{T+h} = \alpha + \beta (t_T + h)$$
   Uncertainty incorporates parameter estimation variance:
   $$\text{SE}(\hat{y}_{T+h}) = \text{RMSE} \sqrt{1 + \frac{1}{N} + \frac{(t_{T+h} - \bar{t})^2}{\sum (t_i - \bar{t})^2}}$$
   $$[\hat{y}_{low}, \hat{y}_{high}] = \hat{y}_{T+h} \pm 1.96 \cdot \text{SE}(\hat{y}_{T+h})$$
3. **`ewma-damped-trend-v1`**:
   Combines EWMA level $\hat{s}_T$ with damped velocity $b_T$ (damping factor $\phi = 0.85$):
   $$\hat{y}_{T+h} = \hat{s}_T + \sum_{k=1}^h \phi^k b_T = \hat{s}_T + b_T \frac{\phi(1 - \phi^h)}{1 - \phi}$$
   Prevents unrealistic compounding linear runaway over longer forecast horizons.

---

## 4. Multi-Signal Early-Warning Engine

The early-warning engine (`backend/src/domain/analytics/early-warning-engine.ts`) provides predictive warnings before physical regulatory thresholds are breached.

### 4.1 Trigger Rules
- **Threshold Escalation**: Latest value or +24h projected value $> 0.18$ (Advisory) or $> 0.28$ (Warning).
- **Trend Velocity Escalation**: OLS trend slope $\beta > 0.02$ / day with $R^2 \ge 0.50$.
- **Baseline Anomaly**: Baseline deviation $Z_{\text{score}} \ge 2.0\sigma$ or $\Delta_{\text{baseline}} \ge 40\%$.

### 4.2 Signal Corroboration & Contradiction Matrix
Early warnings evaluate multi-sensor context to upgrade or downgrade confidence:
- **Corroborating Factors** (+confidence, +severity):
  * Elevated water temperature ($> 22^\circ\text{C}$).
  * Depressed dissolved oxygen ($< 6.0\text{ mg/L}$).
  * Corroborating upstream stream reach showing elevated optical proxy.
- **Contradicting / Confounding Factors** (-confidence, potential false positive):
  * Heavy rainfall ($> 25\text{ mm/24h}$) causing optical scattering and mineral sediment plumes rather than biogenic chlorophyll.
  * Extreme turbidity spikes without organic pigment absorption features.
  * High stream discharge / velocity flushing out quiescent water bodies.

Trigger rationale is rendered as human-readable factual bullet points explaining exact data thresholds and corroborating conditions.

---

## 5. Counterfactual Scenario Simulation Engine

The scenario simulation engine (`backend/src/domain/analytics/scenario-engine.ts`) allows operators to run what-if analyses by adjusting environmental or operational levers.

### 5.1 The 5 Canonical Scenario Types
1. **Status Quo (`STATUS_QUO`)**: Assumes continuation of baseline trend and seasonal parameters without perturbation.
2. **Accelerated Deterioration (`ACCELERATED_DETERIORATION`)**: Simulates compounding degradation (e.g. prolonged heatwave, sustained low flow, nutrient pulse).
3. **Natural Attenuation (`NATURAL_ATTENUATION`)**: Simulates biological die-off, hydraulic dilution, and seasonal cooling without artificial intervention.
4. **Meteorological Shock (`METEOROLOGICAL_SHOCK`)**: Simulates heavy storm runoff or abrupt solar irradiance transitions.
5. **Operational Intervention (`OPERATIONAL_INTERVENTION`)**: Simulates flow augmentation, algaecide dosing, aeration deployment, or intake shutdown.

### 5.2 Step Comparison Matrix & Differential Analytics
For each projection step $k \in \{1 \dots M\}$:
$$\Delta y_k = y_{k, \text{simulated}} - y_{k, \text{baseline}}$$
$$\% \text{ Change} = \frac{\Delta y_k}{y_{k, \text{baseline}}} \times 100\%$$
Explicit assumptions and boundary parameters are embedded directly into the simulation record.

---

## 6. Multi-Dimensional Resilience Scorecard & Monitoring Coverage

### 6.1 Non-Collapsing Resilience Dimensions
AquaSentinel rejects arbitrary single composite scores that mask critical operational vulnerabilities. Each reach receives explicit, independent dimension ratings:
1. **Alert Exposure**: Frequency and severity of active alarms and early warnings.
2. **Trend Velocity**: Direction and rate of change of water quality indicators.
3. **Monitoring Coverage**: Data density, spatial coverage, and temporal latency.
4. **Historical Volatility**: Dispersion and variance over a 90-day rolling baseline.
5. **Recovery Capability**: Historical rate of return to baseline following disturbance.

### 6.2 Monitoring Coverage Breakdown
- Observation frequency (measurements per week).
- Maximum and average temporal gaps between valid observations.
- Freshness rating based on timestamp of latest observation.
- Sensor status and data completeness percentage.

---

## 7. Rolling Holdout Backtesting & Verification

The backtesting engine (`backend/src/domain/analytics/backtesting-engine.ts`) executes rolling holdout validation across historical timestamps $T_1 < T_2 < \dots < T_K$:
- For each origin $T_k$, models are trained only on observations up to $T_k$.
- Projections for $T_k + 24\text{h}, T_k + 48\text{h}, T_k + 72\text{h}$ are compared against actual observed values $y(T_k + h)$.
- Evaluated metrics:
  * **Mean Absolute Error (MAE)**: $\frac{1}{M} \sum_{m=1}^M |y_m - \hat{y}_m|$
  * **Root Mean Square Error (RMSE)**: $\sqrt{\frac{1}{M} \sum_{m=1}^M (y_m - \hat{y}_m)^2}$
  * **Directional Accuracy (%)**: Fraction of steps where sign of predicted change matches sign of actual change.
  * **Skill Score vs Baseline**: Relative percentage improvement in MAE over the `baseline-persistence` benchmark.

---

## 8. Analytical Provenance & Lineage DAG

Every generated forecast and simulated scenario creates a permanent immutable provenance record (`AnalyticalProvenance`):
- `modelId` and semantic version string (e.g. `linear-trend-v1@1.0.0`).
- Model parameters (intercept, slope, damping factor, confidence intervals).
- Complete array of `inputObservationIds` used to fit the model.
- Execution environment metadata, computation duration in milliseconds, and random seed (if applicable).
- Directed Acyclic Graph (DAG) node lineage tracking upstream features and parent baseline forecasts.

---

## 9. FHIR R4 Interoperability Extensions

1. **Early Warnings**: Mapped to HL7 FHIR R4 `Flag` resources:
   * `status`: `active` or `inactive`
   * `category`: `safety`
   * `code`: `early-warning-water-quality`
   * `extension`: Detailed trigger reason, confidence, corroboration score, and stream reach reference.
2. **Projected Forecasts**: Mapped to HL7 FHIR R4 `Observation` resources:
   * `status`: `preliminary`
   * `code`: `projected-water-quality-ndci`
   * `effectiveDateTime`: Horizon projection target timestamp.
   * `valueQuantity`: Projected numerical value.
   * `referenceRange`: Low and high uncertainty interval bounds.
