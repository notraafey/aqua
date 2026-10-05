# AquaSentinel Architecture Documentation (Phase 1)

## 1. System Overview
AquaSentinel is an autonomous environmental intelligence and decision-support system designed to monitor urban and peri-urban stream reaches for contamination hazards (such as cyanobacterial algal blooms, sewage discharges, and chemical spills).

It operates on a closed supervisory control loop:
**Detect → Corroborate → Assess → Recommend → Approve → Act → Verify → Resolve**

---

## 2. High-Level Architecture Diagram

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA INGESTION LAYER                            │
│  Sentinel-2 Satellite │ Citizen Reports │ Open-Meteo │ In-Situ Sensors │
└───────────┬───────────────────┬──────────────┬───────────────┬─────────┘
            ▼                   ▼              ▼               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        ADAPTER BOUNDARIES                              │
│       ISatelliteAdapter │ ICitizenAdapter │ IWeatherAdapter            │
│       (Anti-Corruption Layer & Normalization to Domain Models)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        AQUASENTINEL CORE                               │
│  - Internal Event Bus (IEventBus)                                      │
│  - First-Class Provenance Tracking (createProvenanceRecord)            │
│  - Relational Persistence Layer (PostgreSQL / In-Memory Repositories)   │
│  - Domain Entities: StreamReach, Observation, EvidenceItem, Incident   │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    ▼                               ▼
┌───────────────────────────────────┐ ┌──────────────────────────────────┐
│          FHIR R4 GATEWAY          │ │          REST API LAYER          │
│ - IFhirAdapter (HAPI FHIR Client) │ │ - Versioned Express API (/api/v1)│
│ - FhirMapper (Observation, Task)  │ │ - Centralized Error Handling     │
│ - Subscription Webhook Listener   │ │ - Structured Winston Logging     │
└───────────────────────────────────┘ └─────────────────┬────────────────┘
                                                        ▼
                                      ┌──────────────────────────────────┐
                                      │     COMMAND CONSOLE FRONTEND     │
                                      │ - React 18 + Vite + Tailwind CSS │
                                      │ - Typed ApiClient Service Layer  │
                                      │ - Reusable Design System Tokens  │
                                      └──────────────────────────────────┘
```

---

## 3. Subsystem Breakdown

### 3.1 Shared Contracts (`shared/`)
- Contains canonical TypeScript interfaces and enums used across frontend and backend.
- `StreamReach`, `Observation`, `EvidenceItem`, `Incident`, `Recommendation`, `Task`, `Verification`, `ProvenanceRecord`.
- Standard GeoJSON geometry representations (`Point`, `LineString`, `Polygon`).

### 3.2 Backend Service (`backend/`)
- **Config**: Zod-validated environment manager (`backend/src/config/index.ts`).
- **Logger**: Winston structured logger with correlation `requestId`, ISO timestamps, and levels.
- **Database & Migrations**:
  - `backend/src/database/client.ts`: PostgreSQL connection pool with connection health telemetry.
  - `backend/src/database/migrator.ts`: Versioned SQL migration runner tracking state in `schema_migrations`.
  - Dual repository pattern: `Postgres*Repository` and `InMemory*Repository` for zero-dependency execution in tests and demo mode.
- **Adapters**:
  - `adapters/fhir/`: `IFhirAdapter`, `HapiFhirAdapter` (live REST client targeting HAPI FHIR R4), `DemoFhirAdapter` (deterministic in-memory provider), and `FhirMapper`.
  - `adapters/satellite/`: `ISatelliteAdapter` interface + `DemoSatelliteAdapter` (ready for Phase 2).
  - `adapters/weather/`: `IWeatherAdapter` interface + `DemoWeatherAdapter` (ready for Phase 2).
  - `adapters/citizen/`: `ICitizenAdapter` interface + `DemoCitizenAdapter` (ready for Phase 2).
- **Event Bus**:
  - `IEventBus` with `InMemoryEventBus` implementation supporting typed event publishing and subscription.
- **API Server & Routing**:
  - `/api/health`: Comprehensive system telemetry (DB status, FHIR status, uptime, mode).
  - `/api/v1/stream-reaches`: Management of monitored water bodies with baseline data and constraints.
  - `/api/v1/observations`: Observation ingestion, automatic provenance generation, event publishing, and FHIR sync.
  - `/api/v1/incidents`: Incident queries and evidence inspection.
  - `/api/v1/tasks`: Operational tasks tracking.
  - `/api/v1/webhooks/fhir/subscription`: HAPI FHIR resthook listener.

### 3.3 Frontend Command Console (`frontend/`)
- Modern, accessible React + Vite + Tailwind CSS application.
- Dedicated `apiClient` service layer (no direct `fetch()` scattered in components).
- Reusable Design System primitives: `Button`, `Card`, `Badge`, `Modal`, `StatusIndicator`, `LoadingSpinner`, `ErrorBoundary`.
- App Shell with live system status beacon, LIVE/DEMO mode badge, and tab navigation.
- Views: Dashboard / Overview, Stream Reaches, Incident Queue, Operational Tasks, and System Health Telemetry.

---

## 4. Key Architectural Guarantees
1. **Zero External Lock-In**: The domain layer never imports external HTTP SDKs or raw FHIR libraries.
2. **Immutable Provenance**: Every observation and evidence item records where it came from, how it was processed, and original timestamps.
3. **Reproducibility**: Entire database schema and seed data are reproducible via migration scripts.
4. **Resilience**: The system gracefully falls back to deterministic InMemory repositories in demo/offline mode.

---

## 5. Phase 2: Environmental Data Layer

### 5.1 Architecture Overview
Phase 2 implements the multi-source environmental data ingestion layer that feeds canonical observations into AquaSentinel:
```text
[Copernicus CDSE Sentinel-2]  [Open-Meteo Hourly Weather]  [Citizen Science Reports]
            │                              │                           │
            ▼                              ▼                           ▼
[CopernicusSatelliteAdapter]    [OpenMeteoWeatherAdapter]     [CitizenScienceAdapter]
            │                              │                           │
            └──────────────────────────────┼───────────────────────────┘
                                           ▼
                       [ObservationIngestionService]
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
     1. Validation & Quality       2. Spatial Match              3. Deduplication
        (Physical bounds,             (Point-to-LineString          (SHA-256 Idempotent
         Cloud gate: 30%,              Stream Reach buffer)          Hash Key)
         Narrow stream warn)               │                             │
             │                             │                             │
             └─────────────────────────────┼─────────────────────────────┘
                                           ▼
                         [Persistence & Event Emission]
                                           │
                  ┌────────────────────────┴────────────────────────┐
                  ▼                                                 ▼
        [IObservationRepository]                          [IEventBus: ObservationReceived]
       (PostgreSQL / InMemory)                                      │
                                                                    ▼
                                                          [FHIR R4 Non-Blocking Mirror]
```

### 5.2 Environmental Adapters
1. **Satellite (`backend/src/adapters/satellite/`)**:
   - `CopernicusSatelliteAdapter`: Live client connecting to Copernicus Data Space Ecosystem (CDSE) OAuth and Statistical API for Sentinel-2 L2A (B04 Red 665nm, B05 RedEdge 705nm) computing $NDCI = \frac{B05 - B04}{B05 + B04}$.
   - `DemoSatelliteAdapter`: Realistic deterministic acquisitions for Greek pilot sites (Almyros Stream and Kladissos River).
   - Quality gates: Cloud cover contamination gate (flagged > 15%, rejected > 40%), narrow stream mixed-pixel warning for reaches < 20m width.
2. **Weather (`backend/src/adapters/weather/`)**:
   - `OpenMeteoWeatherAdapter`: Live client querying Open-Meteo hourly weather variables (`PRECIPITATION`, `AIR_TEMP`, `CLOUD_COVER`, `RELATIVE_HUMIDITY`, `WIND_SPEED`).
   - Strict preservation of hourly temporal resolution without premature averaging.
   - `DemoWeatherAdapter`: Deterministic hourly series fixtures.
3. **Citizen Science (`backend/src/adapters/citizen/`)**:
   - Community report normalization (`WATER_COLOR`, `ODOR`, `FOAM`, `DEAD_FISH`, `TURBIDITY`).
   - Preserves photographic media references in provenance and observation metadata.

### 5.3 Ingestion Service & Idempotency Pipeline
All adapters route through the canonical `ObservationIngestionService`:
- Deterministic SHA-256 deduplication key: `hash(source + ":" + sourceIdentifier + ":" + timestamp + ":" + indicator + ":" + (streamReachId || "UNASSOCIATED"))`.
- Prevents duplicate observations on repeated runs.
- Automatically associates points to monitored stream reach geometries within urban buffer limits.

---

## 6. Phase 3: Evidence Fusion Engine

### 6.1 Subsystem Overview & Closed-Loop Architecture
Phase 3 establishes the supervisory decision-support intelligence of AquaSentinel. It transforms raw environmental observations into explainable, mathematically sound evidence assessments without black-box ML or non-deterministic hallucinations.

```text
               [ObservationReceived Event]
                          │
                          ▼
             [EvidenceFusionService.handleObservation]
                          │
                          ▼
    ┌────────────────────────────────────────────────────────┐
    │              MULTI-SCALE EVIDENCE CORRELATOR           │
    │  ├─ SpatialCorrelator: Centerline distance & buffer   │
    │  ├─ TemporalCorrelator: Multi-scale temporal windows   │
    │  └─ QualityCorrelator: Reliability & confidence bounds │
    └─────────────────────┬──────────────────────────────────┘
                          │
                          ▼
    ┌────────────────────────────────────────────────────────┐
    │           CORROBORATION & CONTRADICTION ENGINE         │
    │  ├─ CorroborationAnalyzer: Source groups & bonuses     │
    │  ├─ BaselineService: Empirical median & deviations     │
    │  ├─ ContradictionDetector: Normal readings & runoff    │
    │  └─ MissingEvidenceAnalyzer: Gaps & field action       │
    └─────────────────────┬──────────────────────────────────┘
                          │
                          ▼
    ┌────────────────────────────────────────────────────────┐
    │             DETERMINISTIC SCORING ENGINE               │
    │  Score (0-100) = Anomaly + Baseline + Corroboration    │
    │                  + Spatial + Temporal - Penalties      │
    │  Operational Bands: NORMAL | VERIFY | INVESTIGATE      │
    │                     | PRIORITIZE                       │
    │  4-Part Rationale: Changed | Corroborates | Weakens   │
    │                    | Missing                           │
    └─────────────────────┬──────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
    [IEvidenceAssessmentRepository]   [IEventBus: EvidenceUpdated]
    (PostgreSQL / In-Memory)          (Feeds Phase 4 Incidents)
              │
              ▼
    [REST API: /api/v1/evidence-assessments]
              │
              ▼
    [Frontend Command Console: Evidence Fusion Page]
```

### 6.2 Mathematical Scoring Model & Transparent Formulation
The Evidence Confidence Score is bounded between 0 and 100:

$$\text{RawScore} = C_{\text{anomaly}} + C_{\text{baseline}} + C_{\text{corroboration}} + C_{\text{spatial}} + C_{\text{temporal}} - P_{\text{quality}} - P_{\text{contradiction}}$$

$$\text{EvidenceScore} = \max(0, \min(100, \text{round}(\text{RawScore})))$$

1. **Anomaly Contribution ($C_{\text{anomaly}}$)**:
   - Primary signal strength evaluated against baseline threshold: $18 \times \text{anomalyStrength}$ (capped at 18).
2. **Baseline Deviation Contribution ($C_{\text{baseline}}$)**:
   - Evaluated as $\min(10, \text{round}(\Delta_{\text{baseline}} \times 30))$.
   - If historical baseline is unavailable, $C_{\text{baseline}} = 0$ and the assessment status is flagged as `BASELINE_UNAVAILABLE`.
3. **Corroboration Contribution ($C_{\text{corroboration}}$)**:
   - Evaluates independent corroboration groups (`REMOTE_SENSING`, `CITIZEN`, `WEATHER`, `HISTORICAL_BASELINE`, `IN_SITU`).
   - Group caps prevent flooding by single source types (e.g. max 35 for remote sensing, max 15 for weather).
   - Diminishing returns multipliers within groups: $[1.0, 0.5, 0.1]$ for successive observations.
   - Independent multi-source bonus:
     - 2 independent groups: $+15$ pts
     - 3+ independent groups: $+25$ pts
4. **Spatial & Temporal Relevance ($C_{\text{spatial}}, C_{\text{temporal}}$)**:
   - Bounded relevance: $\text{HIGH} \to 5$ pts, $\text{MEDIUM} \to 3$ pts, $\text{LOW} \to 1$ pt.
5. **Quality Penalties ($P_{\text{quality}}$)**:
   - Narrow stream mixed-pixel penalty: $-10$ pts.
   - High cloud cover optical uncertainty: $-15$ pts.
   - Low sensor quality score: $-10$ pts.
6. **Contradiction Penalties ($P_{\text{contradiction}}$)**:
   - Conflicting normal reading within correlation window (e.g., concurrent NDCI < 0.10): $-25$ pts.
   - Healthy dissolved oxygen ($\ge 7.5\text{ mg/L}$): $-15$ pts.
   - Storm runoff explanation (heavy rain $\ge 15\text{ mm}$ with elevated turbidity): $-15$ pts.
   - Uncorroborated narrow-stream satellite anomaly: $-10$ pts.

### 6.3 Operational Confidence Bands
Assessments map strictly to deterministic decision bands:
- **0–39: NORMAL**: Baseline conditions or normal seasonal fluctuation. Routine monitoring maintained.
- **40–59: VERIFY**: Isolated anomaly (e.g., satellite-only) requiring verification. Automatic high-priority alarm is prohibited.
- **60–79: INVESTIGATE**: Multi-source corroboration confirmed (e.g., satellite + citizen report). Targeted inspection recommended.
- **80–100: PRIORITIZE**: Multi-source convergence (satellite + citizen + weather context). Immediate operational dispatch indicated.

### 6.4 Explainable Machine-Readable Rationale
Every assessment produces an `AssessmentRationale` object with 4 structured dimensions:
1. `whatChanged`: Explicit metric changes relative to typical conditions or thresholds.
2. `whatCorroborates`: Summary of agreeing independent sources and applied multi-source bonuses.
3. `whatWeakens`: Active quality flags, cloud cover gating, conflicting normal readings, or meteorological counter-explanations.
4. `whatIsMissing`: Actionable operational data gaps (e.g., in-situ probe needed, baseline unavailable, citizen verification required).

### 6.5 Demo Scenarios (Scenarios A – E)
- **Scenario A (Isolated Satellite Anomaly)**: Sentinel-2 NDCI anomaly on Almyros reach without ground confirmation. Scores in `VERIFY` band (~52/100).
- **Scenario B (Satellite + Citizen Corroboration)**: Eyewitness photo report confirms green film. Corroboration bonus elevates score into `INVESTIGATE` band (~74/100).
- **Scenario C (Satellite + Citizen + Weather)**: Sustained warm air temperature (+29.5°C) and zero rainfall corroborate eutrophic bloom conditions. Elevates score into `PRIORITIZE` band (~88/100).
- **Scenario D (Contradictory Evidence)**: Mixed-pixel satellite anomaly contradicted by concurrent normal NDCI (0.08). Contradiction penalty depresses score to `NORMAL` band (~0–20/100).
- **Scenario E (Missing Baseline)**: Assessment on reach without prior monitoring data explicitly reports `baselineStatus: "UNAVAILABLE"` with data-gathering guidance.

---

## 7. Phase 4 Architecture: Operational Response & Recommendation Engine

### 7.1 Supervisory Control Loop & Governance
Phase 4 implements deterministic operational response coordination, closing the loop:
$$\text{DATA (Phase 2)} \longrightarrow \text{INSIGHT (Phase 3)} \longrightarrow \text{DECISION (Phase 4)} \longrightarrow \text{ACTION (Phase 4)}$$

All generated recommendations initialize with `humanApprovalRequired: true` in `PENDING_REVIEW`. Non-autonomous dispatch is strictly enforced: municipal operators and lead scientists must sign off on physical interventions.

### 7.2 Core Engines
1. **Incident Classifier**: Maps Phase 3 evidence signatures into deterministic classifications (`POSSIBLE_CYANOBLOOM`, `POSSIBLE_SEWAGE_CONTAMINATION`, `POSSIBLE_INDUSTRIAL_DISCHARGE`, `POSSIBLE_STORMWATER_EVENT`, `POSSIBLE_EUTROPHICATION`, `ANOMALOUS_EVIDENCE_PATTERN`).
2. **Decoupled 5-Factor Operational Severity Engine**: Evaluates evidence confidence (25%), acute hazard severity (30%), human exposure potential (25%), public visibility (10%), and ecological impact (10%).
3. **OneAquaHealth Action Catalogue**: 10 authoritative measures linked to OneAquaHealth Work Packages (WP1 through WP5), ISO/EN standards, and responsible operational roles.
4. **7-Dimension Suitability Scoring & 5 Hard Safety Gates**: Evaluates evidence, incident, site, temporal, verification readiness, and operational feasibility compatibility while enforcing NORMAL band, VERIFY band, Single-Satellite Anomaly, contraindication, and prerequisite gates.
5. **Explainable 4-Question Rationale**: Formulates clear answers to *Why this measure?*, *Why now?*, *What evidence supports it?*, and *What is missing?*.
6. **Operational Task Lifecycle & Audit Trail**: Manages state transitions (`REQUESTED` $\rightarrow$ `ACCEPTED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED` $\rightarrow$ `VERIFIED`) with immutable logging and bi-directional HL7 FHIR R4 Task resource synchronization.

---

## 8. Phase 5 Architecture: Municipal Command Console & Real-Time Operational UX

### 8.1 Architectural Principles
Phase 5 transforms AquaSentinel into a unified operational console answering the 5 fundamental incident response questions:
1. *Where is it happening?* (Interactive SVG Geospatial Catchment Map)
2. *What is happening?* (Deterministic Hazard Classification & Severity)
3. *How strong is the evidence?* (Multi-source Evidence Fusion Breakdown & Lineage)
4. *What should happen next?* (Ranked Response Interventions & Suitability Scoring)
5. *What has already been done?* (Chronological Timeline & Strict Task State Machine)

### 8.2 Strict Architectural Invariants
1. **Zero Frontend Business Calculations**: The React frontend is strictly a presentation and interaction layer. Scores, severity ratings, rankings, and suitability dimension breakdowns are calculated exclusively by backend domain services.
2. **Server-Sent Events (SSE) Real-Time Transport**: Low-latency unidirectional event stream at `GET /api/v1/events/stream` backed by an in-memory `EventBus`, heartbeat pinging, automatic exponential backoff reconnection, and non-blocking delivery.
3. **End-to-End Cryptographic Provenance Lineage**: Complete visual verification path from raw observation to FHIR task via interactive modal diagrams (`Observation` $\rightarrow$ `EvidenceAssessment` $\rightarrow$ `Incident` $\rightarrow$ `Recommendation` $\rightarrow$ `Task` $\rightarrow$ `FHIR R4`).
4. **Accessible Colorblind-Safe Geospatial Cartography**: Stream reach coordinates projected into SVG viewport with distinct geometric shapes (Hexagon for Critical, Triangle for High, Diamond for Medium) ensuring WCAG 2.1 AA accessibility without color-only encoding.
5. **Supervised Human Review Gate**: Mandatory human sign-off on physical tasks with modal controls for `APPROVE`, `REJECT`, or `REQUEST MORE EVIDENCE`.
6. **Bi-directional HL7 FHIR R4 Interoperability**: Automatic synchronization status badges (`SYNCHRONIZED`, `PENDING`, `FAILED`) and raw/profile JSON resource inspector.

---

## 9. Phase 6 Architecture: Resilience Intelligence & Scenario Simulation

### 9.1 Predictive Domain Architecture
Phase 6 adds a forward-looking predictive resilience intelligence layer situated downstream of the evidence fusion engine and parallel to the operational response engine:
- **Time-Series Engine (`backend/src/domain/analytics/time-series-engine.ts`)**: Pure deterministic statistical engine computing OLS linear regression, EWMA smoothing, rolling standard deviations, and baseline deviation metrics.
- **Forecasting Engine (`backend/src/domain/analytics/forecasting-engine.ts`)**: Produces short-horizon projections (24h, 48h, 72h) across reference (`baseline-persistence`), empirical (`linear-trend-v1`), and damped trend (`ewma-damped-trend-v1`) models.
- **Strict Anti-Data-Leakage Barrier**: Strict temporal partition at forecast origin $T$. No observation with $t > T$ is visible or accessible to feature extractors or model estimators.
- **Multi-Signal Early-Warning Engine (`backend/src/domain/analytics/early-warning-engine.ts`)**: Evaluates forward-looking trajectory breaches and corroborates with multi-sensor environmental context (temperature, DO, turbidity, precipitation) before generating early warnings.
- **Scenario Simulation Engine (`backend/src/domain/analytics/scenario-engine.ts`)**: Evaluates counterfactual hypotheses across 5 canonical archetypes (`STATUS_QUO`, `ACCELERATED_DETERIORATION`, `NATURAL_ATTENUATION`, `METEOROLOGICAL_SHOCK`, `OPERATIONAL_INTERVENTION`) with explicit assumption auditing and step-by-step differential comparison.
- **Resilience Scorecard Engine (`backend/src/domain/analytics/resilience-scorecard.ts`)**: Evaluates 5 orthogonal dimensions without collapsing into an arbitrary single composite score.
- **Rolling Backtesting Engine (`backend/src/domain/analytics/backtesting-engine.ts`)**: Conducts temporal holdout backtests computing MAE, RMSE, and directional accuracy benchmarked against persistence baseline.
- **Resilience Analytics Service & Reactive Bus (`backend/src/services/analytics/resilience-analytics-service.ts`)**: Reactive coordinator subscribing to `ObservationReceived`, `EvidenceUpdated`, and `TaskStatusUpdated` events to refresh analytics and publish `ForecastGeneratedEvent`, `EarlyWarningTriggeredEvent`, and `ScenarioSimulatedEvent`.
- **FHIR R4 Extension**: Extends healthcare and public health interoperability by mapping early warnings to FHIR `Flag` resources and projected forecast horizon points to FHIR `Observation` resources.

---

## 10. Phase 7 Architecture: Event-Driven One Health Interoperability Platform

### 10.1 Interoperability Domain Architecture
Phase 7 establishes AquaSentinel as an enterprise-grade, event-driven One Health hub that bridges municipal water monitoring with downstream healthcare systems, public health portals, and regional crisis authorities.

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           AQUASENTINEL CORE                                            │
│                                                                                                        │
│  [Domain Event Sources]                                                                                │
│  • ObservationCreated     • EvidenceAssessmentUpdated   • IncidentCreated                              │
│  • IncidentSeverityChanged • RecommendationApproved      • TaskCreated / TaskCompleted                  │
│  • EarlyWarningCreated    • ForecastUpdated             • ScenarioCompleted                            │
│                                       │                                                                │
│                                       ▼                                                                │
│                       ┌───────────────────────────────┐                                                │
│                       │  Event Qualifier & Filter     │  (Suppresses raw noise, enforces thresholds,   │
│                       │  (EventQualifier.ts)          │   gating, & scientific proxy disclosures)      │
│                       └───────────────┬───────────────┘                                                │
│                                       │ Qualified Events Only                                          │
│                                       ▼                                                                │
│                       ┌───────────────────────────────┐                                                │
│                       │  FHIR R4 Mapper & Validator   │  (Observation, Flag, Task, DeviceMetric,       │
│                       │  (FhirMapper, FhirValidator)  │   OperationOutcome validation)                 │
│                       └───────────────┬───────────────┘                                                │
│                                       │ Validated FHIR Envelope                                        │
│                                       ▼                                                                │
│                       ┌───────────────────────────────┐                                                │
│                       │   Transactional Outbox DB     │  (PENDING status, idempotent UUIDv4 eventId,   │
│                       │   (IOutboxRepository)         │   atomic with domain state mutation)           │
│                       └───────────────┬───────────────┘                                                │
│                                       │                                                                │
│                                       │ Asynchronous Poll (every 1000ms)                               │
│                                       ▼                                                                │
│                       ┌───────────────────────────────┐                                                │
│                       │     Delivery Worker Engine    │                                                │
│                       │   (OutboxDeliveryWorker.ts)   │                                                │
│                       └───────────────┬───────────────┘                                                │
│                                       │                                                                │
│                   ┌───────────────────┴───────────────────┐                                            │
│                   │ REST-Hook Webhook Dispatcher          │                                            │
│                   │ (HMAC-SHA256 signature, bearer auth)  │                                            │
└───────────────────┼───────────────────────────────────────┼────────────────────────────────────────────┘
                    │ HTTP POST /webhook/fhir               │ HTTP POST /api/v1/interoperability/acknowledgements
                    ▼                                       ▲
┌───────────────────────────────────────────────────────────┴────────────────────────────────────────────┐
│                    EXTERNAL CONSUMER: Volos Public Health Portal (:3002)                               │
│                                                                                                        │
│  • Fully Decoupled Microservice (zero direct DB/model imports)                                         │
│  • Idempotency & Deduplication Engine (Set/hash tracking, DUPLICATE status handling)                   │
│  • Resource Processor & Action Dispatcher:                                                             │
│      - Flag (Incident/Warning)   → Public Health Advisory Issuance                                     │
│      - Task (Physical Action)    → Municipal Field Team Dispatch                                       │
│      - Observation (Sensor/Sat)  → Environmental Monitoring Registry Record                            │
│  • Downstream Acknowledgement Callback Client (delivers ackId, processingStatus, and action details)   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Architectural Guarantees & Invariants
1. **Decoupled Consumer Isolation**: The external consumer service (`consumer/`) operates as a completely independent process on port 3002. It shares zero memory, database connections, or domain repositories with AquaSentinel, communicating strictly via HTTP REST-hooks and standard HL7 FHIR R4 payloads.
2. **Scientific Proxy Disclosure Invariant**: Optical chlorophyll-a and NDCI metrics derived from Sentinel-2 satellite imagery represent bio-optical reflectance proxies, not clinical toxin or cyanotoxin diagnostic assays. Every qualified satellite event, outbox payload, and FHIR resource envelope carries an explicit `scientificProxyDisclosure` warning and structured FHIR `Provenance` metadata referencing Sentinel-2 MSI L2A algorithm lineage.
3. **Transactional Outbox & At-Least-Once Delivery**: To eliminate dual-write hazards, domain events intended for external distribution are written into the persistent `outbox_events` table within the same transaction as local state changes. A resilient polling `DeliveryWorker` guarantees delivery with exponential backoff retries ($200\text{ms} \times 2^{\text{attempt}}$ plus jitter) and transitions failed payloads to `DEAD_LETTER` upon reaching max retries.
4. **Non-Destructive Manual Replay**: Dead-lettered events can be manually replayed by authorized supervisors via the Command Console or REST API. Replay resets status to `PENDING` and preserves the stable original `eventId`, ensuring downstream consumers recognize replayed items through their existing idempotency filters.
5. **Downstream Idempotency Defense**: The external consumer maintains a durable event registry. Incoming events with already-processed `eventId`s are safely acknowledged as `DUPLICATE` without re-triggering municipal field actions.
6. **Immutable Interoperability Audit Trail**: Every outbound dispatch, HTTP transmission, failure, retry, dead-letter transition, replay, and inbound acknowledgment is recorded into `interoperability_audit_log` with timestamps, actor metadata, and cryptographic hashes.

---

## 11. Phase 8: Closed-Loop Operational Response Subsystem

### 11.1 Architecture & Feedback Loop
Phase 8 closes the supervisory control loop by establishing a bidirectional link between municipal decision recommendations and physical ground verification:

```text
┌─────────────────────────┐       ┌─────────────────────────┐       ┌─────────────────────────┐
│ Remote Sensing Anomaly  │ ────► │ Recommendation Approval │ ────► │ Field Task Assignment   │
│ (Sentinel-2 / In-Situ)  │       │ & Task Generation       │       │ (FieldActor / Role)     │
└─────────────────────────┘       └─────────────────────────┘       └────────────┬────────────┘
                                                                                 │
┌─────────────────────────┐       ┌─────────────────────────┐       ┌────────────▼────────────┐
│ Outcome Confirmation &  │ ◄──── │ Bayesian Reassessment   │ ◄──── │ In-Situ Ground Truth    │
│ Outbox Interoperability │       │ & OutcomeEngine Propos. │       │ & Geofence Validation   │
└─────────────────────────┘       └─────────────────────────┘       └─────────────────────────┘
```

### 11.2 Core Architectural Components
1. **GeofenceValidator**: Computes great-circle Haversine distance between reported GPS coordinates and reach centroid. Classifies positions as `AT_LOCATION` ($\le 50\text{m}$), `NEAR_LOCATION` ($50-250\text{m}$), or `OUTSIDE_EXPECTED_AREA` ($> 250\text{m}$).
2. **OutcomeEngine (`OUTCOME_RULE_V1`)**: Generates deterministic, explainable operational outcome proposals (`CONFIRMED`, `NOT_CONFIRMED`, `UNCERTAIN`, `ESCALATE`, `ADDITIONAL_VERIFICATION_REQUIRED`) based on multi-source evidence assessments and ground-truth observations.
3. **Task State Machine**: Enforces valid lifecycle transitions from `DRAFT` through `APPROVED`, `ASSIGNED`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, to `VERIFIED`.
4. **Idempotent Synchronization**: Utilizes client-assigned UUIDv4 tokens (`clientSubmissionId`) to guarantee safe, idempotent offline verification uploads and prevent duplicate observations.
5. **Phase 7 Outbox Integration**: Directly qualifies closed-loop events (`VerificationCompleted`, `IncidentConfirmed`, `IncidentNotConfirmed`, `IncidentEscalated`, `AdditionalVerificationRequired`), converts them to HL7 FHIR R4 resources (`Observation`, `Flag`, `Task`), and dispatches them via the transactional outbox.

