# AquaSentinel — Phase 4 PRD
## Operational Response & Recommendation Engine

Version: 1.0
Phase: 4 of 9
Depends on: Phase 1, Phase 2, Phase 3
Primary purpose: Convert evidence-backed environmental incidents into explainable, actionable, human-supervised operational recommendations and interoperable FHIR workflow resources.

============================================================
1. PHASE OBJECTIVE
============================================================

Phase 4 transforms AquaSentinel from an evidence assessment system into an operational decision-support system.

Phase 3 answers:

"What is happening, how strong is the evidence, what corroborates it, what contradicts it, and what evidence is missing?"

Phase 4 must answer:

"Given this evidence, what should a responsible municipal operator do next?"

The system must:

1. Receive a Phase 3 EvidenceAssessment.
2. Determine whether the assessment is actionable.
3. Classify the operational incident.
4. Identify the relevant environmental condition/stressor.
5. Query the internal representation of the OneAquaHealth Catalogue of Measures.
6. Match the incident to appropriate candidate measures.
7. Rank candidate actions using transparent deterministic rules.
8. Generate an explainable recommendation package.
9. Generate human-reviewable operational tasks.
10. Represent the workflow through FHIR resources.
11. Preserve provenance from evidence → assessment → recommendation → task.
12. Never autonomously execute a physical environmental intervention.
13. Require human approval for consequential actions.
14. Support deterministic demo scenarios.

The central transformation is:

Environmental evidence
        ↓
EvidenceAssessment
        ↓
Incident classification
        ↓
Candidate measures
        ↓
Suitability filtering
        ↓
Ranked recommendations
        ↓
Human review
        ↓
FHIR Task / Flag / CommunicationRequest
        ↓
Operational execution outside AquaSentinel


============================================================
2. PHASE 4 PRODUCT PRINCIPLE
============================================================

The system is NOT an autonomous environmental authority.

It is an operational decision-support and orchestration layer.

AquaSentinel may:

- detect
- assess
- explain
- recommend
- prioritize
- draft
- create reviewable tasks
- notify authorized stakeholders

AquaSentinel must NOT:

- independently order physical construction
- independently deploy chemicals
- independently close a public waterway
- independently issue legally binding public-health orders
- claim that a remote-sensing signal proves a disease or toxin
- claim certainty where evidence is uncertain
- automatically execute consequential intervention

All consequential operational actions must remain human-supervised.

This boundary is mandatory.


============================================================
3. WHAT PHASE 3 HANDS TO PHASE 4
============================================================

Phase 4 must consume the outputs already produced by Phase 3.

Phase 3 currently provides:

- EvidenceAssessment
- bounded evidence score
- confidence band
- score breakdown
- corroborating evidence
- contradictory evidence
- missing evidence
- rationale:
  - whatChanged
  - whatCorroborates
  - whatWeakens
  - whatIsMissing
- stream reach association
- temporal correlation
- spatial correlation
- source-group analysis
- baseline deviation
- quality assessment
- contradiction analysis

Phase 4 must NOT recreate the Phase 3 evidence-fusion engine.

It consumes Phase 3's conclusions.

The dependency chain must remain:

Phase 1:
Foundation
↓
Phase 2:
Environmental Data
↓
Phase 3:
Evidence Fusion
↓
Phase 4:
Operational Response
↓
Phase 5+:
Further workflow, UX, resilience, demonstration and hardening


============================================================
4. CORE USER PROBLEM
============================================================

Environmental monitoring systems frequently stop at:

"Something appears wrong."

Municipal users instead need:

"Something appears wrong. Here is why we believe it. Here is what remains uncertain. Here are the available actions. Here is the action we recommend considering. Here is why. Here is who should review it. Here is the task that can be assigned."

Phase 4 closes the:

DATA
→
INSIGHT
→
DECISION
→
ACTION

gap.

The system should turn evidence into operationally useful information without pretending that an algorithm can replace an ecologist, environmental officer, public-health authority or municipal engineer.


============================================================
5. PRIMARY USER
============================================================

Primary user:

Municipal/environmental operations officer.

Secondary users:

- environmental inspectors
- river basin managers
- public-health officers
- municipal engineers
- ecological researchers
- field investigators
- authorized incident coordinators

The UI should therefore use operational language rather than machine-learning terminology.

Prefer:

"Evidence strength: 78/100"

over:

"Model confidence: 78%"

Prefer:

"Field verification recommended"

over:

"AI says verify."


============================================================
6. INCIDENT CLASSIFICATION
============================================================

Phase 4 must introduce a deterministic Incident Classification layer.

Candidate incident types should include at minimum:

1. POSSIBLE_EUTROPHICATION
2. POSSIBLE_CYANOBLOOM
3. POSSIBLE_SEWAGE_CONTAMINATION
4. POSSIBLE_INDUSTRIAL_DISCHARGE
5. POSSIBLE_STORMWATER_EVENT
6. UNKNOWN_WATER_QUALITY_ANOMALY

The classification must be based on available evidence.

It must NOT claim that the incident type is scientifically proven unless the evidence actually supports that conclusion.

Every classification must include:

- classification
- confidence band
- supporting evidence IDs
- contradicting evidence IDs
- missing evidence
- classification rationale


============================================================
7. OPERATIONAL SEVERITY
============================================================

Introduce an operational severity model separate from evidence confidence.

These concepts must not be conflated.

Evidence confidence answers:

"How strongly does the available evidence support the assessment?"

Operational severity answers:

"How consequential would this situation be if confirmed?"

Minimum levels:

LOW
MODERATE
HIGH
CRITICAL

Severity inputs may include:

- evidence confidence
- spatial extent
- proximity to populated areas
- recreational exposure potential
- persistence
- ecological sensitivity
- presence of citizen reports
- potential acute exposure pathway
- known site characteristics

The system must expose the factors contributing to severity.


============================================================
8. ACTION CATALOGUE MODEL
============================================================

Create an internal structured representation of the OneAquaHealth Catalogue of Measures.

Do NOT simply store free-form text.

Each measure should have structured metadata.

Minimum fields:

- measureId
- title
- description
- measureType
- applicableIncidentTypes
- applicableStressors
- applicableIndicators
- minimumEvidenceBand
- requiredVerification
- spatialRequirements
- temporalRequirements
- implementationComplexity
- estimatedTimeToInitiate
- responsibleStakeholder
- contraindications
- prerequisites
- sourceReference
- provenance
- humanApprovalRequired

The data model must make it possible to explain:

"Why was this recommendation considered?"


============================================================
9. CATALOGUE PROVENANCE
============================================================

Every catalogue measure must preserve provenance.

At minimum:

- source name
- source document
- source section/page if known
- catalogue identifier
- ingestion date
- version
- provenance status

The system must distinguish between:

OFFICIAL_OAH_MEASURE

and

AQUASENTINEL_DERIVED_OPERATIONAL_TASK

The system must never present a locally-created rule as though it were directly authored by OneAquaHealth.


============================================================
10. RECOMMENDATION ENGINE
============================================================

Create a deterministic Recommendation Engine.

Input:

EvidenceAssessment
+
Incident Classification
+
Stream Reach metadata
+
Catalogue of Measures

Output:

RecommendationSet

Each Recommendation must include:

- recommendationId
- incidentId
- measureId
- rank
- suitabilityScore
- rationale
- supportingEvidence
- missingPrerequisites
- contraindications
- requiredVerification
- responsibleRole
- humanApprovalRequired
- generatedAt
- provenance


============================================================
11. RECOMMENDATION SCORING
============================================================

The recommendation ranking must be deterministic and explainable.

Do NOT introduce a black-box ML model.

Suggested conceptual scoring dimensions:

1. Evidence compatibility
2. Incident compatibility
3. Site compatibility
4. Temporal compatibility
5. Required verification compatibility
6. Operational feasibility
7. Expected relevance
8. Safety/constraint compatibility

Each dimension must produce an explicit contribution.

Example:

Recommendation:
"Conduct riparian buffer assessment"

Score:
82/100

Breakdown:

Evidence compatibility:       +22
Incident compatibility:      +20
Site compatibility:          +18
Operational feasibility:     +12
Verification readiness:       +8
Contraindication penalty:     -0

The exact weighting may be tuned during implementation, but must be documented in code and architecture documentation.


============================================================
12. HARD SAFETY / SCIENTIFIC GATES
============================================================

The recommendation engine must contain hard gates.

Example:

IF evidenceBand = NORMAL
    THEN do not generate intervention recommendation.

IF evidenceBand = VERIFY
    THEN prioritize verification/inspection tasks.

IF evidenceBand = INVESTIGATE
    THEN generate investigation-oriented recommendations.

IF evidenceBand = PRIORITIZE
    THEN generate investigation + response recommendations,
    subject to human approval.

A single satellite observation must not directly generate a high-consequence intervention.

Where evidence is incomplete, recommend evidence gathering rather than pretending certainty.


============================================================
13. MISSING-EVIDENCE → TASK GENERATION
============================================================

Phase 3 already identifies missing evidence.

Phase 4 should operationalize that output.

Example:

Phase 3:

"What is missing:
Recent field observation confirming discoloration."

Phase 4:

"Recommended next action:
Dispatch field verification."

Task:

Type:
FIELD_VERIFICATION

Priority:
HIGH

Purpose:
Confirm visual water discoloration and collect photographic evidence.

Assigned role:
ENVIRONMENTAL_INSPECTOR

Required evidence:
Geotagged photograph
Timestamp
Observation form


============================================================
14. ACTION TYPES
============================================================

Minimum supported action types:

1. FIELD_VERIFY
2. COLLECT_WATER_SAMPLE
3. REVIEW_SENSOR_DATA
4. REQUEST_CITIZEN_VALIDATION
5. INSPECT_UPSTREAM_SOURCE
6. MONITOR_REACH
7. ISSUE_INTERNAL_ADVISORY_DRAFT
8. PREPARE_REMEDIATION_PLAN
9. REVIEW_NATURE_BASED_SOLUTION
10. ESCALATE_TO_AUTHORITY

Actions must be represented as structured objects rather than plain text.


============================================================
15. HUMAN-IN-THE-LOOP WORKFLOW
============================================================

The workflow must be:

Evidence
→
Assessment
→
Recommendation
→
Human Review
→
Approval / Rejection / Request More Evidence
→
Task Creation
→
Task Execution
→
Verification

The system must never silently skip human review.

Recommendation statuses:

DRAFT
PENDING_REVIEW
APPROVED
REJECTED
SUPERSEDED
EXECUTED
VERIFIED

Task statuses:

DRAFT
REQUESTED
ACCEPTED
IN_PROGRESS
COMPLETED
CANCELLED
VERIFIED


============================================================
16. FHIR WORKFLOW REPRESENTATION
============================================================

Phase 4 must extend the existing FHIR architecture.

The primary resources should be:

Observation
    ↓
Flag
    ↓
Task
    ↓
CommunicationRequest

Where appropriate.

Use the existing FHIR anti-corruption layer rather than leaking raw FHIR JSON throughout the application.

FHIR should represent the operational workflow.

The internal domain model remains the source of application logic.

Minimum requirements:

- Recommendation → FHIR-compatible representation
- Operational Task → FHIR Task
- Alert/incident state → FHIR Flag where appropriate
- Notification/request → FHIR CommunicationRequest where appropriate


============================================================
17. FHIR TASK REQUIREMENTS
============================================================

Every generated FHIR Task must contain sufficient information to understand:

- what needs to happen
- why it was generated
- what incident it belongs to
- which evidence triggered it
- who should perform/review it
- priority
- current status
- creation timestamp
- provenance/reference chain

The Task must be traceable back to:

Task
→ Recommendation
→ EvidenceAssessment
→ EvidenceItem
→ Observation


============================================================
18. EVENT-DRIVEN INTEGRATION
============================================================

Phase 4 must subscribe to Phase 3 events.

Primary trigger:

EvidenceUpdatedEvent

When an EvidenceAssessment crosses an actionable threshold:

1. Receive event.
2. Load assessment.
3. Classify incident.
4. Evaluate operational severity.
5. Query applicable measures.
6. Generate recommendations.
7. Persist recommendations.
8. Generate draft tasks.
9. Emit RecommendationGeneratedEvent.
10. Optionally produce FHIR workflow resources.
11. Update frontend.

The process must be idempotent.

Duplicate EvidenceUpdatedEvents must not generate duplicate recommendations or tasks.


============================================================
19. PERSISTENCE
============================================================

Implement SQL migration(s) for Phase 4.

Required entities:

recommendations
recommendation_evidence
action_catalogue
operational_tasks
task_events

If the existing Phase 1 schema already contains these tables, inspect and extend them rather than blindly recreating them.

Use:

- PostgreSQL/PostGIS production persistence
- In-memory repositories for deterministic testing/demo

Every persistent object requires UUIDv4 identifiers.

All timestamps must be UTC ISO-8601.


============================================================
20. API REQUIREMENTS
============================================================

Create or extend:

GET /api/v1/recommendations

GET /api/v1/recommendations/:id

GET /api/v1/recommendations/incident/:incidentId

POST /api/v1/recommendations/:id/approve

POST /api/v1/recommendations/:id/reject

POST /api/v1/recommendations/:id/request-more-evidence

GET /api/v1/actions/catalogue

GET /api/v1/actions/catalogue/:measureId

GET /api/v1/tasks

GET /api/v1/tasks/:id

POST /api/v1/tasks/:id/accept

POST /api/v1/tasks/:id/complete

POST /api/v1/tasks/:id/verify

Exact route naming may be adjusted to match the existing architecture, but API semantics must remain.


============================================================
21. RECOMMENDATION EXPLANATION
============================================================

Every recommendation shown to a human must answer four questions:

WHY THIS?

WHY NOW?

WHAT SUPPORTS IT?

WHAT COULD CHANGE THE DECISION?

Example:

RECOMMENDED ACTION

Conduct upstream field inspection.

WHY THIS?
Recent evidence indicates a spatially localized water-quality anomaly.

WHY NOW?
Evidence score increased from 47 → 74 within the active assessment window.

WHAT SUPPORTS IT?
• Sentinel-2 NDCI anomaly
• Citizen discoloration report
• Historical baseline deviation

WHAT WEAKENS IT?
• Recent rainfall may explain part of the signal.

WHAT IS MISSING?
• Field confirmation.

This explanation must be generated from structured data, not an LLM-generated paragraph.


============================================================
22. FRONTEND REQUIREMENTS
============================================================

Create a dedicated Recommendation / Response view.

Minimum UI:

A. Incident header

- incident type
- reach
- severity
- evidence confidence
- current status

B. Evidence summary

- score
- supporting evidence
- contradicting evidence
- missing evidence

C. Recommended Actions

Cards containing:

- action
- recommendation rank
- suitability score
- rationale
- source measure
- required verification
- responsible role

D. Human Review Controls

Buttons:

APPROVE
REJECT
REQUEST MORE EVIDENCE

E. Generated Task

Show:

- task type
- assignee role
- priority
- status
- evidence chain
- FHIR resource identifier


============================================================
23. OPERATIONAL TASK VIEW
============================================================

Extend the existing Operational Tasks interface.

A task should display:

Incident
↓
Recommendation
↓
Action
↓
Task

The UI must allow the demo user to:

1. Review task.
2. Accept task.
3. Mark task in progress.
4. Complete task.
5. Verify task.

Every state transition must be recorded.

The interface should visually communicate that AquaSentinel is coordinating a workflow rather than autonomously performing physical intervention.


============================================================
24. DEMO SCENARIOS
============================================================

Implement deterministic scenarios.

SCENARIO A — LOW CONFIDENCE

Satellite anomaly only.

Expected:

- low/moderate confidence
- no direct intervention
- field verification recommendation

SCENARIO B — CORROBORATED EVENT

Satellite anomaly
+
citizen observation
+
baseline deviation.

Expected:

- elevated confidence
- incident classification
- field investigation recommendation
- draft FHIR Task

SCENARIO C — CONTRADICTED EVENT

Satellite anomaly
+
heavy rainfall
+
no citizen corroboration.

Expected:

- confidence reduced
- storm runoff explanation surfaced
- no high-priority intervention
- monitoring / verification recommendation

SCENARIO D — HIGH-CONFIDENCE INCIDENT

Satellite anomaly
+
citizen observation
+
supporting weather/context data
+
strong baseline deviation.

Expected:

- high evidence score
- incident classified
- multiple candidate measures
- ranked recommendations
- human approval gate
- FHIR Task generated after approval

SCENARIO E — MISSING EVIDENCE

Strong environmental signal but insufficient field confirmation.

Expected:

- recommendation engine explicitly requests missing evidence
- field verification task created
- intervention remains gated


============================================================
25. FHIR DEMONSTRATION
============================================================

The Phase 4 demo must visibly demonstrate interoperability.

Example flow:

1. Environmental Observation enters system.
2. Phase 3 evaluates evidence.
3. Evidence crosses actionable threshold.
4. Phase 4 generates recommendation.
5. Human approves recommendation.
6. AquaSentinel creates FHIR Task.
7. HAPI FHIR receives Task.
8. Task is displayed in FHIR server.
9. AquaSentinel retains internal provenance chain.

The demo must make it obvious that FHIR is being used for operational interoperability, not merely stored as JSON.


============================================================
26. DUPLICATE / IDEMPOTENCY PROTECTION
============================================================

The engine must protect against:

- repeated evidence events
- repeated webhook deliveries
- repeated approval requests
- duplicate task generation
- duplicate FHIR resources

Recommendation generation should use a deterministic idempotency signature based on:

incident
+
assessment version
+
measure
+
workflow state

Duplicate events must result in a single logical recommendation.


============================================================
27. AUDIT TRAIL
============================================================

Every consequential transition must be auditable.

Example:

09:42 EvidenceAssessment created
09:42 Recommendation generated
09:43 Human review requested
09:44 Recommendation approved
09:44 FHIR Task created
09:46 Task accepted
09:51 Task completed
09:53 Task verified

Persist event metadata including:

- event ID
- entity ID
- event type
- timestamp
- actor
- previous state
- new state
- reason


============================================================
28. TESTING REQUIREMENTS
============================================================

The implementation must include:

UNIT TESTS

- incident classification
- severity calculation
- catalogue matching
- recommendation scoring
- hard safety gates
- recommendation explanations
- idempotency
- FHIR Task mapping
- state transitions

INTEGRATION TESTS

- EvidenceUpdatedEvent → recommendation
- recommendation → task
- task → FHIR Task
- approval workflow
- rejection workflow
- request-more-evidence workflow
- persistence
- duplicate event handling

END-TO-END TEST

At least one complete scenario must execute:

Observation
→
EvidenceAssessment
→
Recommendation
→
Human Approval
→
Task
→
FHIR Task

All existing Phase 1–3 tests must continue passing.


============================================================
29. SCIENTIFIC / ETHICAL GUARDRAILS
============================================================

The system must never:

- diagnose human disease
- claim an environmental measurement proves human illness
- claim a satellite signal proves cyanotoxin presence
- issue autonomous public-health orders
- autonomously execute physical remediation
- hide uncertainty
- suppress contradictory evidence
- fabricate Catalogue of Measures references

Use wording such as:

"possible"
"consistent with"
"evidence supports"
"requires verification"
"recommended for review"

rather than:

"confirmed"
"proven"
"safe"
"unsafe"

unless the underlying data and authoritative threshold genuinely justify that terminology.


============================================================
30. OBSERVABILITY
============================================================

Add diagnostics for:

- recommendation engine executions
- recommendations generated
- recommendations rejected
- recommendations approved
- tasks generated
- FHIR resources generated
- failed FHIR submissions
- duplicate events
- catalogue matching failures

System Health should expose these metrics where practical.


============================================================
31. ARCHITECTURE DOCUMENTATION
============================================================

Update docs/ARCHITECTURE.md.

Document:

1. Recommendation architecture
2. Catalogue data model
3. Recommendation scoring
4. Safety gates
5. Human approval workflow
6. Recommendation → Task pipeline
7. FHIR workflow mapping
8. Provenance chain
9. Idempotency model
10. State machines
11. Event flow

Create ADRs for major decisions where appropriate.


============================================================
32. DEVELOPMENT DOCUMENTATION
============================================================

Update:

README.md
DEVELOPMENT.md

Document:

- how to run Phase 4
- how to seed catalogue measures
- how to run demo scenarios
- how to approve/reject recommendations
- how to inspect generated FHIR resources
- how to run tests
- environment variables
- demo mode vs live mode


============================================================
33. DEMO REQUIREMENTS
============================================================

The Phase 4 implementation must support a deterministic 3–5 minute demonstration.

Preferred story:

"Something has changed in the stream."

↓

Satellite evidence arrives.

↓

Citizen observation corroborates it.

↓

Phase 3 says:

"Evidence score: 82/100 — PRIORITIZE."

↓

Phase 4 says:

"Possible eutrophication event."

↓

System explains:

"Satellite anomaly + citizen observation + baseline deviation."

↓

System produces:

"Recommended next action:
Field verification and upstream inspection."

↓

Human reviews.

↓

Human approves.

↓

AquaSentinel generates:

FHIR Task

↓

HAPI FHIR receives the Task.

↓

Task appears in the operational task queue.

↓

The audience can see:

Evidence
→
Decision
→
Action
→
Interoperable workflow


============================================================
34. DEFINITION OF DONE
============================================================

Phase 4 is complete only when all are true:

[ ] Recommendation engine implemented.

[ ] Catalogue representation implemented.

[ ] Catalogue provenance implemented.

[ ] Incident classification implemented.

[ ] Operational severity implemented.

[ ] Recommendation scoring implemented.

[ ] Hard safety gates implemented.

[ ] Human approval workflow implemented.

[ ] Missing-evidence tasks implemented.

[ ] Operational task lifecycle implemented.

[ ] Recommendation API implemented.

[ ] Task API implemented.

[ ] FHIR Task mapping implemented.

[ ] FHIR workflow integration verified.

[ ] Provenance chain implemented.

[ ] Idempotency implemented.

[ ] Audit trail implemented.

[ ] Frontend recommendation view implemented.

[ ] Frontend task workflow implemented.

[ ] Deterministic demo scenarios implemented.

[ ] Unit tests implemented.

[ ] Integration tests implemented.

[ ] End-to-end workflow tested.

[ ] Existing Phase 1–3 tests remain green.

[ ] Production build passes.

[ ] Architecture documentation updated.

[ ] Development documentation updated.

[ ] Phase 4 walkthrough created.

[ ] Phase 4 handoff document created.


============================================================
35. MANDATORY HANDOFF DOCUMENT
============================================================

At the end of Phase 4, create:

prd/PHASE_4_HANDOFF.md

This document is mandatory.

It will be handed directly to the Phase 5 implementation agent.

It must contain:

1. Phase 4 summary
2. What was implemented
3. Files created
4. Files modified
5. Database migrations
6. New domain models
7. New APIs
8. New events
9. Recommendation engine architecture
10. Catalogue model
11. Scoring formulas
12. Safety gates
13. Human approval workflow
14. Task lifecycle
15. FHIR resources generated
16. Provenance chain
17. Idempotency strategy
18. Audit trail
19. Frontend changes
20. Test coverage
21. Test results
22. Build results
23. Known limitations
24. Known technical debt
25. Environment variables
26. Demo instructions
27. Deterministic scenarios
28. Seed data
29. Important architectural decisions
30. Phase 5 integration instructions
31. Anything Phase 5 must NOT modify
32. Anything Phase 5 is expected to extend

The handoff must be detailed enough that a fresh Phase 5 agent can continue without asking the user to explain Phase 4.

============================================================
36. HANDOFF FAILURE CONDITION
============================================================

If PHASE_4_HANDOFF.md cannot be created successfully:

Phase 4 is NOT complete.

The agent must explicitly report:

"HANDOFF DOCUMENT NOT CREATED — PHASE 4 INCOMPLETE"

Do not silently proceed.

The file must exist at:

prd/PHASE_4_HANDOFF.md


============================================================
37. PHASE 5 COMPATIBILITY
============================================================

Phase 4 must avoid architectural decisions that unnecessarily constrain Phase 5.

Use interfaces and adapters where future external systems may be introduced.

In particular:

- Catalogue source must be replaceable.
- FHIR destination must remain adapter-based.
- Recommendation scoring must be configurable.
- Task assignment must be extensible.
- Notification channels must remain decoupled.
- Frontend components must consume typed API contracts.

Do not hard-code the entire system around one external API.


============================================================
38. NON-GOALS
============================================================

Do NOT build:

- autonomous physical intervention
- autonomous public-health decision-making
- disease diagnosis
- toxin concentration prediction without appropriate data
- a generative-AI recommendation engine
- a generic chatbot
- a second evidence-fusion engine
- a duplicate OAH dashboard
- a replacement for the OAH Decision Support System

The contribution is:

Evidence-backed operational orchestration.


============================================================
39. PHASE 4 SUCCESS CRITERION
============================================================

The strongest possible evidence that Phase 4 works is:

A real or deterministic environmental observation enters AquaSentinel.

Phase 3 independently establishes that the evidence is sufficiently actionable.

Phase 4 explains why an action is appropriate.

A human approves the recommendation.

A structured operational task is created.

That task is represented through FHIR.

The entire chain remains auditable.

Therefore:

OBSERVATION
→
EVIDENCE
→
ASSESSMENT
→
RECOMMENDATION
→
HUMAN DECISION
→
TASK
→
FHIR INTEROPERABILITY

must function end-to-end.


============================================================
40. PHASE 4 OUTPUT
============================================================

At completion, AquaSentinel should no longer be merely:

"an environmental monitoring platform."

It should demonstrably function as:

"an evidence-driven One Health operational decision-support and interoperability layer."

Phase 4 establishes the action layer of the platform.

Phase 5 will build on this completed operational foundation.