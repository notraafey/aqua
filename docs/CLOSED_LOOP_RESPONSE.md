# AquaSentinel Closed-Loop Operational Response Architecture

## 1. Overview & Operational Concept

The **Closed-Loop Field Response** subsystem (Phase 8) provides the decisive ground-truth verification boundary in AquaSentinel. It transforms AquaSentinel from an open-loop alert engine into a bidirectional, supervised, closed-loop environmental health intelligence and intervention platform.

```
┌─────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│  Remote Alert   │ ────► │  Supervised Task     │ ────► │ Field Dispatch &     │
│ (Satellite/IoT) │       │  Recommendation      │       │ Mobile Inspection    │
└─────────────────┘       └──────────────────────┘       └──────────┬───────────┘
                                                                    │
┌─────────────────┐       ┌──────────────────────┐       ┌──────────▼───────────┐
│ Outcome Learning│ ◄──── │ Dynamic Reassessment │ ◄──── │ In-Situ Ground Truth │
│ & Interoperab.  │       │ & Outcome Proposal   │       │ Geofenced Telemetry  │
└─────────────────┘       └──────────────────────┘       └──────────────────────┘
```

The system ensures that no remote sensing alert is actioned into permanent containment measures without operational ground verification, and conversely, that every field inspection immediately updates multi-source evidence confidence, drives explainable operational outcomes, and notifies regional health systems via standard HL7 FHIR R4 resources.

---

## 2. Operational Task Lifecycle & State Machine

Field operational tasks follow a strict, deterministic state machine (`TaskStatus`):

```
                     ┌───────────┐
                     │   DRAFT   │
                     └─────┬─────┘
                           │ APPROVED
                           ▼
                     ┌───────────┐
                     │ APPROVED  │
                     └─────┬─────┘
                           │ ASSIGNED
                           ▼
                     ┌───────────┐
                     │ ASSIGNED  │
                     └─────┬─────┘
                           │ ACCEPTED (or REJECTED)
                           ▼
                     ┌───────────┐
                     │ ACCEPTED  │
                     └─────┬─────┘
                           │ IN_PROGRESS
                           ▼
                     ┌───────────┐
                     │IN_PROGRESS│
                     └─────┬─────┘
                           │ Submits Verification
                           ▼
                     ┌───────────┐
                     │ COMPLETED │
                     └─────┬─────┘
                           │ Supervisor Confirms Outcome
                           ▼
                     ┌───────────┐
                     │ VERIFIED  │
                     └───────────┘
```

### Transition Validation Rules
1. `DRAFT`: Allowed next states: `['APPROVED', 'ASSIGNED', 'CANCELLED']`
2. `APPROVED`: Allowed next states: `['ASSIGNED', 'ACCEPTED', 'CANCELLED']`
3. `ASSIGNED`: Allowed next states: `['ACCEPTED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS']`
4. `ACCEPTED`: Allowed next states: `['IN_PROGRESS', 'CANCELLED', 'COMPLETED']`
5. `IN_PROGRESS`: Allowed next states: `['AWAITING_VERIFICATION', 'COMPLETED', 'CANCELLED']`
6. `COMPLETED`: Allowed next states: `['VERIFIED', 'REJECTED', 'AWAITING_VERIFICATION']`
7. `VERIFIED`: Terminal operational state (can transition to `REJECTED` under supervisor dispute).

---

## 3. Geofencing & Spatial Boundary Verification

To prevent falsification or erroneous location reporting, every verification submission undergoes automated geodetic distance verification against the expected reach coordinate:

- **Formula**: Great-circle Haversine formula on WGS84 coordinates.
- **Thresholds**:
  - `distance <= 50m`: **`AT_LOCATION`** (Optimal ground truth accuracy)
  - `50m < distance <= 250m`: **`NEAR_LOCATION`** (Acceptable reach perimeter)
  - `distance > 250m`: **`OUTSIDE_EXPECTED_AREA`** (Flagged as non-compliant; rejected or highlighted for supervisor review)

```typescript
const result = GeofenceValidator.validate(observedLocation, expectedLocation, 250);
// Returns: { status: 'AT_LOCATION' | 'NEAR_LOCATION' | 'OUTSIDE_EXPECTED_AREA', distanceMeters, isWithinGeofence }
```

---

## 4. Structured Field Observations & Evidence Model

Field inspections record both qualitative and quantitative telemetry:

- **Surface Physical**: Water colour (`DENSE_GREEN`, `BROWN`, `CLEAR`, `MILKY`), surface foam (boolean), algae presence, odor (`FISHY`, `EARTHY`, `CHEMICAL`, `NONE`).
- **Ecological Distress**: Dead fish observation count (`deadFish: number | boolean`).
- **In-Situ Multi-Parameter Probe**: Dissolved oxygen (mg/L), pH, Turbidity (NTU), Temperature (°C).
- **Physical Attachments**:
  - `PhotoEvidence`: Timestamped, geo-referenced, SHA-256 integrity hashed photography.
  - `SampleEvidence`: Laboratory container ID, sample type (`SURFACE_WATER`, `SEDIMENT`), chain-of-custody metadata.

---

## 5. OutcomeEngine Rules & Explainable Decision Triage

The `OutcomeEngine` (`OUTCOME_RULE_V1`) evaluates post-verification evidence assessments and proposes one of five deterministic operational outcomes:

| Condition | Proposed Outcome | Action Taken |
| :--- | :--- | :--- |
| Dead fish mortality > 5 observed + high confidence | **`ESCALATE`** | Triggers emergency alert, escalates incident severity to `CRITICAL`. |
| Inspector reports `CONFIRMED` + positive indicators | **`CONFIRMED`** | Confirms physical hazard presence. Emits `IncidentConfirmed`. |
| Inspector reports `NOT_CONFIRMED` / Clean water | **`NOT_CONFIRMED`** | Classifies alert as **False Alarm**. Decreases score, emits `IncidentNotConfirmed`. |
| Ambiguous / `UNCERTAIN` observations | **`ADDITIONAL_VERIFICATION_REQUIRED`** | Queues secondary water sampling or transect investigation. |
| Score < 40% with inconclusive telemetry | **`UNCERTAIN`** | Keeps incident in observational pending state. |

---

## 6. Offline Queueing & Idempotent Synchronization

Field inspectors often operate in rural or degraded network connectivity environments along riverbanks and mountain gorges:

1. **Client Submission ID**: Every verification generated on a mobile device receives a client-side UUIDv4 (`clientSubmissionId`).
2. **Idempotency Guarantee**: If network drops during upload, retrying the submission with the same `clientSubmissionId` is guaranteed to return the previously processed verification without double-counting observations or re-triggering duplicate events.
3. **Batch Sync**: The `POST /api/v1/verifications/sync` endpoint accepts batches of offline verification records and processes each atomically.

---

## 7. Interoperability & FHIR R4 Publishing

Every Phase 8 operational lifecycle event publishes qualified domain events that are transformed to HL7 FHIR R4 resources and routed to the Phase 7 transactional outbox:

- `VerificationCompleted`: Mapped to a FHIR `Observation` with `Observation.category = "exam"`, containing structured components for water appearance, odor, and geofence status.
- `IncidentConfirmed`: Mapped to a FHIR `Flag` with `Flag.status = "active"` and `Flag.code = "environmental-hazard-confirmed"`.
- `IncidentNotConfirmed`: Mapped to a FHIR `Flag` with `Flag.status = "inactive"` (false alarm resolution).
- `IncidentEscalated`: Mapped to a FHIR `Flag` with `Flag.status = "active"` and `priority = "critical"`.
- `AdditionalVerificationRequired`: Mapped to a FHIR `Task` requesting supplementary sampling.
