# Track 7 Requirement Mapping: AquaSentinel

This document provides a line-by-line mapping of AquaSentinel's implemented capabilities to the requirements and evaluation dimensions of **Track 7 (Health, Environment, & Public Safety / AI Agents for Global Good / Public Health Interoperability)**.

---

## Evaluation Dimension 1: Environmental Intelligence & Multi-Source Fusion

### Requirement: Ingest and harmonize heterogeneous environmental and sensor streams
- **Implemented Capability**: Real-time multi-sensor ingestion engine supporting satellite optical data (Copernicus Sentinel-2 NDCI, turbidity), river sensors (USGS Water Services DO, pH, temperature, conductivity), weather telemetry (NOAA rainfall, wind velocity), and regional clinical health trends.
- **Component & Implementation**:
  - `backend/src/adapters/satellite/sentinel-adapter.ts` (Sentinel-2 MSI processing, NDCI calculation)
  - `backend/src/adapters/sensors/usgs-adapter.ts` (USGS instantaneous value client with live and recorded modes)
  - `backend/src/adapters/weather/noaa-adapter.ts` (NOAA precipitation and meteorological ingestion)
  - `backend/src/domain/evidence/observation-engine.ts` (Standardized observation parsing and baseline deviation)
- **Demonstrated In E2E**: Scenario Golden Path Step 1–3 (`backend/tests/integration/phase9-full-e2e.test.ts`).

### Requirement: Defensible anomaly detection with explicit uncertainty quantification
- **Implemented Capability**: Multi-source Bayesian evidence scoring with calibrated false-alarm suppression. Isolated optical detections suffer a penalty (-25) unless corroborated by in-situ chemical changes or clinical patterns (+35 to +50).
- **Component & Implementation**:
  - `backend/src/domain/evidence/scoring-engine.ts` (Bayesian probability formulation, corroboration matrices)
  - `backend/src/domain/evidence/anomaly-detector.ts` (Z-score and threshold statistical anomaly detection)
- **Demonstrated In E2E**: Scenario B demonstrates false-alarm suppression when field observation refutes remote alert (`outcome: NOT_CONFIRMED`).

---

## Evaluation Dimension 2: Hydrodynamic Plume Modeling & Spatial Intelligence

### Requirement: Spatiotemporal propagation and downstream risk forecasting
- **Implemented Capability**: 1D Physics-informed advection-dispersion transport equation modeling contaminant plume concentration, velocity decay, and estimated time-of-arrival (ETA) at downstream drinking water intakes and recreational zones.
- **Component & Implementation**:
  - `backend/src/domain/hydrodynamics/plume-model.ts` (Advection-dispersion solver: $\frac{\partial C}{\partial t} + u \frac{\partial C}{\partial x} = D \frac{\partial^2 C}{\partial x^2} - k C$)
  - `backend/src/domain/hydrodynamics/stream-network.ts` (Topological stream reach graph of Volos / Pagasetic Gulf catchment)
  - `backend/src/database/repositories/pg-spatial-repository.ts` / `in-memory-spatial-repository.ts` (Reach topological routing)
- **Demonstrated In E2E**: Incident creation with computed plume downstream impact reaches and arrival times.

---

## Evaluation Dimension 3: Human-in-the-Loop Governance & Operational Decision Support

### Requirement: Autonomous decision recommendations with strict human authorization gates
- **Implemented Capability**: Operational decision engine generating tiered recommendations (`DISPATCH_INSPECTOR`, `ISSUE_BOIL_WATER_ADVISORY`, `SAMPLE_INTAKE`) based on severity and risk thresholds. Recommendations cannot execute without explicit human approval.
- **Component & Implementation**:
  - `backend/src/domain/operational/decision-engine.ts` (Deterministic policy rules and severity categorization)
  - `backend/src/services/operational/operational-service.ts` (Approval state transitions, dispatch validation)
  - `backend/src/api/routes/recommendations.ts` (`POST /api/v1/recommendations/:id/approve` and `:id/reject`)
  - `frontend/src/components/incidents/IncidentActionPanel.tsx` (Interactive operator approval UI)
- **Demonstrated In E2E**: Step 6–7: Recommendation requires approval before task dispatch occurs.

---

## Evaluation Dimension 4: Closed-Loop Field Verification & Verification Feedback

### Requirement: Field technician dispatch, ground-truth observation, and closed-loop learning
- **Implemented Capability**: Operational task dispatch to named field actors, mobile verification workflow with GPS geofencing, evidentiary photos with SHA-256 hashes, physical sample barcoding, and automated outcome reassessment.
- **Component & Implementation**:
  - `backend/src/domain/response/geofence.ts` (Haversine 50m warning / 250m rejection geofencing)
  - `backend/src/domain/response/outcome-engine.ts` (Automated outcome evaluation: `CONFIRMED`, `NOT_CONFIRMED`, `REQUIRES_FOLLOW_UP`)
  - `backend/src/services/response/operational-response-service.ts` (Closed-loop feedback: reassesses evidence, updates incident confidence)
  - `frontend/src/components/tasks/FieldVerificationModal.tsx` (Mobile-responsive ground-truth submission modal)
  - `frontend/src/pages/FieldOperationsPage.tsx` (Field operational dashboard and scenario executor)
- **Demonstrated In E2E**: Scenarios A, B, and C in `backend/tests/integration/phase9-full-e2e.test.ts`.

---

## Evaluation Dimension 5: Healthcare Interoperability & HL7 FHIR R4

### Requirement: Standards-based integration with healthcare systems and public health registries
- **Implemented Capability**: Bidirectional translation of environmental events into standard HL7 FHIR R4 resources (`Observation`, `Flag`, `ServiceRequest`, `Subscription`) with LOINC/SNOMED terminology and mandatory satellite proxy disclosures.
- **Component & Implementation**:
  - `backend/src/adapters/fhir/mapper.ts` (FHIR R4 resource construction with proxy disclosure invariants)
  - `backend/src/domain/interoperability/event-qualifier.ts` (Event qualification engine)
  - `backend/src/services/interoperability/interoperability-service.ts` (FHIR orchestration)
  - `backend/src/api/routes/fhir.ts` (FHIR R4 REST API endpoints)
- **Demonstrated In E2E**: Integration test Scenario 5: Full validation of FHIR Observation, Flag, and ServiceRequest generation with proxy note assertions.

---

## Evaluation Dimension 6: Resilient Event-Driven Delivery & Dual-Write Prevention

### Requirement: Guaranteed delivery, transactional integrity, and external fault tolerance
- **Implemented Capability**: Transactional Outbox pattern guaranteeing at-least-once delivery to external webhook subscribers. Includes cryptographic HMAC signatures (`X-AquaSentinel-Signature`), exponential backoff retry with jitter, Dead-Letter Queue (DLQ), and manual replay capability.
- **Component & Implementation**:
  - `backend/src/services/interoperability/delivery-worker.ts` (Outbox worker with retry scheduling, DLQ transitions, and replay)
  - `backend/src/database/repositories/pg-outbox-repository.ts` / `in-memory-outbox-repository.ts` (Outbox persistence)
  - `consumer/src/server.ts` (Independent standalone Volos Public Health Portal demonstrating deduplication and outage recovery)
- **Demonstrated In E2E**: Integration test Scenarios 6, 7, and 8: Delivery failure retry, consumer deduplication, and DLQ replay verification.

---

## Summary Matrix

| Track 7 Rubric Item | AquaSentinel Implementation | Verification Evidence |
|---|---|---|
| **Multi-Source Data Ingestion** | Satellite (Sentinel-2), Sensor (USGS), Weather (NOAA), Health | `backend/tests/integration/phase9-full-e2e.test.ts` (Step 1–3) |
| **Physics-Informed Modeling** | 1D Advection-dispersion plume transport equation | `backend/tests/unit/hydrodynamics.test.ts` |
| **Uncertainty & False Alarm Control**| Multi-source Bayesian fusion with remote penalty | `backend/tests/unit/scoring-engine.test.ts` |
| **Human-in-the-Loop Governance** | Operator approval gate before dispatch or advisory | `backend/tests/integration/phase9-full-e2e.test.ts` (Step 6) |
| **Closed-Loop Ground Truth** | Geofenced mobile field verification & reassessment | `backend/tests/integration/phase8-closed-loop.test.ts` |
| **Healthcare Interoperability** | HL7 FHIR R4 (`Observation`, `Flag`, `ServiceRequest`) | `backend/tests/unit/fhir-mapper.test.ts` |
| **Production-Grade Delivery** | Transactional Outbox, HMAC-SHA256, Backoff, DLQ, Replay | `backend/tests/integration/phase9-full-e2e.test.ts` (Scenarios 6–8) |
| **External Consumer Integration** | Standalone Public Health Portal with outage simulation | `consumer/tests/consumer.test.ts` |
| **Deterministic Reproducibility** | Sub-second full system reset (`npm run demo:reset`) | `backend/tests/integration/phase9-full-e2e.test.ts` (Scenario 10) |
