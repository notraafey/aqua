# AquaSentinel — Final PRD

## Sections 1–6: Product Definition & User Experience

---

# 1. Executive Summary

### 1.1 Product

**AquaSentinel** is an evidence-driven early-warning and incident-response platform for urban freshwater ecosystems.

It monitors environmental signals from multiple sources, including **satellite observations, citizen science reports, weather/environmental data, and historical site information**, and brings those signals together to determine whether an unusual environmental event warrants human attention.

The system is designed around a simple operational question:

> **“Something may be happening in this stream. How strong is the evidence, and what should we do next?”**

Rather than functioning as another passive environmental dashboard, AquaSentinel creates an **event-driven response loop**:

**Detect → Corroborate → Assess → Recommend → Approve → Act → Verify**

The core innovation is therefore not simply the ingestion of FHIR data or the generation of alerts. The existing strategy research explicitly identifies FHIR and basic event-driven thresholding as insufficiently novel on their own; the differentiating layer is the combination of **multi-source evidence fusion, contextual assessment, and actionable workflow orchestration**. 

### 1.2 The Problem

Urban-stream monitoring produces information across disconnected systems.

A satellite may identify an anomalous surface-water signal. A citizen may photograph unusual coloration. Weather conditions may provide important context. Historical data may show that the observation is highly abnormal for that location.

Individually, each signal may be ambiguous.

The operational problem is:

> **How can these heterogeneous signals be combined quickly enough to distinguish a potentially meaningful incident from an isolated or misleading observation, and then translate that assessment into an appropriate next action?**

The current OAH ecosystem contains important analytical, citizen-science, environmental-surveillance, and decision-support components. The opportunity identified by the product research is to add an **operational decision and workflow layer** connecting these components. 

### 1.3 Proposed Solution

AquaSentinel creates a common incident representation from heterogeneous environmental observations.

For each detected event, it:

1. Receives an environmental observation.
2. Verifies its spatial and temporal relevance.
3. Searches for corroborating observations from other sources.
4. Compares the evidence against contextual and historical information.
5. Calculates an explainable **Evidence Confidence Score**.
6. Assigns an incident state.
7. Determines whether additional evidence is required.
8. Recommends an appropriate response.
9. Places consequential actions behind human approval.
10. Generates structured workflow objects such as FHIR Tasks where appropriate.
11. Tracks the incident through verification and resolution.

### 1.4 Product Principle

AquaSentinel is not intended to replace environmental scientists, inspectors, municipal authorities, or clinical professionals.

Its role is:

> **Turn fragmented environmental evidence into an understandable, prioritized, and actionable workflow for human decision-makers.**

### 1.5 MVP

The initial MVP will focus on a tightly scoped urban-stream hazard scenario rather than attempting to monitor every possible water-quality problem.

The MVP will demonstrate:

* Satellite anomaly detection/input
* Citizen observation input
* Weather/contextual data
* Historical baseline comparison
* Multi-source evidence fusion
* Incident classification
* Recommended actions
* Human approval
* FHIR workflow generation
* Incident resolution

The existing research similarly defines the 14-day MVP around three evidence inputs—Sentinel-2 NDCI, citizen reports, and rainfall—with an incident dashboard and FHIR-based workflow. 

---

# 2. Problem Statement

## 2.1 Problem Definition

Urban freshwater ecosystems can change rapidly, while environmental information is often **fragmented across observation systems, citizen reports, remote-sensing datasets, weather feeds, and institutional workflows**.

A single observation rarely provides enough information to confidently determine whether intervention is required.

For example:

> A satellite detects an abnormal surface-water signal.

That could represent a meaningful environmental change—or it could be caused by cloud contamination, mixed pixels, seasonal variation, or another non-hazardous phenomenon.

Similarly:

> A citizen reports green water.

The observation is spatially precise and potentially valuable, but subjective and incomplete.

The core problem is therefore **not simply detecting anomalies**.

It is **interpreting heterogeneous evidence and converting it into an appropriate operational response.**

---

## 2.2 Current Failure Mode

The existing research identifies several related gaps:

### Fragmented evidence

Environmental information can exist in different systems without being automatically correlated.

### Passive monitoring

Dashboards can display information without necessarily determining what should happen next.

### Uncertainty

Environmental signals can be noisy, incomplete, or contradictory.

### Response latency

A meaningful signal may require human investigation before action can occur.

### Lack of structured workflow

Even when an environmental problem is identified, the next operational step may remain outside the digital monitoring system.

The strategic research specifically identifies the opportunity for an operational command layer connecting environmental telemetry, alerts, and municipal workflows. 

---

## 2.3 Why Existing OAH Components Are Not Sufficient by Themselves

AquaSentinel is intended to **extend rather than replace** the OneAquaHealth ecosystem.

Relevant OAH capabilities include:

* Citizen Science
* environmental indicators
* City Dashboards
* GEOSSIP
* Decision Support
* Catalogue of Measures
* OAH-FHIR

The product opportunity is to connect these types of information into an **event-driven incident lifecycle**.

The strategic research identifies multi-source evidence fusion as the key gap rather than simply creating another FHIR interface. 

---

## 2.4 The Fundamental Product Problem

AquaSentinel therefore addresses five linked questions:

### 1. Detection

**Did something unusual happen?**

### 2. Corroboration

**Do other independent sources support the observation?**

### 3. Assessment

**How strong and reliable is the combined evidence?**

### 4. Action

**What should a responsible human do next?**

### 5. Verification

**Was the incident actually confirmed, disproven, or left unresolved?**

This creates the central product transformation:

> **Raw environmental data → Evidence → Decision → Action → Feedback**

---

## 2.5 Scientific Boundary

AquaSentinel must not overstate what remote sensing or citizen observations can establish.

In particular:

* A satellite spectral anomaly is **not equivalent to laboratory confirmation**.
* A citizen observation is **not equivalent to professional field verification**.
* An Evidence Confidence Score is **not a calibrated probability of disease or contamination**.
* The system does not diagnose individual health conditions.
* The system does not autonomously authorize physical remediation or public-health interventions.

Sentinel-2 also requires spatial safeguards because its 10–20 m resolution can produce mixed-pixel contamination in narrow urban channels. The research recommends spatial/water-coverage gating and exclusion of unsuitable reaches. 

---

# 3. Users & Stakeholders

## 3.1 Primary User

### Municipal / Environmental Response Officer

The primary AquaSentinel user is a person responsible for monitoring or responding to environmental conditions across urban streams.

Their fundamental job is:

> **Identify which environmental events require attention, understand why, and initiate the appropriate response.**

They should not need to inspect multiple disconnected datasets manually.

AquaSentinel gives them a prioritized incident queue.

---

## 3.2 Secondary User — Field Inspector

The field inspector receives investigation tasks generated or approved through AquaSentinel.

Their workflow is:

1. Receive assigned incident.
2. Navigate to affected location.
3. Perform field observation.
4. Photograph the site.
5. Collect samples where appropriate.
6. Submit verification.
7. Close or escalate the task.

This creates the ground-truth feedback loop necessary to improve incident confidence.

---

## 3.3 Secondary User — Environmental Scientist

The environmental scientist uses AquaSentinel primarily to:

* inspect evidence,
* understand why an incident was escalated,
* review environmental context,
* examine historical patterns,
* validate recommendations,
* assess false positives/false negatives.

Their priority is **scientific interpretability**, not merely receiving an alert.

---

## 3.4 Secondary User — Citizen Scientist

The citizen scientist provides localized observations.

They are not expected to interpret satellite imagery or make professional environmental diagnoses.

Their role is simply:

> **Observe → photograph → locate → report**

Their observations become one component of the broader evidence system.

---

## 3.5 Stakeholder — Public / Recreational Water Users

The public is an indirect beneficiary.

AquaSentinel can support the preparation of precautionary advisories where appropriate, but public-facing warnings remain subject to human institutional approval.

The system should therefore distinguish between:

**Internal recommendation**

and

**official public communication.**

---

## 3.6 Stakeholder — Public Authorities

Potential institutional stakeholders include:

* environmental authorities,
* water-management organizations,
* municipal services,
* public-health authorities,
* emergency/resilience planners.

AquaSentinel's interoperability layer is designed to allow incidents and tasks to be represented in standardized formats rather than trapped inside the application's database.

---

## 3.7 User Hierarchy

```text
                    AQUASENTINEL
                         │
             ┌───────────┴───────────┐
             │                       │
       Decision Maker           Field Team
             │                       │
       Reviews evidence        Executes task
             │                       │
       Approves response ─────→ Verification
             │                       │
             └───────────┬───────────┘
                         ↓
                    Resolution
```

---

# 4. Product Vision

## 4.1 Vision Statement

> **AquaSentinel will become an intelligent environmental incident-response layer for urban freshwater ecosystems—continuously turning fragmented environmental observations into explainable evidence, prioritized decisions, and human-approved action.**

---

## 4.2 Product Philosophy

### From dashboards → decisions

A dashboard answers:

> "What is happening?"

AquaSentinel additionally asks:

> **"Does it matter, what evidence supports it, and what should happen next?"**

---

### From single signals → evidence

AquaSentinel should avoid treating any individual signal as definitive.

Instead:

**Satellite + citizen + weather + historical context**

can produce a stronger assessment than any one source alone.

The research explicitly supports combining satellite and citizen observations because their strengths and weaknesses are complementary. 

---

### From alerts → workflows

An alert without an action can become noise.

AquaSentinel therefore connects:

**Alert → recommended response → human approval → task → verification**

---

### From automation → supervised intelligence

AquaSentinel automates:

* data correlation,
* evidence assessment,
* prioritization,
* recommendation generation,
* workflow creation.

Humans retain authority over consequential decisions.

---

## 4.3 Product North Star

The North Star is:

> **Reduce the time and cognitive effort required for a responsible human to move from “something unusual was detected” to “we know what to investigate and why.”**

We should **not** claim a specific reduction in response time until the prototype is tested against a defined baseline.

---

## 4.4 Long-Term Vision

The initial product focuses on one tightly defined environmental incident class.

The architecture should eventually support additional event types such as:

* eutrophication-related anomalies,
* contamination events,
* storm/overflow-related hazards,
* vector-related environmental conditions,
* pharmaceutical contamination,
* other OAH-relevant ecological stressors.

The strategy research identified multiple possible verticals, but recommends keeping the initial implementation focused rather than building all of them simultaneously. 

---

## 4.5 What AquaSentinel Is Not

AquaSentinel is **not**:

* a replacement for the OAH Citizen Science App,
* a generic environmental dashboard,
* a medical diagnostic tool,
* an autonomous municipal decision-maker,
* a black-box AI prediction system,
* a laboratory water-quality testing system,
* a complete replacement for existing OAH decision-support infrastructure.

The research explicitly recommends these boundaries for feasibility and scientific defensibility. 

---

# 5. Hackathon & Track Alignment

## 5.1 Selected Track

# **Track 6 — Resilience Informatics**

**AquaSentinel will be submitted to ONE track only: Track 6.**

The product's primary purpose is **environmental early warning, incident prioritization, and resilience-oriented response**.

FHIR is supporting infrastructure rather than the product's primary track identity.

---

## 5.2 Why Track 6

AquaSentinel directly addresses the core Track 6 concept:

> **Detect environmental change early and help responsible actors respond.**

The product transforms environmental surveillance from:

**Observation → Dashboard**

into:

**Observation → Evidence → Early Warning → Recommended Response → Action → Verification**

The strategy research specifically contrasts Track 6's early-warning/resilience orientation with Track 7's interoperability focus and concludes that AquaSentinel's operational purpose is better represented by Track 6. 

---

## 5.3 OAH Alignment

AquaSentinel builds upon OAH concepts and assets rather than operating as an unrelated environmental application.

### OAH Citizen Science

Provides localized human observations and photographs.

### OAH Environmental Indicators

Provides standardized environmental representation.

### OAH-FHIR

Provides interoperability infrastructure for representing observations and downstream workflow.

### Catalogue of Measures

Provides a knowledge base from which appropriate response recommendations can be structured.

### OAH environmental surveillance / remote sensing

Provides the conceptual and scientific foundation for incorporating Earth-observation signals.

The proposed architecture specifically incorporates the OAH-FHIR profiles, pilot environmental datasets, and Catalogue of Measures. 

---

## 5.4 What Is New

The novelty is **not**:

> "We use FHIR."

Nor is it:

> "We created an environmental dashboard."

The proposed contribution is:

> **A multi-source evidence-fusion and action-orchestration layer that converts heterogeneous environmental observations into explainable incident states and human-approved workflows.**

The strategic analysis explicitly identifies FHIR as baseline infrastructure and multi-source reasoning/action orchestration as the more meaningful differentiator. 

---

## 5.5 Judging-Criterion Alignment

### Impact & OAH Alignment

AquaSentinel directly addresses early environmental detection and response while building on OAH infrastructure.

### Innovation & Creativity

The innovation lies in combining asynchronous evidence sources and translating uncertainty into an operational decision workflow.

### Technical Implementation

The system combines:

* geospatial processing,
* environmental data ingestion,
* evidence fusion,
* event-driven architecture,
* FHIR,
* workflow generation,
* interactive visualization.

### UX

The interface is centered around an understandable incident lifecycle rather than exposing raw technical data.

### Feasibility & Scale

The architecture separates:

* ingestion,
* evidence assessment,
* workflow orchestration,
* user interface,

allowing additional data sources and incident types to be added later.

---

## 5.6 Track Positioning Rule

All submission language should reinforce:

> **AquaSentinel is a Resilience Informatics product.**

We should not describe the submission as simultaneously belonging to Track 6 and Track 7.

Instead:

> **Track 6 is the product category. FHIR is the interoperability mechanism that makes the resilience workflow portable and integrable.**

---

# 6. Core User Journey

## 6.1 Journey Overview

The complete AquaSentinel journey is:

> **Normal → Detect → Verify → Corroborate → Assess → Recommend → Human Approves → Task → Field Verification → Resolve**

---

# Stage 1 — Normal

The system continuously represents monitored stream reaches.

Example:

```text
ALMYROS STREAM

Status: 🟢 NORMAL

No significant environmental anomaly detected.
```

The user does not need to take action.

---

# Stage 2 — Detection

A new environmental observation arrives.

Example:

> Sentinel-2 detects an anomalous spectral signal.

AquaSentinel checks whether the observation is technically suitable for interpretation.

### Validation includes:

* location,
* timestamp,
* stream geometry,
* water coverage,
* data quality,
* satellite validity.

If the observation fails quality gates, it is not escalated.

---

# Stage 3 — VERIFY

If an anomaly is potentially meaningful but lacks corroboration:

```text
🟡 VERIFY

Potential anomaly detected.

Evidence Confidence: 42/100

Supporting evidence:
✓ Satellite anomaly

Missing evidence:
○ Ground observation
○ Independent environmental corroboration
```

### Recommended action

> **Obtain ground verification.**

The system does not falsely declare an environmental hazard.

---

# Stage 4 — Corroboration

A citizen submits an observation near the same stream reach.

Example:

> **Citizen report:** unusual green surface
> **Photo:** attached
> **Location:** within relevant stream reach
> **Time:** within the defined temporal window

AquaSentinel spatially and temporally associates the observation with the existing incident.

Now:

```text
Satellite anomaly
       +
Citizen observation
       ↓
Stronger evidence
```

---

# Stage 5 — Contextual Assessment

The system incorporates additional context.

For example:

* rainfall,
* temperature,
* historical baseline,
* satellite data quality,
* observation proximity,
* temporal alignment.

This prevents the system from treating every isolated signal as equivalent.

---

# Stage 6 — Evidence Assessment

The fusion engine produces an interpretable result.

Example:

```text
🟠 INVESTIGATE

Evidence Confidence: 78/100
```

### Evidence breakdown

```text
Satellite anomaly          +30
Citizen corroboration      +25
Historical deviation       +15
Weather context            +8
Data-quality penalty       -0
                            ───
                             78
```

The exact scoring model will be defined in the technical sections of the PRD.

Crucially, this is an **evidence score**, not a claim that there is a 78% probability of a particular hazard.

---

# Stage 7 — Recommended Action

AquaSentinel now answers the second half of the problem:

> **What should happen next?**

Example:

### Recommended response

**1. Field verification**

Dispatch an environmental inspector.

**2. Water sampling**

Collect a sample for appropriate laboratory analysis.

**3. Review upstream conditions**

Inspect potential contributing areas.

### Reason

> Multiple independent observations indicate a potentially significant environmental anomaly requiring ground verification.

The recommendation engine can use structured logic derived from relevant OAH measures rather than autonomously inventing remediation interventions. The existing strategy research specifically supports Catalogue-of-Measures-driven recommendations under human supervision. 

---

# Stage 8 — Human Decision

The responsible user reviews:

### Evidence

* satellite visualization,
* citizen photograph,
* environmental context,
* historical comparison.

### Recommendation

* proposed action,
* rationale,
* priority.

They then choose:

**[Approve]**

**[Request More Evidence]**

**[Dismiss]**

**[Escalate]**

The system does not automatically execute consequential public-health or physical interventions.

---

# Stage 9 — Workflow Creation

If approved:

```text
Human Approval
      ↓
FHIR Task
      ↓
Assigned Field Team
```

Example:

### Task

**High Priority — Field Verification**

**Location:** Almyros Stream
**Reason:** Multi-source environmental anomaly
**Required actions:**

* Photograph site
* Perform field observation
* Collect sample if appropriate

Status:

> **REQUESTED**

---

# Stage 10 — Field Verification

The field inspector completes the task.

Possible outcomes:

### ✅ Confirmed

Evidence supports the original incident.

### ❌ Not confirmed

Initial signal was not corroborated.

### ⚠️ Uncertain

Additional investigation required.

The result is fed back into the incident.

---

# Stage 11 — Resolution

Example:

```text
INCIDENT #1042

Status: RESOLVED

Initial detection: 14:32
Investigation: 15:04
Field verification: 16:18
Resolution: 17:02
```

The system retains the incident history.

This allows future events to be compared against actual ground truth.

---

# 6.2 Complete Journey

```text
                   ENVIRONMENT
                       │
             ┌─────────┴─────────┐
             ↓                   ↓
        🛰️ Satellite        👥 Citizen
             │                   │
             └─────────┬─────────┘
                       ↓
                 🌧️ Context
                       │
                       ↓
                🧠 AQUASENTINEL
                       │
                Evidence Fusion
                       │
                       ↓
              Evidence Confidence
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
       🟢 NORMAL    🟡 VERIFY    🟠 INVESTIGATE
                                     │
                                     ↓
                              🔴 PRIORITIZE
                                     │
                                     ↓
                            Recommended Action
                                     │
                                     ↓
                              👤 Human Review
                                     │
                           ┌─────────┴─────────┐
                           ↓                   ↓
                       APPROVE            REQUEST MORE
                           │                 EVIDENCE
                           ↓
                       FHIR TASK
                           │
                           ↓
                    FIELD VERIFICATION
                           │
                    ┌──────┼──────┐
                    ↓      ↓      ↓
                 CONFIRMED  NO   UNCERTAIN
                    │       │       │
                    └───────┴───────┘
                            ↓
                         RESOLVED
```

---

## 6.3 The "Magic Moment"

The most important moment in the eventual demo should be this:

> **The system doesn't merely tell the user that something is wrong. It shows them why it believes the signal matters and gives them a defensible next action.**

The judge sees:

**Satellite anomaly**

↓

**Citizen corroboration**

↓

**Evidence confidence increases**

↓

**Incident escalates**

↓

**AquaSentinel recommends field verification**

↓

**Human approves**

↓

**FHIR Task is created**

That is the product in one sequence.

---

## 6.4 Core Product Equation

The entire PRD can ultimately be reduced to:

> ### **Environmental Signals + Context + Evidence Fusion → Actionable Incident → Human-Approved Response**

And the architectural philosophy is:

> ### **FHIR makes the workflow interoperable; AquaSentinel makes the workflow intelligent.**

That distinction should remain central throughout the remaining PRD.


# 16. Technical Architecture

## 16.1 Architectural Objective

AquaSentinel shall use a modular, event-driven architecture that separates:

1. Environmental data ingestion
2. Standardized data persistence
3. Event detection and dispatch
4. Evidence processing
5. Incident assessment
6. Action recommendation
7. Human approval
8. Workflow execution
9. Incident resolution
10. User-facing visualization

The architecture must allow individual components to be developed, tested, replaced, and extended independently.

The system should be capable of operating with simulated or preloaded data during development while retaining interfaces compatible with live data sources.

---

## 16.2 High-Level Architecture

```text
┌───────────────────────────────────────────────────────────┐
│                    DATA SOURCES                           │
│                                                           │
│ Sentinel-2 │ Citizen Reports │ Weather │ Historical Data │
└───────┬────────────┬────────────┬────────────┬────────────┘
        │            │            │            │
        └────────────┴────────────┴────────────┘
                         ↓
              ┌─────────────────────┐
              │  INGESTION LAYER    │
              │                     │
              │ Validation          │
              │ Normalization       │
              │ Geospatial checks   │
              └──────────┬──────────┘
                         ↓
              ┌─────────────────────┐
              │    FHIR LAYER       │
              │                     │
              │ HAPI FHIR R4        │
              │ OAH Profiles        │
              │ Observations        │
              └──────────┬──────────┘
                         ↓
              ┌─────────────────────┐
              │   EVENT LAYER       │
              │                     │
              │ FHIR Subscription   │
              │ REST Hook           │
              └──────────┬──────────┘
                         ↓
              ┌─────────────────────┐
              │ AQUASENTINEL CORE   │
              │                     │
              │ Evidence Fusion     │
              │ Context Analysis    │
              │ Incident Engine     │
              │ Recommendation      │
              └──────────┬──────────┘
                         ↓
              ┌─────────────────────┐
              │ WORKFLOW LAYER      │
              │                     │
              │ Flag                │
              │ Task                │
              │ CommunicationReq.   │
              └──────────┬──────────┘
                         ↓
              ┌─────────────────────┐
              │ COMMAND CONSOLE     │
              │                     │
              │ Map                 │
              │ Incidents           │
              │ Evidence            │
              │ Recommendations     │
              │ Tasks               │
              └─────────────────────┘
```

The proposed architecture is consistent with the existing strategy's event-driven design: ingestion adapters feed standardized FHIR resources, subscriptions trigger the orchestration service, and downstream workflow resources are generated from the resulting assessment. 

---

## 16.3 Core System Components

### A. Data Ingestion Layer

Responsible for receiving environmental observations from:

* Sentinel-2-derived observations
* Citizen science observations
* Weather/environmental APIs
* Historical/baseline datasets

Responsibilities:

* Input validation
* Schema validation
* Timestamp normalization
* Coordinate validation
* Data-quality checks
* Deduplication
* Source identification
* Conversion to internal canonical representation

---

### B. FHIR Layer

The FHIR layer serves as the standardized persistence and interoperability layer.

The initial implementation will use:

**HAPI FHIR R4**

with relevant **OneAquaHealth FHIR profiles**.

The system should represent environmental observations using appropriate OAH-compatible Observation structures and represent downstream operational states through appropriate FHIR workflow resources.

FHIR is an architectural interoperability mechanism, **not the primary source of product intelligence**.

---

### C. Event Layer

The system shall support event-driven processing.

A new qualifying observation can trigger:

```text
Observation created
       ↓
FHIR Subscription
       ↓
REST Hook
       ↓
AquaSentinel Core
```

The event layer must support asynchronous processing and prevent duplicate processing of the same observation.

---

### D. AquaSentinel Core

This is the central intelligence layer.

It is responsible for:

* spatial/temporal correlation,
* evidence collection,
* evidence quality assessment,
* contextual analysis,
* evidence scoring,
* incident state transitions,
* action recommendation,
* workflow generation.

This component should remain independent of the frontend.

---

### E. Workflow Layer

Converts approved decisions into structured operational objects.

Potential resources include:

* `Flag`
* `Task`
* `CommunicationRequest`

The workflow layer must distinguish between:

**system recommendation**

and

**human-approved action**.

---

### F. Command Console

React-based web application providing:

* stream map
* incident map
* incident queue
* evidence inspector
* recommendation panel
* task management
* incident history
* resolution interface

The UI should expose the reasoning behind an incident rather than simply displaying a score.

---

## 16.4 Architecture Principles

### Modular

Each major subsystem must have a defined interface.

### Explainable

Every escalation and recommendation must have a machine-readable rationale.

### Human-in-the-loop

Consequential actions require human approval.

### Interoperable

Environmental observations and operational tasks should use standards-based representations where appropriate.

### Resilient

The prototype should remain demonstrable if an external API becomes unavailable.

### Extensible

New hazards, evidence sources, and response rules should be addable without rewriting the entire system.

---

## 16.5 Implementation Strategy

The project will be developed incrementally across **Phases 1–9**.

The phase boundaries are architectural boundaries rather than independent products.

Each phase must leave the system in a runnable state wherever practical.

The phase-specific PRDs will define implementation details.

---

# 17. Data Model

## 17.1 Data Model Objective

AquaSentinel must maintain a coherent representation of:

* environmental observations,
* evidence,
* incidents,
* confidence assessments,
* recommendations,
* actions,
* approvals,
* field verification,
* resolution history.

The model must preserve **provenance** so the user can understand where every important piece of evidence originated.

---

## 17.2 Core Entities

### 17.2.1 Stream Reach

Represents a monitored geographic segment.

Core fields:

```text
streamReachId
name
geometry
city
region
monitoringStatus
waterCoverageConstraint
baselineData
```

A stream reach provides the geographic context against which observations are evaluated.

---

### 17.2.2 Observation

Represents an individual environmental observation.

Core conceptual fields:

```text
observationId
source
timestamp
location
streamReach
indicator
value
unit
quality
provenance
```

Examples:

```text
Satellite → NDCI anomaly
Citizen → green water observation
Weather → rainfall
Historical → baseline deviation
```

---

### 17.2.3 Evidence Item

An **Evidence Item** represents information that contributes to the assessment of an incident.

It differs from an Observation because it contains assessment metadata.

Conceptually:

```text
EvidenceItem
├── source
├── observation
├── relevance
├── spatialMatch
├── temporalMatch
├── quality
├── contribution
└── provenance
```

---

### 17.2.4 Incident

The Incident is the central product entity.

An incident represents a potentially meaningful environmental event.

Core fields:

```text
incidentId
streamReach
createdAt
updatedAt
status
hazardType
evidenceConfidence
severity
evidenceItems[]
recommendations[]
tasks[]
verificationStatus
resolution
```

---

### 17.2.5 Evidence Assessment

Represents the system's interpretation of available evidence.

```text
assessmentId
incidentId
score
confidenceBand
supportingEvidence[]
contradictingEvidence[]
missingEvidence[]
rationale
createdAt
```

The system must preserve previous assessments where meaningful so that an incident's evolution can be reconstructed.

---

### 17.2.6 Recommendation

Represents an action suggested by AquaSentinel.

```text
recommendationId
incidentId
actionType
priority
rationale
sourceRule
requiresApproval
status
```

---

### 17.2.7 Task

Represents an operational action approved or assigned to a responsible actor.

```text
taskId
incidentId
recommendationId
assignedTo
location
priority
instructions
status
createdAt
completedAt
```

---

### 17.2.8 Verification

Represents field or other ground-truth information used to validate an incident.

```text
verificationId
incidentId
observer
timestamp
location
result
photos[]
sampleCollected
notes
```

Possible result:

```text
CONFIRMED
NOT_CONFIRMED
UNCERTAIN
```

---

### 17.2.9 Incident Event

Every meaningful transition should be recorded.

Example:

```text
INCIDENT_CREATED
EVIDENCE_ADDED
SCORE_UPDATED
STATE_CHANGED
RECOMMENDATION_CREATED
RECOMMENDATION_APPROVED
TASK_CREATED
TASK_COMPLETED
VERIFICATION_RECEIVED
INCIDENT_RESOLVED
```

This creates an auditable incident timeline.

---

## 17.3 Data Provenance

Every external observation should preserve:

* source,
* acquisition time,
* processing time,
* original identifier where available,
* processing method,
* quality status.

AquaSentinel must never present derived information as though it were directly measured.

For example:

> **“Satellite-derived NDCI anomaly”**

rather than:

> **“Measured algae concentration.”**

---

## 17.4 Source Confidence vs Incident Confidence

These must remain conceptually separate.

### Source confidence

> How reliable is this individual observation?

### Incident evidence confidence

> How strongly does the total evidence support escalation?

This distinction prevents one low-quality observation from disproportionately influencing the incident.

---

# 18. API Specification

## 18.1 API Objective

The backend API provides a stable interface between:

* data sources,
* ingestion services,
* AquaSentinel Core,
* FHIR,
* frontend applications,
* future external systems.

The exact endpoint implementation will be defined in the relevant phase PRDs.

---

## 18.2 API Domains

The API should be logically divided into:

### `/observations`

Environmental observations.

Operations conceptually include:

```text
POST   /observations
GET    /observations/{id}
GET    /observations?streamReach=...
```

---

### `/incidents`

Incident management.

```text
GET    /incidents
GET    /incidents/{id}
POST   /incidents/{id}/reassess
PATCH  /incidents/{id}
```

---

### `/incidents/{id}/evidence`

Evidence inspection.

```text
GET /incidents/{id}/evidence
POST /incidents/{id}/evidence
```

---

### `/incidents/{id}/recommendations`

Recommendation management.

```text
GET  /incidents/{id}/recommendations
POST /incidents/{id}/recommendations/{recommendationId}/approve
POST /incidents/{id}/recommendations/{recommendationId}/reject
```

---

### `/tasks`

Operational tasks.

```text
GET   /tasks
GET   /tasks/{id}
PATCH /tasks/{id}
```

---

### `/verification`

Ground-truth submissions.

```text
POST /incidents/{id}/verification
GET  /incidents/{id}/verification
```

---

### `/webhooks`

Internal event endpoints.

Example:

```text
POST /webhooks/fhir/subscription
```

This endpoint receives FHIR-triggered events and passes them into the orchestration pipeline.

---

## 18.3 API Design Principles

The API must:

* validate input schemas,
* reject malformed observations,
* provide deterministic error responses,
* prevent duplicate event processing,
* maintain provenance,
* support structured logging,
* avoid exposing unnecessary personal information.

---

## 18.4 External API Adapters

External services must be accessed through adapters rather than directly throughout the application.

For example:

```text
SentinelAdapter
WeatherAdapter
CitizenObservationAdapter
FHIRAdapter
```

This means an external API can later be replaced without changing the evidence engine.

This is particularly important because the research identified uncertainty around direct GEOSSIP runtime access and recommends avoiding hard dependency on an unverified live API. 

---

# 19. FHIR Resource Specification

## 19.1 Purpose

FHIR provides the interoperability layer through which AquaSentinel represents environmental information and operational workflow.

The implementation should use the OneAquaHealth FHIR Implementation Guide where appropriate.

---

## 19.2 Observation

Environmental observations should be represented using appropriate OAH-compatible Observation structures.

Examples include:

```text
Satellite-derived environmental indicator
Citizen environmental observation
Weather observation
```

The Observation should preserve:

* subject/location,
* timestamp,
* indicator,
* value,
* unit,
* source,
* provenance where applicable.

---

## 19.3 Location

Locations should represent the relevant:

* stream,
* stream reach,
* monitoring site,
* incident location.

Geospatial relationships should allow the orchestration engine to determine whether an observation belongs to a monitored reach.

---

## 19.4 Flag

`Flag` represents a system-generated operational warning or attention state.

Example:

```text
Flag
Status: Active
Priority: High
Subject: Almyros Stream
Reason: Multi-source environmental anomaly
```

The Flag does **not** mean laboratory confirmation.

Its semantic purpose is:

> **This incident requires human attention.**

---

## 19.5 Task

`Task` represents a concrete operational action.

Example:

```text
Task
Status: Requested
Priority: High
Focus: Field Verification
Location: Almyros Stream
Reason: Environmental anomaly requiring verification
```

---

## 19.6 CommunicationRequest

Used where the system needs to represent a proposed communication.

Examples:

* notify responsible authority,
* prepare precautionary advisory,
* communicate an incident to an authorized stakeholder.

A CommunicationRequest should not be interpreted as proof that an official communication has already been sent.

---

## 19.7 Human Approval

The system must distinguish:

```text
Recommendation
      ↓
PENDING APPROVAL
      ↓
Human decision
      ↓
APPROVED / REJECTED
      ↓
Workflow action
```

No consequential action should silently transition from recommendation to execution.

---

## 19.8 FHIR as an Internal and External Contract

The implementation should avoid making the entire frontend directly dependent on raw FHIR JSON.

Instead:

```text
Frontend
   ↓
AquaSentinel API
   ↓
Domain Model
   ↓
FHIR Adapter
   ↓
HAPI FHIR
```

This gives the product a clean domain layer while preserving standards interoperability.

---

# 20. Evidence / Scoring Logic

## 20.1 Objective

The evidence engine determines:

> **How strongly does the available evidence support treating an environmental anomaly as an incident requiring action?**

It should prioritize **explainability, reproducibility, and scientific caution** over artificial sophistication.

---

## 20.2 Evidence Dimensions

The initial engine should evaluate:

### A. Anomaly strength

How unusual is the environmental observation relative to the relevant baseline?

### B. Spatial relevance

Does the observation correspond to the monitored stream reach?

### C. Temporal relevance

Are supporting observations close enough in time to plausibly describe the same event?

### D. Source quality

How trustworthy is the underlying observation?

### E. Independent corroboration

Do different sources support the same interpretation?

### F. Environmental context

Do weather or other contextual variables strengthen or weaken the interpretation?

### G. Contradictory evidence

Is there evidence suggesting an alternative explanation?

---

## 20.3 Initial Evidence Model

The MVP may use a deterministic weighted evidence model.

Conceptually:

```text
Evidence Score =
    anomaly contribution
  + corroboration contribution
  + baseline deviation contribution
  + contextual contribution
  - quality penalties
  - contradiction penalties
```

The exact coefficients will be specified and tested during the Evidence Fusion phase.

The score must be transparent enough that the UI can explain:

> **Why did the score increase?**

---

## 20.4 Evidence Confidence Bands

The initial product can use:

|  Score | State          | Interpretation                                      |
| -----: | -------------- | --------------------------------------------------- |
|   0–39 | 🟢 Normal      | Insufficient evidence of a meaningful incident      |
|  40–59 | 🟡 Verify      | Potential anomaly requiring additional evidence     |
|  60–79 | 🟠 Investigate | Multiple signals justify field investigation        |
| 80–100 | 🔴 Prioritize  | Strong evidence warrants prioritized human response |

These thresholds are **product decision thresholds**, not scientifically validated probabilities.

They will be configurable rather than hard-coded throughout the application.

---

## 20.5 Missing Evidence

A major feature of the evidence engine is identifying **what is missing**.

Example:

```text
Satellite anomaly: ✓
Historical deviation: ✓
Citizen observation: ✗
Weather context: ✓

Missing:
Ground corroboration
```

The system can then recommend:

> **Request field/citizen verification.**

This makes the engine more than a simple threshold calculator.

---

## 20.6 Spatial-Temporal Correlation

The system should define configurable correlation windows.

For the MVP, the architecture may support:

```text
Spatial window: configurable
Temporal window: configurable
```

The earlier strategy proposes a 500 m / 12-hour initial window, but these values should be treated as **configuration parameters requiring validation**, not universal scientific truths. 

---

## 20.7 Satellite Quality Gate

Satellite-derived evidence must first pass technical quality checks.

Potential gates:

* cloud quality,
* valid observation,
* water-surface coverage,
* stream geometry intersection,
* sufficient water-pixel proportion.

If the observation fails:

```text
Satellite signal
      ↓
Quality Gate
      ↓
FAIL
      ↓
Do not escalate
```

This is particularly important because Sentinel-2's spatial resolution makes narrow channels vulnerable to mixed-pixel contamination. 

---

## 20.8 Evidence Explanation

Every assessment must produce machine-readable reasons.

Example:

```text
{
  "score": 78,
  "state": "INVESTIGATE",
  "supportingEvidence": [
    "satellite_anomaly",
    "citizen_corroboration",
    "historical_deviation"
  ],
  "missingEvidence": [
    "field_verification"
  ],
  "contradictingEvidence": [],
  "explanation":
    "Multiple independent observations correspond
     spatially and temporally with an abnormal
     environmental signal."
}
```

This object should directly power the Evidence Inspector in the frontend.

---

# 21. Recommendation Logic

## 21.1 Objective

The recommendation engine converts an assessed incident into:

> **A specific, proportionate, explainable next action.**

It should answer:

> **“Given what we know right now, what should the responsible human do next?”**

---

## 21.2 Recommendation Hierarchy

Recommendations should generally progress from **information gathering** to **investigation** to **response**, depending on evidence strength.

### Low evidence

**Monitor**

or

**Request additional evidence**

### Moderate evidence

**Field verification**

**Water-quality sampling**

### Strong evidence

**Prioritized field investigation**

**Notify relevant authority**

**Prepare precautionary communication**

### Confirmed incident

Potential response measures may be surfaced from the appropriate OAH knowledge base / Catalogue of Measures, subject to human authorization.

---

## 21.3 Recommendation ≠ Automatic Action

This distinction is fundamental.

```text
Evidence
   ↓
Recommendation
   ↓
Human Review
   ↓
Approved Action
```

The system should never represent:

> “AI recommends closing the stream”

as:

> “Stream closed.”

Instead:

> **Recommended: prepare precautionary recreational-water advisory.**

**Approval required.**

---

## 21.4 Recommendation Rationale

Every recommendation must contain:

```text
Action
Priority
Reason
Supporting Evidence
Triggering Rule
Required Approval
```

Example:

### Recommended Action

**Field Verification**

**Priority:** High

**Reason:**

> Satellite-derived anomaly is corroborated by a nearby citizen observation and exceeds the site's configured evidence threshold.

**Required approval:** Yes

---

## 21.5 Catalogue of Measures Integration

Where appropriate, recommendations should map to structured OAH response/restoration measures.

The Catalogue should function as a **knowledge source**, not an autonomous physical-control mechanism.

The earlier research specifically considers automated compilation of structured restoration proposals and field investigation tasks appropriate, while direct autonomous physical execution is not. 

---

## 21.6 Recommendation Selection Logic

The recommendation engine should consider:

```text
Incident State
+
Hazard Type
+
Evidence Strength
+
Missing Evidence
+
Location
+
Existing Tasks
+
Applicable Measures
        ↓
Recommended Action Set
```

It must avoid generating duplicate tasks.

For example, if:

> **Field verification task already exists**

the system should not generate five identical field-verification tasks every time another supporting observation arrives.

Instead:

> **Update existing task / increase priority / attach new evidence.**

---

## 21.7 Recommendation Safety Rules

The engine must not:

* diagnose human illness,
* prescribe medical treatment,
* claim laboratory confirmation without laboratory evidence,
* autonomously order physical remediation,
* automatically issue official public-health warnings,
* fabricate environmental measurements,
* convert an uncertain observation into a definitive hazard claim.

---

## 21.8 Phase-Level Implementation

The exact recommendation rules, data structures, Catalogue mappings, state transitions, and test cases will be specified in the **Phase 5 Recommendation Engine PRD**.

The main PRD defines the contract:

> **Evidence → Explainable Recommendation → Human Approval → Structured Workflow**

while the phase PRD will tell Antigravity/Codex exactly **how to implement it**.

---

### The six sections we've now established form the technical spine:

**16. Architecture** → *How everything connects*

**17. Data Model** → *What the system knows*

**18. APIs** → *How components communicate*

**19. FHIR** → *How the system interoperates*

**20. Evidence Engine** → *How it decides how strong the evidence is*

**21. Recommendation Engine** → *How it decides what should happen next*

# 28. HACKATHON MVP DEFINITION

## 28.1 MVP Objective

The AquaSentinel MVP must demonstrate one complete, credible, end-to-end operational loop:

> **Environmental signal → evidence corroboration → incident assessment → recommended response → human approval → operational task → field verification → incident resolution**

The MVP is not intended to become a complete municipal environmental-management platform. It is a focused proof-of-concept demonstrating how heterogeneous environmental observations can be transformed into an explainable, evidence-driven resilience workflow.

The MVP must answer the following question:

> **“Something may be happening in this urban freshwater system. How strong is the evidence, and what should the responsible person do next?”**

The MVP must prioritize **depth and reliability over breadth**.

---

## 28.2 MVP Scope

The MVP must contain the following capabilities.

### A. Environmental Data Ingestion

The system must be capable of ingesting at least three evidence sources:

1. **Satellite / remote-sensing evidence**

   * Sentinel-2-derived environmental indicators where technically feasible.
   * Appropriate spatial and quality filtering.
   * Stream/reach geometry matching.
   * Cloud/invalid-pixel handling.
   * Explicit indication when satellite evidence is insufficient.

2. **Citizen-science evidence**

   * Environmental observations associated with location and timestamp.
   * Optional photographs.
   * Observation quality/provenance metadata.

3. **Weather / contextual evidence**

   * Recent rainfall.
   * Temperature and other available contextual variables where relevant.
   * Temporal alignment with the incident.

Historical baseline/context may also be used where available.

---

## 28.3 Evidence Fusion

The MVP must not simply display the three sources independently.

It must determine whether they provide **corroborating, contradictory, or insufficient evidence**.

The evidence engine must consider:

* anomaly magnitude;
* spatial relevance;
* temporal relevance;
* source quality;
* independent corroboration;
* historical deviation;
* environmental context;
* contradictory evidence;
* missing evidence.

The resulting value is an **Evidence Confidence Score**, not a probability.

The system must never present an uncalibrated score as:

* “89% probability”;
* “confirmed contamination”;
* “confirmed disease risk”;
* or equivalent language.

---

## 28.4 Incident State Machine

The MVP must convert evidence into an operational state.

Minimum states:

| State                    | Meaning                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| **NORMAL**               | No meaningful incident signal                                    |
| **VERIFY**               | Anomaly exists but evidence is insufficient                      |
| **INVESTIGATE**          | Multiple relevant evidence sources support further investigation |
| **PRIORITIZE**           | Evidence and contextual factors justify prioritized response     |
| **VERIFICATION_PENDING** | Human/field verification has been requested                      |
| **RESOLVED**             | Investigation has concluded and incident has been closed         |

The state machine must be deterministic, auditable, and explainable.

Every state transition must have:

* timestamp;
* triggering event;
* evidence considered;
* rule/logic responsible;
* previous state;
* new state.

---

## 28.5 Evidence Explanation

Every incident must have an evidence drawer/inspection interface showing:

### Supporting evidence

Evidence increasing confidence in the incident.

### Contradicting evidence

Evidence reducing confidence.

### Missing evidence

Evidence that would materially improve the assessment but is unavailable.

### Context

Environmental information that affects interpretation.

### Provenance

Where each piece of evidence came from and when it was obtained.

The user must be able to understand **why the system reached its current state without needing to inspect source code.**

---

## 28.6 Recommendation Engine

The MVP must translate incident state into a proportionate recommendation.

Examples:

**VERIFY**
→ request additional observation / monitor.

**INVESTIGATE**
→ create field verification task.

**PRIORITIZE**
→ prioritize field investigation and prepare an appropriate communication/review workflow.

**VERIFIED**
→ surface relevant response measures for human consideration.

The system must distinguish:

> **Recommendation ≠ Action**

The platform may recommend or prepare an action, but a responsible human must approve operationally consequential actions.

---

## 28.7 Human-in-the-Loop Workflow

The MVP must provide explicit human decision controls:

* Approve
* Request More Evidence
* Reject
* Assign Task
* Complete Verification
* Resolve Incident

The system must record the decision and responsible user.

No public warning or physical remediation action should occur automatically.

---

## 28.8 FHIR Workflow

FHIR must demonstrate interoperability rather than merely exist as documentation.

Where appropriate, the MVP should represent:

* environmental observations through OAH-compatible FHIR resources;
* operational warnings through `Flag`;
* operational work through `Task`;
* proposed communications through `CommunicationRequest`.

The intended chain is:

> **Observation → Assessment → Recommendation → Human Approval → Task / CommunicationRequest**

FHIR should remain behind an application/domain API so that the frontend does not become tightly coupled to raw FHIR JSON.

---

## 28.9 Command Console

The MVP command console must contain:

### Main dashboard

* Stream/reach map.
* Current incidents.
* Incident states.
* Evidence confidence.
* Priority.
* Active tasks.

### Incident detail

* Incident summary.
* Map location.
* Evidence timeline.
* Supporting evidence.
* Contradicting evidence.
* Missing evidence.
* Evidence confidence.
* Recommendation.
* Approval controls.
* Task status.
* Verification history.

### Task interface

* Assignment.
* Priority.
* Location.
* Instructions.
* Status.
* Completion.

The interface should optimize for:

> **Status → Evidence → Recommendation → Action**

rather than exposing unnecessary technical information.

---

## 28.10 Deterministic Demo Mode

The hackathon submission must include a deterministic seeded scenario.

The final demonstration must not depend on a live satellite API, live weather API, or any other external service being operational at the exact moment of judging.

The system should support:

**LIVE MODE**

* Uses available external APIs.

**DEMO MODE**

* Uses validated/searched/preloaded data representing the same system workflow.

Both modes must exercise the same core application architecture wherever practical.

Demo mode exists for reliability; it must not become a fake UI disconnected from the actual system.

---

## 28.11 MVP Acceptance Criteria

The MVP is considered complete only when it can demonstrate:

1. At least three evidence types entering the system.
2. Evidence validation and provenance.
3. Spatial and temporal correlation.
4. Evidence scoring.
5. Supporting/contradicting/missing evidence.
6. Deterministic incident state transitions.
7. Explainable recommendations.
8. Human approval.
9. FHIR-based workflow representation.
10. Operational task creation.
11. Field verification.
12. Incident resolution.
13. Complete audit history.
14. Reliable seeded end-to-end demonstration.
15. Tests covering the critical evidence and workflow logic.

---

# 29. PHASE ROADMAP & HANDOFF PROTOCOL

## 29.1 Development Philosophy

AquaSentinel will be developed through **nine sequential implementation phases**.

Each phase has a specific engineering responsibility.

The phases are deliberately ordered so that later agents build on a tested foundation rather than attempting to construct the entire system simultaneously.

The Main PRD defines the **target architecture and product contract**.

Each Phase PRD defines the **implementation requirements for that phase**.

Each completed phase must produce a **Phase Handoff Document** describing what was actually built.

Therefore:

> **The Main PRD describes what should exist. The Phase Handoff describes what actually exists.**

The next phase must build from the latter.

---

## 29.2 Phase 1 — Foundation & Infrastructure

### Purpose

Establish the technical foundation of AquaSentinel.

### Primary work

* Repository structure.
* Frontend foundation.
* Backend foundation.
* Database.
* Docker/containerization.
* Configuration management.
* Basic logging.
* Basic authentication/roles where required.
* Initial domain models.
* Development/test environments.
* CI/test foundation where practical.

### By the end of Phase 1

The project must have a runnable skeleton.

Later phases should be able to add functionality without restructuring the entire application.

---

## 29.3 Phase 2 — Environmental Data Layer

### Purpose

Create the reliable environmental data ingestion and normalization layer.

### Primary work

* Observation ingestion.
* Satellite adapter.
* Weather adapter.
* Citizen-observation adapter.
* Validation.
* Provenance.
* Geospatial matching.
* Temporal normalization.
* Data-quality handling.
* Seed/demo datasets.
* FHIR environmental observation integration where appropriate.

### By the end of Phase 2

The system must be capable of receiving and storing normalized environmental evidence.

---

## 29.4 Phase 3 — Evidence Fusion Engine

### Purpose

Turn individual observations into a coherent evidence assessment.

### Primary work

* Spatial correlation.
* Temporal correlation.
* Baseline comparison.
* Source-quality evaluation.
* Corroboration logic.
* Contradiction logic.
* Missing-evidence logic.
* Evidence Confidence Score.
* Evidence explanation.
* Satellite quality gates.

### By the end of Phase 3

Given a collection of observations, the system must be able to explain:

> **How strongly does the available evidence support treating this as an incident?**

---

## 29.5 Phase 4 — Incident State Machine

### Purpose

Convert evidence assessments into operational incident states.

### Primary work

* Incident creation.
* State definitions.
* State-transition rules.
* Event processing.
* Incident history.
* Reassessment.
* Escalation/de-escalation.
* Duplicate incident prevention.
* Audit events.

### By the end of Phase 4

The platform must automatically move an incident through the appropriate states based on evidence.

---

## 29.6 Phase 5 — Action Recommendation Engine

### Purpose

Translate incident assessments into explainable recommended next actions.

### Primary work

* Recommendation rules.
* Action categories.
* Priority logic.
* Missing-evidence requests.
* Field-investigation recommendations.
* Catalogue of Measures integration where appropriate.
* Duplicate-task prevention.
* Human approval requirements.
* Recommendation rationale.

### By the end of Phase 5

AquaSentinel must be able to answer:

> **“Given what we know right now, what should the responsible person consider doing next?”**

---

## 29.7 Phase 6 — Human-in-the-Loop Command Console

### Purpose

Expose the intelligence and workflow through a usable operational interface.

### Primary work

* Main dashboard.
* Map.
* Incident queue.
* Incident detail.
* Evidence drawer.
* Recommendation panel.
* Approval controls.
* Task interface.
* Incident timeline.
* Responsive states/loading/error handling.

### By the end of Phase 6

A user must be able to operate the complete detection → assessment → recommendation workflow through the UI.

---

## 29.8 Phase 7 — FHIR Workflow & Interoperability

### Purpose

Connect the operational workflow to the FHIR/OAH interoperability layer.

### Primary work

* OAH-compatible environmental observations.
* FHIR adapter.
* HAPI FHIR integration.
* FHIR subscriptions/event delivery where appropriate.
* `Flag`.
* `Task`.
* `CommunicationRequest`.
* Workflow synchronization.
* FHIR validation.
* Interoperability testing.

### By the end of Phase 7

The operational incident workflow must have a functioning interoperability pathway rather than FHIR existing merely as a technical artifact.

---

## 29.9 Phase 8 — Closed-Loop Response & Verification

### Purpose

Complete the loop from automated detection to human field response and back into the system.

### Primary work

* Task assignment.
* Field verification.
* Verification result.
* Evidence/photo attachment where appropriate.
* Incident reassessment after verification.
* Confirmed / not-confirmed / uncertain outcomes.
* Resolution.
* Complete incident timeline.
* Post-verification audit trail.

### By the end of Phase 8

AquaSentinel must demonstrate:

> **Detect → Corroborate → Assess → Recommend → Approve → Investigate → Verify → Resolve**

---

## 29.10 Phase 9 — Advanced Intelligence, Hardening & Hackathon Readiness

### Purpose

Improve the system's intelligence, robustness, presentation, and reliability without destabilizing the core MVP.

### Potential work

* Improved anomaly detection.
* Better baseline modeling.
* Additional contextual evidence.
* Evidence-quality improvements.
* Performance optimization.
* UX polish.
* Demo-mode reliability.
* Error recovery.
* Security hardening.
* Test coverage.
* Documentation.
* Architecture visualization.
* Final seeded scenarios.
* Hackathon demo preparation.

Phase 9 must **not introduce unnecessary complexity merely to make the project appear more sophisticated**.

A simpler, validated system is preferable to an impressive but unreliable feature.

### By the end of Phase 9

The product must be:

* stable;
* demonstrable;
* explainable;
* technically defensible;
* visually coherent;
* reproducible;
* ready for final hackathon submission.

---

# 29.11 Phase Dependency Model

The intended dependency chain is:

**Phase 1**
Foundation
↓
**Phase 2**
Environmental Data
↓
**Phase 3**
Evidence Fusion
↓
**Phase 4**
Incident State Machine
↓
**Phase 5**
Recommendations
↓
**Phase 6**
Command Console
↓
**Phase 7**
FHIR Workflow
↓
**Phase 8**
Closed-Loop Verification
↓
**Phase 9**
Advanced Intelligence + Hardening + Demo

A later phase must not silently assume that an earlier phase was completed exactly as originally planned.

The **actual implementation documented in the preceding handoff takes precedence over assumptions.**

---

# 29.12 Mandatory Phase Handoff Protocol

Every completed phase MUST produce a handoff document.

For example:

* Phase 1 → `PHASE_1_HANDOFF.md`
* Phase 2 → `PHASE_2_HANDOFF.md`
* Phase 3 → `PHASE_3_HANDOFF.md`
* etc.

The document must be stored in the project repository and provided directly to the next phase agent.

---

## 29.13 Mandatory Inputs for Every Phase Agent

A Phase X agent must receive:

### 1. Main PRD

Defines:

* product vision;
* architecture;
* product requirements;
* scientific guardrails;
* overall scope;
* long-term system behavior.

### 2. Phase X PRD

Defines:

* current phase objective;
* exact implementation requirements;
* technical tasks;
* acceptance criteria;
* tests;
* constraints.

### 3. Phase X−1 Handoff Document

Defines:

* what the previous agent actually implemented;
* current repository state;
* existing APIs;
* schemas;
* components;
* tests;
* limitations;
* known bugs;
* deviations from the Main PRD.

---

# 29.14 Mandatory Missing-Handoff Behavior

Before beginning implementation, every Phase X agent MUST verify the presence and accessibility of the Phase X−1 Handoff Document.

If the handoff is missing, inaccessible, corrupted, or clearly incomplete, the agent MUST NOT begin implementation.

It must explicitly output:

> **BLOCKED — PHASE X−1 HANDOFF DOCUMENT MISSING**

It must then identify:

* which handoff is missing;
* what information is required;
* what implementation cannot safely proceed without it.

The agent must **not reconstruct the previous phase from memory, assumptions, or the Main PRD.**

The agent must **not silently proceed**.

This is a hard dependency.

### Exception

Phase 1 has no previous implementation phase and therefore does not require a Phase 0 handoff.

---

# 29.15 Handoff Document Required Contents

Every Phase X−1 Handoff Document must contain, at minimum:

### A. Completion Status

* Phase number.
* Completion date.
* Overall status.
* Completed requirements.
* Incomplete requirements.

### B. Actual Implementation

* Features implemented.
* Components created.
* Components modified.
* APIs created.
* Database changes.
* FHIR resources/profiles implemented.
* Frontend routes/components.
* Background workers/services.

### C. Repository Structure

Document important files and directories and explain their purpose.

### D. Configuration

Document:

* environment variables;
* services;
* ports;
* credentials requirements;
* external API requirements;
* local-development requirements.

Secrets themselves must never be included.

### E. Running the System

Provide exact instructions for:

* installation;
* startup;
* database initialization;
* migrations;
* seeding;
* tests;
* local demo.

### F. Tests

Document:

* tests written;
* tests executed;
* passing tests;
* failing tests;
* known untested areas.

### G. Known Problems

Explicitly document:

* bugs;
* technical debt;
* incomplete integrations;
* unreliable external APIs;
* temporary implementations;
* scientific limitations.

### H. Deviations

Document every meaningful deviation from:

* Main PRD;
* Phase X−1 PRD;
* intended architecture.

### I. Decisions

Record important engineering/product decisions made during implementation and why they were made.

### J. Next-Phase Requirements

Explicitly state:

* what Phase X must preserve;
* what Phase X may modify;
* what Phase X is expected to extend;
* dependencies Phase X must verify;
* known risks Phase X should address.

---

# 29.16 Next-Phase Readiness Checklist

Every handoff must end with a checklist:

```text
PHASE X HANDOFF — NEXT PHASE READINESS

[ ] Phase requirements reviewed
[ ] Implementation completed
[ ] Tests executed
[ ] Known failures documented
[ ] Repository structure documented
[ ] APIs documented
[ ] Database changes documented
[ ] Configuration documented
[ ] External dependencies documented
[ ] Known bugs documented
[ ] Deviations documented
[ ] Technical decisions documented
[ ] Local run instructions verified
[ ] Demo/seed data documented
[ ] Next-phase dependencies identified
[ ] Handoff document complete
```

The next phase agent should verify this checklist before implementation.

---

# 29.17 “What Already Exists?” Requirement

Every Phase PRD must explicitly include a section titled:

## **STATE OF THE SYSTEM WHEN ENTERING THIS PHASE**

This section must explain what should already exist **if the preceding phase was completed successfully**.

For example, Phase 5 should state that entering Phase 5, the expected system already contains:

* the Phase 1 infrastructure;
* Phase 2 normalized environmental observations;
* Phase 3 evidence assessments;
* Phase 4 incident creation/state transitions;
* associated APIs and tests;
* the corresponding implementation details from the Phase 4 handoff.

However, the Phase 5 agent must verify the actual state against the Phase 4 handoff and repository rather than blindly assuming every planned component exists.

This requirement applies to **all nine phases**.

---

# 29.18 Handoff Priority Rule

When discrepancies exist:

**Actual code + verified Phase X−1 Handoff**
takes precedence over
**assumptions based on the Main PRD.**

However, the Main PRD remains the authority for the **intended product architecture and ultimate requirements**.

Therefore, if the implementation differs from the Main PRD, the new phase should:

1. identify the discrepancy;
2. determine whether it blocks the current phase;
3. preserve working functionality;
4. correct the deviation when appropriate;
5. document the decision in its own handoff.

---

# 30. DEMO SCRIPT & FINAL INTEGRATION

## 30.1 Demo Objective

The final hackathon demonstration must communicate AquaSentinel's value within approximately **3–5 minutes**.

The demo must not attempt to explain every technical component.

The central story is:

> **A signal appears. AquaSentinel determines whether it matters by combining independent evidence, explains what it knows and does not know, recommends the next action, obtains human approval, creates an operational workflow, and closes the loop through verification.**

---

# 30.2 Demo Scenario

The primary demonstration should use one carefully prepared urban-stream incident.

### Scene 1 — Normal State

The dashboard opens on a monitored urban freshwater environment.

The system displays:

* monitored stream reaches;
* normal status;
* historical/contextual information;
* no active high-priority incidents.

The user understands that AquaSentinel is continuously observing the environment.

---

## Scene 2 — Environmental Anomaly

A new satellite observation arrives.

The system detects a meaningful deviation from the relevant baseline.

Instead of immediately declaring an emergency, AquaSentinel creates:

> **VERIFY — Satellite anomaly detected; corroborating evidence required.**

The evidence panel explains:

* what changed;
* where it changed;
* when it changed;
* satellite-data quality;
* whether the stream geometry/water coverage is adequate.

This demonstrates scientific restraint.

---

# 30.3 Scene 3 — Citizen Corroboration

A citizen-science observation arrives from the same general reach within the relevant temporal window.

The observation contains an environmental description and, where available, an image.

AquaSentinel links the observation to the existing incident.

The state changes because **independent evidence now corroborates the signal**.

The interface shows:

> **INVESTIGATE**

The evidence drawer visibly demonstrates:

**Satellite**
+
**Citizen observation**
+
**Spatial/temporal match**

rather than simply displaying an unexplained AI-generated alert.

---

# 30.4 Scene 4 — Environmental Context

The system adds contextual evidence.

For example:

* recent rainfall;
* temperature;
* baseline deviation;
* other available environmental context.

The system recalculates the Evidence Confidence Score.

The interface explicitly distinguishes:

### Supporting

Evidence that increases confidence.

### Contradicting

Evidence that reduces confidence.

### Missing

Evidence that would improve confidence.

This is the central intelligence demonstration.

---

# 30.5 Scene 5 — Recommendation

AquaSentinel determines that the evidence warrants a prioritized field investigation.

The recommendation panel displays:

> **Recommended Action: Prioritize Field Verification**

Then:

**Why?**

* Satellite anomaly detected.
* Citizen observation spatially and temporally correlated.
* Environmental context supports escalation.
* No sufficient evidence for definitive hazard confirmation.

The user sees:

**Approve | Request More Evidence | Reject**

The recommendation is not automatically executed.

---

# 30.6 Scene 6 — Human Approval

The responsible officer selects:

> **Approve**

AquaSentinel records the decision.

The platform creates the corresponding operational workflow.

The UI shows:

> **Task Created**

with:

* location;
* priority;
* instructions;
* assigned role/person;
* incident ID;
* evidence basis.

Where appropriate, the corresponding FHIR `Task` is created through the interoperability layer.

---

# 30.7 Scene 7 — Field Verification

The field inspector opens the task.

The inspector records:

* verification result;
* timestamp;
* location;
* observations;
* optional photograph;
* optional sample collection;
* notes.

Possible outcomes:

**CONFIRMED**

**NOT CONFIRMED**

**UNCERTAIN**

The verification becomes part of the incident's evidence history.

---

# 30.8 Scene 8 — Resolution

AquaSentinel reassesses the incident using the new field evidence.

The incident is either:

* escalated;
* maintained;
* downgraded;
* or resolved.

The final timeline shows:

> Detection → Corroboration → Assessment → Recommendation → Approval → Task → Verification → Resolution

This demonstrates the complete closed loop.

---

# 30.9 Technical Demonstration Layer

After demonstrating the user workflow, the presentation may briefly reveal the architecture:

**Environmental Sources**

↓

**Normalization & Quality Gates**

↓

**OAH/FHIR Environmental Observations**

↓

**Event Layer**

↓

**AquaSentinel Evidence Engine**

↓

**Incident State Machine**

↓

**Recommendation Engine**

↓

**Human Approval**

↓

**FHIR Task / CommunicationRequest**

↓

**Field Verification**

↓

**Resolution**

The technical explanation should emphasize that FHIR is the interoperability mechanism supporting the workflow, while the product value is the **evidence-driven resilience loop**.

---

# 30.10 Final “Magic Moment”

The most important moment of the demo should be when the system changes from:

> **“Something changed.”**

to:

> **“Here is why we think it matters, here is what evidence supports it, here is what is missing, and here is the next action a responsible human should consider.”**

The audience should see that AquaSentinel is not merely another environmental dashboard.

It connects:

**Detection**

→ **Corroboration**

→ **Decision support**

→ **Human action**

→ **Verification**

→ **Learning from the outcome**

---

# 30.11 Demo Reliability Requirements

The final demo must have:

* deterministic seeded data;
* deterministic incident scenario;
* reliable local fallback;
* no dependency on a live external API for the critical path;
* prevalidated FHIR resources;
* preloaded satellite/contextual evidence where necessary;
* clear loading/error states;
* no fabricated real-time claims;
* no unsupported scientific conclusions.

Live integrations may be shown where they work reliably, but they must not be a single point of failure for the demonstration.

---

# 30.12 Final Phase Completion Model

At the completion of all nine phases, the system should conceptually have progressed as follows:

| Phase                            | What has been built by the end of the phase                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| **1 — Foundation**               | Runnable application, infrastructure, database, configuration and development foundation        |
| **2 — Environmental Data**       | Environmental observations entering through normalized data adapters                            |
| **3 — Evidence Fusion**          | Multi-source evidence correlation, quality assessment and explainable confidence scoring        |
| **4 — Incident State**           | Automatic incident creation, state transitions and audit history                                |
| **5 — Recommendations**          | Explainable recommended actions with human approval requirements                                |
| **6 — Command Console**          | Usable operational dashboard for incidents, evidence, recommendations and tasks                 |
| **7 — FHIR Workflow**            | Interoperable environmental and operational workflow through FHIR/OAH-compatible resources      |
| **8 — Closed Loop**              | Human task execution, field verification, reassessment and resolution                           |
| **9 — Intelligence & Hardening** | Improved intelligence, robustness, testing, UX polish, demo reliability and hackathon readiness |

Thus, when an agent is working in a given phase, it should always know:

> **“Here is what the previous phases were supposed to establish, here is what the previous phase actually established, and here is precisely what I am responsible for adding.”**

That distinction is mandatory throughout the AquaSentinel development process.
