# AquaSentinel — Phase 5 PRD
## Municipal Command Console & Real-Time Operational UX

Version: 1.0
Phase: 5 of 9
Depends on: Phase 1, Phase 2, Phase 3, Phase 4

============================================================
1. PHASE OBJECTIVE
============================================================

Phase 5 turns the underlying AquaSentinel infrastructure into a
coherent municipal command console.

Phases 1–4 have progressively established:

Phase 1:
Foundation, persistence, FHIR, event infrastructure and application shell.

Phase 2:
Environmental data ingestion from satellite, weather and citizen sources.

Phase 3:
Evidence fusion, spatial/temporal corroboration, uncertainty,
contradiction detection and evidence assessments.

Phase 4:
Incident classification, operational severity, Catalogue-based
recommendations, human approval and operational task generation.

Phase 5 must now make all of this understandable and usable through
one unified operational interface.

The primary transformation is:

DATA
↓
INTELLIGENCE
↓
DECISION
↓
ACTION

The interface must allow a municipal operator to understand an incident
within seconds rather than navigating through multiple technical screens.


============================================================
2. PRIMARY PRODUCT
============================================================

Build the AquaSentinel Municipal Command Console.

The console is an operational interface for:

- environmental officers
- municipal water authorities
- catchment managers
- public-health/environmental protection personnel
- field coordinators

It should answer five questions immediately:

1. WHERE is something happening?
2. WHAT is happening?
3. HOW STRONG is the evidence?
4. WHAT should happen next?
5. WHAT has already been done?


============================================================
3. DESIGN PRINCIPLE
============================================================

The interface must not look like:

- a generic CRUD dashboard
- a developer admin panel
- a data-science notebook
- a generic GIS viewer
- an AI chatbot

It should feel like a real operational command centre.

The visual hierarchy should prioritize:

1. Active incidents
2. Risk/severity
3. Location
4. Evidence confidence
5. Recommended action
6. Task status
7. Provenance/auditability

Complexity should be progressively disclosed.

A municipal operator should see the conclusion first and be able
to drill down into the scientific evidence.


============================================================
4. EXISTING SYSTEM TO EXTEND
============================================================

DO NOT replace the existing frontend architecture.

Phase 1 already established:

- React
- Vite
- Tailwind
- application shell
- dashboard
- stream reaches
- incident queue
- operational tasks
- system health
- LIVE/DEMO mode

Phase 3 established the evidence-fusion backend and corresponding
visualization requirements.

Phase 4 establishes recommendations and operational workflows.

Phase 5 must integrate these existing capabilities rather than
creating a parallel frontend.


============================================================
5. CORE SCREEN ARCHITECTURE
============================================================

The console should contain the following primary areas:

A. Command Dashboard
B. Live Incident Map
C. Incident Detail
D. Evidence Inspector
E. Recommendation Panel
F. Operational Task Queue
G. Audit / Timeline
H. System Health

Navigation should remain simple.

Recommended structure:

COMMAND
INCIDENTS
MAP
TASKS
EVIDENCE
SYSTEM


============================================================
6. COMMAND DASHBOARD
============================================================

The main dashboard should provide an immediate operational overview.

Top-level metrics:

- Active incidents
- High-priority incidents
- Pending human reviews
- Tasks in progress
- Tasks awaiting verification
- Environmental reaches monitored
- Last ingestion
- System health

Do not overload the dashboard with meaningless metrics.

Every metric must have an operational purpose.


============================================================
7. INCIDENT MAP
============================================================

The map is the primary spatial interface.

Display:

- stream reaches
- current incident state
- severity
- confidence
- recent observations
- active tasks
- relevant municipal boundaries

Incident states should be visually distinguishable.

Example:

NORMAL
VERIFY
INVESTIGATE
PRIORITIZE

Do not rely solely on colour.

Use:

- icon
- shape
- label
- status text

for accessibility.


============================================================
8. MAP INTERACTION
============================================================

Clicking a stream reach should open a contextual panel containing:

- reach name
- current status
- evidence score
- evidence confidence band
- latest observation
- historical baseline
- recent changes
- active incidents
- recommended actions
- active tasks

The operator should be able to go from:

MAP
→
INCIDENT
→
EVIDENCE
→
RECOMMENDATION

without losing context.


============================================================
9. INCIDENT DETAIL PAGE
============================================================

Every incident must have a dedicated operational view.

Header:

- Incident ID
- Incident classification
- Stream reach
- Operational severity
- Evidence confidence
- Status
- Last updated

Main content:

LEFT:
Evidence

CENTRE:
Incident explanation

RIGHT:
Recommended actions

BOTTOM:
Timeline / tasks / audit


============================================================
10. INCIDENT STATUS
============================================================

Display both:

Evidence State

and

Operational State

These are different concepts.

Evidence State:

NORMAL
VERIFY
INVESTIGATE
PRIORITIZE

Operational State:

OPEN
UNDER_REVIEW
ACTION_APPROVED
IN_PROGRESS
RESOLVED
VERIFIED
CLOSED

Never collapse them into one field.


============================================================
11. EVIDENCE SUMMARY
============================================================

The operator should see a concise evidence summary.

Example:

EVIDENCE CONFIDENCE

82 / 100

PRIORITIZE

Supporting evidence:
✓ Sentinel-2 NDCI anomaly
✓ Citizen field observation
✓ Historical baseline deviation

Contradictory evidence:
△ Recent rainfall may explain part of the signal

Missing:
! Field confirmation

This is a summary.

The full scientific reasoning belongs in the Evidence Inspector.


============================================================
12. EVIDENCE INSPECTOR
============================================================

Create a detailed evidence inspection interface.

Each evidence item should display:

- source
- timestamp
- location
- measurement
- quality
- relevance
- provenance
- relationship to incident

Sources should be visually grouped:

SATELLITE
WEATHER
CITIZEN
IN-SITU
BASELINE

The interface should show how evidence contributed to the final
assessment.


============================================================
13. SCORE BREAKDOWN
============================================================

Display the Phase 3 evidence score transparently.

Example:

Evidence Score
82 / 100

Contribution:

Satellite anomaly          +28
Citizen corroboration     +21
Baseline deviation        +17
Weather consistency       +11
Quality adjustment          +5
-----------------------------
Final                      82

Use the actual Phase 3 calculation returned by the backend.

DO NOT recalculate evidence scores independently in React.


============================================================
14. CONTRADICTION DISPLAY
============================================================

Contradictory evidence must be visible.

Example:

CONTRADICTING SIGNAL

Recent rainfall detected.

Why it matters:

Heavy rainfall can create optical and water-quality changes that
may resemble some environmental anomalies.

Effect:

Reduced confidence.

This is important for scientific credibility.

The UI must never hide inconvenient evidence.


============================================================
15. MISSING EVIDENCE DISPLAY
============================================================

When Phase 3 identifies missing evidence, show:

MISSING EVIDENCE

Field confirmation required.

Reason:
Remote sensing signal requires ground verification.

Recommended next step:
Field inspection.

The interface should allow the operator to open the corresponding
Phase 4 recommendation/task.


============================================================
16. RECOMMENDATION PANEL
============================================================

Integrate Phase 4 recommendations.

Each recommendation should display:

- action
- suitability score
- priority
- rationale
- supporting evidence
- required verification
- responsible role
- source catalogue measure
- approval status

Example:

RECOMMENDED ACTION

Field verification

Suitability:
91 / 100

Why:
Strong environmental signal but field confirmation remains missing.

Required:
Environmental inspector

Approval:
PENDING REVIEW


============================================================
17. RECOMMENDATION COMPARISON
============================================================

When multiple recommendations exist, display them together.

Example:

1. Field verification
   Suitability 91

2. Upstream inspection
   Suitability 78

3. Continue monitoring
   Suitability 63

The ranking must come directly from Phase 4.

The frontend must NOT create its own ranking.


============================================================
18. HUMAN DECISION INTERFACE
============================================================

The operator must be able to:

APPROVE
REJECT
REQUEST MORE EVIDENCE

Before approval, show:

- action
- rationale
- evidence
- uncertainty
- prerequisites
- consequences
- responsible role

Approval must require an explicit user interaction.

No automatic approval.


============================================================
19. APPROVAL CONFIRMATION
============================================================

After approval, show a clear confirmation state.

Example:

ACTION APPROVED

Field verification task created.

Task:
TASK-2048

Assigned role:
Environmental Inspector

Priority:
HIGH

FHIR:
Task/8f4...

Timestamp:
14:32 UTC

The user should immediately understand what happened.


============================================================
20. OPERATIONAL TASK QUEUE
============================================================

Build a professional task queue.

Columns/cards:

- Task
- Incident
- Priority
- Responsible role
- Created
- Due/status
- Current state

Filters:

- priority
- status
- incident
- stream reach
- role

Supported states:

DRAFT
REQUESTED
ACCEPTED
IN_PROGRESS
COMPLETED
VERIFIED
CANCELLED


============================================================
21. TASK DETAIL
============================================================

A task detail screen must show:

WHAT:
What needs to happen?

WHY:
Why was it generated?

EVIDENCE:
What evidence supports it?

INCIDENT:
Which incident?

RECOMMENDATION:
Which recommendation produced it?

FHIR:
Which FHIR resource represents it?

PROVENANCE:
Where did the underlying evidence originate?

STATUS:
Where is the task in its lifecycle?


============================================================
22. TASK STATE TRANSITIONS
============================================================

Provide controls for valid transitions only.

Example:

REQUESTED
→ ACCEPTED
→ IN_PROGRESS
→ COMPLETED
→ VERIFIED

Invalid transitions must be blocked.

The UI must not allow arbitrary status manipulation.


============================================================
23. REAL-TIME UPDATES
============================================================

Phase 5 must introduce real-time frontend updates.

When the backend emits an event:

The UI should update without a manual page refresh.

Relevant events include:

- ObservationCreated
- EvidenceUpdated
- IncidentUpdated
- RecommendationGenerated
- RecommendationApproved
- TaskCreated
- TaskUpdated
- FhirResourceCreated

Use the existing event architecture.

If WebSockets are already available, use them.

If not, introduce a clean real-time transport abstraction.

Do not tightly couple the React application directly to the
backend event bus.


============================================================
24. REAL-TIME INCIDENT EXPERIENCE
============================================================

Demonstration requirement:

An operator has the dashboard open.

A new satellite observation arrives.

The system should visibly update:

1. New observation appears.
2. Incident state changes.
3. Evidence score updates.
4. Incident appears on map.
5. Recommendation becomes available.
6. Operator sees review notification.

No page reload.


============================================================
25. INCIDENT TIMELINE
============================================================

Every incident must have a chronological timeline.

Example:

12:04
Sentinel-2 observation received

12:04
Evidence assessment updated

12:04
Citizen observation linked

12:04
Incident classified

12:05
Recommendation generated

12:06
Recommendation approved

12:06
FHIR Task created

12:19
Task accepted

12:47
Task completed

12:51
Verification recorded

Timeline events must come from backend/audit data.

Do not fabricate timeline entries in the frontend.


============================================================
26. PROVENANCE UX
============================================================

The system should make provenance accessible without overwhelming
the primary interface.

Every important object should support:

"View provenance"

This opens:

Source
→
Observation
→
Evidence
→
Assessment
→
Recommendation
→
Task
→
FHIR resource

This is a critical feature for the project's scientific and
interoperability credibility.


============================================================
27. FHIR RESOURCE VIEWER
============================================================

Provide an optional technical view.

When viewing a Task, allow:

VIEW FHIR RESOURCE

Display:

- resource type
- resource ID
- status
- priority
- references
- timestamps

Provide a raw JSON inspection mode for technical demonstration.

Do not make raw FHIR JSON the default user experience.


============================================================
28. FHIR INTEROPERABILITY STATUS
============================================================

Show whether an operational object has been successfully synchronized.

Example:

FHIR STATUS

✓ Task synchronized

FHIR Resource:
Task/abc123

or:

⚠ Pending synchronization

or:

✕ Synchronization failed

The UI must never claim synchronization succeeded unless the
backend confirms it.


============================================================
29. SYSTEM HEALTH
============================================================

Extend the existing System Health page.

Show:

- Backend
- PostgreSQL
- HAPI FHIR
- Event system
- Satellite adapter
- Weather adapter
- Citizen adapter
- Recommendation engine
- Real-time transport

Statuses:

HEALTHY
DEGRADED
OFFLINE

Include last successful event timestamps.


============================================================
30. DEMO MODE
============================================================

The entire command console must function in DEMO mode without
external API credentials.

Demo mode must provide:

- deterministic incidents
- deterministic evidence
- deterministic recommendations
- deterministic task transitions
- deterministic FHIR resources

The demo must never depend on an external network connection.


============================================================
31. LIVE MODE
============================================================

When APP_MODE=live:

The interface should consume actual backend APIs.

Do not make the frontend call:

- Sentinel Hub
- Open-Meteo
- Citizen APIs
- HAPI FHIR

directly unless the existing architecture explicitly requires it.

The backend remains responsible for external integrations.


============================================================
32. RESPONSIVE DESIGN
============================================================

The primary target is desktop municipal operations.

However, the interface should remain usable on:

- laptop
- tablet

Field personnel should be able to view task details and update
task status from a narrower screen.

A completely separate mobile application is NOT required.


============================================================
33. ACCESSIBILITY
============================================================

The interface must not communicate status through colour alone.

Provide:

- text labels
- icons
- accessible contrast
- keyboard navigation where practical
- semantic buttons
- visible focus states
- descriptive labels

Incident severity must remain understandable to colour-blind users.


============================================================
34. PERFORMANCE
============================================================

The command console should remain responsive with:

- hundreds of observations
- dozens of incidents
- hundreds of tasks

Avoid unnecessary full-page rerenders.

Use:

- query caching
- memoization where justified
- pagination
- virtualized lists if necessary

Do not prematurely optimize.


============================================================
35. API INTEGRATION
============================================================

Use the existing typed API contracts.

Potential required endpoints:

GET /api/v1/dashboard/summary

GET /api/v1/incidents

GET /api/v1/incidents/:id

GET /api/v1/incidents/:id/evidence

GET /api/v1/incidents/:id/recommendations

GET /api/v1/incidents/:id/timeline

GET /api/v1/tasks

GET /api/v1/tasks/:id

POST /api/v1/recommendations/:id/approve

POST /api/v1/recommendations/:id/reject

POST /api/v1/recommendations/:id/request-more-evidence

POST /api/v1/tasks/:id/accept

POST /api/v1/tasks/:id/complete

POST /api/v1/tasks/:id/verify

Reuse Phase 4 routes where they already exist.

Do not duplicate APIs merely for frontend convenience.


============================================================
36. FRONTEND STATE ARCHITECTURE
============================================================

Separate:

SERVER STATE

from

UI STATE.

Server state:

- incidents
- evidence
- recommendations
- tasks
- timeline
- system health

UI state:

- selected incident
- active map layer
- filters
- open panels
- modal state
- expanded evidence items

Use a coherent data-fetching/cache strategy.

Do not create a giant global state object containing everything.


============================================================
37. ERROR STATES
============================================================

Every major view must handle:

- loading
- empty
- error
- stale
- offline/degraded

Example:

FHIR synchronization unavailable.

Do not silently show old information as though it were current.

If data is stale, communicate:

LAST UPDATED
X minutes ago


============================================================
38. NOTIFICATION SYSTEM
============================================================

Introduce an in-app notification system.

Notifications should include:

- new high-priority incident
- recommendation awaiting review
- task created
- task completed
- FHIR synchronization failure
- system degradation

Notifications should be actionable.

Example:

HIGH PRIORITY INCIDENT

Almyros Stream

Evidence score:
84

Review recommendation
[OPEN INCIDENT]


============================================================
39. DO NOT BUILD A CHATBOT
============================================================

Do not introduce a generic AI assistant.

The system's intelligence is represented through:

- evidence fusion
- deterministic scoring
- structured explanations
- recommendation rules
- provenance
- operational workflows

If explanatory natural language is required, it must be generated
from structured backend facts and must not invent scientific conclusions.


============================================================
40. END-TO-END UX SCENARIO
============================================================

The primary Phase 5 demonstration should be:

START:

Command dashboard is open.

STEP 1 — INPUT

A new Sentinel-2 observation arrives.

STEP 2 — INTELLIGENCE

The dashboard updates automatically.

Evidence score rises.

Supporting evidence appears.

STEP 3 — DECISION

The incident is classified.

A recommendation appears.

The operator opens it.

STEP 4 — HUMAN REVIEW

The operator reviews evidence and approves the recommendation.

STEP 5 — ACTION

A task is created.

STEP 6 — INTEROPERABILITY

The FHIR Task is synchronized.

STEP 7 — TRACKING

The task appears in the operational queue.

STEP 8 — COMPLETION

The operator progresses the task.

STEP 9 — VERIFICATION

The incident timeline records completion and verification.

The entire flow should be understandable without opening developer tools.


============================================================
41. VISUAL DEMONSTRATION REQUIREMENT
============================================================

The system must support a 45–60 second "golden path."

The golden path should show:

MAP
→
ALERT
→
EVIDENCE
→
RECOMMENDATION
→
APPROVAL
→
TASK
→
FHIR

The user should not need to navigate through more than a few screens.


============================================================
42. TESTING
============================================================

Write tests for:

Frontend:

- dashboard rendering
- incident rendering
- evidence display
- recommendation display
- approval interaction
- rejection interaction
- task state transitions
- notification rendering
- real-time event handling
- error states
- stale data handling

Integration:

- backend → frontend incident retrieval
- recommendation retrieval
- task retrieval
- approval
- task updates
- FHIR status
- real-time updates

End-to-end:

Observation
→
EvidenceAssessment
→
Incident
→
Recommendation
→
Approval
→
Task
→
FHIR
→
Frontend update


============================================================
43. REGRESSION REQUIREMENT
============================================================

All Phase 1–4 tests must remain passing.

Do not weaken previous tests to make Phase 5 pass.

Run:

npm test -- --run

and:

npm run build

before completion.


============================================================
44. DOCUMENTATION
============================================================

Update:

README.md
DEVELOPMENT.md
docs/ARCHITECTURE.md

Document:

- frontend architecture
- screen architecture
- real-time transport
- server-state strategy
- UI state strategy
- notification system
- FHIR status presentation
- demo mode
- golden path


============================================================
45. WALKTHROUGH
============================================================

Create:

walkthrough.md

The walkthrough must describe how to reproduce:

1. Start system.
2. Open command console.
3. Trigger demo observation.
4. Observe real-time update.
5. Open incident.
6. Inspect evidence.
7. Open recommendation.
8. Approve recommendation.
9. Observe task creation.
10. Inspect FHIR Task.
11. Complete task.
12. Verify task.
13. Inspect incident timeline.


============================================================
46. DEFINITION OF DONE
============================================================

Phase 5 is complete only when:

[ ] Municipal Command Console implemented.

[ ] Existing frontend shell successfully extended.

[ ] Command dashboard implemented.

[ ] Incident map implemented.

[ ] Incident detail implemented.

[ ] Evidence Inspector implemented.

[ ] Recommendation interface implemented.

[ ] Human approval interface implemented.

[ ] Operational task queue implemented.

[ ] Task detail implemented.

[ ] Incident timeline implemented.

[ ] Provenance UI implemented.

[ ] FHIR resource viewer implemented.

[ ] FHIR synchronization status implemented.

[ ] System Health extended.

[ ] Real-time frontend updates implemented.

[ ] Notification system implemented.

[ ] DEMO mode works without external APIs.

[ ] LIVE mode consumes backend APIs.

[ ] Loading states implemented.

[ ] Error states implemented.

[ ] Empty states implemented.

[ ] Stale-data states implemented.

[ ] Accessibility requirements implemented.

[ ] Responsive behaviour implemented.

[ ] Frontend tests implemented.

[ ] Integration tests implemented.

[ ] End-to-end workflow tested.

[ ] Phase 1–4 tests remain green.

[ ] Monorepo build passes.

[ ] Documentation updated.

[ ] Walkthrough created.

[ ] Phase 5 handoff created.


============================================================
47. MANDATORY PHASE 5 HANDOFF
============================================================

Create:

prd/PHASE_5_HANDOFF.md

This document is mandatory.

It must contain:

1. Phase 5 objective
2. What was implemented
3. Frontend architecture
4. Screen architecture
5. Component hierarchy
6. Routes
7. API integrations
8. Server-state architecture
9. UI-state architecture
10. Real-time architecture
11. Notification architecture
12. Map implementation
13. Incident detail implementation
14. Evidence Inspector
15. Recommendation interface
16. Approval workflow
17. Task queue
18. Task detail
19. Timeline
20. Provenance UI
21. FHIR viewer
22. FHIR synchronization status
23. System Health
24. Demo mode
25. Live mode
26. Error handling
27. Accessibility
28. Responsive behaviour
29. Tests
30. Test results
31. Build results
32. Known limitations
33. Technical debt
34. Environment variables
35. Demo instructions
36. Golden-path instructions
37. Files created
38. Files modified
39. Phase 6 starting state
40. Components Phase 6 should reuse
41. Components Phase 6 should not rewrite
42. Exact extension points for Phase 6


============================================================
48. HANDOFF VALIDATION
============================================================

Before declaring Phase 5 complete:

Verify:

test -f prd/PHASE_5_HANDOFF.md

Verify it is non-empty.

Verify it accurately describes the implemented code.

If it cannot be created:

Report exactly:

"HANDOFF DOCUMENT NOT CREATED — PHASE 5 INCOMPLETE"

Do not claim completion.


============================================================
49. PHASE 6 COMPATIBILITY
============================================================

Phase 5 must not unnecessarily constrain Phase 6.

The frontend should remain modular.

Future phases may add:

- advanced resilience analytics
- public-facing communication
- scenario simulation
- deployment hardening
- richer interoperability
- presentation/demo functionality

Therefore:

- do not hard-code demo scenarios into UI components
- keep data-driven components reusable
- keep API calls separated from presentation
- keep real-time events typed
- keep map layers modular
- keep incident/recommendation/task components reusable


============================================================
50. PHASE 5 SUCCESS CRITERION
============================================================

A fresh municipal operator should be able to open AquaSentinel and,
without technical knowledge, understand:

WHAT HAPPENED?

WHERE?

HOW CONFIDENT ARE WE?

WHAT SUPPORTS IT?

WHAT CONTRADICTS IT?

WHAT SHOULD I DO?

HAS SOMEONE APPROVED IT?

WHO IS RESPONSIBLE?

WHAT IS THE TASK STATUS?

DID THE FHIR SYSTEM RECEIVE IT?

WHAT HAPPENED NEXT?


The complete chain must be visually and operationally coherent:

OBSERVATION
→
EVIDENCE
→
ASSESSMENT
→
INCIDENT
→
RECOMMENDATION
→
HUMAN DECISION
→
TASK
→
FHIR
→
AUDIT TRAIL


============================================================
51. FINAL OUTPUT
============================================================

At completion, provide a concise completion report containing:

- what was implemented
- screens created/modified
- frontend architecture
- real-time architecture
- API integrations
- FHIR integration
- test count/result
- build result
- known limitations
- golden-path demo result
- confirmation that prd/PHASE_5_HANDOFF.md exists
- instructions for Phase 6

Do not merely provide a plan.

Actually implement the Phase 5 PRD.