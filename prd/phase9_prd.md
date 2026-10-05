# AquaSentinel — Phase 9 PRD
## Final Integration, Hardening, Validation & Hackathon Release

Version: 1.0
Phase: 9 of 9

Depends on:
Phase 1 — Foundation & Infrastructure
Phase 2 — Environmental Data Ingestion
Phase 3 — Evidence Fusion & Confidence
Phase 4 — Operational Intelligence & Human Approval
Phase 5 — Municipal Command Console
Phase 6 — Resilience Intelligence & Scenario Simulation
Phase 7 — Event-Driven One Health Interoperability
Phase 8 — Closed-Loop Field Response & Verification


============================================================
1. PHASE OBJECTIVE
============================================================

Phase 9 is the final integration and release phase.

The goal is NOT to introduce another major product subsystem.

The goal is to make the complete AquaSentinel system:

- stable
- reproducible
- testable
- observable
- understandable
- demonstrable
- resilient to predictable failures
- ready for external evaluation
- ready for the hackathon submission/demo

Phase 9 must validate that all previous phases operate as ONE
coherent system.

The final product must demonstrate:

ENVIRONMENTAL SIGNAL
        ↓
DATA INGESTION
        ↓
EVIDENCE FUSION
        ↓
CONFIDENCE ASSESSMENT
        ↓
INCIDENT
        ↓
RECOMMENDATION
        ↓
HUMAN APPROVAL
        ↓
OPERATIONAL TASK
        ↓
FIELD VERIFICATION
        ↓
REASSESSMENT
        ↓
OUTCOME
        ↓
FHIR INTEROPERABILITY
        ↓
EXTERNAL SYSTEM
        ↓
AUDIT TRAIL


============================================================
2. PHASE 9 NON-GOALS
============================================================

Do NOT introduce a new major product feature unless it is required
to make an existing Phase 1–8 capability function correctly.

Do NOT:

- redesign the entire architecture
- replace working frameworks
- migrate databases unnecessarily
- rewrite the FHIR layer
- replace the event system
- replace the frontend framework
- add unnecessary machine learning
- add unnecessary cloud infrastructure
- introduce new external dependencies without justification

Prefer:

fix
harden
test
simplify
document
demonstrate.


============================================================
3. MANDATORY STARTUP GATE
============================================================

Before implementation:

Read:

prd/main_prd.md

Read:

prd/phase9_prd.md

Read:

prd/PHASE_8_HANDOFF.md

Then inspect the repository.

Verify that the implementation corresponds to the previous
phase handoff.

If:

prd/PHASE_8_HANDOFF.md

does not exist:

STOP.

Report:

"PHASE 8 HANDOFF MISSING — CANNOT SAFELY START PHASE 9"


============================================================
4. FINAL SYSTEM AUDIT
============================================================

Perform a repository-wide audit.

Inspect:

- frontend
- backend
- shared package
- database
- migrations
- adapters
- FHIR
- event bus
- outbox
- interoperability
- task system
- verification
- evidence
- forecasting
- tests
- Docker
- environment configuration
- documentation

Identify:

CRITICAL
HIGH
MEDIUM
LOW

issues.

Do not silently ignore known failures.


============================================================
5. ARCHITECTURAL CONSISTENCY
============================================================

Verify:

Domain models remain independent from FHIR.

External systems remain isolated behind adapters.

Frontend does not directly access databases.

External consumer does not access AquaSentinel database.

All external services are configuration-driven.

Provenance remains intact.

Events remain traceable.

Existing architecture is not bypassed by later phases.


============================================================
6. DATABASE INTEGRITY
============================================================

Verify:

- migrations work from a clean database
- migrations are idempotent where intended
- seed data works
- foreign keys are valid
- indexes exist for important queries
- no orphaned records are created by normal workflows
- timestamps are consistent
- UUIDs are valid
- spatial fields use the intended coordinate convention


============================================================
7. CLEAN-START TEST
============================================================

A completely clean environment must be able to start.

Test:

docker compose down -v

then:

docker compose up --build

or the project's equivalent clean-start procedure.

Verify:

PostgreSQL
HAPI FHIR
Backend
Frontend
External Consumer

all start successfully.


============================================================
8. REPRODUCIBILITY
============================================================

A new developer/judge should be able to:

clone/copy repository
→
install dependencies
→
configure environment
→
start application
→
run demo

without requiring undocumented manual fixes.


============================================================
9. ENVIRONMENT CONFIGURATION
============================================================

Audit all environment variables.

Create or update:

.env.example

Every required environment variable must be documented.

Separate:

DEMO

from:

LIVE

configuration.

No secrets may exist in:

- source code
- frontend bundles
- committed config
- documentation
- test fixtures


============================================================
10. SECRET SCANNING
============================================================

Search the repository for:

API keys
tokens
passwords
private keys
client secrets

Remove accidental secrets.

Ensure .gitignore protects local environment files.


============================================================
11. DEPENDENCY AUDIT
============================================================

Inspect dependencies for:

- unused packages
- duplicate packages
- known vulnerabilities
- unnecessary dependencies

Do not blindly upgrade major versions.

Any upgrade must preserve functionality.


============================================================
12. BUILD VALIDATION
============================================================

The following must pass:

npm install

npm run build

npm test -- --run

Any lint/typecheck scripts already established by the project must
also pass.


============================================================
13. FULL END-TO-END TEST
============================================================

Build a deterministic end-to-end test covering the entire product.

Required chain:

Environmental Observation
→
Evidence
→
Assessment
→
Incident
→
Recommendation
→
Approval
→
Task
→
Assignment
→
Verification
→
Reassessment
→
Outcome
→
FHIR
→
Subscription
→
External Consumer
→
Acknowledgement
→
Audit


============================================================
14. E2E TEST SCENARIO A
============================================================

CONFIRMED INCIDENT.

The scenario must result in:

environmental signal
→
supporting evidence
→
incident
→
human approval
→
field corroboration
→
confirmed outcome
→
appropriate interoperability event.


============================================================
15. E2E TEST SCENARIO B
============================================================

NOT-CONFIRMED INCIDENT.

The scenario must result in:

environmental signal
→
incident
→
field investigation
→
contradictory/non-supporting evidence
→
NOT_CONFIRMED.

Original evidence must remain preserved.


============================================================
16. E2E TEST SCENARIO C
============================================================

UNCERTAIN INCIDENT.

The scenario must result in:

environmental signal
→
investigation
→
insufficient evidence
→
UNCERTAIN
→
additional verification requirement.


============================================================
17. E2E FAILURE SCENARIO
============================================================

External consumer becomes unavailable.

Expected:

event created
→
outbox
→
delivery failure
→
retry
→
failure recorded
→
consumer restored
→
successful delivery.


============================================================
18. E2E DUPLICATE SCENARIO
============================================================

Deliver the same interoperability event twice.

Expected:

first event:
processed

second event:
deduplicated

No duplicate downstream action.


============================================================
19. E2E FHIR FAILURE
============================================================

Cause a FHIR validation or delivery failure.

Verify:

- failure is captured
- OperationOutcome is preserved where available
- event remains recoverable
- retry behaviour works
- dead-letter behaviour works where appropriate


============================================================
20. E2E REPLAY
============================================================

Take a dead-letter event.

Replay it.

Verify:

event is delivered successfully.

Preserve original event identity and replay metadata.


============================================================
21. GOLDEN PATH DEMO
============================================================

Create ONE primary deterministic demonstration.

This is the official hackathon demo.

Target runtime:

3–5 minutes.

The demonstration must be fast enough to perform live.

Avoid requiring long external processing during the demo.


============================================================
22. GOLDEN PATH NARRATIVE
============================================================

The recommended narrative:

AquaSentinel receives an environmental signal.

The signal alone is insufficient to declare a confirmed incident.

The system combines additional evidence.

Confidence increases.

A human operator reviews the evidence.

A specific operational recommendation is generated.

The operator approves an inspection task.

A field inspector receives the task.

The inspector records ground evidence.

The evidence returns to AquaSentinel.

The system reassesses the incident.

The outcome is recorded.

A standardized FHIR event is generated.

A separate downstream system receives it.

The complete chain is auditable.


============================================================
23. DEMO TIMELINE
============================================================

The demo should approximately follow:

0:00 — Problem

0:30 — Environmental signal

0:50 — Evidence fusion

1:10 — Incident and confidence

1:30 — Recommendation

1:50 — Human approval

2:10 — Field task

2:30 — Verification

2:50 — Reassessment

3:10 — FHIR interoperability

3:30 — External system

3:50 — Audit/provenance

4:10 — Failure/reliability capability

4:30 — Closing system view

The exact timing may vary.


============================================================
24. DEMO RESET
============================================================

Create a reliable demo reset mechanism.

It must restore:

- database state
- FHIR state
- event state
- external consumer state
- demo data

to a known starting point.

Prefer a single command.

Example:

npm run demo:reset


============================================================
25. DEMO SEED
============================================================

Create deterministic demo data.

The demo should not depend on:

- random values
- unavailable APIs
- unpredictable weather
- external service uptime
- manual database editing

Live integrations may be shown separately.


============================================================
26. DEMO MODE
============================================================

Demo mode must work without external credentials.

Where a real external service is unavailable:

use the existing adapter abstraction.

Do NOT fake a live service while labeling it LIVE.


============================================================
27. LIVE MODE
============================================================

Verify that live integrations remain configurable.

Document which components were actually tested against live services.

Do not claim a live integration was validated if only the mock was
tested.


============================================================
28. SENTINEL-2 INTEGRATION
============================================================

Verify the existing satellite adapter.

If live Sentinel-2 access is available:

perform a real test.

Record:

endpoint
authentication method
query
response
processing result

If credentials/API availability prevent testing:

document this explicitly.

The demo must remain functional through deterministic demo mode.


============================================================
29. FHIR INTEGRATION
============================================================

Perform a complete real local HAPI FHIR test.

Verify:

Observation
→
HAPI
→
Subscription
→
REST hook
→
external consumer.


============================================================
30. OAH-FHIR VERIFICATION
============================================================

Verify the final implementation continues to use the intended
OAH-FHIR structures and mappings.

Document:

FHIR version
OAH-FHIR profile
canonical URL
coding system
resource mappings

Do not claim formal certification or conformance beyond what was
actually tested.


============================================================
31. PERFORMANCE BASELINE
============================================================

Measure basic system performance.

At minimum measure:

API response time
event processing latency
FHIR delivery latency
database query latency for major dashboard views

This is a prototype baseline, not a production benchmark.


============================================================
32. EVENT LATENCY
============================================================

Measure:

event creation
→
FHIR resource
→
subscription
→
external consumer

Record approximate latency under local demo conditions.


============================================================
33. FRONTEND PERFORMANCE
============================================================

Verify:

- initial load
- dashboard rendering
- large event lists
- incident timeline
- task list
- interoperability view

Avoid obvious unnecessary re-renders or unbounded polling.


============================================================
34. ERROR STATES
============================================================

Every major UI workflow must have meaningful states for:

loading
empty
success
error
retrying
offline
unauthorized where applicable.


============================================================
35. USER EXPERIENCE AUDIT
============================================================

Perform a full UI pass.

Look for:

- inconsistent terminology
- dead buttons
- placeholder text
- broken links
- inaccessible controls
- unreadable status
- confusing navigation
- inconsistent dates
- inconsistent units
- inconsistent severity labels


============================================================
36. TERMINOLOGY AUDIT
============================================================

Use consistent terminology across:

frontend
backend
FHIR
documentation
demo

Examples:

Observation
Evidence
Incident
Recommendation
Task
Verification
Outcome

Do not call the same concept by multiple names.


============================================================
37. SCIENTIFIC CLAIM AUDIT
============================================================

Search the entire application and documentation for claims that
overstate what the system knows.

Avoid statements such as:

"satellite confirms disease"

"satellite proves contamination"

"AI diagnosed"

"algal bloom confirmed from NDCI alone"

Use scientifically defensible language.

Separate:

signal
observation
evidence
assessment
outcome.


============================================================
38. PUBLIC HEALTH SAFETY AUDIT
============================================================

Ensure the system does not present environmental remote-sensing
signals as individual medical diagnoses.

The product is an environmental/resilience intelligence platform.

Do not turn it into an automated clinical diagnostic system.


============================================================
39. PROVENANCE AUDIT
============================================================

Trace a demo observation all the way through:

source
→
acquisition
→
processing
→
evidence
→
incident
→
recommendation
→
task
→
verification
→
outcome
→
FHIR event.

No major stage should lose provenance.


============================================================
40. AUDIT TRAIL AUDIT
============================================================

Verify all major state transitions have:

timestamp
actor/system
old state
new state
reason where appropriate.


============================================================
41. OBSERVABILITY
============================================================

Verify system health indicators for:

database
FHIR
event bus
outbox
external consumer
adapters
API
frontend/backend connectivity


============================================================
42. SYSTEM HEALTH
============================================================

The final System Health screen should clearly show:

DATABASE
CONNECTED

FHIR
CONNECTED

EVENT BUS
HEALTHY

OUTBOX
HEALTHY

EXTERNAL CONSUMER
CONNECTED

ADAPTERS
STATUS


============================================================
43. LOGGING
============================================================

Audit logs for:

- errors
- external calls
- event delivery
- FHIR failures
- retries
- task transitions
- verification submission

Avoid logging secrets.


============================================================
44. CORRELATION LOGGING
============================================================

Important requests/events should expose:

correlationId
eventId
incidentId
taskId

where applicable.

This should allow developers to follow a single incident through
the backend logs.


============================================================
45. SECURITY REVIEW
============================================================

Perform a lightweight application security review.

Check:

- input validation
- authorization
- secret handling
- CORS
- exposed debug endpoints
- SQL injection protection
- path traversal
- unsafe file upload
- webhook validation
- authentication configuration


============================================================
46. WEBHOOK SECURITY
============================================================

Review the Phase 7 webhook.

Where practical, support:

shared secret
signature
authentication
source validation

Demo mode may use simplified configuration.

Document the security model.


============================================================
47. FILE UPLOAD SECURITY
============================================================

Review Phase 8 photo uploads.

Validate:

- file size
- MIME type
- extension
- filename
- storage path

Prevent arbitrary executable uploads.


============================================================
48. DATABASE BACKUP/RESET
============================================================

Provide documented demo reset procedure.

If practical, provide a seed/export mechanism for deterministic
demo state.

Do not build a full production backup system.


============================================================
49. DOCKER VALIDATION
============================================================

Verify:

docker-compose.yml

(or equivalent)

works from a clean environment.

Check:

- service dependencies
- health checks
- ports
- volumes
- environment variables
- startup order


============================================================
50. DOCUMENTATION AUDIT
============================================================

Review all project documentation.

Required:

README.md
DEVELOPMENT.md
ARCHITECTURE.md
INTEROPERABILITY.md
CLOSED_LOOP_RESPONSE.md
walkthrough.md
main PRD
phase PRDs
handoff documents


============================================================
51. README
============================================================

The README must clearly explain:

What AquaSentinel is.

What problem it addresses.

How the architecture works.

How to run it.

How to run demo mode.

How to run tests.

How to reset demo data.

How to configure live integrations.


============================================================
52. ARCHITECTURE DIAGRAM
============================================================

Create/update the final architecture diagram.

It should communicate:

Environmental Sources
        ↓
Ingestion
        ↓
Evidence Fusion
        ↓
Intelligence
        ↓
Human Decision
        ↓
Operational Task
        ↓
Field Verification
        ↓
Reassessment
        ↓
FHIR/Event Interoperability
        ↓
External Systems

and the feedback loop back into:

Evidence / Incident State.


============================================================
53. JUDGE-FACING EXPLANATION
============================================================

Create:

docs/JUDGE_GUIDE.md

It should explain in simple language:

1. Problem
2. Why it matters
3. What AquaSentinel does
4. Why multiple evidence sources matter
5. Why human oversight exists
6. What is technically novel
7. How FHIR is used
8. How event-driven interoperability works
9. How field verification closes the loop
10. What the demo proves
11. What is prototype vs production-ready


============================================================
54. TRACK 7 MAPPING
============================================================

Create:

docs/TRACK_7_MAPPING.md

Map actual implemented capabilities to the Track 7 requirements.

For every claimed capability:

- cite the relevant implementation
- identify the relevant component
- explain what is demonstrated

Do not claim points or judging outcomes.

Do not invent requirements.

Only map to the official Track 7 requirements available to the
project.


============================================================
55. TECHNICAL NOVELTY STATEMENT
============================================================

Create a concise technical explanation of AquaSentinel's
contribution.

Focus on the combination of:

environmental observations
+
evidence fusion
+
operational decision support
+
human-in-the-loop response
+
FHIR interoperability
+
event-driven delivery
+
field verification
+
closed-loop reassessment

Do not claim that individual technologies such as FHIR,
Sentinel-2, React, or PostgreSQL are novel by themselves.


============================================================
56. LIMITATIONS
============================================================

Create:

docs/LIMITATIONS.md

Explicitly document:

- prototype limitations
- mock integrations
- live API dependencies
- scientific limitations
- data limitations
- geospatial limitations
- model limitations
- security limitations
- scalability limitations


============================================================
57. DEMO SCRIPT
============================================================

Create:

docs/DEMO_SCRIPT.md

Include:

screen
action
narration
expected result
fallback

The script must be usable by a team member who did not build the
system.


============================================================
58. DEMO FALLBACKS
============================================================

Every external dependency used in the demo must have a fallback.

If:

FHIR unavailable
→ local deterministic FHIR path

External consumer unavailable
→ controlled failure demonstration

Satellite API unavailable
→ deterministic recorded/demo observation

Do not silently switch modes.


============================================================
59. PRESENTATION MODE
============================================================

Create a presentation/demo mode that minimizes irrelevant UI.

Prioritize:

- current incident
- evidence
- confidence
- recommendation
- task
- verification
- FHIR event
- external consumer
- provenance


============================================================
60. FINAL UI POLISH
============================================================

Fix:

- alignment
- spacing
- typography
- loading states
- empty states
- status indicators
- responsive layouts
- obvious visual bugs

Do not redesign the product unnecessarily.


============================================================
61. ACCESSIBILITY
============================================================

Perform a basic accessibility pass.

Check:

- keyboard navigation
- form labels
- contrast
- focus states
- buttons
- readable text
- semantic controls


============================================================
62. DATA CONSISTENCY
============================================================

Verify consistency between:

database
API
frontend
FHIR
external consumer.

The same incident/task/event should not display contradictory
identifiers or timestamps.


============================================================
63. TIME HANDLING
============================================================

Verify:

- UTC storage
- UTC event timestamps
- localized display where appropriate
- consistent ISO 8601 serialization

No implicit local timezone assumptions.


============================================================
64. GEO DATA CONSISTENCY
============================================================

Verify:

WGS84
GeoJSON
latitude/longitude ordering
distance calculations
map rendering

No accidental coordinate inversion.


============================================================
65. TEST COVERAGE AUDIT
============================================================

Review tests across all phases.

Identify untested critical paths.

Add tests where necessary.

Do not optimize for an arbitrary coverage percentage.

Prioritize:

business logic
state transitions
evidence handling
FHIR
events
delivery
verification
database integrity
E2E workflows.


============================================================
66. REGRESSION MATRIX
============================================================

Create a final regression matrix.

Include:

Phase 1
Phase 2
Phase 3
Phase 4
Phase 5
Phase 6
Phase 7
Phase 8

For each:

capability
test
result
status


============================================================
67. CLEAN BUILD
============================================================

Perform a clean build from scratch.

Remove generated artifacts where safe.

Reinstall dependencies.

Run:

npm install

npm run build

npm test -- --run


============================================================
68. CLEAN DEMO
============================================================

From a clean state:

start the stack
reset demo
run golden path

No manual code modification is permitted during the demonstration.


============================================================
69. FINAL E2E RECORD
============================================================

Record the exact result of the complete demo.

Include:

start time
components started
scenario
events
FHIR resources
external delivery
verification
outcome
completion


============================================================
70. BUG TRIAGE
============================================================

Classify remaining issues:

BLOCKER
HIGH
MEDIUM
LOW

No BLOCKER or HIGH issue may remain unresolved if it affects the
golden-path demo.

Medium/low issues must be documented.


============================================================
71. RELEASE CANDIDATE
============================================================

Create a release-candidate state.

The repository must have:

- deterministic demo
- passing tests
- passing build
- documentation
- environment example
- reproducible startup
- known limitations
- judge guide
- demo script


============================================================
72. FINAL RELEASE CHECKLIST
============================================================

[ ] Clean installation works.

[ ] Clean Docker startup works.

[ ] Database migrations work.

[ ] Seed data works.

[ ] Backend builds.

[ ] Frontend builds.

[ ] Tests pass.

[ ] FHIR works.

[ ] FHIR Subscription works.

[ ] REST hook works.

[ ] External consumer works.

[ ] Outbox works.

[ ] Retry works.

[ ] Dead-letter works.

[ ] Replay works.

[ ] Environmental ingestion works in demo mode.

[ ] Evidence fusion works.

[ ] Incident workflow works.

[ ] Recommendation workflow works.

[ ] Human approval works.

[ ] Task workflow works.

[ ] Field verification works.

[ ] Reassessment works.

[ ] Confirmed scenario works.

[ ] Not-confirmed scenario works.

[ ] Uncertain scenario works.

[ ] Phase 7 integration works.

[ ] Provenance works.

[ ] Audit trail works.

[ ] Demo reset works.

[ ] Golden-path demo works.

[ ] Failure demo works.

[ ] Duplicate demo works.

[ ] No secrets committed.

[ ] Environment configuration documented.

[ ] Scientific claims reviewed.

[ ] Security review completed.

[ ] Performance baseline recorded.

[ ] Documentation complete.

[ ] Judge guide complete.

[ ] Demo script complete.

[ ] Track mapping complete.

[ ] Limitations documented.


============================================================
73. FINAL DEMO VALIDATION
============================================================

Run the official 3–5 minute demo from a clean state.

A team member who did NOT write the implementation should be able
to follow docs/DEMO_SCRIPT.md and complete it.

Record any ambiguity.

Fix anything that prevents successful execution.


============================================================
74. HANDOFF / FINAL STATE DOCUMENT
============================================================

Create:

prd/PHASE_9_HANDOFF.md

Even though Phase 9 is the final implementation phase, this
document serves as the definitive final system state.

It must contain:

1. Final architecture
2. Final capabilities
3. All services
4. Database
5. APIs
6. FHIR
7. OAH-FHIR
8. Event architecture
9. Outbox
10. External consumer
11. Environmental adapters
12. Evidence system
13. Incident system
14. Recommendation system
15. Task system
16. Field verification
17. Reassessment
18. Frontend
19. Demo mode
20. Live mode
21. Environment variables
22. Security
23. Tests
24. E2E results
25. Performance results
26. Known limitations
27. Technical debt
28. Remaining issues
29. Demo procedure
30. Exact repository state
31. Files created
32. Files modified


============================================================
75. HANDOFF VALIDATION
============================================================

Before completion:

test -f prd/PHASE_9_HANDOFF.md

If missing:

"PHASE 9 INCOMPLETE — FINAL HANDOFF DOCUMENT MISSING"

Do not claim completion.


============================================================
76. FINAL SUCCESS CRITERION
============================================================

A technically sophisticated evaluator should be able to understand
the complete AquaSentinel proposition from one end-to-end execution.

The system must demonstrate:

1. Environmental intelligence
2. Multi-source evidence
3. Explicit uncertainty
4. Human oversight
5. Actionable operational response
6. Field verification
7. Closed-loop reassessment
8. FHIR interoperability
9. Event-driven communication
10. External-system integration
11. Provenance
12. Auditability
13. Failure recovery
14. Reproducibility

The final system should NOT feel like nine disconnected features.

It should feel like ONE coherent platform.


============================================================
77. FINAL OUTPUT
============================================================

Provide a final completion report containing:

- final architecture
- capabilities
- services
- database
- APIs
- FHIR
- OAH-FHIR
- interoperability
- evidence fusion
- operational intelligence
- field verification
- closed-loop response
- demo mode
- live mode
- E2E results
- test results
- build results
- performance baseline
- security review
- known limitations
- unresolved issues
- demo readiness
- files changed
- PHASE_9_HANDOFF.md confirmation

Do not claim anything was verified unless it was actually tested.