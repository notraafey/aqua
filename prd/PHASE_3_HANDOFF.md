# AquaSentinel Phase 3 Handoff: Evidence Fusion Engine

> **Version:** 1.0.0  
> **Status:** COMPLETE & VERIFIED  
> **Target Audience:** Phase 4 Implementation Agent (Incident State Machine & Workflow Orchestration)  
> **Verification Status:** 107/107 Tests Passing across 24 Test Suites (100% Pass Rate)

---

## CHAPTER 1: EXECUTIVE SUMMARY & DELIVERABLES STATUS

### Section 1: Executive Summary
AquaSentinel Phase 3 (Evidence Fusion Engine) establishes the supervisory decision-support intelligence of the system. It ingests canonical, provenance-tracked observations from Phase 2 (Copernicus Sentinel-2 satellite imagery, Open-Meteo meteorological telemetry, community citizen science reports, and in-situ probes) and evaluates them against reach baselines, spatial buffers, and multi-scale temporal windows.

The engine calculates an explainable, bounded 0–100 **Evidence Confidence Score** mapped to four discrete operational confidence bands (`NORMAL`, `VERIFY`, `INVESTIGATE`, `PRIORITIZE`). It strictly eliminates non-deterministic ML hallucinations and black-box scoring, ensuring that municipal water authorities and field inspection officers receive unambiguous, reproducible decision support with full data provenance.

### Section 2: Deliverables Checklist & Verification State
| Component | Subsystem | File Location | Status |
|---|---|---|---|
| Domain Types & Contracts | `@aquasentinel/shared` | `shared/src/types/domain.ts`, `api.ts`, `events.ts` | Complete |
| Scoring Configuration | Backend Domain | `backend/src/domain/evidence/config.ts` | Complete |
| Spatial Correlator | Backend Domain | `backend/src/domain/evidence/spatial-correlator.ts` | Complete |
| Temporal Correlator | Backend Domain | `backend/src/domain/evidence/temporal-correlator.ts` | Complete |
| Baseline Deviation Service | Backend Domain | `backend/src/domain/evidence/baseline-service.ts` | Complete |
| Quality Correlator | Backend Domain | `backend/src/domain/evidence/quality-correlator.ts` | Complete |
| Corroboration Analyzer | Backend Domain | `backend/src/domain/evidence/corroboration-analyzer.ts` | Complete |
| Contradiction Detector | Backend Domain | `backend/src/domain/evidence/contradiction-detector.ts` | Complete |
| Missing Evidence Analyzer | Backend Domain | `backend/src/domain/evidence/missing-evidence-analyzer.ts` | Complete |
| Scoring Engine | Backend Domain | `backend/src/domain/evidence/scoring-engine.ts` | Complete |
| Demo Scenarios Runner | Backend Domain | `backend/src/domain/evidence/demo-scenarios.ts` | Complete |
| SQL Migration 003 | Backend Database | `backend/src/database/migrations/003_phase3_evidence_fusion.sql` | Complete |
| Dual Repositories | Backend Repositories | `backend/src/database/repositories/postgres-repositories.ts`, `in-memory-repositories.ts` | Complete |
| Evidence Fusion Service | Backend Services | `backend/src/services/evidence/evidence-fusion-service.ts` | Complete |
| REST API Routes | Backend API | `backend/src/api/routes/evidence-assessments.ts` | Complete |
| API Client & UI | Frontend Console | `frontend/src/pages/EvidenceAssessmentsPage.tsx`, `frontend/src/api/client.ts` | Complete |
| Full Test Suite | Tests (Unit + Integration) | `backend/tests/unit/`, `backend/tests/integration/` | 107/107 Passing |

### Section 3: Guardrail Compliance Verification
1. **No ML Black Boxes**: The scoring engine is 100% deterministic arithmetic. No opaque neural networks, uncalibrated embeddings, or probabilistic regressions are used.
2. **Deterministic Reproducibility**: Given identical input observations, baseline history, and stream reach geometry, the engine produces identical scores, identical breakdowns, and identical rationales (`expect(run1).toEqual(run2)`).
3. **No Uncorroborated Incident Auto-Creation**: The engine does NOT transition or create Phase 4 Incidents. It produces `EvidenceAssessment` records and emits `EvidenceUpdated` events, leaving state transition authority strictly to Phase 4.
4. **No Premature Bloom or Contamination Declarations**: All labels and UI texts strictly display `"Evidence Confidence Score: X/100 (Operational Decision-Support Score)"` and guardrail notices such as `"Operational decision support only — not a regulatory compliance determination"`.
5. **No Probabilities or False Precision**: Confidence scores are reported as integer points on a 0–100 scale, never as disease risk percentages or bloom probabilities.

### Section 4: Dual Mode Support (Demo vs. Live)
- **Demo Mode (`APP_MODE=demo`)**: Uses deterministic in-memory repositories and pre-seeded pilot reaches (Almyros Stream Reach Alpha, Kladissos River Reach Beta). The 5 canonical demo scenarios execute without external network calls.
- **Live Mode (`APP_MODE=live`)**: Queries PostgreSQL with PostGIS / JSONB storage, pulls live Sentinel-2 L2A via CDSE OAuth, Open-Meteo hourly weather, and live FHIR R4 server mirrors.

### Section 5: Handshake with Phase 2
Phase 3 inherits Phase 2 without modifications to Phase 2 contracts:
- Subscribes directly to `ObservationReceived` emitted by `ObservationIngestionService`.
- Reuses `StreamReach` and `Observation` domain models intact.
- Reuses provenance tracing (`createProvenanceRecord`) for all generated `EvidenceAssessment` and `EvidenceItem` records.

---

## CHAPTER 2: MATHEMATICAL MODEL & SCORING SPECIFICATION

### Section 6: Bounded 0–100 Evidence Confidence Formula
$$\text{RawScore} = C_{\text{anomaly}} + C_{\text{baseline}} + C_{\text{corroboration}} + C_{\text{spatial}} + C_{\text{temporal}} - P_{\text{quality}} - P_{\text{contradiction}}$$

$$\text{EvidenceScore} = \max(0, \min(100, \text{round}(\text{RawScore})))$$

### Section 7: Anomaly Contribution ($C_{\text{anomaly}}$)
Calculated based on primary trigger signal strength:
$$C_{\text{anomaly}} = \text{round}((\text{isAnomaly} ? 18 : 10) \times \text{anomalyStrength})$$
Where:
- $\text{anomalyStrength} = \min\left(1.0, \frac{\Delta_{\text{baseline}}}{\text{extremeThreshold} - \text{typicalThreshold}}\right)$ (defaults to 0.5 if baseline unavailable).

### Section 8: Baseline Deviation Contribution ($C_{\text{baseline}}$)
- If baseline status is `AVAILABLE`:
  $$C_{\text{baseline}} = \text{round}\left(\min\left(10, \max\left(0, \Delta_{\text{baseline}} \times 30\right)\right)\right)$$
- If baseline status is `UNAVAILABLE` or `INSUFFICIENT`:
  $$C_{\text{baseline}} = 0$$

### Section 9: Corroboration Groups & Diminishing Returns ($C_{\text{corroboration}}$)
Observations are partitioned into 5 independent corroboration groups:
1. `REMOTE_SENSING`: Satellite Sentinel-2 MSI observations (NDCI, Chlorophyll, Turbidity). Group Cap: 35.
2. `CITIZEN`: Community reports (Water color, odor, foam, dead fish). Group Cap: 30.
3. `WEATHER`: Meteorological stations (Air temperature, precipitation, wind). Group Cap: 15.
4. `HISTORICAL_BASELINE`: Long-term reach empirical quantiles. Group Cap: 20.
5. `IN_SITU`: Fixed telemetry probes, multiparameter sondes. Group Cap: 35.

**Diminishing Returns**: Within each group, observations are sorted by quality and scored with diminishing multipliers:
- 1st observation: $\times 1.0$ (100%)
- 2nd observation: $\times 0.5$ (50%)
- 3rd+ observations: $\times 0.1$ (10%)
The sum of effective points within each group is hard-capped at the group cap.

### Section 10: Multi-Source Corroboration Bonuses
To reward genuine independent corroboration, bonuses are added when multiple distinct groups are active:
- 1 group active: $+0$ pts
- 2 independent groups active: $+15$ pts bonus
- 3+ independent groups active: $+25$ pts bonus

### Section 11: Spatial and Temporal Relevance Weights
- **Spatial Relevance ($C_{\text{spatial}}$)**:
  - $\text{HIGH}$ ($< 100\text{m}$ from reach centerline): $+5$ pts
  - $\text{MEDIUM}$ ($100\text{m} - 500\text{m}$): $+3$ pts
  - $\text{LOW}$ ($500\text{m} - 1000\text{m}$): $+1$ pt
- **Temporal Relevance ($C_{\text{temporal}}$)**:
  - $\text{HIGH}$ ($< 3\text{h}$ delta): $+5$ pts
  - $\text{MEDIUM}$ ($3\text{h} - 12\text{h}$ delta): $+3$ pts
  - $\text{LOW}$ ($12\text{h} - 24\text{h}$ delta): $+1$ pt

### Section 12: Penalties Formulation ($P_{\text{quality}}$ and $P_{\text{contradiction}}$)
- **Quality Penalties ($P_{\text{quality}}$)**:
  - Narrow stream mixed pixel: $-10$ pts
  - High cloud cover uncertainty ($> 15\%$ cloud): $-15$ pts
  - Low sensor quality score ($< 0.5$): $-10$ pts
- **Contradiction Penalties ($P_{\text{contradiction}}$)**:
  - Conflicting normal reading (e.g. concurrent NDCI $< 0.10$): $-25$ pts
  - Healthy dissolved oxygen ($\ge 7.5\text{ mg/L}$): $-15$ pts
  - Storm runoff counter-explanation (rain $\ge 15\text{ mm}$ + turbidity $> 10$): $-15$ pts
  - Uncorroborated narrow-stream satellite anomaly (width $< 15\text{m}$, no ground data): $-10$ pts

---

## CHAPTER 3: DOMAIN ARCHITECTURE & COMPONENT BREAKDOWN

### Section 13: `backend/src/domain/evidence/config.ts`
Contains `defaultEvidenceConfig` with all configurable thresholds, group caps, diminishing return multipliers, and operational band cutoffs. Allows tests and custom environments to override weights without altering code.

### Section 14: `backend/src/domain/evidence/spatial-correlator.ts`
Performs spatial point-to-geometry distance calculation against stream reach centerlines (GeoJSON LineString or Point). Identifies reach buffer containment, evaluates water coverage constraints, and detects narrow-stream mixed-pixel hazards.

### Section 15: `backend/src/domain/evidence/temporal-correlator.ts`
Applies source-specific multi-scale temporal windows:
- Satellite: 48-hour window
- Citizen reports: 24-hour window
- Weather: 12-hour window
- In-situ sensors: 6-hour window

### Section 16: `backend/src/domain/evidence/baseline-service.ts`
Computes expected baseline distributions, empirical medians, absolute deviations, and z-scores from historical observations. Categorizes baseline status as:
- `AVAILABLE`: $\ge 3$ historical observations exist.
- `INSUFFICIENT`: $1 - 2$ historical observations exist.
- `UNAVAILABLE`: $0$ historical observations exist.

### Section 17: `backend/src/domain/evidence/quality-correlator.ts`
Evaluates observational reliability vs sensor quality. Penalizes degraded flags such as optical cloud contamination, narrow reach boundary mixing, and uncalibrated telemetry.

### Section 18: `backend/src/domain/evidence/corroboration-analyzer.ts`
Partitions observations into independent corroboration groups, enforces group caps and diminishing returns, and awards multi-source bonuses (+15 for 2 groups, +25 for 3+ groups).

### Section 19: `backend/src/domain/evidence/contradiction-detector.ts`
Actively identifies conditions that undermine the contamination hypothesis:
- Concurrent normal readings.
- Natural storm runoff explanations for elevated turbidity.
- Uncorroborated satellite anomaly over narrow streams.

### Section 20: `backend/src/domain/evidence/missing-evidence-analyzer.ts`
Distinguishes between "Evidence Contradicts" and "Evidence Absent". Identifies critical missing data streams and generates recommended data-gathering actions.

### Section 21: `backend/src/domain/evidence/scoring-engine.ts`
The central coordinator that assembles all pipeline components, computes raw and bounded scores, assigns operational confidence bands, populates `scoreBreakdown`, and builds the 4-part human-readable rationale.

---

## CHAPTER 4: DATA PERSISTENCE & MIGRATION

### Section 22: Migration `003_phase3_evidence_fusion.sql`
- Creates table `evidence_assessments`:
  - `id UUID PRIMARY KEY`
  - `stream_reach_id UUID NOT NULL REFERENCES stream_reaches(id)`
  - `candidate_id VARCHAR(255)`
  - `score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100)`
  - `confidence_band VARCHAR(32) NOT NULL`
  - `scoring_version VARCHAR(32) NOT NULL`
  - `baseline_status VARCHAR(32) NOT NULL`
  - `baseline_deviation JSONB`
  - `score_breakdown JSONB NOT NULL`
  - `independent_source_groups JSONB NOT NULL`
  - `supporting_evidence_ids JSONB NOT NULL`
  - `contradicting_evidence_ids JSONB NOT NULL`
  - `missing_evidence JSONB NOT NULL`
  - `rationale JSONB NOT NULL`
  - `created_at TIMESTAMPTZ NOT NULL`
  - `updated_at TIMESTAMPTZ NOT NULL`
- Updates table `evidence_items`:
  - Adds `assessment_id UUID REFERENCES evidence_assessments(id) ON DELETE CASCADE`
  - Adds `indicator`, `value`, `unit`, `corroboration_group`, `relevance`, `spatial_match`, `temporal_match`, `quality_score`, `quality_flags`, `contribution`, `score_delta`, `reason`, `rule`.
- Creates high-performance indexes:
  - `idx_evidence_assessments_reach_created`
  - `idx_evidence_assessments_band`
  - `idx_evidence_items_assessment`
  - `idx_evidence_items_obs`

### Section 23: Entity Data Model
Maps 1:1 with TypeScript interfaces in `@aquasentinel/shared`:
- `EvidenceAssessment`
- `EvidenceItem`
- `ScoreBreakdown`
- `AssessmentRationale`

### Section 24: Repository Interface (`IEvidenceAssessmentRepository`)
```typescript
export interface IEvidenceAssessmentRepository {
  save(assessment: EvidenceAssessment): Promise<EvidenceAssessment>;
  findById(id: string): Promise<EvidenceAssessment | null>;
  findLatestByStreamReach(streamReachId: string): Promise<EvidenceAssessment | null>;
  findRecentByStreamReach(streamReachId: string, limit?: number): Promise<EvidenceAssessment[]>;
  findAll(filter?: EvidenceAssessmentFilter): Promise<{ data: EvidenceAssessment[]; total: number }>;
}
```

### Section 25: PostgreSQL Implementation (`PostgresEvidenceAssessmentRepository`)
Implements full JSONB serialization/deserialization, parameterized queries, and transactional persistence.

### Section 26: In-Memory Implementation (`InMemoryEvidenceAssessmentRepository`)
Implements identical semantics for zero-dependency test execution and demo mode operation.

---

## CHAPTER 5: SERVICE LAYER, EVENT BUS & PIPELINE INTEGRATION

### Section 27: `EvidenceFusionService` Architecture
Located at `backend/src/services/evidence/evidence-fusion-service.ts`. Instantiated as a singleton in the backend container.

### Section 28: Event Bus Subscription (`ObservationReceived`)
Upon system startup, `evidenceFusionService.initialize()` subscribes to `ObservationReceived` events on `IEventBus`.

### Section 29: Reactive Assessment Trigger
When an `ObservationReceived` event arrives:
1. Resolves the associated `StreamReach`.
2. Gathers recent candidate observations within the temporal window (48h).
3. Evaluates evidence fusion via `scoringEngine.evaluate()`.

### Section 30: Idempotency & Deduplication
The service checks the latest assessment for the stream reach:
- Compares score, confidence band, and observation signatures (`observationId:indicator:value`).
- Redundant identical writes are skipped, preventing database bloat.

### Section 31: Persistence & Event Bus Emission (`EvidenceUpdated`)
If a new or changed assessment is computed:
1. Persists the record via `IEvidenceAssessmentRepository.save()`.
2. Emits `EvidenceUpdatedEvent` on `IEventBus` with payload:
```typescript
{
  assessment: EvidenceAssessment;
  streamReachId: string;
  triggerObservationId?: string;
}
```

### Section 32: Phase 4 Integration Hook
Phase 4 will subscribe directly to `EvidenceUpdatedEvent` to drive incident state machine transitions.

---

## CHAPTER 6: REST API & ENDPOINT CONTRACTS

### Section 33: Route Mounting & Base Path
Mounted at `/api/v1/evidence-assessments` in `backend/src/api/server.ts`.

### Section 34: `GET /api/v1/evidence-assessments`
- Query parameters: `streamReachId`, `confidenceBand`, `baselineStatus`, `limit`, `offset`.
- Returns: `EvidenceAssessmentListResponse` with pagination metadata.

### Section 35: `GET /api/v1/evidence-assessments/:id`
- Returns: `EvidenceAssessmentDetailResponse` with complete `ScoreBreakdown`, `AssessmentRationale`, supporting and contradicting evidence items.

### Section 36: `GET /api/v1/evidence-assessments/reach/:streamReachId/latest`
- Returns latest assessment for the specified stream reach.

### Section 37: `POST /api/v1/evidence-assessments/reassess`
- Body: `ReassessEvidenceRequest` (`{ streamReachId, force }`).
- Executes on-demand re-evaluation of evidence for a reach.

### Section 38: `GET /api/v1/evidence-assessments/scenarios`
- Returns the 5 canonical demo scenarios (`SCENARIO_A` through `SCENARIO_E`) with ground truth expectations and execution results.

---

## CHAPTER 7: FRONTEND COMMAND CONSOLE INTEGRATION

### Section 39: `frontend/src/pages/EvidenceAssessmentsPage.tsx`
A full-featured command console view for municipal operators:
- Metric cards showing active assessments, confidence band counts, and average score.
- Filter toolbar (by confidence band, reach, or search query).
- Score meter with dynamic visual color indicators.
- 4-Part Rationale Card Grid (`What Changed`, `What Corroborates`, `What Weakens`, `What is Missing`).
- Detailed breakdown tables for supporting and contradicting evidence items.

### Section 40: Design Token Colors & Badges
- `PRIORITIZE` (80–100): Crimson / Rose theme (`bg-rose-500/20 text-rose-300 border-rose-500/30`).
- `INVESTIGATE` (60–79): Amber theme (`bg-amber-500/20 text-amber-300 border-amber-500/30`).
- `VERIFY` (40–59): Cyan theme (`bg-cyan-500/20 text-cyan-300 border-cyan-500/30`).
- `NORMAL` (0–39): Emerald theme (`bg-emerald-500/20 text-emerald-300 border-emerald-500/30`).

### Section 41: Interactive Demo Scenario Player
Operators can click to run Scenarios A through E instantly in the UI to inspect simulated evidence flows.

### Section 42: Visual Evidence Score Meter
Interactive visual component showing exact score position within operational band thresholds (0, 40, 60, 80, 100).

### Section 43: API Client Methods (`frontend/src/api/client.ts`)
- `getEvidenceAssessments(filter)`
- `getEvidenceAssessment(id)`
- `reassessEvidence(request)`
- `getDemoScenarios()`

### Section 44: App Shell Navigation
Added `Evidence` navigation tab with flask icon in `frontend/src/layout/Sidebar.tsx` and routed in `frontend/src/App.tsx`.

---

## CHAPTER 8: DEMO SCENARIOS & GROUND TRUTH SPECIFICATIONS

### Section 45: Scenario A — Isolated Satellite Anomaly
- **Setup**: Sentinel-2 NDCI anomaly (0.42) on Almyros reach. No citizen report, no weather, no in-situ.
- **Expected Band**: `VERIFY` (Score: ~52/100, must be 40–59).
- **Rationale**: Single satellite anomaly flagged for ground verification. Must NOT escalate to PRIORITIZE.

### Section 46: Scenario B — Satellite + Citizen Corroboration
- **Setup**: Scenario A + Citizen science report with photo confirming discolored water film.
- **Expected Band**: `INVESTIGATE` (Score: ~74/100, must be 60–79).
- **Rationale**: Independent multi-source bonus applied. Recommended for targeted inspection.

### Section 47: Scenario C — Satellite + Citizen + Weather Context
- **Setup**: Scenario B + Weather station telemetry confirming sustained air temp (+29.5°C) and no precipitation.
- **Expected Band**: `PRIORITIZE` (Score: ~88/100, must be 80–100).
- **Rationale**: Three independent corroboration groups active (+25 bonus). Rapid operational dispatch required.

### Section 48: Scenario D — Contradictory Evidence
- **Setup**: Low-quality satellite anomaly (cloud cover 0.22, mixed pixel flag) with concurrent normal NDCI observation (0.08).
- **Expected Band**: `NORMAL` (Score: ~0–20/100).
- **Rationale**: Contradiction penalty (-25 conflicting normal, -10 mixed pixel) surfaced in `whatWeakens`.

### Section 49: Scenario E — Missing Baseline
- **Setup**: Reach with no historical baseline records.
- **Expected Band**: Reports `baselineStatus: "UNAVAILABLE"` and surfaces baseline gap in `whatIsMissing`.

### Section 50: `demoScenariosRunner.runAllScenarios()`
Executes all 5 scenarios deterministically in batch, returning structured scenario results.

### Section 51: Seed Data Integration
The demo scenarios operate over pilot reaches and observations pre-seeded in demo mode.

---

## CHAPTER 9: TEST SUITE VERIFICATION & COVERAGE MATRIX

### Section 52: Full Suite Results
```text
 Test Files  24 passed (24)
      Tests  107 passed (107)
   Start at  00:32:20
   Duration  2.55s
```

### Section 53: Phase 3 Test Suites
1. `backend/tests/unit/scoring-engine.test.ts` (3 tests)
2. `backend/tests/unit/corroboration-analyzer.test.ts` (4 tests)
3. `backend/tests/unit/contradiction-detector.test.ts` (3 tests)
4. `backend/tests/unit/spatial-correlator.test.ts` (5 tests)
5. `backend/tests/unit/temporal-correlator.test.ts` (4 tests)
6. `backend/tests/unit/baseline-service.test.ts` (4 tests)
7. `backend/tests/unit/missing-evidence.test.ts` (4 tests)
8. `backend/tests/unit/false-positives.test.ts` (5 tests)
9. `backend/tests/unit/reproducibility.test.ts` (1 test)
10. `backend/tests/integration/demo-scenarios.test.ts` (6 tests)
11. `backend/tests/integration/evidence-api.test.ts` (5 tests)
12. `backend/tests/integration/evidence-fusion.test.ts` (2 tests)

### Section 54: Phase 1 & 2 Regressions Check
All 58 tests from Phase 1 and Phase 2 remain 100% passing. No breaking changes were introduced.

### Section 55: Boundary & False-Positive Robustness
Tested narrow-stream mixed-pixel hazards, cloudy optical gates, distant citizen reports, unrelated timestamps, and observation volume flooding (15 weather records capped at 15 pts).

### Section 56: Deterministic Reproducibility
3 sequential runs of the scoring engine with identical inputs produce bit-for-bit identical scores, score breakdowns, and rationales.

---

## CHAPTER 10: CONTRACT & GUIDANCE FOR PHASE 4 AGENT

### Section 57: What Phase 4 Inherits
Phase 4 inherits a fully functional, fully tested Evidence Fusion Engine that continuously emits `EvidenceUpdated` events whenever environmental observations are processed.

### Section 58: How to Listen for Evidence in Phase 4
Subscribe to `EvidenceUpdated` events via the singleton `IEventBus`:
```typescript
import { getEventBus } from '../events/index.js';
import { EvidenceUpdatedEvent } from '@aquasentinel/shared';

const eventBus = getEventBus();
eventBus.subscribe<EvidenceUpdatedEvent>('EvidenceUpdated', async (event) => {
  const { assessment, streamReachId, triggerObservationId } = event.payload;
  // Phase 4 Incident State Machine logic here
});
```

### Section 59: How to Query Evidence Assessments in Phase 4
```typescript
import { getRepositories } from '../database/repositories/index.js';

const repos = getRepositories();
const assessment = await repos.evidenceAssessments.findLatestByStreamReach(streamReachId);
if (assessment && assessment.confidenceBand === 'PRIORITIZE') {
  // Candidate for Incident escalation
}
```

### Section 60: What Phase 4 Must NOT Touch or Re-implement
1. **Do NOT re-score observations**: The Evidence Confidence Score (0–100) and confidence band are already calculated.
2. **Do NOT modify `@aquasentinel/shared` evidence contracts**: `EvidenceAssessment`, `EvidenceItem`, `ScoreBreakdown`, `AssessmentRationale` are locked.
3. **Do NOT introduce black-box ML**: Maintain the deterministic, explainable principles established in Phase 3.

### Section 61: Recommended Next Steps for Phase 4
1. Define Incident State Machine transitions (`DETECTED` -> `CORROBORATING` -> `ASSESSED` -> `RECOMMENDED` -> `APPROVED` -> `RESOLVED`).
2. Map `EvidenceConfidenceBand` to transition rules:
   - `PRIORITIZE` or `INVESTIGATE` -> Escalate to Incident or advance state.
   - `VERIFY` -> Schedule field verification Task.
   - `NORMAL` -> Maintain monitoring, auto-close or dismiss unconfirmed incidents.
3. Implement human-in-the-loop approval workflow for operational dispatch.
4. Synchronize incident state changes to FHIR R4 Task and Flag resources.
