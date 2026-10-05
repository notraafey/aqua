# System Limitations & Engineering Disclosure: AquaSentinel

AquaSentinel is built as an advanced, production-grade release candidate for the Track 7 hackathon. To ensure complete technical credibility, this document provides an honest, rigorous engineering disclosure of the platform's current prototype boundaries, architectural assumptions, and production roadmap.

---

## 1. Prototype Limitations

### Local Execution & Multi-Process Orchestration
- In the local development environment (`npm run dev:all`), the frontend (Vite, port 5173), backend (Express/TypeScript, port 3001), and external consumer (Express/TypeScript, port 3002) run as separate Node.js processes.
- While Docker Compose (`docker-compose.yml`) orchestrates containerized PostgreSQL/PostGIS and services, the local development setup can run with zero external services using in-memory repositories.

### Simulated Cloud Storage for Media
- Photomicrographs and field inspection attachments store cryptographic SHA-256 hashes and data URLs locally or in memory. An enterprise deployment would store raw image binaries in an S3/MinIO bucket with presigned URLs and retain only the SHA-256 CID on-chain or in the relational record.

---

## 2. Mock vs Live Integrations

| Data Stream / Service | Current Prototype Implementation | Live Production Implementation |
|---|---|---|
| **Satellite Imagery** | Deterministic recorded Sentinel-2 Level-2A surface reflectance tiles for Volos / Pagasetic Gulf; synthetic cloud-cover perturbation. | Direct webhook ingestion from European Space Agency (ESA) Copernicus Data Space Ecosystem API. |
| **River Sensors** | Hybrid: Live USGS Water Services API client implemented (`USGSAdapter`), with deterministic replay fixture fallback for zero-network environments. | Continuous MQTT / TLS IoT sensor broker ingestion with hardware anomaly detection. |
| **Weather & Meteorological** | Deterministic NOAA Global Forecast System (GFS) precipitation and wind vectors. | Live NOAA National Weather Service (NWS) API polling with rainfall radar Doppler radar fusion. |
| **Clinical Surveillance** | Deterministic epidemiological syndrome reporting (ICD-10 gastroenteritis emergency admissions). | Automated HL7 v2 / FHIR `Condition` feed from regional hospital electronic health record (EHR) systems. |
| **Healthcare Consumer** | Standalone Volos Public Health Portal (`consumer/`) running on port 3002 with full webhook signature verification. | Municipal public health and Civil Protection incident management dispatch platforms. |

---

## 3. Scientific & Algorithmic Limitations

### 1D vs Multi-Dimensional Hydrodynamic Transport
- AquaSentinel's hydrodynamic plume propagation uses a **1D physics-informed advection-dispersion equation**:
  $$\frac{\partial C}{\partial t} + u \frac{\partial C}{\partial x} = D \frac{\partial^2 C}{\partial x^2} - k C$$
- **Limitation**: While well-suited for confined river reaches and stream networks, 1D modeling does not resolve vertical stratification, wind-driven surface circulation, or bathymetric boundary effects in open transitional waters (e.g. the inner Pagasetic Gulf).
- **Production Path**: Couple river reach mouths to 2D/3D numerical hydrodynamic engines (such as Delft3D or HEC-RAS 2D) for estuarine and coastal dispersion.

### Optical Proxy Invariants
- Optical chlorophyll-a and NDCI algorithms are **proxies**, not direct toxin measurements. High turbidity or floating macrophytes (duckweed) can cause false positives in optical satellite data.
- AquaSentinel addresses this by strictly classifying satellite data as `source: SATELLITE` with mandatory proxy disclosure notes in FHIR resources, requiring ground-truth field inspection before high-confidence confirmation.

---

## 4. Geospatial & Topological Limitations

### Stream Reach Resolution
- The regional hydrological graph models 6 primary reaches of the Volos / Pagasetic Gulf catchment (`reach-001` through `reach-006`).
- **Limitation**: Sub-tributary micro-drainage channels, ephemeral stormwater ditches, and urban stormwater pipes are not currently modeled in the reach graph.
- **Production Path**: Ingest complete HydroSHEDS or EU-Hydro high-resolution digital elevation stream flow networks.

### Geofencing Assumptions
- Field inspection geofencing computes distances using the Haversine great-circle formula:
  - $< 50\text{ m}$: Validated on-site.
  - $50\text{ m} - 250\text{ m}$: Warning flag emitted (possible riverbank access offset).
  - $> 250\text{ m}$: Ingestion rejected with `GEOFENCE_VIOLATION`.
- **Limitation**: In deep canyons or steep riparian ravines, inspectors may legitimately be forced to sample from an accessible bridge 300m away.
- **Production Path**: Implement reach-buffered polygon geofences rather than single-point radii.

---

## 5. Security & Authentication Boundaries

### Hackathon Scoping
- In demo/development mode, API endpoints do not enforce JWT Bearer authorization on every internal route to facilitate frictionless evaluation.
- The external webhook receiver (`consumer/`) demonstrates production-grade security:
  - Mandatory HMAC-SHA256 signature verification (`X-AquaSentinel-Signature`) using a shared secret.
  - Timestamp replay protection (`X-AquaSentinel-Timestamp` within 300 seconds).

### Production Path
- Implement OAuth2 / OpenID Connect with Role-Based Access Control (RBAC):
  - `operator`: View evidence, approve tasks, issue advisories.
  - `field_inspector`: View assigned tasks, submit mobile verifications.
  - `supervisor`: Resolve incidents, override model recommendations, configure outbox endpoints.
  - `auditor`: Read-only access to immutable audit trails and provenance logs.

---

## 6. Scalability & High-Throughput Boundaries

### Transactional Outbox Polling
- The current outbox delivery worker uses a database polling interval (default 1000ms) with row locking (`SELECT FOR UPDATE SKIP LOCKED` in PostgreSQL; mutex in memory).
- **Limitation**: High outbox volume (>10,000 events/second) would incur database polling overhead.
- **Production Path**: Transition the outbox publisher to change-data-capture (CDC) using PostgreSQL logical replication (Debezium) into Apache Kafka or AWS SQS.

### Storage Persistence Modes
- In demo mode, in-memory repositories hold all state. A process restart wipes state unless PostgreSQL is active.
- To provide deterministic evaluator control, `npm run demo:reset` (or `POST /api/v1/demo/reset`) provides an instant sub-second reset of both PostgreSQL and in-memory databases.
