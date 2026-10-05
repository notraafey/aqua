# AquaSentinel — Phase 6 PRD
## Resilience Intelligence & Scenario Simulation

Version: 1.0
Phase: 6 of 9
Depends on: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5


============================================================
1. PHASE OBJECTIVE
============================================================

Phase 6 adds a resilience-intelligence layer to AquaSentinel.

Phases 1–5 established:

Phase 1:
Foundation, persistence, FHIR, events and application architecture.

Phase 2:
Environmental data ingestion and normalization.

Phase 3:
Evidence fusion, corroboration, contradiction detection,
confidence and uncertainty.

Phase 4:
Incident classification, recommendations, human approval,
operational tasks and FHIR workflow.

Phase 5:
Municipal Command Console and real-time operational UX.

Phase 6 must answer the next operational question:

"What happens if current conditions continue or change?"

The system should provide:

1. Environmental trend analysis.
2. Short-horizon risk-state forecasting.
3. Scenario simulation.
4. Resilience planning support.
5. Early-warning indicators.
6. Uncertainty-aware projections.

This phase must NOT replace the existing incident/recommendation
system.

It extends it.


============================================================
2. CORE PRINCIPLE
============================================================

AquaSentinel must distinguish between:

OBSERVED

What has actually been measured.

INFERRED

What the evidence currently suggests.

PROJECTED

What may happen if observed conditions continue.

SIMULATED

What could happen under a hypothetical scenario.

These must never be presented as equivalent.

Every analytical output must identify which category it belongs to.


============================================================
3. PROBLEM BEING SOLVED
============================================================

The existing system can answer:

"What is happening?"

and:

"What should we do?"

Phase 6 adds:

"How might this situation evolve?"

and:

"What happens under different plausible conditions?"

This is useful for municipal resilience planning because an operator
may need to decide whether to:

- increase monitoring
- dispatch field personnel
- prioritize a reach
- prepare an intervention
- continue observation
- escalate an existing incident
- allocate limited field resources


============================================================
4. ANALYTICAL SCOPE
============================================================

Phase 6 should initially model environmental state rather than
directly predicting human disease.

Potential state variables include:

- NDCI
- NDWI / mNDWI where available
- water-quality indicators
- precipitation
- temperature
- observation frequency
- citizen reports
- baseline deviation
- evidence confidence
- incident state
- recent incident history

The architecture must allow additional indicators later.


============================================================
5. TIME-SERIES ENGINE
============================================================

Create a reusable time-series analysis layer.

For each stream reach and indicator:

- retrieve historical observations
- order observations chronologically
- normalize timestamps
- identify missing periods
- identify outliers
- calculate rolling statistics
- calculate baseline deviation
- calculate trend
- calculate recent acceleration/deceleration

At minimum support:

- rolling mean
- rolling median
- rolling standard deviation
- delta from baseline
- percentage change
- trend slope
- observation density


============================================================
6. DATA QUALITY
============================================================

Forecasting must not blindly consume every observation.

Each analytical series should consider:

- source quality
- temporal coverage
- missing observations
- duplicate observations
- contradictory observations
- cloud/imagery quality where available
- citizen observation quality
- provenance

If data quality is insufficient:

DO NOT produce a confident forecast.

Instead return:

"Insufficient evidence for projection."

This is a hard requirement.


============================================================
7. BASELINE MODEL
============================================================

Use the existing Phase 3 baseline machinery where available.

Do not create a second incompatible baseline system.

The analytical layer should be able to answer:

Current value:
0.59

Historical baseline:
0.31

Deviation:
+90.3%

Recent trend:
Increasing

Confidence:
Moderate

The exact calculations must be backend-owned.


============================================================
8. TREND ANALYSIS
============================================================

Implement trend classification.

Possible states:

STABLE
INCREASING
DECREASING
ACCELERATING
DECELERATING
VOLATILE
INSUFFICIENT_DATA

Trend classification must be based on actual observations.

Avoid arbitrary frontend thresholds.

All thresholds must be configurable backend parameters.


============================================================
9. SHORT-HORIZON PROJECTION
============================================================

Implement a short-horizon environmental projection.

The initial system should support configurable horizons such as:

24 hours
48 hours
72 hours
7 days

Do not claim that these projections are universally accurate.

The model must return:

- projected value/range
- forecast horizon
- confidence/uncertainty
- training/history window
- input observations
- model/method identifier

Example:

NDCI

Current:
0.59

72-hour projection:
0.63–0.68

Projection:
INCREASING

Confidence:
MODERATE

Important:

The system must never represent a forecast range as a guaranteed future value.


============================================================
10. MODEL STRATEGY
============================================================

Use the simplest scientifically defensible model that works.

Possible initial methods:

- persistence baseline
- moving average
- linear trend
- exponentially weighted moving average
- simple regression
- optional ARIMA/ETS if justified

Do NOT introduce a complicated neural network merely for complexity.

The system must establish a baseline model first.

If a more complex model is added, compare it against the baseline.


============================================================
11. MODEL EVALUATION
============================================================

Forecasting models must be evaluated against historical holdout data
where enough data exists.

Metrics may include:

- MAE
- RMSE
- MAPE where appropriate
- directional accuracy

The system must record:

model
dataset period
forecast horizon
metric
evaluation timestamp

Do not present an unvalidated model as production-grade forecasting.


============================================================
12. FORECAST CONFIDENCE
============================================================

Forecast output must include uncertainty.

At minimum:

HIGH
MEDIUM
LOW
INSUFFICIENT

The confidence level must depend on actual model/data characteristics.

Relevant factors:

- historical coverage
- observation density
- variance
- model error
- recency
- contradictory evidence


============================================================
13. EARLY-WARNING ENGINE
============================================================

Build an early-warning layer.

It should detect combinations such as:

- sustained baseline deviation
- accelerating environmental indicator
- corroborating observations
- recent weather context
- repeated citizen observations

The output should be:

EARLY WARNING

rather than:

CONFIRMED EVENT

Example:

EARLY WARNING

Almyros Stream

NDCI has remained above historical baseline for 3 consecutive
observations and is trending upward.

Confidence:
Moderate

Recommended response:
Increase monitoring / field verification.


============================================================
14. MULTI-SIGNAL CONFIRMATION
============================================================

Do not trigger high-severity warnings from one weak signal.

The system should distinguish:

Single signal

from:

Corroborated signal

Example:

Satellite anomaly only:
LOWER CONFIDENCE

Satellite anomaly + citizen observation:
HIGHER CONFIDENCE

Satellite anomaly + citizen observation + supporting weather/context:
FURTHER CONFIDENCE INCREASE

Contradictory evidence should reduce confidence.


============================================================
15. SCENARIO ENGINE
============================================================

Implement a scenario simulation engine.

A scenario modifies selected environmental assumptions and evaluates
their projected effect on the system state.

Examples:

Scenario A:
Current conditions continue.

Scenario B:
Environmental indicator continues increasing.

Scenario C:
Heavy precipitation occurs.

Scenario D:
Monitoring intensity increases.

Scenario E:
Field intervention is completed.

The initial implementation does not need to simulate complex
hydrological physics.

It must instead provide transparent, parameterized scenario analysis.


============================================================
16. SCENARIO MODEL
============================================================

Every scenario must contain:

- scenario ID
- name
- description
- baseline state
- changed parameters
- assumptions
- projection horizon
- outputs
- uncertainty
- created timestamp

Example:

SCENARIO:
Continued deterioration

ASSUMPTION:
NDCI continues increasing at recent trend.

HORIZON:
72 hours

PROJECTED STATE:
Higher environmental anomaly

CONFIDENCE:
Moderate

This is a projection, not a factual prediction.


============================================================
17. SCENARIO COMPARISON
============================================================

Allow users to compare:

BASELINE

against:

SCENARIO A
SCENARIO B
SCENARIO C

Display:

- projected indicator
- relative change
- confidence
- assumptions
- expected operational implications

Do not rank scenarios as universally "better" or "worse."

The system should present consequences and leave the operational
decision to the user.


============================================================
18. INTERVENTION SCENARIOS
============================================================

Where Phase 4 provides an approved operational action, Phase 6 may
simulate an intervention scenario.

Example:

Current state

vs.

Current state + increased field monitoring

vs.

Current state + approved mitigation action

The system must distinguish:

MODELLED EFFECT

from:

OBSERVED EFFECT.

An intervention should never be shown as successful until real
verification evidence exists.


============================================================
19. RESILIENCE SCORECARD
============================================================

Create a structured resilience summary for each monitored reach.

Potential dimensions:

- environmental stability
- evidence confidence
- monitoring coverage
- recent anomaly
- trend
- response readiness
- unresolved incidents

Do not create a single arbitrary "health score."

Instead display component dimensions.

Example:

ENVIRONMENTAL STABILITY
Moderate

EVIDENCE COVERAGE
High

MONITORING COVERAGE
Low

ACTIVE INCIDENT
1

RESPONSE READINESS
High


============================================================
20. MONITORING COVERAGE
============================================================

Calculate whether a reach has sufficient recent observations.

Display:

Observation frequency
Last observation
Days since observation
Source diversity

Example:

MONITORING COVERAGE

Satellite:
High

Citizen:
Low

Weather:
High

In-situ:
None

Overall:
Moderate


============================================================
21. ANALYTICAL EXPLANATIONS
============================================================

Every analytical output must explain itself.

Example:

WHY IS THIS TREND INCREASING?

- NDCI increased in 4 of the last 5 observations.
- Current value is 76% above baseline.
- No comparable citizen observation was recorded.
- Recent rainfall introduces uncertainty.

The explanation must be generated from structured facts.

Do not allow an LLM to invent scientific reasoning.


============================================================
22. ANALYTICAL PROVENANCE
============================================================

Every forecast and scenario must link to:

- input observations
- baseline
- model
- parameters
- model version
- calculation timestamp

Provide:

VIEW ANALYTICAL PROVENANCE


============================================================
23. MODEL VERSIONING
============================================================

Every analytical result must store:

- model ID
- model version
- configuration
- parameters
- training window
- forecast horizon
- creation timestamp

This enables reproducibility.


============================================================
24. REPRODUCIBILITY
============================================================

Given the same:

- input observations
- model version
- configuration

the analytical engine should produce the same result.

Avoid uncontrolled randomness.

If randomness is necessary, record the seed.


============================================================
25. COMMAND CONSOLE INTEGRATION
============================================================

Extend the Phase 5 Command Console.

Add:

RESILIENCE

to the primary navigation.

Recommended views:

- Resilience Overview
- Reach Analysis
- Forecasts
- Scenarios
- Model Performance


============================================================
26. RESILIENCE OVERVIEW
============================================================

Show monitored reaches with:

- current state
- trend
- active incidents
- monitoring coverage
- forecast
- confidence

Allow filtering by:

- incident status
- trend
- confidence
- reach
- indicator


============================================================
27. REACH ANALYTICS
============================================================

Selecting a reach opens:

Historical chart
+
Baseline
+
Current observations
+
Trend
+
Forecast
+
Evidence confidence
+
Incident history
+
Monitoring coverage

The operator should be able to understand the evolution of the
environmental state over time.


============================================================
28. FORECAST VISUALIZATION
============================================================

Forecast charts must clearly distinguish:

OBSERVED DATA

from:

PROJECTED DATA.

Display uncertainty bands.

Never draw a forecast line in a way that makes it appear to be
observed historical data.


============================================================
29. SCENARIO VISUALIZATION
============================================================

Scenario charts should show:

BASELINE
SCENARIO

and relevant uncertainty.

Clearly label assumptions.

Example:

72-HOUR SCENARIO PROJECTION

Baseline:
Current trend continues

Scenario:
Indicator increases at 1.5× recent rate

Assumption:
Hypothetical

NOT AN OBSERVED MEASUREMENT


============================================================
30. EARLY-WARNING PANEL
============================================================

Create an operational early-warning panel.

Show:

- warning
- affected reach
- trigger conditions
- confidence
- evidence
- recommended monitoring response
- timestamp

Warnings should link to the relevant incident or evidence.


============================================================
31. RELATIONSHIP TO PHASE 4
============================================================

Phase 6 must NOT become a second recommendation engine.

Phase 6 may produce:

ANALYTICAL SIGNAL

which Phase 4 can consume.

Example:

Phase 6:
"Environmental anomaly projected to persist for 72 hours."

Phase 4:
"Given this evidence and existing operational context,
field verification is recommended."

Keep these responsibilities separate.


============================================================
32. RELATIONSHIP TO FHIR
============================================================

Analytical outputs should be representable in the interoperability
architecture where appropriate.

At minimum provide a structured internal representation.

If the existing FHIR boundary supports the representation:

- forecast
- analytical observation
- warning
- scenario result

may be mapped through the existing FHIR adapter.

Do not create ad-hoc FHIR JSON inside the frontend.


============================================================
33. EVENT INTEGRATION
============================================================

The analytical engine should react to relevant backend events.

Potential triggers:

ObservationCreated
EvidenceAssessmentUpdated
IncidentUpdated
TaskCompleted
NewWeatherObservation

When sufficient new information exists:

recalculate analytical state.

Avoid recalculating every model for every unrelated event.


============================================================
34. COMPUTATION STRATEGY
============================================================

Separate:

ANALYTICAL COMPUTATION

from:

API

and:

UI.

Recommended architecture:

Observation Store
↓
Feature Builder
↓
Analysis Engine
↓
Forecast Engine
↓
Scenario Engine
↓
Persistence
↓
API
↓
Real-Time Events
↓
Command Console


============================================================
35. CACHING
============================================================

Analytical results should be cached/persisted.

Do not recompute expensive forecasts every time the UI loads.

Cache keys should incorporate:

reach
indicator
forecast horizon
model version
latest relevant observation timestamp


============================================================
36. DEMO MODE
============================================================

DEMO mode must contain deterministic historical observations.

The demo dataset should demonstrate:

- stable period
- anomaly
- increasing trend
- corroborating observation
- contradictory evidence
- forecast
- scenario comparison

The golden path must be reproducible.


============================================================
37. LIVE MODE
============================================================

LIVE mode should consume the actual Phase 2/3 data pipeline.

No direct external API calls from the analytics UI.

External data remains backend-owned.


============================================================
38. SCIENTIFIC LIMITATIONS
============================================================

The UI and documentation must explicitly communicate:

Remote sensing indicators are proxies.

An environmental index does not independently establish:

- a confirmed ecological event
- a confirmed pathogen
- a human health event
- causality
- clinical diagnosis

Forecasts are probabilistic/modelled outputs.

Scenarios are hypothetical.

This is mandatory.


============================================================
39. MODEL FAILURE STATES
============================================================

If insufficient historical data exists:

"INSUFFICIENT DATA FOR FORECAST"

If model quality is poor:

"LOW FORECAST RELIABILITY"

If observations are contradictory:

"CONFLICTING EVIDENCE"

If observations are too sparse:

"INSUFFICIENT MONITORING COVERAGE"

Never silently return a misleading forecast.


============================================================
40. MODEL PERFORMANCE
============================================================

Create a model-performance view.

Display:

- model
- version
- horizon
- evaluation period
- MAE
- RMSE
- directional accuracy where available
- sample size

This is primarily a technical/validation view.

Do not imply that one model is universally superior.


============================================================
41. TESTING
============================================================

Write unit tests for:

- time-series ordering
- missing observations
- rolling statistics
- baseline deviation
- trend detection
- forecast generation
- uncertainty calculation
- scenario generation
- scenario reproducibility
- model versioning
- insufficient-data handling
- contradictory evidence
- monitoring coverage

Integration tests:

Observations
→
Feature generation
→
Forecast
→
Persistence
→
API

and:

Observation
→
Evidence
→
Incident
→
Analytics
→
Command Console


============================================================
42. BACKTESTING
============================================================

Where the demo dataset supports it, perform historical backtesting.

The engine should simulate:

"What would the system have predicted at time T using only
information available at time T?"

Do not allow future observations to leak into historical forecasts.


============================================================
43. DATA LEAKAGE PROTECTION
============================================================

This is mandatory.

Forecast training/features must never use observations occurring
after the forecast origin timestamp.

Tests must explicitly verify this.


============================================================
44. DOCUMENTATION
============================================================

Update:

README.md
DEVELOPMENT.md
docs/ARCHITECTURE.md

Create/update:

docs/ANALYTICS.md

Document:

- analytical architecture
- models
- assumptions
- features
- forecast horizons
- uncertainty
- scenario engine
- validation
- limitations
- data leakage protection


============================================================
45. WALKTHROUGH
============================================================

Update:

walkthrough.md

The Phase 6 walkthrough must demonstrate:

1. Open resilience overview.
2. Select a stream reach.
3. Inspect historical observations.
4. Inspect baseline.
5. Inspect trend.
6. Inspect evidence confidence.
7. View forecast.
8. Inspect uncertainty.
9. Open scenario simulator.
10. Run baseline scenario.
11. Run hypothetical scenario.
12. Compare outputs.
13. Inspect analytical provenance.
14. Return to incident.
15. Show how analytical information supports operational review.


============================================================
46. DEFINITION OF DONE
============================================================

[ ] Time-series engine implemented.

[ ] Baseline integration implemented.

[ ] Trend analysis implemented.

[ ] Data-quality gating implemented.

[ ] Short-horizon forecasting implemented.

[ ] Forecast uncertainty implemented.

[ ] Forecast evaluation implemented.

[ ] Early-warning engine implemented.

[ ] Multi-signal corroboration supported.

[ ] Scenario engine implemented.

[ ] Scenario comparison implemented.

[ ] Intervention scenario support implemented where appropriate.

[ ] Monitoring coverage implemented.

[ ] Resilience scorecard implemented.

[ ] Analytical explanations implemented.

[ ] Analytical provenance implemented.

[ ] Model versioning implemented.

[ ] Reproducibility implemented.

[ ] Command Console integration implemented.

[ ] Forecast visualization implemented.

[ ] Scenario visualization implemented.

[ ] Early-warning UI implemented.

[ ] FHIR boundary integration evaluated/implemented where appropriate.

[ ] DEMO mode works without external APIs.

[ ] LIVE mode works through backend APIs.

[ ] Model failure states implemented.

[ ] Backtesting implemented where data permits.

[ ] Data leakage tests implemented.

[ ] Unit tests implemented.

[ ] Integration tests implemented.

[ ] Phase 1–5 regression tests pass.

[ ] npm run build passes.

[ ] Documentation updated.

[ ] walkthrough updated.

[ ] PHASE_6_HANDOFF.md created.


============================================================
47. MANDATORY PHASE 6 HANDOFF
============================================================

Create:

prd/PHASE_6_HANDOFF.md

The document must contain:

1. Phase objective
2. Implemented functionality
3. Analytical architecture
4. Feature engineering
5. Baseline implementation
6. Trend engine
7. Forecasting models
8. Forecast validation
9. Uncertainty methodology
10. Early-warning engine
11. Scenario engine
12. Scenario assumptions
13. Scenario outputs
14. Monitoring coverage
15. Resilience scorecard
16. Model versioning
17. Analytical provenance
18. Backtesting
19. Data leakage protections
20. API endpoints
21. Event architecture
22. Frontend architecture
23. Resilience UI
24. Forecast UI
25. Scenario UI
26. Demo data
27. Live mode
28. Tests
29. Test results
30. Build results
31. Known limitations
32. Technical debt
33. Files created
34. Files modified
35. Environment variables
36. Phase 7 starting state
37. What Phase 7 should reuse
38. What Phase 7 must not rewrite
39. Exact extension points for Phase 7


============================================================
48. HANDOFF VALIDATION
============================================================

Before declaring completion:

test -f prd/PHASE_6_HANDOFF.md

Verify that it exists and is non-empty.

If the handoff does not exist:

"HANDOFF DOCUMENT NOT CREATED — PHASE 6 INCOMPLETE"

Do not claim completion.


============================================================
49. REGRESSION REQUIREMENT
============================================================

All prior functionality must remain operational.

Run:

npm test -- --run

npm run build

Do not weaken previous tests.

Do not delete previous functionality merely to simplify Phase 6.


============================================================
50. PHASE 6 SUCCESS CRITERION
============================================================

A municipal operator should be able to answer:

WHAT HAS BEEN HAPPENING?

WHAT IS THE CURRENT TREND?

HOW CONFIDENT ARE WE?

WHAT COULD HAPPEN NEXT?

WHAT IF CONDITIONS CONTINUE?

WHAT IF CONDITIONS CHANGE?

HOW MUCH MONITORING DO WE HAVE?

WHAT EVIDENCE SUPPORTS THE PROJECTION?

WHAT ARE THE LIMITATIONS?

HOW SHOULD THIS INFORM OPERATIONAL PLANNING?


The complete chain should now be:

OBSERVATION
→
EVIDENCE
→
ASSESSMENT
→
INCIDENT
→
RECOMMENDATION
→
ACTION
→
ANALYTICS
→
FORECAST
→
SCENARIO
→
PLANNING


============================================================
51. FINAL OUTPUT
============================================================

Provide a completion report containing:

- implemented functionality
- analytical architecture
- models used
- forecast methodology
- scenario methodology
- validation results
- model performance
- UI changes
- API changes
- event changes
- test count
- build result
- known limitations
- golden-path result
- confirmation of PHASE_6_HANDOFF.md
- exact instructions for Phase 7

Actually implement the PRD.

Do not merely describe how it could be implemented.