# AquaSentinel Phase 8 Handoff: Closed-Loop Field Response, Verification & Outcome Learning

## 1. Phase Objective
Phase 8 completes the operational verification loop of AquaSentinel. It transforms the platform from an open-loop remote detection and recommendation system into an end-to-end, supervised, closed-loop environmental intelligence platform. Phase 8 enables field actors (inspectors, municipal officers, environmental specialists) to be dispatched, collect structured ground-truth observations and physical evidence, validate location against geofences, and feed verifiable ground truth back into the evidence fusion and outcome engine. This directly validates or refutes remote-sensing anomalies, suppressing false alarms and driving automated FHIR R4 notifications to regional health authorities.

---

## 2. Architecture Implemented
The Phase 8 architecture builds on the clean, unidirectional domain-driven layer established in Phases 1–7:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        AQUASENTINEL PHASE 8 ARCHITECTURE                │
│                                                                         │
│  [Field Force / Mobile Device]                                          │
│  • FieldActor (Inspector/Officer) • Offline SQLite / IndexedDB Queue    │
│  • Photo & Sample Capture • GPS In-Situ Telemetry                       │
│                                │                                        │
│                                ▼ POST /api/v1/verifications/submit      │
│  [Closed-Loop Operational Response Service]                             │
│  • Idempotency Check (clientSubmissionId deduplication)                 │
│  • GeofenceValidator (Haversine 50m / 250m validation)                  │
│  • Structured Observation Ingestion (FIELD_INSPECTION source)           │
│  • EvidenceFusionService.reassess (Multi-modal bayesian scoring)        │
│  • OutcomeEngine.evaluate (Proposes CONFIRMED/NOT_CONFIRMED/etc.)       │
│  • Task Lifecycle State Machine (IN_PROGRESS -> COMPLETED -> VERIFIED)  │
│                                │                                        │
│                                ▼ Internal Event Bus                     │
│  [Domain Events Emitted]                                                │
│  • VerificationCompleted • IncidentConfirmed • IncidentNotConfirmed    │
│  • IncidentEscalated • AdditionalVerificationRequired                   │
│                                │                                        │
│                                ▼ Phase 7 Boundary                       │
│  [EventQualifier & FHIR R4 Mapper]                                      │
│  • Qualifies domain events -> Maps to FHIR Observation / Flag / Task    │
│  • Writes to Transactional Outbox (outbox_events)                       │
│  • Delivered asynchronously via OutboxDeliveryWorker to Subscribers     │
│                                │                                        │
│                                ▼ Command Console                        │
│  [Frontend Field Operations Hub]                                        │
│  • Verification Feed • Response Analytics • Deterministic Scenarios A/B/C│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Task Lifecycle
The task lifecycle state machine governs operational tasks (`TaskStatus`):
- `DRAFT`: Task created from approved recommendation or follow-up request.
- `APPROVED`: Supervisor has authorized task execution.
- `ASSIGNED`: Linked to a specific `FieldActor` with target reach coordinates.
- `ACCEPTED`: Field actor has acknowledged receipt on their mobile interface.
- `IN_PROGRESS`: Field actor is en-route or actively on-site conducting inspection.
- `AWAITING_VERIFICATION`: Inspection completed, telemetry awaiting network sync.
- `COMPLETED`: Verification successfully ingested and attached to parent incident.
- `VERIFIED`: Final operational closure following human supervisor outcome confirmation.
- `REJECTED` / `CANCELLED`: Terminal cancellation states.

---

## 4. Assignment System
- Dispatchers assign tasks using `POST /api/v1/tasks/:id/assign`.
- Supports direct actor assignment (`actorId`) and role-based queuing (`assignedRole`: `FIELD_INSPECTOR`, `MUNICIPAL_OFFICER`, `ENVIRONMENTAL_SPECIALIST`).
- Generates `TaskAssigned` audit entries, updates `assignedActorId`, and issues audit events.

---

## 5. Actor Model
- Entity `FieldActor` represents human and automated field personnel.
- Fields: `actorId`, `name`, `organization`, `role`, `contact`, `active`.
- Pre-seeded with 4 multi-agency actors:
  1. `Alex Rivera` (Field Inspector, Hellenic Environmental Inspectorate)
  2. `Elena Vasquez` (Environmental Specialist, Regional Water Directorate)
  3. `Nikos Katsaros` (Municipal Officer, Volos Municipal Water Board)
  4. `Dr. Sophia Chen` (Senior Hydrochemist, OneAquaHealth Research Lab)

---

## 6. Verification Model
- Entity `Verification` represents the formal record of an on-site physical inspection.
- Fields: `id`, `taskId`, `incidentId`, `inspector`, `timestamp`, `location`, `status`, `observations`, `notes`, `evidence` (`photos`, `samples`), `clientSubmissionId`, `syncStatus`, `conflictStatus`.
- Status types: `CONFIRMED`, `NOT_CONFIRMED`, `UNCERTAIN`, `PARTIALLY_CONFIRMED`, `REQUIRES_FOLLOW_UP`.

---

## 7. Evidence Model
Field inspection data is ingested directly as an `Observation` with `source: 'FIELD_INSPECTION'`:
- Scored via `ScoringEngine` with dedicated ground-truth weighting (+25 for corroboration, -25 for contradiction).
- Contradicting ground truth (e.g. clean water) immediately marks remote optical alerts as false positives.

---

## 8. Photo/Media System
- Entity `PhotoEvidence`: `evidenceId`, `verificationId`, `timestamp`, `filename`, `mediaType`, `description`, `source`, `dataUrl`, `storagePath`.
- Includes cryptographic SHA-256 provenance hash ensuring evidentiary chain-of-custody for environmental enforcement.

---

## 9. Sample System
- Entity `SampleEvidence`: `sampleId`, `verificationId`, `sampleType` (`SURFACE_WATER`, `SEDIMENT`, `EFFLUENT`), `collectionTime`, `collectionLocation`, `collector`, `containerReferenceId`, `laboratoryStatus`, `notes`.
- Enables physical laboratory sample dispatch and downstream test correlation.

---

## 10. Location Handling
- `VerificationLocation` extends GeoJSON `Point` with `accuracyMeters`, `latitude`, `longitude`, `timestamp`, `distanceMeters`, `validationStatus`.
- Preserves raw GPS sensor telemetry alongside normalized GeoJSON coordinates.

---

## 11. Geofence
- Validated via `GeofenceValidator.validate(observedLocation, expectedLocation, thresholdMeters = 250)`.
- Returns geodetic distance in meters using the Haversine equation on WGS84.
- Classifications:
  - `<= 50m`: `AT_LOCATION`
  - `50m - 250m`: `NEAR_LOCATION`
  - `> 250m`: `OUTSIDE_EXPECTED_AREA` (`isWithinGeofence: false`)

---

## 12. Offline Workflow
- Field apps store pending verifications locally in IndexedDB / SQLite.
- Submissions are assigned client-side `clientSubmissionId` before network dispatch.
- When connection is restored, client flushes queue via `POST /api/v1/verifications/sync`.

---

## 13. Synchronization
- Server checks `clientSubmissionId` against existing verifications before processing.
- Duplicate uploads are recognized immediately, returning the cached verification and outcome without duplicate side-effects.

---

## 14. Conflict Handling
- Server-authoritative conflict resolution with optimistic locking.
- If multiple submissions arrive for the same task, the highest evidentiary quality and most complete observation record is preserved, marking older records with `conflictStatus: 'RESOLVED_LOCAL'`.

---

## 15. Reassessment
- After verification ingestion, `OperationalResponseService` triggers `EvidenceFusionService.reassess(streamReachId, incidentId)`.
- Updates overall reach confidence score, supporting/contradicting counts, and confidence band.

---

## 16. Outcome Engine
`OutcomeEngine.evaluate` (`OUTCOME_RULE_V1`) evaluates combined post-verification assessment:
- **`ESCALATE`**: Observed acute fish mortality (>5 dead fish) or chemical toxicity.
- **`CONFIRMED`**: Field inspector corroborated anomaly presence.
- **`NOT_CONFIRMED`**: Inspector observed clean water; classifies as **False Alarm**.
- **`ADDITIONAL_VERIFICATION_REQUIRED`**: Inconclusive or ambiguous field observations.
- **`UNCERTAIN`**: Low overall confidence score (<40%).

---

## 17. Resolution
- Operators can formally resolve an incident via `POST /api/v1/incidents/:id/resolve`.
- Sets incident status to `RESOLVED`, records resolution narrative, and emits `IncidentResolved` domain event.

---

## 18. Escalation
- Critical hazards can be escalated via `POST /api/v1/incidents/:id/escalate`.
- Elevates severity to `CRITICAL`, triggers priority dispatch, and emits `IncidentEscalated` event.

---

## 19. Closed-Loop Events
Phase 8 introduces 6 qualified domain events:
1. `VerificationCompletedEvent`
2. `IncidentConfirmedEvent`
3. `IncidentNotConfirmedEvent`
4. `IncidentEscalatedEvent`
5. `IncidentResolvedEvent`
6. `AdditionalVerificationRequiredEvent`

---

## 20. FHIR Integration
Each Phase 8 domain event maps to an HL7 FHIR R4 standard resource:
- `VerificationCompleted` -> FHIR `Observation` (category: exam, components: water colour, odor, dead fish, geofence status).
- `IncidentConfirmed` -> FHIR `Flag` (status: active, code: confirmed-hazard).
- `IncidentNotConfirmed` -> FHIR `Flag` (status: inactive, false-alarm-resolution).
- `IncidentEscalated` -> FHIR `Flag` (status: active, priority: critical).
- `AdditionalVerificationRequired` -> FHIR `Task` (requested secondary sampling).

---

## 21. Phase 7 Integration
- All Phase 8 events are registered with `EventQualifier` and subscribed in `InteroperabilityService`.
- Outbound resources are recorded in `outbox_events` and dispatched via `OutboxDeliveryWorker` with retry, backoff, and dead-letter handling.

---

## 22. APIs
- `GET /api/v1/verifications` — List verifications (filters: taskId, incidentId, status, inspectorId).
- `GET /api/v1/verifications/:id` — Verification detail.
- `POST /api/v1/verifications` — Create draft verification.
- `POST /api/v1/verifications/:id/submit` — Submit verification and trigger closed-loop pipeline.
- `POST /api/v1/verifications/:id/evidence` — Attach photos and samples.
- `POST /api/v1/verifications/sync` — Offline batch sync.
- `GET /api/v1/actors` — List registered field actors.
- `GET /api/v1/actors/:id` — Actor details.
- `GET /api/v1/analytics/response` — Closed-loop operational metrics and KPI summaries.
- `POST /api/v1/tasks/:id/assign` — Assign task to actor.
- `POST /api/v1/incidents/:id/outcome/confirm` — Supervisor outcome confirmation.
- `POST /api/v1/incidents/:id/resolve` — Resolve incident.
- `POST /api/v1/incidents/:id/escalate` — Escalate incident severity.
- `POST /api/v1/incidents/:id/tasks/follow-up` — Create secondary sampling task.
- `POST /api/v1/demo/phase8/scenario-a` — Scenario A execution.
- `POST /api/v1/demo/phase8/scenario-b` — Scenario B execution.
- `POST /api/v1/demo/phase8/scenario-c` — Scenario C execution.
- `POST /api/v1/demo/phase8/execute-all` — Sequential execution of all three scenarios.

---

## 23. Frontend Routes
Integrated into the tab-based console:
- `NavTab = 'field-ops'` ("Field Operations" nav tab in Sidebar).
- Accessible via the main navigation sidebar.

---

## 24. Frontend Components
- `FieldOperationsPage`: Main hub with Verifications Feed, Analytics view, and Demo Runner.
- `ResponseAnalyticsView`: KPI summary cards, outcome breakdown, actor workload table.
- `OutcomeReviewModal`: Human supervisor review modal with structured outcome selection and notes.
- Updated `Sidebar.tsx`, `App.tsx`, and `client.ts`.

---

## 25. Database Changes
Migration `007_phase8_closed_loop_response.sql`:
- Extended `tasks`: `assigned_actor_id`, `verification_status`, `accepted_at`, `in_progress_at`, `verified_at`.
- Extended `verifications`: `observations` JSONB, `location_telemetry` JSONB, `geofence_status`, `client_submission_id`, `sync_status`.
- Created `field_actors` table with 4 seeded actors.
- Created `incident_outcomes` table recording engine proposals and supervisor confirmations.

---

## 26. Configuration
- Geofence default threshold: 250m.
- At-location precision threshold: 50m.
- Rule version: `OUTCOME_RULE_V1`.

---

## 27. Security
- Input payload validation using strict Zod schemas.
- Client submission idempotency prevents duplicate state changes or replay attacks.
- SHA-256 provenance hashes on attached evidence.

---

## 28. Tests
- `backend/tests/unit/phase8-closed-loop.test.ts`:
  - GeofenceValidator (AT_LOCATION, NEAR_LOCATION, OUTSIDE_EXPECTED_AREA, threshold override).
  - OutcomeEngine (ESCALATE, CONFIRMED, NOT_CONFIRMED, ADDITIONAL_VERIFICATION_REQUIRED).
  - Task state machine transition enforcement and error guards.

---

## 29. Integration Tests
- `backend/tests/integration/phase8-closed-loop.test.ts`:
  - End-to-end Scenario A (Confirmed contamination).
  - End-to-end Scenario B (False alarm / Not confirmed).
  - End-to-end Scenario C (Uncertain / Follow-up task creation).
  - Idempotency verification via `clientSubmissionId`.

---

## 30. Demo Scenarios
- **Scenario A (Confirmed)**: Alex Rivera inspects Sentinel-2 NDCI alert, observes green foam and fish kill -> OutcomeEngine proposes CONFIRMED -> Supervisor confirms.
- **Scenario B (False Alarm)**: Elena Vasquez inspects optical anomaly, observes clear water -> OutcomeEngine proposes NOT_CONFIRMED -> False alarm archived.
- **Scenario C (Uncertain / Follow-Up)**: Nikos Katsaros observes ambiguous runoff -> OutcomeEngine proposes ADDITIONAL_VERIFICATION_REQUIRED -> Follow-up task created for secondary lab sampling.

---

## 31. Known Limitations
- Media attachments in demo mode store metadata and simulated binary hashes; S3/MinIO cloud object storage integration is simulated with local storage paths.
- Mobile device GPS accuracy relies on browser Geolocation API when invoked in browser clients.

---

## 32. Technical Debt
- Repository in-memory collections duplicate PostgreSQL schema fields; keep schema and memory store synchronized during migrations.

---

## 33. Files Created
1. `backend/src/database/migrations/007_phase8_closed_loop_response.sql`
2. `backend/src/database/repositories/in-memory-verification-repository.ts`
3. `backend/src/database/repositories/in-memory-field-actor-repository.ts`
4. `backend/src/database/repositories/in-memory-incident-outcome-repository.ts`
5. `backend/src/database/repositories/pg-verification-repository.ts`
6. `backend/src/database/repositories/pg-field-actor-repository.ts`
7. `backend/src/database/repositories/pg-incident-outcome-repository.ts`
8. `backend/src/domain/response/geofence.ts`
9. `backend/src/domain/response/outcome-engine.ts`
10. `backend/src/domain/response/demo-scenarios-phase8.ts`
11. `backend/src/api/routes/verifications.ts`
12. `backend/src/api/routes/actors.ts`
13. `backend/src/api/routes/response-analytics.ts`
14. `frontend/src/pages/FieldOperationsPage.tsx`
15. `frontend/src/components/incidents/OutcomeReviewModal.tsx`
16. `frontend/src/components/analytics/ResponseAnalyticsView.tsx`
17. `backend/tests/unit/phase8-closed-loop.test.ts`
18. `backend/tests/integration/phase8-closed-loop.test.ts`
19. `docs/CLOSED_LOOP_RESPONSE.md`
20. `prd/PHASE_8_HANDOFF.md`

---

## 34. Files Modified
1. `shared/src/types/domain.ts` (Added verification, field actor, outcome, and observation types).
2. `shared/src/types/events.ts` (Added 6 Phase 8 domain events and interoperability types).
3. `backend/src/database/repositories/types.ts` (Added repository interfaces).
4. `backend/src/database/repositories/container.ts` (Registered new repositories).
5. `backend/src/domain/evidence/scoring-engine.ts` (Added FIELD_INSPECTION scoring branch).
6. `backend/src/services/response/operational-response-service.ts` (Added verification submission, outcome confirmation, follow-up task creation).
7. `backend/src/domain/interoperability/event-qualifier.ts` (Added Phase 8 event qualification rules).
8. `backend/src/adapters/fhir/mapper.ts` (Added toFhirVerificationObservation).
9. `backend/src/services/interoperability/interoperability-service.ts` (Subscribed to Phase 8 events and added FHIR mapping cases).
10. `backend/src/api/routes/tasks.ts` (Added assign task endpoint and status enum expansion).
11. `backend/src/api/routes/incidents.ts` (Added outcomes, resolve, escalate, follow-up endpoints).
12. `backend/src/api/routes/demo.ts` (Added Phase 8 demo scenario endpoints).
13. `backend/src/api/server.ts` (Mounted verifications, actors, response-analytics routers).
14. `frontend/src/api/client.ts` (Added Phase 8 client methods).
15. `frontend/src/layout/Sidebar.tsx` (Added field-ops NavTab).
16. `frontend/src/App.tsx` (Added FieldOperationsPage rendering).

---

## 35. Exact Phase 9 Starting State
- Full closed-loop verification pipeline is operational, build-verified, and test-verified (51 test files, 222 tests passing).
- Both in-memory and PostgreSQL database modes fully support field operations, actors, verifications, outcomes, and FHIR outbox dispatch.
- Frontend Command Console includes a dedicated Field Operations hub with verification feed, response analytics, and one-click demo scenario execution.

---

## 36. What Phase 9 Should Reuse
- Use `OperationalResponseService` for task lifecycle and assignment.
- Use `OutcomeEngine` for outcome evaluations.
- Use `GeofenceValidator` for any spatial validation needs.
- Use `IVerificationRepository`, `IFieldActorRepository`, and `IIncidentOutcomeRepository`.
- Use the existing event-driven Phase 7 Outbox mechanism to deliver external notifications.

---

## 37. What Phase 9 Must Not Rewrite
- Do **not** rewrite the `TaskStatus` state machine in `OperationalResponseService`.
- Do **not** rewrite the `EventQualifier` qualification logic for Phase 7/8 events.
- Do **not** modify the core FHIR mapper methods or change the proxy disclosure invariant on satellite observations.

---

## 38. Extension Points for Phase 9
- **Automated Drone & Autonomous Surface Vessel (ASV) Dispatch**: Plug ASV navigation waypoints into `tasks` and ingest automated water sampling probe records into `verifications`.
- **Active Learning & Retraining**: Feed confirmed and refuted field ground-truth outcomes back into ML baseline models (Phase 6 forecasting) to optimize anomaly detection thresholds and reduce false positive rates over time.
- **Mobile PWA Support**: Wrap the verification form into an offline-first ServiceWorker PWA with background sync capabilities.
