# AquaSentinel Development Guide

This guide explains how to develop, extend, and test AquaSentinel following the established Phase 1 architecture.

---

## 1. Quick Start

### Prerequisites
- Node.js 20+ or 22+
- npm 10+
- Docker & Docker Compose (optional for local PostgreSQL and HAPI FHIR)

### Installation
```bash
# Clone the repository and install all workspace dependencies
git clone <repo-url>
cd aqua
npm install

# Build shared types
npm run build --workspace=shared
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default mode is `APP_MODE=demo`. In demo mode, the application runs with deterministic mock data and can operate completely without external databases.

---

## 2. Running Locally

### Start Everything (Backend + Frontend)
```bash
npm run dev:all
# or using script:
./scripts/dev.sh
```
- Backend will start on `http://localhost:3001`
- Frontend will start on `http://localhost:5173`

### Start Backend Only
```bash
npm run dev
```

### Start Frontend Only
```bash
npm run dev:frontend
```

---

## 3. Running Automated Tests

```bash
# Run all backend unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch --workspace=backend
```

---

## 4. How-To Guides

### How to Add a New Domain Model
1. Define the TypeScript interface in `shared/src/types/domain.ts`.
2. Export it from `shared/src/index.ts` and run `npm run build --workspace=shared`.
3. Add a database migration in `backend/src/database/migrations/` (e.g. `002_new_entity.sql`).
4. Update repository interfaces in `backend/src/database/repositories/types.ts`.
5. Implement in `Postgres*Repository` and `InMemory*Repository`.

### How to Add a New API Endpoint
1. Define request/response DTOs in `shared/src/types/api.ts`.
2. Create or extend a router in `backend/src/api/routes/` (e.g. `backend/src/api/routes/new-domain.ts`).
3. Validate inputs using `zod` schemas.
4. Mount the route under `/api/v1` in `backend/src/api/server.ts`.
5. Add unit/integration tests in `backend/tests/integration/api.test.ts`.

### How to Implement an External Adapter (e.g. for Phase 2)
1. Check interface in `backend/src/adapters/<domain>/index.ts` (e.g. `ISatelliteAdapter`).
2. Implement a live client class implementing that interface.
3. Bind the adapter in the factory method based on `config.APP_MODE`.
4. Ensure domain models remain decoupled from external HTTP responses.

### How to Add a Database Migration
1. Create a new `.sql` file in `backend/src/database/migrations/` prefixed with a 3-digit sequence number, e.g. `002_add_sensor_telemetry.sql`.
2. Run migrations:
```bash
npm run migrate
```

---

## 5. Coding Conventions
- **Identifiers**: Always use UUIDv4 via `generateId()` from `backend/src/domain/value-objects.ts`.
- **Timestamps**: Always format timestamps as canonical ISO-8601 UTC strings using `nowUtc()`.
- **Error Handling**: Throw domain errors (`ValidationError`, `NotFoundError`, `UnauthorizedError`, `ConflictError`, `ExternalDependencyError`) from `backend/src/api/middleware/error-handler.ts`.
- **Provenance**: Always attach a `ProvenanceRecord` when creating new observations or evidence items using `createProvenanceRecord()`.
- **Zero Frontend Business Calculation**: Frontend components NEVER compute evidence scores, suitability scores, or hazard classifications; all calculations are strictly performed by backend domain services and consumed via API.

---

## 6. Phase 5 Municipal Command Console & Frontend Development

### Frontend Structure
- `frontend/src/layout/`: `AppShell`, `Sidebar`, `Header`.
- `frontend/src/pages/`: `DashboardPage`, `MapPage`, `IncidentsPage`, `EvidenceAssessmentsPage`, `RecommendationsPage`, `TasksPage`, `StreamReachesPage`, `SystemHealthPage`.
- `frontend/src/components/`:
  - `map/IncidentMap.tsx`: Accessible SVG catchment map with colorblind-safe shape coding.
  - `evidence/EvidenceInspector.tsx`: Multi-source corroboration and 8-factor score breakdown.
  - `provenance/ProvenanceModal.tsx`: Complete cryptographic lineage graph.
  - `recommendations/`: `RecommendationPanel` and `HumanReviewModal`.
  - `tasks/`: `TaskDetailView` and `TaskLifecycleControls`.
  - `fhir/`: `FhirStatusBadge` and `FhirResourceViewer`.
  - `notifications/NotificationCenter.tsx`: Header bell with real-time drawer and toasts.
  - `timeline/IncidentTimeline.tsx`: Chronological unified event history.

### Real-Time SSE Transport
The frontend subscribes to `GET /api/v1/events/stream` via `frontend/src/services/realtime.ts`.
When domain events (`ObservationReceived`, `IncidentCreated`, `RecommendationApproved`, `TaskStatusUpdated`) are received, the frontend refreshes server state and renders contextual toast notifications.

---

## 7. Phase 6 Resilience Intelligence & Analytics Development

### Analytics Domain Modules
- `backend/src/domain/analytics/`:
  - `time-series-engine.ts`: Pure statistical OLS, EWMA, rolling statistics, and baseline deviation functions.
  - `forecast-models.ts` & `forecasting-engine.ts`: 24h/48h/72h forecasting models with strict anti-data leakage enforcement.
  - `early-warning-engine.ts`: Multi-signal early-warning rule evaluation with environmental corroboration and factual rationale.
  - `scenario-engine.ts`: Counterfactual simulation across 5 canonical scenarios with assumption tracking and differential comparison matrix.
  - `resilience-scorecard.ts`: 5-dimensional orthogonal scorecard and monitoring coverage breakdown.
  - `backtesting-engine.ts`: Historical rolling backtests evaluating MAE, RMSE, and directional accuracy vs baseline.
- `backend/src/services/analytics/resilience-analytics-service.ts`: Domain service integrating repositories, event bus, and calculation engines.
- `backend/src/api/routes/resilience.ts`: REST endpoints mounted under `/api/v1/resilience/*`.

### Resilience Frontend Components
- `frontend/src/pages/ResiliencePage.tsx`: Top-level page with Overview, Forecast, Scenarios, and Model Backtesting tabs.
- `frontend/src/components/resilience/`:
  - `EarlyWarningBanner.tsx`: Predictive early-warning banner with corroboration cards and acknowledgment flow.
  - `ForecastChartView.tsx`: Pure SVG chart showing historical observations, origin line $T$, projections, and uncertainty polygon.
  - `ScenarioSimulatorView.tsx`: Interactive what-if simulator with parameter sliders and differential comparison matrix.
  - `ModelPerformanceView.tsx`: Backtest holdout metrics table and live rolling backtest trigger.
  - `ResilienceOverview.tsx`: 5-dimensional resilience scorecards table and system-wide coverage KPI cards.
  - `AnalyticalProvenanceModal.tsx`: Complete analytical lineage DAG modal showing model ID, version, parameters, and input observation IDs.

---

## 8. Phase 7 Event-Driven One Health Interoperability Development

### Running the External Consumer Microservice
The decoupled external consumer service (`consumer/`, package name `@aquasentinel/consumer`) represents the Volos Public Health Portal and runs on port `3002`:

```bash
# Run standalone consumer in dev mode with hot-reload
npm run dev:consumer

# Build consumer workspace
npm run build --workspace=consumer

# Run consumer test suite
npm test --workspace=consumer
```

### Running All Services Concurrently
```bash
# Concurrently start backend (3001), frontend (5173), and consumer (3002)
npm run dev:all
```

### Interoperability Database Migrations
Phase 7 migration `backend/src/database/migrations/006_phase7_interoperability_outbox.sql` introduces:
- `outbox_events`: Transactional outbox table with delivery status, retry counters, and FHIR payloads.
- `interoperability_acknowledgements`: Downstream callback receipt tracking.
- `interoperability_audit_log`: Immutable timeline of all dispatch, retry, replay, and webhook lifecycle events.
- `fhir_subscriptions`: Subscriptions registry for REST-hook webhooks.

Run migrations via:
```bash
npm run migrate
```

### Interoperability REST API Reference
- `GET /api/v1/interoperability/overview`: Real-time telemetry (delivered count, pending count, dead-letter count, success rate).
- `GET /api/v1/interoperability/events` (alias `/outbox`): Filterable outbox event list (`status`, `eventType`, `resourceType`, `limit`, `offset`).
- `GET /api/v1/interoperability/events/:id`: Specific outbox event details and FHIR payload.
- `POST /api/v1/interoperability/events/:id/retry`: Manual retry trigger.
- `POST /api/v1/interoperability/events/:id/replay`: Non-destructive manual replay for dead-lettered events (preserves `eventId`).
- `GET /api/v1/interoperability/subscriptions`: Registered FHIR subscriptions.
- `POST /api/v1/interoperability/subscriptions/register`: Register new FHIR REST-hook webhook subscription.
- `GET /api/v1/interoperability/audit-log`: Immutable audit log query (`eventId`, `action`, `limit`).
- `POST /api/v1/interoperability/acknowledgements`: Inbound downstream callback endpoint.

### Interactive Resilience Testbed Scenarios
Trigger Phase 7 interactive resilience scenarios via API or Command Console:
- `POST /api/v1/interoperability/demo/golden-path`: Full end-to-end flow with downstream acknowledgment.
- `POST /api/v1/interoperability/demo/failure-simulation`: Simulates consumer outage (503), outbox exponential retry, dead-lettering, recovery, and replay.
- `POST /api/v1/interoperability/demo/duplicate-handling`: Dispatches duplicate event to verify consumer idempotency and `DUPLICATE` acknowledgment.
- `POST /api/v1/interoperability/demo/scientific-proxy`: Sentinel-2 NDCI bloom scenario demonstrating mandatory scientific proxy disclosure and FHIR Provenance.

---

## 8. Phase 8: Closed-Loop Field Response Development

### Testing Phase 8
```bash
# Run Phase 8 unit tests
npx vitest run tests/unit/phase8-closed-loop.test.ts

# Run Phase 8 integration tests
npx vitest run tests/integration/phase8-closed-loop.test.ts
```

### Phase 8 REST API Endpoints
- `GET /api/v1/verifications`: List verifications (filters: `taskId`, `incidentId`, `status`, `inspectorId`).
- `GET /api/v1/verifications/:id`: Detailed verification record with structured observations and evidence.
- `POST /api/v1/verifications/:id/submit`: Ingests field telemetry, runs geofence validation, reassesses evidence, proposes outcome via `OutcomeEngine`, and transitions task status.
- `POST /api/v1/verifications/sync`: Offline batch synchronization with idempotency deduplication.
- `GET /api/v1/actors`: Registered field actors (inspectors, municipal officers, specialists).
- `GET /api/v1/analytics/response`: Response operational analytics (false alarm rate, geofence compliance, response time).
- `POST /api/v1/tasks/:id/assign`: Assign task to actor or role.
- `POST /api/v1/incidents/:id/outcome/confirm`: Human supervisor confirms operational outcome.
- `POST /api/v1/incidents/:id/resolve`: Formally resolves an incident.
- `POST /api/v1/incidents/:id/escalate`: Escalates incident severity to critical.
- `POST /api/v1/incidents/:id/tasks/follow-up`: Generates follow-up task.

### Phase 8 Deterministic Demo Endpoints
- `POST /api/v1/demo/phase8/scenario-a`: Scenario A (Confirmed Contamination).
- `POST /api/v1/demo/phase8/scenario-b`: Scenario B (False Alarm / Not Confirmed).
- `POST /api/v1/demo/phase8/scenario-c`: Scenario C (Uncertain / Follow-Up Task).
- `POST /api/v1/demo/phase8/execute-all`: Executes all three scenarios sequentially.

---

## 9. Phase 9: Final Integration, Hardening & Release Candidate

### Sub-Second Deterministic Reset
To guarantee reproducible demonstration states without restarting server processes:
```bash
# Via CLI command (runs in <10ms)
npm run demo:reset

# Or via REST API
curl -X POST http://localhost:3001/api/v1/demo/reset
```
This purges all volatile incidents, evidence assessments, tasks, verifications, outbox events, and consumer-side received webhooks, then seeds baseline reaches (`reach-001` to `reach-006`) and field actors.

### Mobile Field Verification Component
- Mounted inside `frontend/src/components/tasks/TaskDetailView.tsx` via `FieldVerificationModal.tsx`.
- Features geofencing calculation, status classification (`AT_LOCATION`, `NEAR_LOCATION`, `OUTSIDE_EXPECTED_AREA`), multi-parameter field observation inputs, sample photo previews, and client submission deduplication.

### Full End-to-End Test Suite
Phase 9 introduces the comprehensive master integration test covering all 10 operational scenarios:
```bash
# Run the complete Phase 9 master integration test
npx vitest run tests/integration/phase9-full-e2e.test.ts

# Run all backend unit & integration tests (52 test files, 232 tests)
npm test -- --run

# Run external consumer test suite
npm test --workspace=consumer
```

### Essential Release & Evaluation Documents
- **Judge & Evaluator Guide**: [`docs/JUDGE_GUIDE.md`](JUDGE_GUIDE.md)
- **Track 7 Rubric Mapping**: [`docs/TRACK_7_MAPPING.md`](TRACK_7_MAPPING.md)
- **System Limitations & Roadmap**: [`docs/LIMITATIONS.md`](LIMITATIONS.md)
- **3-5 Minute Demo Script**: [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md)
- **Final Phase 9 Handoff**: [`prd/PHASE_9_HANDOFF.md`](../prd/PHASE_9_HANDOFF.md)

