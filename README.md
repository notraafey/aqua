# AquaSentinel

**Autonomous Environmental Water Contamination Detection & Supervised Response System**

AquaSentinel is an explainable decision-support platform that transforms fragmented water-quality signals (Sentinel-2 satellite imagery, citizen reports, weather context, and in-situ sensor data) into verified municipal response actions.

It implements a supervised closed-loop control system:
```text
Detect → Corroborate → Assess → Recommend → Approve → Act → Verify → Resolve
```

---

## System Architecture

AquaSentinel is organized as a modular TypeScript monorepo with clear separation between domain logic, persistence, external adapters, FHIR interoperability, and user-facing presentation:

```text
aqua/
├── backend/            # Express + TypeScript API server & orchestration engine
├── frontend/           # React 18 + Vite + Tailwind CSS Command Console
├── shared/             # Canonical domain models, API contracts, event types, FHIR DTOs
├── infrastructure/     # Docker Compose, PostgreSQL init, container configs
├── tests/              # Automated unit and integration test suites
├── docs/               # Architecture docs, Developer guide, ADRs (ADR-001 to ADR-005)
├── data/               # Baseline seed data (Almyros Stream, Greece) and test fixtures
├── scripts/            # Development, testing, migration, and seeding automation scripts
├── PRD/                # Product Requirements Documents & Phase 1 Handoff
├── docker-compose.yml  # Root orchestration for Postgres, HAPI FHIR, Backend, Frontend
└── .env.example        # Environment variable configuration template
```

---

## Key Phase 1 Foundations Implemented

1. **Monorepo & Shared Types**: Zero-drift TypeScript contracts between backend and frontend.
2. **Relational Database & Migrations**: PostgreSQL schema with PostGIS capability and versioned SQL migration runner (`schema_migrations`). Dual repository pattern with in-memory fallback for rapid testing and demo reliability.
3. **Canonical Standards**: Universal UUIDv4 identifiers, strict ISO-8601 UTC timestamps, and WGS84 GeoJSON geometry representation.
4. **First-Class Provenance**: Every observation and evidence item preserves source identity, acquisition timestamp, processing pipeline, and quality score.
5. **External Adapter Boundaries**: Decoupled interfaces for FHIR R4 (`IFhirAdapter`), Sentinel-2 (`ISatelliteAdapter`), Weather (`IWeatherAdapter`), and Citizen reports (`ICitizenAdapter`).
6. **Dual Operating Modes**:
   - `DEMO`: Uses deterministic local mock adapters and seeded stream reaches.
   - `LIVE`: Connects to live PostgreSQL, remote HAPI FHIR servers, and external APIs.
7. **Event Architecture**: Decoupled internal event bus (`IEventBus`) and FHIR subscription resthook webhook listener (`/api/v1/webhooks/fhir/subscription`).
8. **Frontend Command Console**: React App Shell with real-time system telemetry beacon, LIVE/DEMO badge, monitored reach explorer, and incident queue skeleton.
9. **Automated Testing Suite**: 100% passing unit and integration tests covering domain models, config validation, event bus, FHIR mappings, API endpoints, and error handling.

---

## Getting Started

### Prerequisites
- Node.js 20+ or 22+
- npm 10+
- (Optional) Docker & Docker Compose

### 1. Installation
```bash
git clone <repo-url>
cd aqua
npm install
npm run build --workspace=shared
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Default mode is `APP_MODE=demo`.

### 3. Run Locally
```bash
# Start backend and frontend concurrently
npm run dev:all
# or
./scripts/dev.sh
```
- Backend runs on `http://localhost:3001`
- Frontend runs on `http://localhost:5173`
- External Public Health Consumer runs on `http://localhost:3002`
- Backend health check: `http://localhost:3001/api/health`

### 4. Canonical Demonstration Mode
The frontend automatically loads the docked **Incident Lifecycle Controller** bar across all pages. You can control the end-to-end incident lifecycle via the UI or using the CLI:
```bash
# Check current demo stage status
npm run demo:canonical -- --status

# Advance one step at a time
npm run demo:canonical -- --step=1

# Run up to the Human Review Decision Gate (Stages 0 -> 3)
npm run demo:canonical -- --gate

# Authorize human approval (Stages 3 -> 4)
npm run demo:canonical -- --approve

# Execute full 0-to-8 lifecycle in one shot
npm run demo:canonical -- --full

# Instant baseline reset (<1s)
npm run demo:reset
```
See [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md) for the complete 16-stage presenter narration script.

### 5. Run Automated Tests
```bash
npm test
# or
./scripts/test.sh
```

### 5. Start with Docker Compose
```bash
docker compose up -d --build
```
Orchestrates:
- `aquasentinel-postgres` (PostGIS enabled, port 5432)
- `aquasentinel-hapi-fhir` (HAPI FHIR R4, port 8080)
- `aquasentinel-backend` (API server, port 3001)
- `aquasentinel-frontend` (Nginx static bundle, port 3000)

---

## Phase 5 Municipal Command Console

AquaSentinel Phase 5 delivers a real-time, explainable operational console for municipal water authorities and environmental emergency responders:

- **Command Overview**: 8 top-level operational KPIs, real-time alert queue, deterministic Scenario A–E trigger bar.
- **Geospatial Catchment Map**: Accessible SVG projection of Volos stream reaches, colorblind-safe shape-coded incident beacons, active task markers, and reach inspection drawer.
- **Multi-Source Evidence Inspector**: Corroboration group cards, 8-factor score breakdown bars, scientific contradiction rationale, missing evidence warnings, and full cryptographic provenance lineage (`Observation` → `Assessment` → `Incident` → `Recommendation` → `Task` → `FHIR`).
- **Response Recommendation Engine**: OneAquaHealth interventions catalogue, 7-dimension suitability scoring, and 4-question rationale cards (`Why This`, `Why Now`, `What Supports It`, `What Is Missing`).
- **Supervised Human Review**: Modal workflow for `APPROVE`, `REJECT`, and `REQUEST MORE EVIDENCE` with notes and assignment.
- **Operational Task Lifecycle**: Strict state machine progression (`REQUESTED` → `ACCEPTED` → `IN_PROGRESS` → `COMPLETED` → `VERIFIED`) with immutable audit logging and HL7 FHIR R4 Task bi-directional synchronization.
- **Real-Time SSE Streaming**: Server-Sent Events transport at `/api/v1/events/stream` with automatic reconnect backoff and toast notifications.

---

## Phase 6 Resilience Intelligence & Scenario Simulation

AquaSentinel Phase 6 extends the platform with predictive analytics and counterfactual simulation:

- **Empirical Time-Series Engine**: Deterministic OLS linear trend estimation, EWMA smoothing, rolling statistics, and baseline deviation metrics without black-box ML dependencies.
- **Short-Horizon Forecasting (24h/48h/72h)**: Predictive projections with explicit uncertainty intervals and strict anti-data-leakage barriers at forecast origin $T$.
- **Multi-Signal Early-Warning Engine**: Predictive triggers corroborated with multi-sensor environmental context (temperature, dissolved oxygen, turbidity, precipitation) and structured factual rationale.
- **Counterfactual Scenario Simulation**: 5 canonical simulation archetypes (Status Quo, Accelerated Deterioration, Natural Attenuation, Meteorological Shock, Operational Intervention) with parameter tuning and step-by-step differential matrix comparison.
- **Multi-Dimensional Resilience Scorecard**: Non-collapsing independent evaluations of Alert Exposure, Trend Velocity, Monitoring Coverage, Historical Volatility, and Recovery Capability.
- **Rolling Holdout Backtesting**: Historical backtests evaluating out-of-sample MAE, RMSE, and directional accuracy benchmarked against persistence baseline.
- **Analytical Provenance & Lineage DAG**: Complete traceability of model parameters, versions, and input observation IDs.
- **FHIR R4 Extension**: Bi-directional mapping of early warnings to FHIR `Flag` and projected points to FHIR `Observation`.

---

## Phase 7 Event-Driven One Health Interoperability Platform

AquaSentinel Phase 7 establishes an enterprise-grade, asynchronous interoperability layer connecting municipal water monitoring with downstream public health, clinical, and civil protection infrastructures:

- **Domain Event Qualification**: Strict noise suppression, physical thresholds, and multi-source gating qualifying domain events before external dispatch.
- **HL7 FHIR R4 Standardized Mapping**: Maps qualified events into FHIR `Observation`, `Flag`, `Task`, and `DeviceMetric` resources with strict `FhirValidator` verification and structured `OperationOutcome` diagnostic reporting.
- **Scientific Proxy Disclosure Invariant**: Mandatory optical proxy disclosure warnings and FHIR `Provenance` metadata attached to Sentinel-2 satellite NDCI/chlorophyll events, distinguishing remote sensing bio-optical estimates from clinical diagnostic assays.
- **Transactional Outbox & At-Least-Once Delivery**: Dual-write hazard prevention via database-backed transactional outbox, asynchronous polling delivery worker, exponential backoff retries ($200\text{ms} \times 2^{\text{attempt}}$ plus jitter), and dead-letter queueing.
- **Non-Destructive Manual Replay**: Administrative replay capability preserving immutable UUIDv4 event identifiers to prevent duplicate processing downstream.
- **Decoupled External Consumer Microservice**: Standalone `consumer/` package simulating the Volos Public Health Portal (`volos-public-health-portal`) running on port 3002 with zero shared database or entity coupling.
- **Downstream Idempotency & Action Registry**: Consumer-side deduplication engine safely acknowledging duplicate event dispatches while preventing duplicate physical team dispatches or public health advisories.
- **Bi-Directional Acknowledgements & Immutable Audit Trail**: Comprehensive tracking of delivery lifecycle, HTTP transmission metrics, failure reasons, and downstream acknowledgment callbacks recorded in `interoperability_audit_log`.
- **Command Console Interoperability Hub**: Real-time telemetry bar (Delivered, Pending, Dead-Letter, Success Rate), filterable Outbox event list, interactive Scenario Testbed (Golden Path, Failure/Retry, Duplicate Idempotency, Scientific Proxy), FHIR Subscription manager, and Event Detail Inspector with FHIR JSON viewer.

---

## Phase 8 Closed-Loop Field Response, Verification & Outcome Learning

AquaSentinel Phase 8 establishes a bidirectional operational verification loop connecting supervised decision recommendations with physical ground-truth inspections:

- **Operational Task Lifecycle State Machine**: Full progression (`DRAFT` → `APPROVED` → `ASSIGNED` → `ACCEPTED` → `IN_PROGRESS` → `COMPLETED` → `VERIFIED`) with role-based dispatching.
- **Geofencing & Spatial Integrity**: Haversine distance validation classifying field telemetry as `AT_LOCATION` ($\le 50\text{m}$), `NEAR_LOCATION` ($50-250\text{m}$), or `OUTSIDE_EXPECTED_AREA`.
- **Structured Field Observations & Evidence Model**: Standardized multi-parameter telemetry (water color, surface appearance, odor, foam, algae, dead fish count, in-situ probe readings) and cryptographic SHA-256 evidence hashing.
- **Explainable OutcomeEngine (`OUTCOME_RULE_V1`)**: Reassesses evidence assessments with field ground truth to propose explainable outcomes (`CONFIRMED`, `NOT_CONFIRMED` false alarm, `UNCERTAIN`, `ESCALATE`, `ADDITIONAL_VERIFICATION_REQUIRED`).
- **Offline Resiliency & Idempotent Synchronization**: Client submission IDs (`clientSubmissionId`) preventing duplicate writes and supporting batch offline synchronization.
- **Phase 7 Event Qualification & FHIR Publishing**: Emits 6 qualified domain events mapped to FHIR `Observation`, `Flag`, and `Task` resources delivered through the transactional outbox.
- **Frontend Field Operations Hub**: Dedicated Command Console view featuring real-time verification feed, response analytics, human review outcome modal, and deterministic demo runners.

---

## Phase 9 Release Candidate: Integration, Hardening & Verification

AquaSentinel Phase 9 solidifies the platform into a technically credible, hackathon-ready release candidate (`v1.0-RC1`):

- **Sub-Second Deterministic Reset**: Instant baseline restoration (`npm run demo:reset` or header button) executing in <10ms across both PostgreSQL and in-memory stores.
- **Mobile Field Verification Interface**: Responsive field modal (`FieldVerificationModal.tsx`) with GPS geofence checks, visual water appearance indicators, photo evidence hash generation, and one-click closed-loop reassessment.
- **Comprehensive Master Integration Suite**: Complete 10-scenario end-to-end integration test (`phase9-full-e2e.test.ts`) covering the canonical 13-step golden path, confirm/refute/uncertain outcomes, FHIR resource generation, outbox backoff, DLQ replay, and unbroken provenance lineage.
- **Full Monorepo Docker Orchestration**: Complete multi-service `docker-compose.yml` including `consumer` microservice, PostGIS, HAPI FHIR, Backend, and Frontend.
- **100% Test Passing Rate**: 52 backend test suites (232 tests) and consumer test suite passing with zero flakiness.

---

## Documentation & Phase Handoffs

### Judge & Evaluation Documentation
- **Canonical Video Demo Runbook (Stages 00–15)**: [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md)
- **Judge Onboarding & Executive Guide**: [`docs/JUDGE_GUIDE.md`](docs/JUDGE_GUIDE.md)
- **Track 7 Rubric Mapping**: [`docs/TRACK_7_MAPPING.md`](docs/TRACK_7_MAPPING.md)
- **System Limitations & Engineering Disclosure**: [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md)
- **3–5 Minute Evaluator Demo Script**: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)
- **Final Phase 9 Release Handoff**: [`prd/PHASE_9_HANDOFF.md`](prd/PHASE_9_HANDOFF.md)

### Technical Guides & Architecture
- **Architecture**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Closed-Loop Response Guide**: [`docs/CLOSED_LOOP_RESPONSE.md`](docs/CLOSED_LOOP_RESPONSE.md)
- **One Health Interoperability Guide**: [`docs/INTEROPERABILITY.md`](docs/INTEROPERABILITY.md)
- **Analytics & Time-Series Guide**: [`docs/ANALYTICS.md`](docs/ANALYTICS.md)
- **Developer Guide**: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)

### Phase History & Handoffs
- **Phase 8 Handoff Document**: [`prd/PHASE_8_HANDOFF.md`](prd/PHASE_8_HANDOFF.md)
- **Phase 7 Handoff Document**: [`prd/PHASE_7_HANDOFF.md`](prd/PHASE_7_HANDOFF.md)
- **Phase 6 Handoff Document**: [`prd/PHASE_6_HANDOFF.md`](prd/PHASE_6_HANDOFF.md)
- **Phase 5 Handoff Document**: [`prd/PHASE_5_HANDOFF.md`](prd/PHASE_5_HANDOFF.md)
- **Phase 4 Handoff Document**: [`prd/PHASE_4_HANDOFF.md`](prd/PHASE_4_HANDOFF.md)
- **Phase 3 Handoff Document**: [`prd/PHASE_3_HANDOFF.md`](prd/PHASE_3_HANDOFF.md)
- **Phase 2 Handoff Document**: [`prd/PHASE_2_HANDOFF.md`](prd/PHASE_2_HANDOFF.md)
- **Phase 1 Handoff Document**: [`prd/PHASE_1_HANDOFF.md`](prd/PHASE_1_HANDOFF.md)


