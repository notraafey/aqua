# AquaSentinel: Canonical Demonstration Mode & Video Runbook Walkthrough

## Summary of Completed Work

We have implemented a **dedicated, deterministic, end-to-end Demonstration Mode** for the AquaSentinel application. This system exercises the **REAL** application architecture and domain engines without mock UI shortcuts, fake datasets, or simulation facades.

```text
INPUT / OBSERVATION
       │
       ▼
INGESTION SERVICE (Sentinel-2, In-situ Sonde, Weather, Citizen)
       │
       ▼
PROVENANCE TRACKING & CANONICAL STANDARD NORMALIZATION
       │
       ▼
DECOUPLED EVENT BUS (ObservationReceived)
       │
       ▼
EVIDENCE FUSION ENGINE (Spatial Buffer, Temporal Decay, Narrow Stream Quality Corrections)
       │
       ▼
CONFIDENCE SCORING (Multi-Source Corroboration Matrix: 25% NORMAL -> 91% PRIORITIZE)
       │
       ▼
INCIDENT CLASSIFIER & OPERATIONAL SEVERITY ENGINE (ALGAL_BLOOM, Severity HIGH)
       │
       ▼
ONEAQUAHEALTH RECOMMENDATION ENGINE (Interventions Catalogue: Surface Aerators & Booms)
       │
       ▼
HUMAN REVIEW DECISION GATE (PENDING_REVIEW -> Operator Formal Approval)
       │
       ▼
OPERATIONAL TASK DISPATCH & HL7 FHIR R4 TASK SYNCHRONIZATION
       │
       ▼
FIELD RESPONSE MOBILITY & HAVERSINE GEOFENCE VALIDATION (<= 50m)
       │
       ▼
GROUND TRUTH INSPECTION (FIELD_INSPECTION Observation, Dead Fish Count, SHA-256 Hash)
       │
       ▼
CLOSED-LOOP DYNAMIC REASSESSMENT (Score elevates to 100%, Proposed Outcome: CONFIRMED)
       │
       ▼
SUPERVISOR OUTCOME CONFIRMATION (Outcome: CONFIRMED, Incident: ACTION_IN_PROGRESS)
       │
       ▼
TRANSACTIONAL OUTBOX (HMAC-SHA256 Signed HL7 FHIR R4 Flag & Observation Resources)
       │
       ▼
DECOUPLED EXTERNAL CONSUMER (Volos Public Health Portal, Port 3002)
       │
       ▼
CONSUMER IDEMPOTENT DEDUPLICATION, SIGNATURE VERIFICATION & ACKNOWLEDGEMENT RECEIPT
       │
       ▼
IMMUTABLE AUDIT TRAIL & SYSTEM HEALTH MONITORING
```

---

## Key Architecture & Code Deliverables

1. **Backend Canonical Demo Service** ([`canonical-demo-service.ts`](file:///Users/raafey/Documents/ss/aqua/backend/src/services/demo/canonical-demo-service.ts)):
   - Replaced old mock database inserts with 8 deterministic, real service invocations:
     - `stage0_resetAndBaseline()`: In-memory or Postgres reset + baseline reach seeding.
     - `stage1_ingestSatelliteAnomaly()`: Sentinel-2 NDCI proxy (0.28) ingestion.
     - `stage2_ingestCorroboratingEvidence()`: In-situ DO hypoxia (2.6 mg/L), weather (31.8°C), and citizen scum report.
     - `stage3_getPendingReviewState()`: Decision gate state check.
     - `stage4_approveRecommendation()`: Human approval & operational task dispatch.
     - `stage5_advanceFieldTask()`: Task transition to `ACCEPTED` and `IN_PROGRESS`.
     - `stage6_submitFieldVerification()`: Geofence validation + `FIELD_INSPECTION` ingestion + fusion reassessment.
     - `stage7_confirmOutcome()`: Outcome confirmation as `CONFIRMED`.
     - `stage8_deliverInteroperability()`: Outbox delivery with HMAC-SHA256 signature to consumer on port 3002.
   - Built programmatic helper methods: `runToGate()`, `executeNextStep(step)`, `executeEndToEndScenario()`, and `getStatus()`.

2. **Backend REST API Routes** ([`demo.ts`](file:///Users/raafey/Documents/ss/aqua/backend/src/api/routes/demo.ts)):
   - `GET /api/v1/demo/canonical/status`
   - `POST /api/v1/demo/canonical/step`
   - `POST /api/v1/demo/canonical/run-to-gate`
   - `POST /api/v1/demo/canonical/approve`
   - `POST /api/v1/demo/canonical/reset`
   - `POST /api/v1/demo/canonical/execute`

3. **Frontend Incident Lifecycle Controller** ([`DemoControlBar.tsx`](file:///Users/raafey/Documents/ss/aqua/frontend/src/components/demo/DemoControlBar.tsx) & [`AppShell.tsx`](file:///Users/raafey/Documents/ss/aqua/frontend/src/layout/AppShell.tsx)):
   - Docked top controller bar permanently accessible across all application screens.
   - 9-stage visual pipeline tracker (Stages 0 through 8) with pulse indicator.
   - Live telemetry status badges (Incident ID, Confidence Score %, Field Task, FHIR Interoperability Outbox).
   - Advance Step, Run to Gate, and Reset buttons.
   - Presenter Guide expandable drawer with live talking points tailored to the current active stage.
   - Quick navigation deep-links for evaluators (`Reach Map`, `Evidence Fusion`, `Response Tasks`, `FHIR Outbox`).
   - Defaulted `selectedReachId` to Reach Alpha (`7a3b4c12-89de-4f56-9abc-1234567890ab`) so loading `http://localhost:5173` immediately lands on the canonical reach context.

4. **CLI Canonical Demo Runner** ([`canonical-demo-runner.ts`](file:///Users/raafey/Documents/ss/aqua/backend/src/scripts/canonical-demo-runner.ts)):
   - CLI script runnable with `npm run demo:canonical`:
     - `npm run demo:canonical -- --status` (inspect active state)
     - `npm run demo:canonical -- --step=1` (advance single step)
     - `npm run demo:canonical -- --gate` (run up to Decision Gate)
     - `npm run demo:canonical -- --approve` (authorize human approval)
     - `npm run demo:canonical -- --full` (execute full 0-to-8 sequence)
     - `npm run demo:reset` (sub-second clean state reset)

5. **Authoritative Video Recording Runbook & Feature Coverage Matrix** ([`DEMO_RUNBOOK.md`](file:///Users/raafey/Documents/ss/aqua/DEMO_RUNBOOK.md)):
   - 16-stage comprehensive presenter script (Stages 00–15) with exact visual actions, audio narration, and technical numbers.
   - Full Feature Coverage Matrix verifying Subsystems A, B, C, D, and E.
   - Presenter Cheat Sheet table.

---

## Verification & Test Results

### 1. Automated Test Suites
- **Backend Tests**: 54 test files, 242 tests passing with 0 failures (`npm test --workspace=backend`).
  - Unit tests: Corroborators, spatial/temporal engines, scoring, quality penalties, fhir validator.
  - Integration tests: `demo-canonical-lifecycle.test.ts` (9/9 passed), `canonical-demo.test.ts`, `phase9-full-e2e.test.ts`.
- **Consumer Tests**: 4 tests passing with 0 failures (`npm test --workspace=consumer`).
- **Frontend Build**: `tsc && vite build` completed cleanly with zero type errors.

### 2. End-to-End CLI Verification
Executing `npm run demo:canonical -- --full` verifies the unbroken chain of custody:
```text
Stage 0: Baseline initialized for Almyros Stream - Reach Alpha (Volos). Surveillance mode active.
Stage 1: Sentinel-2 NDCI proxy ingested (0.28). Fused score 25/100 (NORMAL band).
Stage 2: Ingested In-situ Probe (DO: 2.6 mg/L), Weather (31.8°C), Citizen Report. Fused score escalated to 91/100 (PRIORITIZE). Hazard: ALGAL_BLOOM, Severity: HIGH.
Stage 4: Recommendation approved by supervisor. Operational Task created (status: REQUESTED, priority: HIGH).
Stage 5: Task accepted and transitioned to IN_PROGRESS by Inspector Alex Rivera on-site.
Stage 6: Field verification submitted (Geofence verified <= 50m, 4 dead fish, dense green scum). Closed-loop feedback: new FIELD_INSPECTION observation ingested, evidence reassessed (Score: 100/100), task COMPLETED, proposed outcome: CONFIRMED.
Stage 7: Outcome confirmed as CONFIRMED by Supervisor Dimitris Georgiou. Incident status set to ACTION_IN_PROGRESS. IncidentConfirmed domain event published; FHIR Flag resource qualified and queued in Interoperability Outbox.
Stage 8: Interoperability delivery worker processed outbox with HMAC-SHA256 signatures to Volos Health Portal.
```
