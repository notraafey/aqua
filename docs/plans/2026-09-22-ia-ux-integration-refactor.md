# AquaSentinel — Information Architecture & UX Integration Refactor

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor AquaSentinel from isolated, development-phase feature demos into ONE unified municipal water-contamination response platform organized around the 8 operational lifecycle pillars, backed by a canonical end-to-end demo scenario and defensive data contracts.

**Architecture:** Connect the entire municipal operational lifecycle (Reach → Observation → Evidence → Incident → Recommendation → Approval → Task → Field Operation → Outcome → Interoperability Event → Audit Trail) with shared domain state, bidirectional entity cross-linking, and guaranteed array defaults at the data boundary. Replace fragmented phase-based navigation with 8 cohesive operational pillars while strictly preserving the existing visual language and styling.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Express 4, Node.js, Leaflet / IncidentMap, EventBus, SSE Streaming, HL7 FHIR R4.

---

## User Review Required

> [!IMPORTANT]
> **Zero Visual Regressions**: In accordance with user directives, no colors, typography, spacing, card layouts, icons, borders, or animations will be altered. All work is purely Information Architecture, UX integration, and data contract consistency.

> [!IMPORTANT]
> **8 Canonical Pillars**: Navigation will transition from the current 11 disconnected tabs to the 8 operational lifecycle pillars:
> 1. **Command Center** (High-level situational overview with 8 operational facets)
> 2. **Water Network** (Catchment Map + Monitored Stream Reaches & History)
> 3. **Monitoring & Evidence** (Multi-source ingestion feeds + Evidence Fusion & Provenance)
> 4. **Incidents** (Supervised Incident Queue + End-to-End Incident Lifecycle Detail)
> 5. **Response & Operations** (Connected pipeline: Recommendations → Tasks → Field Operations → Analytics)
> 6. **Resilience & Scenarios** (Forecasting & Simulation referencing the operational network)
> 7. **Interoperability** (FHIR resources, Outbox, retries, acks, and external event audit)
> 8. **System Health** (Real-time telemetry across all 9 municipal subsystems)

---

## Open Questions

None. The user requirements, operational lifecycle, core entities, and error handling contracts are fully specified.

---

## Proposed Changes

Grouped logically by architectural layer:

```
[Domain & Backend Layer]
  1. Backend Canonical Demo Service & Route
  2. Data Contract Boundary & API Client Normalization
[Frontend Information Architecture & State Layer]
  3. App Navigation Shell & 8-Pillar Sidebar (Remove Phase Jargon)
  4. Global Application State & Cross-Entity Deep Linking
[Core Views & Connected Workflows Layer]
  5. Command Center (8 Operational Facet Cards & Quick Scenario Actions)
  6. Water Network (Unified Catchment Map & Reach Detail with Incident/Task Links)
  7. Monitoring & Evidence (Evidence Fusion + Multi-Source Feed Inspector)
  8. Incidents & Incident Detail (Full Lifecycle Traversal)
  9. Response & Operations (Connected Workflow: Recommendations → Tasks → Field Ops → Analytics)
  10. Resilience, Interoperability & System Health Cleanup
```

---

### Phase 1: Data Contracts & Runtime Error Remediation

#### [MODIFY] [client.ts](file:///Users/raafey/Documents/ss/aqua/frontend/src/api/client.ts)
- Fix unwrapping bug in lines 535–668 where `this.request` already unwraps `data.data !== undefined ? data.data : data`, but methods called `return res.data;` (which returned `undefined`).
- Introduce data boundary normalizer `safeArray<T>(val: any): T[]` ensuring `evidence`, `observations`, `recommendations`, `approvals`, `tasks`, `fieldOperations`, `verifications`, `interoperabilityEvents`, `auditEvents` always default to `[]`.
- Audit every method (`getVerifications`, `getTasks`, `getIncidents`, `getObservations`, `getEvidenceAssessments`, `getRecommendations`, `getEarlyWarnings`, `getInteroperabilityEvents`, `getIncidentOutcomes`, `getFieldActors`) to guarantee an array is returned.
- Add `executeCanonicalDemo(): Promise<CanonicalDemoResult>` and ensure `resetDemo(): Promise<SystemResetResult>` is wired.

---

### Phase 2: Canonical End-to-End Demo Scenario (Backend & Shared)

#### [NEW] [canonical-demo-service.ts](file:///Users/raafey/Documents/ss/aqua/backend/src/services/demo/canonical-demo-service.ts)
- Implement `CanonicalDemoService.executeEndToEndScenario()`:
  1. **Reach**: Pins monitored stream reach `7a3b4c12-89de-4f56-9abc-1234567890ab` ("Almyros Stream - Reach Alpha") in Volos.
  2. **Observations**: Generates multi-source observations:
     - Satellite Sentinel-2 L2A (NDCI: 0.42, water color GREEN_TINT)
     - Weather Station (Air temp 31.5°C, rainfall 0.0mm, stagnant conditions)
     - In-Situ Sensor (Turbidity 19.2 NTU, Dissolved Oxygen 2.8 mg/L, pH 8.7)
     - Citizen Science report (turquoise-green scum and septic odor)
  3. **Evidence Assessment**: Evaluates fused evidence with score 86/100 (`PRIORITIZE` band), corroborating sources, and analytical provenance.
  4. **Incident**: Creates `INC-2026-001` (Severity: `HIGH`, Status: `ACTION_IN_PROGRESS`, Hazard: `ALGAL_BLOOM`).
  5. **Recommendations**: Generates catalogue-backed recommendations:
     - Primary: `REC-2026-001` ("Priority Water Sampling & Rapid Toxin Screening", status: `APPROVED`)
     - Secondary: `REC-2026-002` ("Precautionary Downstream Irrigation Advisory", status: `PENDING_REVIEW`)
  6. **Operational Task**: Generates `TSK-2026-001` ("Field Ground-Truth Inspection & In-Situ Sampling") linked to `REC-2026-001` and `INC-2026-001`, assigned to Alex Rivera. Status progresses to `COMPLETED`.
  7. **Field Operation / Verification**: Records `VER-2026-001` with field inspector Alex Rivera, geofence validation `AT_LOCATION`, structured observations (dense green, foam, dead fish), photographic evidence, and water sample #SMP-8821.
  8. **Outcome**: Proposes outcome `CONFIRMED` (confidence: 94%), confirmed by Municipal Supervisor, updating incident `verificationStatus` to `CONFIRMED`.
  9. **Interoperability & FHIR**: Emits outbox events (`IncidentCreated`, `EvidenceAssessmentUpdated`, `RecommendationApproved`, `TaskCreated`, `VerificationSubmitted`, `IncidentConfirmed`) with FHIR Task and Flag mapping. Delivers events to consumer and records delivery acknowledgements.
  10. **Audit Trail**: Writes immutable audit log entries preserving the entire end-to-end chain.

#### [MODIFY] [demo.ts](file:///Users/raafey/Documents/ss/aqua/backend/src/api/routes/demo.ts)
- Add route `POST /api/v1/demo/canonical/execute` calling `CanonicalDemoService.executeEndToEndScenario()`.
- Ensure `POST /api/v1/demo/reset` calls `resetSystemState()`.

---

### Phase 3: Information Architecture & Navigation Refactor

#### [MODIFY] [Sidebar.tsx](file:///Users/raafey/Documents/ss/aqua/frontend/src/layout/Sidebar.tsx)
- Refactor `NavTab` to represent the 8 canonical pillars:
  - `command-center` ("Command Center", icon: `LayoutDashboard`)
  - `water-network` ("Water Network", icon: `Compass`)
  - `monitoring-evidence` ("Monitoring & Evidence", icon: `ShieldAlert`)
  - `incidents` ("Incident Management", icon: `AlertOctagon`)
  - `response-operations` ("Response & Operations", icon: `Sparkles`)
  - `resilience` ("Resilience & Scenarios", icon: `TrendingUp`)
  - `interoperability` ("Interoperability Hub", icon: `Share2`)
  - `system-health` ("System Health", icon: `Server`)
- Remove "Phase 5 Municipal Command Console" text; replace with "Municipal Environmental Operations Center".
- Display live badge counts for active items across the 8 pillars.

#### [MODIFY] [Header.tsx](file:///Users/raafey/Documents/ss/aqua/frontend/src/layout/Header.tsx)
- Add quick-trigger buttons in Header:
  - "Run End-to-End Demo Scenario" (triggers canonical scenario and live refreshes all shared state)
  - "Reset System State" (cleans and re-seeds baseline)
- Remove any Phase-specific header subtitles.

#### [MODIFY] [App.tsx](file:///Users/raafey/Documents/ss/aqua/frontend/src/App.tsx)
- Update state orchestration for the 8 tabs.
- Support deep entity navigation via `handleNavigate(tab, entityId, subTab)`:
  - e.g., navigating to `incidents` with `incidentId` opens `IncidentDetailView`.
  - navigating to `response-operations` with `taskId` opens `TaskDetailView` under Operational Tasks tab.
  - navigating to `water-network` with `reachId` focuses the specific reach or map pin.
- Fetch all shared collections (`reaches`, `observations`, `assessments`, `incidents`, `recommendations`, `tasks`, `verifications`, `warnings`, `outbox`) with defensive `[]` defaults.

---

### Phase 4: Core Operational Views Refactor

#### [MODIFY] [DashboardPage.tsx](file:///Users/raafey/Documents/ss/aqua/frontend/src/pages/DashboardPage.tsx) (Command Center)
- Reorganize into the 8 operational lifecycle facets:
  1. Current System Status (telemetry, uptime, mode)
  2. Monitored Reaches Summary (coverage, status)
  3. Active Early Warnings
  4. Active Incident Queue (with severity badges and 1-click jump to incident)
  5. Pending Human Reviews (Recommendations awaiting approval with 1-click review)
  6. Active Operational Tasks (Tasks in flight with 1-click jump to task)
  7. Recent Field Activity (Latest ground-truth submissions with photo/verification status)
  8. Interoperability Status (Outbox health, delivered vs retrying, FHIR synchronization)
- Add prominent "Run Canonical End-to-End Scenario" action bar at the top with step progression indicator.

#### [NEW] [WaterNetworkPage.tsx](file:///Users/raafey/Documents/ss/aqua/frontend/src/pages/WaterNetworkPage.tsx)
- Merges Catchment Map (`MapPage`) and Stream Reaches (`StreamReachesPage`) under the **Water Network** pillar:
  - Tab 1: **Catchment Map** (Interactive map with reach footprint, active incident markers, operational tasks, sensor points)
  - Tab 2: **Monitored Reaches & History** (Reach cards showing reach metadata, baseline parameters, active incidents on reach, active tasks on reach, and recent observations)
- Direct cross-links:
  - "View Incidents for this Reach" → jumps to Incidents tab filtered by reach.
  - "View Operational Tasks for this Reach" → jumps to Response & Operations tab.

#### [MODIFY] [EvidenceAssessmentsPage.tsx](file:///Users/raafey/Documents/ss/aqua/frontend/src/pages/EvidenceAssessmentsPage.tsx) (Monitoring & Evidence)
- Rename title from "Phase 3 Intelligence" to "Monitoring & Evidence Fusion".
- Tab 1: **Evidence Fusion & Reasoning** (`EvidenceInspector` with confidence scoring, corroboration breakdown, and provenance modal)
- Tab 2: **Multi-Source Observation Streams** (Satellite Sentinel-2, Weather station telemetry, In-situ water quality probes, Citizen reports)
- Direct cross-link:
  - "View Classified Incident" → jumps to incident detail for the assessment.

#### [MODIFY] [IncidentsPage.tsx](file:///Users/raafey/Documents/ss/aqua/frontend/src/pages/IncidentsPage.tsx) & [IncidentDetailView.tsx](file:///Users/raafey/Documents/ss/aqua/frontend/src/components/incidents/IncidentDetailView.tsx)
- Enrich `IncidentDetailView` with the complete lifecycle chain:
  - Originating Reach & baseline deviation
  - Fused Evidence & Classification
  - Algorithmic Recommendations & Human Approvals
  - Dispatched Operational Tasks
  - Linked Field Operations / Verifications (photos, structured observations, geofence validation)
  - Incident Outcome & Supervisory Confirmation (Allow confirming outcome, escalating, or resolving)
  - Interoperability & FHIR Event status
- Cross-links to view task detail or view reach detail in 1 click.

#### [NEW] [ResponseOperationsPage.tsx](file:///Users/raafey/Documents/ss/aqua/frontend/src/pages/ResponseOperationsPage.tsx)
- Unifies Recommendations, Tasks, Field Operations, and Analytics into **ONE connected operational workflow**:
  - Sub-tab 1: **Response Engine & Recommendations** (Review, approve, or reject recommendations; approving automatically generates task and offers instant navigation to task)
  - Sub-tab 2: **Operational Tasks** (Task queue, lifecycle controls: Requested → Assigned → In Progress → Completed → Verified)
  - Sub-tab 3: **Field Operations & Verifications** (Submissions feed, structured observations, photo gallery, geofence status, supervisor outcome review)
  - Sub-tab 4: **Response Analytics** (SLA performance, actor activity, outcome statistics)
- Smooth transitions between tabs when actions occur (e.g. approving recommendation highlights new task; completing task opens field verification).

#### [MODIFY] [ResiliencePage.tsx](file:///Users/raafey/Documents/ss/aqua/frontend/src/pages/ResiliencePage.tsx), [InteroperabilityPage.tsx](file:///Users/raafey/Documents/ss/aqua/frontend/src/pages/InteroperabilityPage.tsx), [SystemHealthPage.tsx](file:///Users/raafey/Documents/ss/aqua/frontend/src/pages/SystemHealthPage.tsx)
- Remove all "Phase 4 / Phase 6 / Phase 7" text.
- In `ResiliencePage`: ensure scorecard and forecasts reference the same monitored reaches.
- In `InteroperabilityPage`: add entity correlation link so outbox events link to their originating Incident or Task.
- In `SystemHealthPage`: ensure clean telemetry for all 9 municipal subsystems.

---

## Verification Plan

### Automated Tests
- Build verification: `npm run build` across all workspaces (`shared`, `backend`, `frontend`, `consumer`).
- Backend test suite: `npm test --workspace=backend`.
- Add integration test for Canonical Demo: `tests/integration/canonical-demo.test.ts` verifying all 10 steps of the lifecycle chain execute and persist deterministically.

### Manual Verification
- Launch application (`npm run dev:all`).
- Check Command Center loads with all 8 operational facets and no runtime errors.
- Verify `verifications.length` error is completely eliminated.
- Click "Run End-to-End Demo Scenario":
  - Verify Incident Queue shows `INC-2026-001`.
  - Verify Water Network shows the active anomaly and links to `INC-2026-001`.
  - Verify Monitoring & Evidence shows the 4 fused observation sources.
  - Verify Response & Operations shows `REC-2026-001`, `TSK-2026-001`, and `VER-2026-001`.
  - Verify Interoperability Hub shows the corresponding outbox FHIR events.
  - Verify full Audit Trail preserves the chain.
  - Verify cross-linking between Reach → Evidence → Incident → Task → Verification → Outcome.
