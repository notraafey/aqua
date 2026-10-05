# AquaSentinel: Canonical 5-Minute Demonstration Runbook & Video Recording Script

> **Purpose**: This runbook provides the verbatim stage-by-stage operator guide, action cues, and narration script for recording the 5-minute hackathon/demo video. It exercises the **real, production-grade application architecture and domain engines** without mock shortcuts or synthetic UI facades.

---

## 1. Quickstart & Recording Environment Setup

### 1.1 Localhost Startup

In three terminal tabs (or in a single terminal via `npm run dev:all`), launch the core services:

```bash
# Terminal 1: External Health Consumer (Volos Public Health Portal)
npm run dev:consumer
# Running at http://localhost:3002

# Terminal 2: AquaSentinel Backend API Server & Orchestration Engine
npm run dev --workspace=backend
# Running at http://localhost:3001

# Terminal 3: AquaSentinel Command Console (Frontend)
npm run dev:frontend
# Running at http://localhost:5173
```

*(Alternatively, run all 3 simultaneously: `npm run dev:all`)*

### 1.2 Verify Services
- **Command Console**: Open [`http://localhost:5173`](http://localhost:5173) in Chrome, Edge, or Safari (recommended 1920x1080 resolution, 100% zoom).
- **Backend Health**: Verify [`http://localhost:3001/api/health`](http://localhost:3001/api/health) returns `status: "healthy"`.
- **Consumer Health**: Verify [`http://localhost:3002/health`](http://localhost:3002/health) returns `status: "healthy"`.

### 1.3 Instant Baseline Reset
At the start of any rehearsal or final recording run:
- **Click "Reset Baseline"**: Click the prominent **"Reset Baseline"** button in the top docked **Incident Lifecycle Controller** bar.
- The system will immediately restore a clean surveillance baseline in **< 10 milliseconds** and automatically navigate to **Water Network → Almyros Stream Reach Alpha**.

---

## 2. Authoritative 5-Minute Video Recording Script

### 0:00–0:40 — OPENING / WHY AQUASENTINEL
- **ON SCREEN**: Start on clean AquaSentinel localhost (`http://localhost:5173`). Do not immediately start clicking around.
- **YOU SAY**:
  > *"Hi, and welcome to AquaSentinel. What we built is a closed-loop environmental intelligence and response platform for freshwater systems.*
  >
  > *The idea started with a question we encountered while researching environmental and agricultural risk: when you see a signal, how do you know when it actually matters?*
  >
  > *We found that question repeatedly in water-quality research. In particular, research around citizen science and remote sensing showed us that individual observations can be valuable, but each has limitations when used alone.*
  >
  > *So we built AquaSentinel around a different principle: don't just detect an anomaly—corroborate it, explain it, act on it, verify it, and learn from what happened.*
  >
  > *In this demo, I'll show that entire lifecycle, from the first satellite signal to a verified field outcome and interoperable FHIR delivery.”*
- **ACTION**: Click **Reset Baseline**.
- **YOU SAY**:
  > *“And we're starting from a completely clean operational state.”*

---

### 0:40–0:55 — STAGE 01: BASELINE
- **ACTION**: Open **Water Network → Almyros Stream Reach Alpha** (`RCH-7a3b`).
- **YOU SAY**:
  > *“We're looking at a monitored stream reach in the Volos catchment. At baseline, the system sees normal conditions: historical dissolved oxygen is around 8.2 milligrams per liter, and the chlorophyll proxy remains below 0.15.”*
- **POINT TO**: `NORMAL` status badge & Surveillance Baseline State card.
- **YOU SAY**:
  > *“So there is no reason to intervene.”*

---

### 0:55–1:12 — STAGE 02: SENTINEL-2 SIGNAL
- **ACTION**: Click **Advance Step** (Button: `1. Ingest Sentinel-2 Signal`).
- **YOU SAY**:
  > *“Now a Copernicus Sentinel-2 observation arrives. Our satellite ingestion pipeline detects an NDCI anomaly of 0.28.”*
- **PAUSE**.
- **YOU SAY**:
  > *“But here's the important part: AquaSentinel does not call that contamination.”*
- **POINT TO**: `NDCI 0.28`.
- **YOU SAY**:
  > *“It's an optical environmental proxy—not a pathogen detector and not ground truth.”*

---

### 1:12–1:32 — STAGE 03: FIRST EVIDENCE ASSESSMENT
- **ACTION**: Open **Evidence Assessments → Quality & Uncertainty** (or click deep link `Evidence Fusion`).
- **YOU SAY**:
  > *“The evidence engine initially scores this at just 25%, keeping it in the NORMAL band.”*
  >
  > *“Why? AquaSentinel accounts for spatial and temporal relevance and applies a narrow-stream mixed-pixel uncertainty penalty to the satellite observation.”*
  >
  > *“So one imperfect signal doesn't trigger a municipal response.”*
- **POINT TO**: `25%`, penalty (`narrow_stream_mixed_pixel`), proxy disclosure warning.
- **YOU SAY**:
  > *“We're deliberately building a system that knows when not to act.”*

---

### 1:32–1:48 — STAGE 04: CORROBORATION
- **ACTION**: Click **Advance Step** (Button: `2. Ingest Ground Corroboration`).
- **YOU SAY**:
  > *“Now independent evidence arrives.”*
  >
  > *“An in-situ YSI sonde records dissolved oxygen at 2.6 milligrams per liter. The weather station records 31.8 degrees Celsius. And a citizen reports dense surface scum and malodor.”*
- **POINT TO**: The observations list cards.
- **YOU SAY**:
  > *“Now we're no longer looking at one anomalous pixel. We're looking at multiple independent signals describing the same place and time.”*

---

### 1:48–2:03 — STAGE 05: EVIDENCE FUSION
- **ACTION**: Stay on **Evidence Assessments**. Show the score changing.
- **YOU SAY**:
  > *“This is where AquaSentinel's core intelligence operates.”*
  >
  > *“The spatial-temporal correlator confirms that these observations overlap in both location and time. Independent source groups corroborate one another, triggering our +15-point corroboration bonus.”*
  >
  > *“The resulting confidence jumps from 25% to 91%—PRIORITIZE.”*
- **POINT TO**: `91%` score badge & 8-factor breakdown.
- **YOU SAY**:
  > *“Every point isn't just a black-box prediction. The system can show what supports the assessment, what weakens it, and why the score changed.”*

---

### 2:03–2:16 — STAGE 06: CLASSIFICATION
- **ACTION**: Open **Incident Queue → Active Incident** (or click deep link `Incidents`).
- **YOU SAY**:
  > *“At 91%, the incident classifier now characterizes this as a high-severity algal bloom and moves it into an actionable state.”*
- **POINT TO**:
  - `ALGAL_BLOOM` (hazard badge)
  - `HIGH` (severity badge)
  - `ACTION_RECOMMENDED` (incident state)
- **YOU SAY**:
  > *“The system has gone from raw environmental observation to an operationally classified event.”*

---

### 2:16–2:30 — STAGE 07: RESPONSE ENGINE
- **ACTION**: Open recommendation card under the active incident.
- **YOU SAY**:
  > *“The Response Engine now evaluates the incident against our intervention catalogue and operational constraints.”*
  >
  > *“For this event, it recommends mechanical aeration and containment booms.”*
- **POINT TO**: Recommendation rationale cards (`Why This`, `Why Now`, `What Supports It`, `What Is Missing`).
- **YOU SAY**:
  > *“But critically, the recommendation is still PENDING REVIEW.”*

---

### 2:30–2:43 — STAGE 08: HUMAN DECISION
- **ACTION**: Click **Review & Approve** on the recommendation (or click `Advance Step` in controller).
- **YOU SAY**:
  > *“AquaSentinel doesn't autonomously send a municipal crew into the field.”*
  >
  > *“A supervisor reviews the evidence, enters the operational rationale, assigns priority and authorizes the response.”*
- **ACTION**: Click **Approve**.
- **YOU SAY**:
  > *“One human decision now turns an analytical recommendation into an operational task.”*

---

### 2:43–2:57 — STAGE 09: OPERATIONAL TASK + FHIR
- **ACTION**: Go to **Response Operations → Tasks** (or click deep link `Response Tasks`).
- **YOU SAY**:
  > *“The approval immediately creates a real operational task.”*
  >
  > *“And at the same time, AquaSentinel maps that action into an HL7 FHIR R4 Task.”*
- **POINT TO**: `REQUESTED` badge, Assignee (Alex Rivera), FHIR Resource ID.
- **YOU SAY**:
  > *“So interoperability isn't a report we export after the fact. It is part of the operational transaction itself.”*

---

### 2:57–3:15 — STAGE 10: FIELD OPERATIONS
- **ACTION**: Click **Advance Step** (Button: `5. Deploy Field Crew`).
- **YOU SAY**:
  > *“The assigned inspector accepts the task and begins the field operation.”*
  >
  > *“Before accepting ground evidence, the backend validates the inspector's coordinates against the monitored reach using a Haversine geofence.”*
- **POINT TO**: `≤50m` geofence badge on task inspection panel.
- **YOU SAY**:
  > *“That means the system isn't just accepting a form—it is validating that the reported inspection actually occurred where the incident was detected.”*

---

### 3:15–3:30 — STAGE 11: GROUND TRUTH
- **ACTION**: Open inspection drawer / submission panel.
- **YOU SAY**:
  > *“The inspector now submits structured ground evidence: green-brown water, dense surface scum, and four dead fish.”*
  >
  > *“The observation payload is fingerprinted with SHA-256 to preserve provenance.”*
- **POINT TO**: SHA-256 evidence fingerprint, dead fish count: 4, water appearance: green-brown.
- **YOU SAY**:
  > *“And now comes the most important part of the entire system.”*

---

### 3:30–3:48 — STAGE 12: CLOSED LOOP
- **ACTION**: Click **Advance Step** and go back to **Evidence Assessments**.
- **YOU SAY**:
  > *“This field inspection doesn't disappear into a separate database.”*
  >
  > *“It becomes a first-class observation and goes back through the same evidence-fusion pipeline.”*
  >
  > *“The new ground evidence pushes confidence to 100%, and the outcome engine proposes CONFIRMED.”*
- **PAUSE**.
- **YOU SAY**:
  > *“We didn't confirm the incident because our original model said so. We confirmed it because the field evidence independently came back and changed the evidence state.”*

---

### 3:48–4:00 — STAGE 13: SUPERVISED OUTCOME
- **ACTION**: Incident → **Confirm Outcome** (or click `Advance Step`).
- **YOU SAY**:
  > *“The supervisor now reviews the ground verification and formally confirms the outcome.”*
- **ACTION**: Confirm.
- **YOU SAY**:
  > *“That decision is recorded with its audit trail and emitted as a domain event.”*

---

### 4:00–4:22 — STAGE 14: FHIR + OUTBOX + SECURITY
- **ACTION**: Open **Interoperability Hub** (click deep link `FHIR Outbox`).
- **YOU SAY**:
  > *“Now let's look underneath the operational workflow.”*
  >
  > *“AquaSentinel uses a transactional outbox, so database state and interoperability events aren't left vulnerable to a failed synchronous network call.”*
  >
  > *“The confirmed incident is represented as FHIR R4 resources, queued for delivery, and signed using HMAC-SHA256.”*
- **POINT TO**:
  - Outbox table
  - FHIR Flag resource
  - Observation resource
  - HMAC-SHA256 signature header (`x-aquasentinel-signature`)
- **YOU SAY**:
  > *“So we have standards compliance, durable event delivery, and cryptographic message authentication in the same pipeline.”*

---

### 4:22–4:38 — STAGE 15: EXTERNAL CONSUMER
- **ACTION**: Click **Advance Step** (Button: `8. Deliver Interoperability Webhook`) to show delivered status / consumer terminal.
- **YOU SAY**:
  > *“That event now leaves AquaSentinel and reaches our decoupled external public-health consumer.”*
  >
  > *“The consumer verifies the HMAC signature, checks the idempotency key to prevent duplicate processing, accepts the FHIR resource, and returns an acknowledgement.”*
- **POINT TO**:
  - `ACCEPTED` / `ACKNOWLEDGED` receipt
  - `DELIVERED` status badge
- **YOU SAY**:
  > *“AquaSentinel records the complete transmission lineage back in its audit system.”*

---

### 4:38–4:55 — FINAL SYSTEM VIEW
- **ACTION**: Go to **System Health / Overview** (click deep link `System Health`). Do not start clicking random pages.
- **YOU SAY**:
  > *“And that's the complete lifecycle.”*
  >
  > *“A satellite signal became corroborated evidence; evidence became an incident; the incident became a human-approved intervention; the intervention became a FHIR task; the field operation generated new ground truth; that ground truth changed the assessment; and the verified outcome was delivered to another system.”*
- **THE PUNCHLINE**:
  > *“That's the difference between a water-quality dashboard and AquaSentinel: we don't stop at detecting a problem. We connect detection, decision, action, verification, and interoperability into one auditable loop.”*

---

### 4:55–5:00 — CLOSE
- **YOU SAY**:
  > *“AquaSentinel turns environmental intelligence into accountable action. Thank you.”*
- **STOP**. Do not keep talking.

---

## 3. Operator Cheat Sheet & Quick Navigation Table

| Time | Action | Where to Click | Key Visual Cue to Point To |
|---|---|---|---|
| **0:00–0:40** | Clean start & Reset | Top bar: **Reset Baseline** | Toast: Clean baseline initialized in < 10ms |
| **0:40–0:55** | Baseline State | **Water Network** → RCH-7a3b | `NORMAL` status, DO ~8.2 mg/L, NDCI < 0.15 |
| **0:55–1:12** | Satellite Signal | Top bar: **Advance Step** | Sentinel-2 NDCI = 0.28 optical proxy |
| **1:12–1:32** | Restraint Score | **Evidence Assessments** | Score: `25%` (NORMAL), narrow stream penalty |
| **1:32–1:48** | Ground Corroboration | Top bar: **Advance Step** | In-situ DO 2.6 mg/L, Temp 31.8°C, Citizen Scum |
| **1:48–2:03** | Fused Intelligence | Stay on Evidence Assessments | Confidence jumps to `91%` (PRIORITIZE, +15 bonus) |
| **2:03–2:16** | Incident Classification | Deep link: **Incidents** | Hazard: `ALGAL_BLOOM`, Severity: `HIGH` |
| **2:16–2:30** | Response Recommendation | Expand Recommendation card | Surface Aerators & Booms (`PENDING_REVIEW`) |
| **2:30–2:43** | Human Review Decision | Modal: **Approve** | Operational rationale entered, status `APPROVED` |
| **2:43–2:57** | Operational Task & FHIR | Deep link: **Response Tasks** | Task status: `REQUESTED`, HL7 FHIR Task ID |
| **2:57–3:15** | Field Mobility | Top bar: **Advance Step** | Haversine geofence validated: `≤50m` |
| **3:15–3:30** | Ground Truth Evidence | Task Inspection Drawer | 4 dead fish, scum, SHA-256 evidence fingerprint |
| **3:30–3:48** | Closed-Loop Reassessment | Deep link: **Evidence Fusion** | Field inspection feeds back: Score pushes to `100%` |
| **3:48–4:00** | Supervised Outcome | Click **Confirm Outcome** | Outcome confirmed as `CONFIRMED` |
| **4:00–4:22** | FHIR Outbox & Security | Deep link: **FHIR Outbox** | Transactional Outbox, FHIR Flag, HMAC-SHA256 |
| **4:22–4:38** | External Consumer Ack | Top bar: **Advance Step** | Webhook delivered to port 3002, `ACKNOWLEDGED` |
| **4:38–4:55** | Summary & Punchline | Deep link: **System Health** | All subsystems healthy, full auditable loop |
| **4:55–5:00** | Close | Stay still | End presentation |
