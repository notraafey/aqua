# AquaSentinel: Event-Driven One Health Interoperability (Phase 7)

## 1. Architecture Overview

AquaSentinel Phase 7 establishes an enterprise-grade, event-driven interoperability platform connecting freshwater environmental telemetry with downstream public health surveillance systems (specifically the **Volos Public Health Portal** — `volos-public-health-portal`).

```
┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│ Environmental Sensors  │       │ Decision Engine        │       │ Interoperability       │
│ & Remote Sensing (S2)  │ ───▶  │ (Fusion & Early Warning)│ ───▶  │ Event Qualifier        │
└────────────────────────┘       └────────────────────────┘       └──────────┬─────────────┘
                                                                             │
                                                                 (Noise Qualification Gate)
                                                                             │
                                                                             ▼
┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│ FHIR R4 Validator      │ ◀───  │ FHIR Mapper            │ ◀───  │ Qualified Domain Event │
│ (& OperationOutcome)   │       │ (Observation/Flag/Task)│       │ Envelope v1.0.0        │
└──────────┬─────────────┘       └────────────────────────┘       └────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             TRANSACTIONAL OUTBOX (PostgreSQL)                           │
│  State Machine: PENDING ──▶ DELIVERING ──▶ DELIVERED (w/ Acknowledgement)               │
│                                │                                                         │
│                                └──▶ RETRYING (Exp Backoff) ──▶ DEAD_LETTER ──▶ REPLAYED  │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │
                                   (Outbox Delivery Worker)
                                             │
                                             ▼
┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│ FHIR REST-Hook Dispatch│ ───▶  │ Decoupled Consumer     │ ───▶  │ Downstream Action &    │
│ (Subscription Engine)  │       │ (Volos Health Portal)  │       │ Acknowledgement POST   │
└────────────────────────┘       └────────────────────────┘       └──────────┬─────────────┘
                                                                             │
                                                                             ▼
                                                                  ┌────────────────────────┐
                                                                  │ Immutable Audit Log    │
                                                                  │ (End-to-End Lineage)   │
                                                                  └────────────────────────┘
```

---

## 2. Core Invariants

### 2.1 Decoupled Consumer Invariant
The external consumer (`consumer/`) operates as a completely autonomous, physically isolated microservice on port 3002. It has **zero direct access** to AquaSentinel internal databases, domain entities, repositories, or services. All communication occurs over strictly typed HTTP/JSON and FHIR R4 REST-hook protocols.

### 2.2 Scientific Proxy Disclosure Invariant
Satellite remote-sensing proxies (Normalized Difference Chlorophyll Index - NDCI derived from Copernicus Sentinel-2 MSI Bands 4 and 5) represent optical surface reflectance proxies for chlorophyll-a, **not clinical or pathogen diagnostics**.
- Every FHIR Observation, Flag, and Event Envelope carrying remote-sensing data explicitly includes a structured `scientificDisclaimer`:
  > *"Elevated chlorophyll-related remote-sensing signal detected (NDCI). Optical proxy indicates potential biogenic presence; pending field corroboration and laboratory verification. Not a verified clinical or pathogen diagnostic."*
- Prohibits downstream systems from mistaking surface algal bloom optical indicators for unverified clinical bacterial infections without in-situ laboratory corroboration.

### 2.3 At-Least-Once Delivery & Idempotency Invariant
- **Outbox Persistence**: Events are committed transactionally to the database before delivery is attempted.
- **Stable Event IDs**: Every interoperability event is assigned a globally unique UUIDv4 `eventId` that persists across retries, re-transmissions, and dead-letter replays.
- **Consumer Deduplication**: The downstream consumer checks incoming `eventId`s against its local idempotency registry. Duplicate deliveries return HTTP 200 with status `'DUPLICATE'`, prevent duplicate downstream operational actions, and acknowledge the delivery.

---

## 3. External Event Taxonomy & Envelope Schema

External interoperability events use a standard, versioned envelope (`InteroperabilityEventEnvelope`):

```json
{
  "eventId": "c76f0b8d-2e11-4f10-9150-e5dc23508491",
  "eventType": "EarlyWarningCreated",
  "eventVersion": "1.0.0",
  "occurredAt": "2026-09-19T09:30:00.000Z",
  "producer": "aquasentinel-decision-engine",
  "subject": "Location/reach-almyros-1",
  "resourceType": "Flag",
  "resourceId": "flag-ew-almyros-1",
  "resource": { ... },
  "correlationId": "inc-volos-2026-001",
  "causationId": "ea-volos-2026-001",
  "provenance": {
    "provenanceId": "prov-f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
    "sourceEntityId": "flag-ew-almyros-1",
    "sourceEntityType": "Flag",
    "originatingSource": "COPERNICUS_SENTINEL_2",
    "processingPipeline": "FHIR_R4_INTEROPERABILITY_PIPELINE_V1",
    "scientificDisclaimer": "Elevated chlorophyll-related remote-sensing signal detected (NDCI)...",
    "timestamp": "2026-09-19T09:30:00.000Z"
  },
  "severity": "HIGH",
  "qualificationReason": "Predictive early warning: [WARNING] High NDCI optical proxy"
}
```

### Event Taxonomy
| Event Type | Subject | FHIR Resource | Trigger Condition |
|---|---|---|---|
| `ObservationCreated` | `Location/{reachId}` | `Observation` | Anomalous observation (NDCI > 0.15, DO < 6.0 mg/L, Temp > 22°C, or Flagged quality) |
| `EvidenceAssessmentUpdated` | `Location/{reachId}` | `Observation` | Multi-source fused score >= 50 or confidence band in PRIORITIZE/INVESTIGATE |
| `IncidentCreated` | `Location/{reachId}` | `Flag` | Verified or high-severity incident classified by decision engine |
| `IncidentSeverityChanged` | `Incident/{id}` | `Flag` | Transition in incident status (e.g. DETECTED -> MITIGATING -> RESOLVED) |
| `RecommendationApproved` | `Incident/{id}` | `Task` draft | Human-in-the-loop supervisor approves containment/intervention recommendation |
| `TaskCreated` | `Incident/{id}` | `Task` | Operational response task dispatched to municipal field crews |
| `TaskCompleted` | `Incident/{id}` | `Task` | Field task completed with verification evidence |
| `EarlyWarningCreated` | `Location/{reachId}` | `Flag` | Early warning engine triggers WARNING or CRITICAL advisory |
| `ForecastUpdated` | `Location/{reachId}` | `Observation` | Short-horizon forecasting model predicts escalating proxy breach (> 0.20) |
| `ScenarioCompleted` | `Location/{reachId}` | `Observation` | Counterfactual resilience scenario simulation completed |

---

## 4. Transactional Outbox & Delivery Worker

### 4.1 State Machine
```
[ PENDING ] ──▶ [ DELIVERING ] ──▶ [ DELIVERED ] (HTTP 200 + Ack recorded)
                     │
                     └── (HTTP 5xx / Network Error)
                             │
                             ▼
                     [ RETRYING ] (Next retry at now + initialBackoff * (multiplier ^ retries))
                             │
                             └── (Retries >= maxRetries) ──▶ [ DEAD_LETTER ]
                                                                   │
                                                                   └── (Operator Replay) ──▶ [ REPLAYED / PENDING ]
```

### 4.2 Retry Backoff Formula
$$\text{delay} = \min(\text{maxBackoff}, \text{initialBackoffMs} \times (\text{multiplier})^{\text{retryCount}})$$
- Default: `initialBackoffMs = 1000`, `multiplier = 2`, `maxRetries = 3`.
- Replay: Operator manual replay resets status to `PENDING`, increments `replayCount`, preserves original `eventId`, and generates a `REPLAYED` audit entry.

---

## 5. FHIR R4 Validation & OperationOutcome

Before an event is placed into the outbox or delivered via REST-hook, it passes through `FhirValidator.validateOrThrow(resource)`:
- Validates structure against FHIR R4 standard constraints.
- Rejects malformed resources with `FhirValidationError` containing a complete FHIR `OperationOutcome`:
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "required",
      "diagnostics": "Task missing required intent (e.g. order, proposal)",
      "location": ["$.intent"]
    }
  ]
}
```

---

## 6. External Consumer (`consumer/`)

The decoupled consumer is located in `consumer/` running at port 3002:
- `GET /health`: Health status, consumer identity, uptime, and delivery statistics.
- `POST /webhook/fhir`: Main ingestion webhook for FHIR R4 REST-hook events.
  * Validates envelope and extracts FHIR resource.
  * Checks in-memory idempotency cache (`seenEventIds`). If duplicate, returns HTTP 200 with status `'DUPLICATE'`.
  * Generates downstream operational action log (e.g., Public Health Bulletin, Water Intake Inspection order).
  * Returns immediate acknowledgement payload (`InteroperabilityAcknowledgement`).
- `POST /simulate-failure`: Enables simulation mode (HTTP 503) for failure/recovery testing.
- `POST /simulate-restore`: Restores normal operation after failure simulation.
- `GET /actions`: Lists downstream operational actions executed by the consumer.

---

## 7. Interoperability REST API Reference

### System Overview & Telemetry
- `GET /api/v1/interoperability/overview`
  * Returns system health, FHIR adapter mode, consumer connection state, outbox counts, and active subscriptions.

### Outbox & Queue Monitoring
- `GET /api/v1/interoperability/events` (or `GET /api/v1/interoperability/outbox`)
  * Filter query params: `status`, `eventType`, `correlationId`, `resourceType`, `limit`, `offset`.
- `GET /api/v1/interoperability/events/:id` (or `GET /api/v1/interoperability/outbox/:id`)
  * Returns event envelope, payload, audit trail, and acknowledgements.
- `POST /api/v1/interoperability/events/:id/retry` (or `/outbox/:id/retry`)
  * Triggers immediate redelivery attempt for a retrying or failed event.
- `GET /api/v1/interoperability/dead-letter`
  * Lists all permanently failed events in the dead-letter queue.
- `POST /api/v1/interoperability/dead-letter/:id/replay` (or `/outbox/:id/replay`)
  * Manually triggers non-destructive replay preserving original `eventId`.

### FHIR Subscriptions
- `GET /api/v1/interoperability/subscriptions`
  * Lists registered REST-hook subscriptions.
- `POST /api/v1/interoperability/subscriptions`
  * Registers a new subscription with `reason`, `criteria` (e.g. `Flag?status=active`), `endpoint`, and optional `id`.

### Audit Trail & Traceability
- `GET /api/v1/interoperability/audit`
  * Chronological ledger of all qualification, delivery, retry, and dead-letter stages.
- `GET /api/v1/interoperability/acknowledgements`
  * Records of all receipts returned by external consumers.
- `POST /api/v1/interoperability/consumer/acknowledge`
  * Asynchronous acknowledgement webhook endpoint for decoupled consumers.

### Interactive Demonstration Endpoints
- `POST /api/v1/demo/interoperability/golden-path`: Executes full end-to-end telemetry to consumer flow.
- `POST /api/v1/demo/interoperability/simulate-failure`: Simulates consumer 503 outage and backoff recovery.
- `POST /api/v1/demo/interoperability/simulate-duplicate`: Tests idempotency defense against duplicate deliveries.
- `POST /api/v1/demo/interoperability/simulate-dead-letter`: Tests max retry exhaustion, dead-lettering, and manual replay.
