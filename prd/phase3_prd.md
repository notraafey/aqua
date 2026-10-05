PHASE 3 PRD — EVIDENCE FUSION ENGINE

Project: AquaSentinel
Phase: 3 of 9
Phase Name: Evidence Fusion Engine
Depends On: Phase 2 — Environmental Data Layer
Primary Objective: Transform normalized, provenance-preserving environmental observations into an explainable, spatially and temporally correlated assessment of whether the available evidence meaningfully supports treating a situation as an environmental incident.

1. PHASE OBJECTIVE

Phase 3 is where AquaSentinel begins doing its core intelligence work.

Phase 1 created the infrastructure.

Phase 2 created the environmental data layer.

Phase 3 must now answer:

“What do these observations mean when considered together?”

The system will receive observations from:

Sentinel-2;
weather;
citizen science;
historical/baseline data;
potentially additional sources in future phases.

These observations must not remain isolated records.

Phase 3 will construct an Evidence Assessment by determining:

whether observations are spatially relevant to one another;
whether they are temporally relevant;
whether they represent meaningful deviations from baseline;
how trustworthy each observation is;
whether independent sources corroborate one another;
whether evidence contradicts the suspected incident;
what important evidence is missing;
how strongly the total evidence supports escalation.

The output is not a medical diagnosis, probability, or scientific confirmation.

It is an operational decision-support assessment.

2. MANDATORY DOCUMENT GATE

Before implementation begins, the Phase 3 agent MUST verify that all three documents exist and are accessible:

MAIN_PRD
PHASE_3_PRD
PRD/PHASE_2_HANDOFF.md

The Phase 2 handoff is mandatory.

The agent MUST read:

Main PRD;
Phase 3 PRD;
PRD/PHASE_2_HANDOFF.md;

completely before implementing anything.

If PRD/PHASE_2_HANDOFF.md is missing, inaccessible, corrupted, or clearly incomplete, the agent MUST STOP.

It must report:

BLOCKED — PHASE 2 HANDOFF DOCUMENT MISSING

It must not:

reconstruct Phase 2;
assume what adapters look like;
implement against hypothetical APIs;
silently proceed.

The actual Phase 2 implementation documented in the handoff and verified against the repository is the starting point.

3. STATE OF THE SYSTEM WHEN ENTERING PHASE 3

The Phase 2 handoff currently reports that the system has:

Environmental adapters
Copernicus Sentinel-2 adapter;
Open-Meteo weather adapter;
citizen-science adapter;
live/demo factories.
Canonical observation pipeline
External Source
↓
Adapter
↓
Validation
↓
Normalization
↓
Quality Assessment
↓
Provenance
↓
Spatial Association
↓
Deduplication
↓
Persistence
↓
ObservationReceived
↓
FHIR Mirror
Existing quality information

Phase 2 provides quality metadata including:

physical parameter validation;
cloud-cover assessment;
temporal validity;
source credibility;
spatial uncertainty;
narrow-stream mixed-pixel flags.
Existing geospatial infrastructure

The Phase 2 implementation reports:

Point;
LineString;
Polygon;
Haversine-based distance;
configurable stream buffer;
narrow-stream quality penalty.
Existing observation data

Observations can be queried by:

source;
indicator;
stream reach;
quality;
date range.
Existing events

ObservationReceived is available for downstream processing.

Existing persistence

Observations, provenance and stream associations are persisted.

Existing demo mode

Deterministic environmental fixtures exist.

Important instruction

The Phase 3 agent MUST inspect the actual repository and Phase 2 handoff rather than assuming the above is complete exactly as described.

The handoff is the starting point; the code is the implementation reality.

4. PHASE 3 SUCCESS DEFINITION

Phase 3 is complete when AquaSentinel can take a set of environmental observations and produce a structured assessment such as:

Incident Candidate
        ↓
Relevant Evidence
        ↓
Spatial Correlation
        ↓
Temporal Correlation
        ↓
Baseline Deviation
        ↓
Source Quality
        ↓
Independent Corroboration
        ↓
Contradictory Evidence
        ↓
Missing Evidence
        ↓
Evidence Confidence Score
        ↓
Confidence Band
        ↓
Explainable Assessment

The system must be able to explain:

Why did the evidence score increase?

and:

What evidence would cause it to decrease or remain uncertain?

5. CORE PRINCIPLE: CORROBORATION, NOT AGGREGATION

Phase 3 must not simply add numbers together.

Three observations from the same underlying source should not automatically count as three independent confirmations.

For example:

Satellite observation
Satellite observation
Satellite observation

must not automatically provide the same corroboration benefit as:

Satellite
+
Citizen
+
Weather/context

The system must distinguish:

Evidence volume

How much evidence exists.

from:

Evidence independence

How many meaningfully independent sources support the same interpretation.

This distinction is central to AquaSentinel.

6. EVIDENCE ITEM CONSTRUCTION

Each observation considered relevant to an assessment must be transformed into an EvidenceItem.

An Evidence Item should capture at least:

id
incident/candidate association
observationId
source
indicator
timestamp
spatialMatch
temporalMatch
quality
relevance
contribution
provenance

Where useful, add:

baselineDeviation
corroborationGroup
contradiction
qualityFlags
reason

The exact implementation must remain compatible with the Phase 1 domain model and Phase 2 implementation.

7. SPATIAL CORRELATION

Evidence must be geographically relevant.

Phase 2 established basic stream-reach association.

Phase 3 must go further by determining whether multiple observations refer to the same environmental situation.

The system should consider:

same stream reach;
neighboring reaches;
distance between observations;
distance from reach geometry;
satellite footprint;
observation geometry;
spatial uncertainty.
8. SPATIAL CORRELATION WINDOWS

The system must use configurable spatial thresholds.

Do not hardcode a universal scientific truth such as:

“500 metres always means the same incident.”

Instead, configure parameters such as:

MAX_EVIDENCE_DISTANCE
DEFAULT_CORRELATION_RADIUS
SATELLITE_FOOTPRINT_TOLERANCE

The defaults must be documented.

The system must preserve the ability to tune them later.

9. SATELLITE SPATIAL GATING

Satellite observations require special treatment.

Sentinel-2 has significantly coarser spatial resolution than many urban streams.

Therefore, Phase 3 must use Phase 2's spatial quality information.

If an observation carries a flag such as:

narrow_stream_mixed_pixel

the evidence engine must not treat it as equivalent to a clean, spatially reliable observation.

The exact penalty should be configurable and documented.

10. TEMPORAL CORRELATION

Evidence must also be temporally relevant.

The system must determine whether observations occur within an appropriate temporal window.

For example:

Satellite anomaly
      ↓
Citizen observation
      ↓
Weather context

may be considered corroborating only if the observations are temporally related.

The temporal window must be configurable.

Do not encode a single arbitrary window as scientific truth.

11. MULTI-SCALE TEMPORAL CONTEXT

Different data sources have different temporal characteristics.

Examples:

satellite: discrete acquisition;
citizen observation: event-based;
weather: hourly time series;
baseline: historical time series.

The evidence engine must therefore distinguish:

Event timestamp

When the observation occurred.

Acquisition timestamp

When the source acquired the data.

Context window

The period used to find supporting contextual observations.

Do not prematurely average away temporal information.

12. BASELINE DEVIATION

The evidence engine must support determining whether an observation is unusual relative to an available baseline.

For example:

Current NDCI
      ↓
Historical NDCI distribution/baseline
      ↓
Deviation

The baseline system must support:

historical values;
expected range;
deviation;
baseline period.

The exact statistical methodology may initially be deterministic.

Do not introduce sophisticated machine learning merely because it is possible.

13. BASELINE REQUIREMENTS

A baseline comparison must distinguish between:

Baseline available

A meaningful historical comparison can be made.

Baseline insufficient

Not enough historical information exists.

Baseline unavailable

No baseline exists.

Missing baseline data must not be interpreted as normal conditions.

The assessment should explicitly state:

Baseline evidence unavailable

where applicable.

14. INITIAL BASELINE METHOD

The Phase 3 implementation should begin with a transparent statistical method.

A suitable initial approach is:

historical median;
historical percentile range;
deviation from baseline;
robust standardized deviation where enough data exists.

The exact method should be selected by the agent and documented.

A simple deterministic model is preferable to an opaque ML model.

15. SOURCE QUALITY

Phase 2 already supplies source-quality information.

Phase 3 must use it as an input.

However:

Source quality ≠ incident confidence.

For example:

A highly reliable satellite measurement can still be spatially inappropriate for a narrow stream.

Similarly:

A citizen observation can be valuable corroborating evidence despite having lower source reliability than an instrument.

The engine must therefore consider:

Source Reliability
+
Observation Quality
+
Spatial Relevance
+
Temporal Relevance

rather than simply assigning a fixed source score.

16. INDEPENDENT CORROBORATION

The evidence engine must explicitly identify independent corroboration.

At minimum, distinguish evidence groups such as:

REMOTE_SENSING
CITIZEN
WEATHER
HISTORICAL_BASELINE

Multiple observations from the same source should have diminishing or capped corroboration value.

The agent must design a defensible mechanism.

The mechanism must be:

deterministic;
explainable;
configurable.
17. CONTRADICTORY EVIDENCE

The system must actively look for evidence that weakens the incident hypothesis.

Examples:

satellite anomaly but insufficient valid water coverage;
citizen report spatially far away;
observation outside the relevant temporal window;
normal historical baseline;
strong rainfall context that provides an alternative explanation;
poor-quality observation.

Contradictory evidence must not simply disappear.

It must be surfaced.

18. MISSING EVIDENCE

The engine must identify evidence that would materially improve confidence but is unavailable.

Examples:

No citizen corroboration
No recent weather context
Insufficient satellite coverage
No historical baseline
No field verification

The system should distinguish:

Evidence absent

from:

Evidence contradicts the hypothesis.

These are fundamentally different.

19. EVIDENCE CONFIDENCE SCORE

The output should be an Evidence Confidence Score on a transparent scale.

Recommended range:

0–100

This is an operational scoring mechanism.

It is NOT:

a probability;
a calibrated posterior;
a disease-risk percentage;
a laboratory confidence level.

The UI and API must label it accordingly.

20. INITIAL SCORING MODEL

The initial scoring system should use a deterministic weighted model.

Conceptually:

Evidence Score =
    anomaly strength
  + baseline deviation
  + independent corroboration
  + spatial relevance
  + temporal relevance
  + contextual support
  - quality penalties
  - contradiction penalties
  - missing-evidence limitations

The exact weights must be configurable.

The agent must document the rationale for each weight.

Do not present arbitrary weights as scientifically validated.

They are prototype decision-support parameters.

21. SCORE NORMALIZATION

Ensure the final score remains:

0 ≤ score ≤ 100

Avoid score inflation caused by many observations.

For example, 15 weather records from the same hourly series must not overwhelm:

one satellite observation;
one citizen observation.

The system should cap or aggregate evidence appropriately.

22. SOURCE GROUP CAPS

The scoring architecture should include source-group caps or diminishing returns.

Conceptually:

Satellite evidence
      ↓
Satellite contribution capped

Citizen evidence
      ↓
Citizen contribution capped

Weather evidence
      ↓
Context contribution capped

The exact implementation is an engineering decision, but it must prevent one source from dominating simply because it generates many observations.

23. EVIDENCE CONFIDENCE BANDS

Use the Main PRD's initial operational bands:

0–39   NORMAL
40–59  VERIFY
60–79  INVESTIGATE
80–100 PRIORITIZE

These are product thresholds, not scientifically validated probability thresholds.

They must be configurable.

The engine must return both:

score

and:

confidenceBand
24. IMPORTANT: DO NOT CREATE INCIDENTS AUTOMATICALLY YET

Phase 3's primary responsibility is evidence assessment.

Do not implement the complete Phase 4 incident state machine here.

The evidence engine may produce an assessment/candidate.

Phase 4 will own:

incident lifecycle;
incident creation;
state transitions;
escalation/de-escalation.

Keep responsibilities clean.

25. EVENT-DRIVEN ASSESSMENT

Phase 2 emits:

ObservationReceived

Phase 3 should subscribe to this event.

Conceptually:

ObservationReceived
        ↓
Find Relevant Observations
        ↓
Build Evidence Set
        ↓
Assess Evidence
        ↓
Persist Evidence Assessment
        ↓
Emit EvidenceUpdated

The event-processing design must be idempotent.

Repeated events must not produce duplicate assessments.

26. ASSESSMENT IDENTIFICATION

An evidence assessment needs a deterministic identity.

It should be associated with a logical:

stream reach;
spatial region;
incident candidate/event context;
relevant time window.

The agent must design the identity carefully.

The same observation arriving twice must not create multiple equivalent assessments.

27. EVIDENCE ASSESSMENT DATA MODEL

The assessment should include:

id
subject/incidentCandidate
score
confidenceBand
timestamp
supportingEvidence[]
contradictingEvidence[]
missingEvidence[]
rationale

Also preserve the component contributions where practical:

anomalyContribution
baselineContribution
corroborationContribution
spatialContribution
temporalContribution
contextContribution
qualityPenalty
contradictionPenalty

This is important for explainability.

28. EXPLAINABILITY

Every assessment must produce a machine-readable explanation.

For example:

Evidence Confidence: 73

Supporting:
- Satellite NDCI deviates from historical baseline.
- Citizen observation occurred within spatial correlation window.
- Both observations are temporally aligned.

Contradicting:
- Satellite water-pixel coverage is moderate.

Missing:
- No field verification.

The wording can be generated by deterministic templates.

Do not introduce an LLM merely to explain a deterministic calculation.

29. RATIONALE REQUIREMENTS

The rationale must answer:

What changed?

Example:

NDCI is above the established local baseline.

What corroborates it?

Example:

A citizen observation occurred within the configured spatial and temporal correlation window.

What weakens it?

Example:

Satellite spatial quality is reduced because the monitored reach is narrow.

What is missing?

Example:

No field verification is currently available.

30. EVIDENCE LINEAGE

Every contribution to the final score must be traceable to an underlying observation.

The system must be able to answer:

“Why did this observation contribute +12?”

or:

“Why did this evidence receive a penalty?”

Therefore store:

evidenceItem
→ contribution
→ reason
→ rule

Do not produce unexplained aggregate numbers.

31. QUALITY PENALTIES

Quality penalties must be explicit.

For example:

high_cloud_cover_uncertainty
narrow_stream_mixed_pixel
invalid_spatial_coverage
low_source_quality

should become structured assessment factors.

The exact numerical penalty must be configurable and documented.

32. CONTRADICTION MODEL

The engine must support explicit contradiction records.

For example:

type: CONTRADICTING
observationId: ...
reason: "Observation does not fall within temporal correlation window"

or:

reason: "Satellite observation has insufficient valid-water coverage"

Contradiction should reduce confidence only when the evidence genuinely bears on the hypothesis.

Do not treat irrelevant observations as contradictions.

33. WEATHER CONTEXT

Weather should initially be treated primarily as context, not direct proof of the suspected hazard.

Examples:

recent precipitation;
unusual temperature;
persistent conditions.

The system may use these to modify contextual support/interpretation.

It must not claim:

“Rainfall proves contamination.”

Instead:

“Recent rainfall provides contextual information relevant to interpreting the observed signal.”

34. CITIZEN EVIDENCE

Citizen observations should receive appropriate quality weighting.

The engine should consider:

spatial match;
temporal match;
observation completeness;
source credibility;
media presence where available;
quality flags.

A citizen observation should not automatically be classified as:

confirmed.

It is corroborating evidence.

35. SATELLITE EVIDENCE

Satellite evidence should consider:

indicator value;
baseline deviation;
cloud quality;
water coverage;
spatial suitability;
acquisition timestamp;
stream geometry.

A satellite anomaly should never be sufficient by itself to claim a confirmed hazard.

36. CORRELATION ENGINE

Implement a reusable correlation service.

Conceptually:

Observation
    ↓
Spatial Candidate Search
    ↓
Temporal Candidate Search
    ↓
Quality Filtering
    ↓
Related Evidence

The correlation engine should be independently testable.

Do not embed all correlation logic directly inside the event handler.

37. BASELINE SERVICE

Create a dedicated baseline service or module.

Conceptually:

BaselineService

It should support:

retrieving historical observations;
calculating baseline;
calculating deviation;
identifying insufficient history.

It must be independent from the evidence scoring service.

38. EVIDENCE ENGINE ARCHITECTURE

Recommended structure:

ObservationReceived
        ↓
Evidence Correlation Service
        ↓
Baseline Service
        ↓
Quality/Source Assessment
        ↓
Corroboration Analyzer
        ↓
Contradiction Analyzer
        ↓
Evidence Scoring Engine
        ↓
Evidence Assessment
        ↓
Persistence
        ↓
EvidenceUpdated

Each component should be testable independently.

39. CONFIGURATION

Evidence parameters must be configurable.

Examples:

EVIDENCE_SCORE_WEIGHTS
SPATIAL_CORRELATION_RADIUS
TEMPORAL_CORRELATION_WINDOW
BASELINE_MIN_OBSERVATIONS
SATELLITE_QUALITY_PENALTY
SOURCE_GROUP_CAP
CONFIDENCE_BAND_THRESHOLDS

Do not hardcode these throughout the codebase.

40. CONFIGURATION VERSIONING

An evidence assessment should record which scoring configuration was used.

For example:

scoringVersion: "v1"

This is important because future phases may change weights.

A historical assessment should remain reproducible.

41. REPRODUCIBILITY

Given the same:

observations;
baseline;
configuration;

the evidence engine should produce the same result.

This is a key requirement.

Avoid nondeterministic scoring.

42. NO BLACK-BOX ML

Do not introduce machine learning into Phase 3 unless there is an exceptional, clearly justified requirement.

The initial evidence engine should be:

deterministic;
transparent;
auditable;
explainable.

Future advanced intelligence can be considered in Phase 9.

43. API

Expose evidence assessments through the AquaSentinel API.

At minimum:

GET /api/v1/evidence-assessments
GET /api/v1/evidence-assessments/:id
POST /api/v1/evidence-assessments/reassess

The exact naming may be adapted to the existing API architecture.

Support useful filters such as:

stream reach;
confidence band;
time;
score range.

Do not create an unnecessarily complex query language.

44. OBSERVATION → ASSESSMENT FLOW

The API should allow the system to demonstrate:

Observation A
Observation B
Observation C
        ↓
Correlation
        ↓
Evidence Set
        ↓
Assessment

The frontend should eventually be able to retrieve the assessment and display its explanation.

45. FRONTEND VERIFICATION

Phase 3 should make a minimal evidence-assessment view available.

It does not need to be the final Phase 6 command console.

It should allow developers to see:

evidence score;
confidence band;
supporting evidence;
contradicting evidence;
missing evidence;
score components;
rationale.

This exists primarily to validate the intelligence engine.

46. DEMO SCENARIOS

Create deterministic scenarios.

Scenario A — Isolated satellite anomaly

Input:

Satellite anomaly
No corroboration

Expected:

VERIFY

or equivalent low-confidence assessment.

It must not automatically become a high-priority incident.

Scenario B — Satellite + citizen corroboration

Input:

Satellite anomaly
+
spatially/temporally aligned citizen observation

Expected:

Evidence score increases meaningfully.

The exact score must depend on configured weights.

Scenario C — Satellite + citizen + contextual weather

Input:

Satellite anomaly
+
Citizen observation
+
Relevant weather context

Expected:

Higher evidence confidence than Scenario B where the weather context is genuinely supportive.

Scenario D — Contradictory evidence

Input:

Satellite anomaly
+
poor spatial quality
+
contradictory contextual evidence

Expected:

Score reduced and contradiction explicitly surfaced.

Scenario E — Missing baseline

Input:

Satellite anomaly
+
no historical baseline

Expected:

The assessment explicitly states:

Baseline unavailable.

It must not assume the anomaly is unusually large simply because no baseline exists.

47. TESTING REQUIREMENTS

Phase 3 must have extensive automated testing.

Unit tests

Test independently:

spatial correlation;
temporal correlation;
baseline calculation;
source quality;
corroboration;
contradiction detection;
missing evidence;
score calculation;
score normalization;
confidence bands;
explanation generation.
48. PROPERTY/BOUNDARY TESTING

Test:

score = 0
score = 39
score = 40
score = 59
score = 60
score = 79
score = 80
score = 100

Ensure confidence-band boundaries behave deterministically.

Also test:

negative contributions;
excessive contributions;
duplicate observations;
many observations from one source;
zero evidence;
missing evidence.
49. INTEGRATION TESTING

Test:

ObservationReceived
        ↓
Correlation
        ↓
Assessment
        ↓
Persistence
        ↓
EvidenceUpdated

Verify:

event handling;
idempotency;
persistence;
assessment retrieval.
50. FALSE-POSITIVE TESTING

This is one of the most important Phase 3 test categories.

Test that:

Satellite-only anomaly

does not automatically produce extreme confidence.

Low-quality satellite anomaly

is appropriately penalized.

Spatially distant citizen report

does not corroborate the satellite observation.

Temporally unrelated citizen report

does not corroborate it.

Duplicate observations

do not artificially increase confidence.

Large weather time series

does not overwhelm other evidence.

51. CORROBORATION TESTING

Explicitly test:

Satellite only

vs:

Satellite + citizen

vs:

Satellite + citizen + weather

and verify that the score changes for the correct reasons.

Do not merely assert that the score should be higher.

Inspect the component contributions.

52. CONTRADICTION TESTING

Test cases where:

one source supports;
another weakens;
quality is poor;
temporal alignment fails;
spatial alignment fails.

The final assessment must show both sides.

53. REPRODUCIBILITY TEST

Given the same fixture dataset and same scoring configuration:

Run 1 → Score X
Run 2 → Score X
Run 3 → Score X

The results must be identical.

54. PERFORMANCE

Phase 3 does not need production-scale optimization.

However:

avoid N×N comparisons across every observation;
use database filtering where appropriate;
filter spatially and temporally before detailed scoring;
avoid loading unnecessary historical data;
use indexes established in Phase 2;
keep scoring deterministic and reasonably fast.
55. SECURITY

Do not introduce new security risks.

Validate:

observation identifiers;
assessment identifiers;
query parameters;
reassessment inputs.

Do not allow users to arbitrarily inject scoring configuration through public APIs.

Configuration remains controlled by the application/operator.

56. SCIENTIFIC GUARDRAILS

The evidence engine must never output:

“Confirmed cyanobacterial bloom”

unless actual confirmation data exists and the product scope explicitly supports that conclusion.

Prefer:

High-confidence suspected environmental anomaly — field verification required.

Similarly, never output:

“89% probability of contamination.”

Use:

Evidence Confidence Score: 89/100

and clearly identify the score as a prototype decision-support measure.

57. NO CLINICAL INTERPRETATION

The engine must not:

diagnose individuals;
estimate individual disease probability;
recommend treatment;
claim an observation caused illness.

Human-health implications, where eventually surfaced, must remain within the environmental/public-health decision-support boundary defined in the Main PRD.

58. DOCUMENTATION

Update:

docs/ARCHITECTURE.md

with the Phase 3 Evidence Fusion architecture.

Document:

correlation;
baseline;
scoring;
corroboration;
contradiction;
quality;
confidence bands;
configuration;
reproducibility.

Also document the mathematical/logic model sufficiently for another engineer to reproduce it.

59. ACCEPTANCE CRITERIA

Phase 3 is complete only when:

Correlation
 Spatial correlation implemented.
 Temporal correlation implemented.
 Configurable windows exist.
 Satellite spatial-quality constraints are respected.
Baseline
 Baseline retrieval implemented.
 Deviation calculation implemented.
 Insufficient baseline handled.
 Missing baseline explicitly surfaced.
Evidence
 Evidence Items generated.
 Supporting evidence identified.
 Contradicting evidence identified.
 Missing evidence identified.
 Provenance retained.
Corroboration
 Independent source groups recognized.
 Duplicate/same-source evidence cannot artificially inflate confidence.
 Corroboration is explainable.
Scoring
 Deterministic 0–100 score.
 Configurable weights.
 Configurable thresholds.
 Score components persisted or reproducible.
 Scoring version recorded.
Events
 ObservationReceived can trigger assessment.
 Assessment generation is idempotent.
 EvidenceUpdated or equivalent event emitted.
API
 Assessments retrievable.
 Assessment detail available.
 Reassessment available.
 Useful filters available.
Frontend
 Evidence assessment can be inspected.
 Score is clearly labelled as a decision-support score.
 Supporting/contradicting/missing evidence visible.
Testing
 Unit tests pass.
 Integration tests pass.
 False-positive tests pass.
 Corroboration tests pass.
 Contradiction tests pass.
 Reproducibility test passes.
Documentation
 Architecture updated.
 Scoring methodology documented.
 Configuration documented.
 Scientific limitations documented.
 Phase 3 handoff created.
60. MANDATORY PHASE 3 HANDOFF

At the end of Phase 3, the agent MUST create:

PRD/PHASE_3_HANDOFF.md

This document will be handed directly to the Phase 4 agent.

It is a hard requirement.

The handoff must describe what was actually built, not what this PRD intended to be built.

It must contain:

Phase 3 completion status.
Actual architecture.
Evidence engine components.
Correlation implementation.
Baseline methodology.
Scoring formula.
Actual weights.
Confidence thresholds.
Configuration parameters.
Corroboration logic.
Contradiction logic.
Missing-evidence logic.
Evidence data model.
API endpoints.
Events.
Database changes.
Frontend verification interface.
Demo scenarios.
Tests and results.
Known bugs.
Known limitations.
Deviations from Phase 3 PRD.
Deviations from Main PRD.
What Phase 4 inherits.
What Phase 4 must preserve.
What Phase 4 must not assume.
Phase 4 readiness checklist.

The file MUST be located at:

PRD/PHASE_3_HANDOFF.md
61. PHASE 4 READINESS CHECKLIST

The handoff must end with:

PHASE 4 READINESS

[ ] Evidence correlation works
[ ] Temporal correlation works
[ ] Baseline comparison works
[ ] Source quality incorporated
[ ] Independent corroboration works
[ ] Contradiction detection works
[ ] Missing evidence works
[ ] Evidence score deterministic
[ ] Confidence bands work
[ ] Scoring version recorded
[ ] Evidence rationale generated
[ ] Evidence provenance retained
[ ] ObservationReceived triggers assessment
[ ] Assessment persistence works
[ ] Assessment retrieval works
[ ] Reassessment works
[ ] False-positive tests pass
[ ] Corroboration tests pass
[ ] Contradiction tests pass
[ ] Reproducibility verified
[ ] Documentation complete
[ ] Known limitations documented
[ ] PHASE_3_HANDOFF.md created
62. DEFINITION OF DONE

Phase 3 is complete when:

AquaSentinel can take heterogeneous environmental observations, determine which observations are meaningfully related, compare relevant observations against available baselines, assess source quality, identify independent corroboration and contradiction, explicitly identify missing evidence, calculate a deterministic and explainable Evidence Confidence Score, persist the resulting assessment, and expose its reasoning to downstream systems.

At that point, AquaSentinel has the intelligence layer required for Phase 4 to build a proper incident lifecycle around it.