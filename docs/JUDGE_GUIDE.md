# AquaSentinel: Judge & Evaluator Guide

Welcome to the **AquaSentinel** Hackathon Evaluation Guide. This document provides an executive summary and technical walkthrough of the platform, explaining what it does, why it matters, how it works, and how to verify its claims.

---

## 1. Problem Statement
Freshwater basins and coastal transitional waters worldwide face intensifying threats from industrial effluents, agricultural runoff, sewage leaks, and harmful cyanobacterial algal blooms (HABs). 

Currently, environmental and public health monitoring operate in disconnected silos:
- **Satellite remote sensing** (e.g., Copernicus Sentinel-2) detects optical chlorophyll-a and turbidity anomalies, but cannot determine toxicity or chemical species.
- **In-situ sensor networks** (e.g., USGS river gauges) provide high-frequency telemetry at discrete points, but lack spatial coverage across entire river reaches.
- **Clinical health surveillance** detects gastroenteritis spikes days or weeks later, with zero automated linkage back to upstream catchment incidents.
- **Field response teams** are dispatched via ad-hoc phone calls or spreadsheets without geofenced verification, sample custody tracking, or real-time closed-loop feedback.

When an incident occurs, public health advisories are delayed, uncoordinated, or issued on unverified remote alarms, leading either to severe community contamination or costly false-alarm panic.

---

## 2. Why It Matters
Waterborne pathogens and cyanotoxins (e.g., microcystin) can cause severe human morbidity, liver failure, and aquatic ecosystem collapse within 24–48 hours of exposure. Downstream drinking water intakes, agricultural irrigation networks, and municipal beaches (such as the Pagasetic Gulf in Volos, Greece) require early detection with quantifiable uncertainty. 

Preventing a public health crisis requires moving from passive, fragmented monitoring to **proactive, verifiable, closed-loop environmental intelligence**.

---

## 3. What AquaSentinel Does
AquaSentinel is an end-to-end environmental intelligence and public health early-warning platform that:
1. **Fuses heterogeneous real-time streams**: Satellite optical indices (NDCI, turbidity), river sensors (DO, pH, temperature, conductivity), weather telemetry (rainfall, wind), and clinical symptom surveillance.
2. **Propagates hydrodynamics**: Simulates downstream pollutant transport along river reaches using physics-informed 1D advection-dispersion modeling with estimated arrival times.
3. **Quantifies uncertainty**: Applies multi-source Bayesian evidence fusion and calibrated anomaly scoring, penalizing isolated remote detections to suppress false positives.
4. **Enforces human-in-the-loop governance**: Demands authorized operator approval before dispatching field inspections or issuing public advisories.
5. **Orchestrates closed-loop field verification**: Dispatches field actors with geofenced mobile verification, evidentiary photo provenance (SHA-256 hashes), and physical water sample custody tracking.
6. **Reassesses and learns**: Ingests ground-truth observations to automatically confirm or refute incidents, updating confidence scores and dynamically driving response escalation or false-alarm suppression.
7. **Bridges environmental and clinical systems**: Emits HL7 FHIR R4 resources (`Observation`, `Flag`, `ServiceRequest`, `Subscription`) via a transactional outbox pattern to external public health consumers.

---

## 4. Why Multiple Evidence Sources Matter
No single sensor or satellite can deliver reliable environmental decision intelligence:
- **Satellite imagery** suffers from cloud cover, 5-day revisit cycles, and optical artifacts. A high Normalized Difference Chlorophyll Index (NDCI) may indicate a severe algal bloom or merely harmless floating duckweed.
- **In-situ telemetry** is vulnerable to sensor biofouling, electronic drift, and localized point-source anomalies that do not represent river-wide contamination.
- **Weather data** provides context (e.g., heavy rain triggering agricultural runoff), but cannot measure water quality directly.

AquaSentinel uses a **Bayesian Evidence Fusion Engine** that computes composite risk scores only when multiple independent sources corroborate the anomaly. A remote optical alert that lacks in-situ sensor deviation or clinical corroboration is flagged with a high false-alarm penalty, preventing knee-jerk panic. Conversely, when optical NDCI, dissolved oxygen depression, and downstream gastrointestinal emergency visits align, composite confidence surges to critical levels.

---

## 5. Why Human Oversight Exists
Environmental and public health actions carry legal, economic, and social consequences:
- Declaring a municipal water advisory shuts down drinking water intakes, closes public beaches, and halts agricultural irrigation.
- Dispatched field technicians operate in hazardous river basins and remote catchments with constrained municipal budgets.

**AquaSentinel adheres to strict Human-in-the-Loop (HITL) principles**:
- The AI / algorithmic layer acts purely as **decision support**: synthesizing data, modeling plumes, computing confidence, and proposing tiered recommendations (`DISPATCH_INSPECTOR`, `ISSUE_BOIL_WATER_ADVISORY`, `SAMPLE_INTAKE`).
- **No public health alert or physical dispatch is ever executed autonomously.** An authorized human operator must review the synthesized evidence chain, examine the hydrodynamic plume forecast, and explicitly authorize or reject the proposed action.
- Every operator decision is recorded in an append-only audit log with UTC timestamps and cryptographic provenance.

---

## 6. What Is Technically Novel
AquaSentinel does not claim novelty in existing standards like FHIR, Docker, or React. The novelty lies in the **end-to-end integration and closed-loop fusion**:
- **Bidirectional Environmental-Clinical Bridge**: Translating remote geospatial hydrological anomalies directly into standard HL7 FHIR R4 clinical resources (`Observation` with LOINC/SNOMED coding and explicit satellite proxy disclosures).
- **Closed-Loop Ground-Truth Reassessment**: Physical field inspections do not just sit in an audit log; they feed directly back into the live Bayesian scoring engine, mathematically refuting or confirming remote sensing detections.
- **Guaranteed At-Least-Once Transactional Outbox**: Eliminating dual-write inconsistency between relational state mutations and external health authority webhook notifications, backed by dead-letter queues (DLQ) and replayability.
- **Strict Evidence Calibration**: Enforcing mathematical separation between raw observations, calibrated anomaly scores, and operational incident lifecycles.

---

## 7. How FHIR Is Used
AquaSentinel models environmental risk into healthcare-interoperable HL7 FHIR R4 resources:
- **`Observation`**: Represents water quality metrics. When translating satellite optical proxies (NDCI, Chlorophyll-a), AquaSentinel enforces an **explicit proxy disclosure invariant** in `Observation.note`, disclosing sensor provenance (Sentinel-2 MSI), spatial resolution (10m), and cloud cover percentage. Standard LOINC codes (`14627-4` for water bicarbonate, custom LOINC/SNOMED extension profiles for NDCI) are attached.
- **`Flag`**: Represents active water quality advisories (e.g., `BOIL_WATER`, `RECREATIONAL_CONTACT_WARNING`) with severity mappings (`critical`, `high`, `moderate`).
- **`ServiceRequest`**: Represents physical sampling requests and laboratory assay requisitions.
- **`Subscription`**: Models external public health consumer subscriptions (rest-hook channel with criteria e.g. `Observation?code=48005-3`).

---

## 8. How Event-Driven Interoperability Works
To notify external hospital information systems (HIS), regional health portals, and municipal dashboards without tight coupling:
1. When domain events occur (e.g. `IncidentConfirmed`, `VerificationCompleted`, `AdvisoryIssued`), the **Event Qualifier** evaluates qualification rules against severity and confidence thresholds.
2. Qualified events are converted into FHIR resources and persisted into the **Transactional Outbox table** (`outbox_events`) in the same atomic database transaction as the domain state change.
3. The asynchronous **Outbox Delivery Worker** polls or consumes the queue, executing HTTP POST webhooks with exponential backoff (1s, 2s, 4s), jitter, and SHA-256 HMAC signature headers.
4. If an external endpoint suffers an extended outage, events transition to a **Dead-Letter Queue (DLQ)**. Operators can trigger manual or bulk replay via the REST API or UI once the external consumer recovers.

---

## 9. How Field Verification Closes the Loop
When a remote anomaly is flagged, AquaSentinel dispatches an operational task to a field inspector. The mobile-responsive field inspection flow operates as follows:
1. **Geofence Validation**: The inspector's device GPS coordinates are validated against the river reach target location (Haversine formula; warnings if >50m, rejection if >250m).
2. **Structured Ground Truth**: The inspector records physical water color, odor, dead aquatic life, foam, and weather conditions.
3. **Photographic & Physical Chain of Custody**: Photo evidence is captured with SHA-256 integrity hashes; physical sample containers are cataloged with barcode references and lab transport status.
4. **Automated Reassessment**: Upon submission:
   - If confirmed: Incident confidence escalates to >90%, triggering proposed public health advisories.
   - If refuted (e.g., harmless surface duckweed detected): Anomaly confidence is penalized, the incident is closed as a false alarm, and downstream alerts are suppressed.

---

## 10. What the Demo Proves
The AquaSentinel demonstration proves:
1. **Deterministic Reproducibility**: The entire system can be reset in milliseconds (`npm run demo:reset` or UI button), returning to a clean, calibrated baseline.
2. **End-to-End Golden Path**: Complete execution from multi-sensor anomaly detection → advection-dispersion forecast → clinical correlation → human dispatch → mobile field verification → closed-loop reassessment → FHIR R4 outbox delivery to a standalone external health portal.
3. **Resilience & Fault Tolerance**: External consumer outages, retries, exponential backoff, deduplication, and DLQ replay operate deterministically under live failure conditions.

---

## 11. What Is Prototype vs Production-Ready

| Capability | Current Prototype State | Production Roadmap |
|---|---|---|
| **Data Ingestion** | Deterministic recorded & synthetic USGS, Sentinel-2, and NOAA streams; live USGS Water Services client. | Continuous Copernicus Hub webhook ingestion; automated satellite image cloud-masking pipeline. |
| **Hydrodynamic Modeling** | 1D Physics-informed advection-dispersion equation with reach-specific velocity and dispersion coefficients. | Full 2D/3D numerical hydrodynamic coupling (Delft3D / HEC-RAS) for complex estuarine currents. |
| **Storage & Spatial** | Dual-mode: PostGIS 16 for production; in-memory geospatial repositories for zero-dependency local demo. | Distributed PostGIS cluster with spatial partitioning and time-series hypertables (TimescaleDB). |
| **Messaging & Outbox** | Transactional database outbox poller with exponential backoff and DLQ. | Distributed event streaming broker (Apache Kafka / AWS SQS) for enterprise-scale throughput. |
| **FHIR Conformance** | Fully valid HL7 FHIR R4 schemas (`Observation`, `Flag`, `ServiceRequest`, `Subscription`) with HAPI FHIR validation. | Formal SMART on FHIR OAuth2 scoping and HL7 US Core / European Interoperability profile certification. |
