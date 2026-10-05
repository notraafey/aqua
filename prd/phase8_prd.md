# AquaSentinel — Phase 8 PRD
## Closed-Loop Field Response, Verification & Outcome Learning

Version: 1.0
Phase: 8 of 9

Depends on:
Phase 1 — Foundation & Infrastructure
Phase 2 — Environmental Data Ingestion
Phase 3 — Evidence Fusion & Confidence
Phase 4 — Operational Intelligence & Human Approval
Phase 5 — Municipal Command Console
Phase 6 — Resilience Intelligence & Scenario Simulation
Phase 7 — Event-Driven One Health Interoperability


============================================================
1. PHASE OBJECTIVE
============================================================

Phase 8 closes the operational loop.

Previous phases allow AquaSentinel to:

detect environmental signals
→ assess evidence
→ create incidents
→ generate recommendations
→ obtain human approval
→ create operational tasks
→ communicate those tasks externally.

Phase 8 adds what happens NEXT.

An operational task must be executable in the field.

The field outcome must return to AquaSentinel.

AquaSentinel must reassess the situation using the new evidence.

The resulting state must be:

- confirmed
- not confirmed / false alarm
- unresolved / uncertain
- resolved
- requires additional verification

The system must preserve the complete history.

This transforms AquaSentinel from an alerting platform into a
closed-loop environmental intelligence and response system.


============================================================
2. CORE LOOP
============================================================

The canonical Phase 8 workflow is:

DETECTION
    ↓
EVIDENCE ASSESSMENT
    ↓
INCIDENT
    ↓
RECOMMENDATION
    ↓
HUMAN APPROVAL
    ↓
TASK
    ↓
FIELD ASSIGNMENT
    ↓
FIELD VERIFICATION
    ↓
NEW EVIDENCE
    ↓
REASSESSMENT
    ↓
OUTCOME
    ↓
RESOLUTION OR ADDITIONAL ACTION


============================================================
3. WHAT PHASE 8 MUST NOT DO
============================================================

Do not rebuild:

- Phase 2 ingestion
- Phase 3 evidence fusion
- Phase 4 recommendation engine
- Phase 5 command console
- Phase 6 forecasting
- Phase 7 FHIR interoperability

Reuse those systems.

Phase 8 extends them.


============================================================
4. FIELD TASK MODEL
============================================================

Extend the existing Task model to support real operational execution.

A task must contain:

taskId
incidentId
recommendationId
title
description
priority
status
assignedTo
assignedOrganization
location
createdAt
dueAt
startedAt
completedAt
instructions
requiredEvidence
completionRequirements
verificationStatus


============================================================
5. TASK STATES
============================================================

Support:

DRAFT
APPROVED
ASSIGNED
ACCEPTED
IN_PROGRESS
AWAITING_VERIFICATION
COMPLETED
VERIFIED
REJECTED
CANCELLED

State transitions must be explicit.

Invalid transitions must be rejected.


============================================================
6. TASK ASSIGNMENT
============================================================

Provide assignment functionality.

An approved task can be assigned to:

- field inspector
- municipal team
- environmental monitoring team
- external operational organization

The system must retain assignment history.


============================================================
7. ASSIGNEE MODEL
============================================================

Create a lightweight operational actor model.

Represent:

actorId
name
organization
role
contact/reference
active status

This does not need to become a full identity-management system.

Use deterministic demo users.


============================================================
8. FIELD WORKFLOW
============================================================

An assigned inspector should be able to:

1. Open assigned task.
2. Review incident context.
3. Review evidence.
4. Review recommended action.
5. Navigate to location.
6. Start task.
7. Record field observations.
8. Attach evidence.
9. Submit verification.
10. Complete task.


============================================================
9. FIELD VERIFICATION
============================================================

Create a first-class Verification entity.

It must contain:

verificationId
taskId
incidentId
inspector
timestamp
location
status
observations
notes
evidence
assessment
submittedAt


============================================================
10. VERIFICATION STATUS
============================================================

Support:

CONFIRMED
NOT_CONFIRMED
UNCERTAIN
PARTIALLY_CONFIRMED
REQUIRES_FOLLOW_UP

Do not force binary outcomes where evidence is inconclusive.


============================================================
11. FIELD OBSERVATIONS
============================================================

The inspector must be able to record structured observations.

Examples:

water colour
surface appearance
odour
foam
visible algae
dead fish
debris
flow conditions
weather conditions
human activity
visible pollution source

These should be represented as structured data where practical,
with free-text notes available.


============================================================
12. SCIENTIFIC LANGUAGE
============================================================

Field observations must remain observations.

Do not automatically transform:

"green surface observed"

into:

"confirmed toxic algal bloom."

The system should preserve:

observation
→ interpretation
→ confidence

as separate concepts.


============================================================
13. PHOTO EVIDENCE
============================================================

Allow field verification to attach photographs.

Each photo must contain:

evidenceId
verificationId
timestamp
location if available
filename
media type
description
source
provenance


============================================================
14. PHOTO STORAGE
============================================================

Implement a clean media-storage abstraction.

Support:

DEMO / LOCAL

and a configurable:

LIVE / OBJECT STORAGE

mode.

Do not hard-code cloud credentials.


============================================================
15. PHOTO PROVENANCE
============================================================

Every attachment must be traceable to:

who created it
when
for which task
for which verification
for which incident


============================================================
16. SAMPLE EVIDENCE
============================================================

Support recording environmental samples.

A sample record may include:

sampleId
verificationId
sampleType
collectionTime
collectionLocation
collector
container/reference ID
laboratory status
result
unit
notes


============================================================
17. LAB RESULT SUPPORT
============================================================

The system should support:

PENDING
AVAILABLE
NOT_AVAILABLE

for laboratory results.

Where results exist, preserve:

parameter
value
unit
method
timestamp
laboratory/source


============================================================
18. DO NOT REQUIRE REAL LAB INTEGRATION
============================================================

A real laboratory API is NOT required for Phase 8.

Implement a deterministic mock/demo pathway.

The architecture must allow future laboratory integration.


============================================================
19. FIELD LOCATION
============================================================

When the device/browser provides location, record:

latitude
longitude
accuracy
timestamp

If unavailable:

allow manual location selection.

Do not fabricate precise field coordinates.


============================================================
20. LOCATION VALIDATION
============================================================

The system should compare:

task location

against:

verification location.

Display whether the field verification occurred:

AT LOCATION
NEAR LOCATION
OUTSIDE EXPECTED AREA
UNKNOWN


============================================================
21. GEO-FENCE
============================================================

Implement a configurable verification radius.

Example:

expected task location
+
acceptable verification radius.

The radius must be configurable.

Do not hard-code one universal distance.


============================================================
22. OFFLINE-FIRST DESIGN
============================================================

Field environments may have unreliable connectivity.

The field workflow should be designed so a verification can be
drafted locally and synchronized later.

At minimum:

- local draft
- queued submission
- retry
- synchronization status


============================================================
23. SYNC STATES
============================================================

Support:

LOCAL_ONLY
PENDING_SYNC
SYNCING
SYNCED
SYNC_FAILED

A failed synchronization must not destroy the field record.


============================================================
24. CONFLICT HANDLING
============================================================

If the same verification is submitted twice:

detect duplicate identity.

Do not create duplicate verification records.

If conflicting edits occur:

preserve the original record and create an explicit conflict state
rather than silently overwriting evidence.


============================================================
25. EVIDENCE INGESTION
============================================================

When verification is submitted:

Field Evidence
↓
Evidence Repository
↓
Evidence Assessment
↓
Incident reassessment


============================================================
26. REASSESSMENT ENGINE
============================================================

Phase 8 must invoke the existing evidence assessment framework.

The new field evidence must be treated as another evidence source.

Do not create a separate independent scoring system unless necessary.

Extend Phase 3 where appropriate.


============================================================
27. MULTI-SOURCE EVIDENCE
============================================================

The reassessment should be able to combine:

satellite evidence
weather evidence
citizen observations
field observations
photographs
sample/laboratory results

The system must preserve each source separately.


============================================================
28. EVIDENCE TIMELINE
============================================================

Create a chronological evidence timeline.

Example:

09:00 Satellite signal
09:30 Weather observation
10:15 Citizen report
11:00 Incident created
11:30 Task approved
14:00 Inspector assigned
15:30 Field verification
16:00 Photo submitted
16:15 Reassessment


============================================================
29. OUTCOME ENGINE
============================================================

After verification, determine the operational outcome.

Possible outcomes:

CONFIRMED
NOT_CONFIRMED
UNCERTAIN
RESOLVED
ESCALATE
ADDITIONAL_VERIFICATION_REQUIRED


============================================================
30. OUTCOME DETERMINATION
============================================================

Outcome determination must be explainable.

Store:

outcome
reason
supporting evidence
confidence
determinedAt
determinedBy
rule/version


============================================================
31. HUMAN OVERSIGHT
============================================================

The system should distinguish:

SYSTEM SUGGESTED OUTCOME

from:

HUMAN CONFIRMED OUTCOME.

Where evidence is ambiguous, require human review.


============================================================
32. CONFIRMED EVENT
============================================================

If field evidence corroborates the incident:

mark the incident as:

CONFIRMED

and preserve:

original detection
supporting evidence
field verification
final assessment


============================================================
33. NOT-CONFIRMED EVENT
============================================================

If field evidence does not corroborate the signal:

mark the incident:

NOT_CONFIRMED

Do not delete the original alert.

This is important.

A false alarm is still part of the system's operational history.


============================================================
34. UNCERTAIN EVENT
============================================================

If evidence is insufficient:

mark:

UNCERTAIN

and optionally generate:

ADDITIONAL_VERIFICATION_REQUIRED.


============================================================
35. RESOLUTION
============================================================

An incident may become:

RESOLVED

only when its resolution criteria are satisfied.

Record:

resolvedAt
resolvedBy
resolutionReason
supportingEvidence


============================================================
36. ADDITIONAL TASK GENERATION
============================================================

If verification indicates that more work is necessary:

create another task.

Example:

Initial task:
Inspect stream reach.

Field result:
Possible pollution source observed.

New task:
Investigate suspected upstream discharge point.


============================================================
37. ESCALATION
============================================================

Allow escalation when field evidence indicates a more serious
situation than originally estimated.

Example:

Initial:
LOW confidence anomaly.

Field:
Strong corroborating evidence.

Result:
HIGHER PRIORITY INCIDENT.


============================================================
38. CLOSED-LOOP EVENT
============================================================

Phase 8 should emit a canonical:

VerificationCompleted

event.

This should integrate with Phase 7's interoperability layer.

Potential downstream events:

IncidentConfirmed
IncidentNotConfirmed
IncidentEscalated
IncidentResolved
AdditionalVerificationRequired


============================================================
39. FHIR INTEGRATION
============================================================

Where appropriate, verification outcomes should be represented
through the existing FHIR boundary.

Potential resources include:

Observation
Task
Communication
Flag

Use only semantically appropriate mappings.

Do not force every internal entity into FHIR.


============================================================
40. INTEROPERABILITY CONTINUITY
============================================================

The Phase 8 workflow must preserve Phase 7's event architecture.

Example:

Task completed
↓
VerificationCompleted
↓
FHIR representation
↓
External notification
↓
External consumer


============================================================
41. COMMAND CONSOLE
============================================================

Extend the Phase 5 console with:

FIELD OPERATIONS


Views:

- My Tasks
- All Tasks
- Task Detail
- Verification
- Evidence
- Outcomes
- Incident Timeline


============================================================
42. TASK DETAIL
============================================================

Display:

incident
location
priority
recommendation
instructions
evidence
assignment
status
due date
verification state
timeline


============================================================
43. FIELD VERIFICATION UI
============================================================

Provide:

structured observations
notes
photo upload
sample recording
location
verification outcome
submission


============================================================
44. MOBILE-RESPONSIVE DESIGN
============================================================

The field interface must be usable on a phone-sized viewport.

Prioritize:

large controls
clear status
minimal navigation
quick evidence entry
camera upload
location


============================================================
45. INCIDENT TIMELINE
============================================================

The incident detail page must show the complete loop:

Detection
→ Evidence
→ Assessment
→ Recommendation
→ Approval
→ Task
→ Assignment
→ Field Verification
→ Reassessment
→ Outcome
→ Resolution


============================================================
46. EVIDENCE COMPARISON
============================================================

Allow an operator to compare:

BEFORE

and:

AFTER

evidence where applicable.

Examples:

satellite indicator before/after
field observation before/after
incident confidence before/after


============================================================
47. RESPONSE EFFECTIVENESS
============================================================

Where measurable data exists, calculate:

time to assignment
time to field verification
time to resolution
evidence confidence before verification
evidence confidence after verification


============================================================
48. DO NOT CLAIM CAUSALITY
============================================================

Do not claim that an intervention caused an environmental improvement
unless the evidence actually supports that conclusion.

Display:

"observed change after intervention"

rather than:

"intervention caused improvement"

unless causality is established.


============================================================
49. RESPONSE ANALYTICS
============================================================

Add operational metrics:

open tasks
overdue tasks
completed tasks
verified tasks
unverified tasks
average verification time
confirmed incidents
not-confirmed incidents
uncertain incidents
resolved incidents


============================================================
50. FALSE-ALARM ANALYTICS
============================================================

Track not-confirmed events.

Display:

total alerts
confirmed
not confirmed
uncertain

Do not interpret this as model accuracy unless statistically
appropriate.


============================================================
51. FEEDBACK LOOP
============================================================

Field outcomes should become feedback for future assessment.

At minimum, persist:

original signal
original confidence
field outcome
supporting evidence
final outcome

This creates the foundation for future model evaluation.


============================================================
52. MODEL EVALUATION FOUNDATION
============================================================

Phase 8 should produce structured records suitable for future
evaluation of detection performance.

Store:

prediction/detection
ground truth proxy
outcome
timestamp
location
evidence

Do not train a machine-learning model in Phase 8 unless already
required by earlier architecture.


============================================================
53. AUDITABILITY
============================================================

Every state transition must be auditable.

Track:

who
what
when
previous state
new state
reason


============================================================
54. SECURITY
============================================================

Field users must only access tasks they are authorized to see.

At minimum implement role-aware UI/API boundaries.

Do not expose all internal administrative data to field users.


============================================================
55. API
============================================================

Implement APIs following existing project conventions.

Required capabilities:

GET /api/v1/tasks

GET /api/v1/tasks/:id

POST /api/v1/tasks/:id/assign

POST /api/v1/tasks/:id/start

POST /api/v1/tasks/:id/complete

GET /api/v1/verifications

GET /api/v1/verifications/:id

POST /api/v1/verifications

POST /api/v1/verifications/:id/evidence

POST /api/v1/verifications/:id/submit

POST /api/v1/incidents/:id/reassess

POST /api/v1/incidents/:id/resolve


============================================================
56. VALIDATION
============================================================

Validate:

task state transitions
required verification fields
photo metadata
sample metadata
location
duplicate submissions
authorization
incident relationship


============================================================
57. ERROR HANDLING
============================================================

Handle:

invalid task
invalid transition
missing incident
missing assignment
duplicate verification
invalid evidence
upload failure
sync failure
reassessment failure


============================================================
58. TESTING
============================================================

Create unit tests for:

task state machine
assignment
verification
evidence
outcomes
resolution
geofence
duplicate submissions
offline queue
sync
conflict handling
reassessment
event generation


============================================================
59. INTEGRATION TESTING
============================================================

Test:

Incident
→ Recommendation
→ Approved Task
→ Assignment
→ Field Verification
→ Evidence
→ Reassessment
→ Outcome
→ Resolution


============================================================
60. PHASE 7 REGRESSION
============================================================

Verify that Phase 7 remains functional.

Specifically test:

VerificationCompleted
→ Phase 7 interoperability event
→ FHIR mapping where applicable
→ external consumer


============================================================
61. DEMO MODE
============================================================

The complete closed-loop demonstration must work locally.

No external credentials should be necessary.

Provide deterministic demo data.


============================================================
62. DEMO SCENARIO
============================================================

Create a compelling golden-path scenario.

Example:

1. Satellite signal detects elevated chlorophyll-related signal.
2. Evidence engine raises a warning.
3. Operator reviews evidence.
4. Recommendation generated.
5. Operator approves field inspection.
6. Task assigned to inspector.
7. Inspector opens task on mobile-sized interface.
8. Inspector records green surface/foam observation.
9. Inspector uploads photograph.
10. Verification submitted.
11. Evidence engine reassesses.
12. Incident confidence increases.
13. Incident becomes CONFIRMED pending human review.
14. Operator confirms outcome.
15. Incident becomes resolved or receives additional operational action.
16. Phase 7 emits the resulting interoperability event.
17. External consumer receives the event.
18. Full audit trail is visible.


============================================================
63. FALSE-ALARM DEMO
============================================================

Also support:

Satellite signal
→ field inspection
→ no corroborating evidence
→ NOT_CONFIRMED

The original signal remains visible.

This demonstrates that AquaSentinel can close the loop even when
initial alerts are not corroborated.


============================================================
64. UNCERTAIN DEMO
============================================================

Support:

Satellite signal
→ field inspection
→ insufficient evidence
→ UNCERTAIN
→ additional verification task.


============================================================
65. BEFORE/AFTER DEMO
============================================================

If existing environmental data allows it, demonstrate:

pre-response condition
→ intervention/verification
→ subsequent observation

Do not claim causal effectiveness without evidence.


============================================================
66. DOCUMENTATION
============================================================

Create/update:

docs/CLOSED_LOOP_RESPONSE.md

Document:

- task lifecycle
- verification
- evidence
- reassessment
- outcomes
- resolution
- offline workflow
- synchronization
- event integration
- FHIR integration
- security


============================================================
67. ARCHITECTURE DOCUMENTATION
============================================================

Update docs/ARCHITECTURE.md with:

Incident
↓
Task
↓
Field Agent
↓
Verification
↓
Evidence
↓
Reassessment
↓
Outcome
↓
Resolution
↓
Interoperability Event


============================================================
68. WALKTHROUGH
============================================================

Update walkthrough.md.

The walkthrough must demonstrate:

1. Start application.
2. Open incident.
3. Review evidence.
4. Review recommendation.
5. Approve task.
6. Assign task.
7. Open field interface.
8. Start task.
9. Record field observation.
10. Attach photograph.
11. Record sample if applicable.
12. Submit verification.
13. Reassess incident.
14. Show outcome.
15. Show incident timeline.
16. Resolve or escalate.
17. Show Phase 7 interoperability event.
18. Show external consumer notification.


============================================================
69. DEFINITION OF DONE
============================================================

[ ] Task lifecycle implemented.

[ ] Assignment implemented.

[ ] Actor model implemented.

[ ] Field verification implemented.

[ ] Structured field observations implemented.

[ ] Photo evidence implemented.

[ ] Media abstraction implemented.

[ ] Sample recording implemented.

[ ] Laboratory result placeholder implemented.

[ ] Location capture implemented.

[ ] Location validation implemented.

[ ] Configurable geofence implemented.

[ ] Offline draft support implemented.

[ ] Sync queue implemented.

[ ] Duplicate protection implemented.

[ ] Conflict handling implemented.

[ ] Reassessment integrated.

[ ] Confirmed outcome implemented.

[ ] Not-confirmed outcome implemented.

[ ] Uncertain outcome implemented.

[ ] Additional verification implemented.

[ ] Escalation implemented.

[ ] Resolution implemented.

[ ] Closed-loop events implemented.

[ ] Phase 7 interoperability integration implemented.

[ ] FHIR mapping where appropriate.

[ ] Field UI implemented.

[ ] Mobile-responsive field interface implemented.

[ ] Incident timeline implemented.

[ ] Before/after evidence comparison implemented where data permits.

[ ] Response analytics implemented.

[ ] False-alarm analytics implemented.

[ ] Audit trail implemented.

[ ] Role-aware access implemented.

[ ] API endpoints implemented.

[ ] Unit tests implemented.

[ ] Integration tests implemented.

[ ] Phase 7 regression tests pass.

[ ] Demo scenario works.

[ ] False-alarm scenario works.

[ ] Uncertain scenario works.

[ ] Documentation updated.

[ ] Walkthrough updated.

[ ] npm test passes.

[ ] npm run build passes.

[ ] PHASE_8_HANDOFF.md created.


============================================================
70. MANDATORY PHASE 8 HANDOFF
============================================================

Create:

prd/PHASE_8_HANDOFF.md

The document must contain:

1. Phase objective
2. Architecture implemented
3. Task lifecycle
4. Assignment system
5. Actor model
6. Verification model
7. Evidence model
8. Photo/media system
9. Sample system
10. Location handling
11. Geofence
12. Offline workflow
13. Synchronization
14. Conflict handling
15. Reassessment
16. Outcome engine
17. Resolution
18. Escalation
19. Closed-loop events
20. FHIR integration
21. Phase 7 integration
22. APIs
23. Frontend routes
24. Frontend components
25. Database changes
26. Configuration
27. Security
28. Tests
29. Integration tests
30. Demo scenarios
31. Known limitations
32. Technical debt
33. Files created
34. Files modified
35. Exact Phase 9 starting state
36. What Phase 9 should reuse
37. What Phase 9 must not rewrite
38. Extension points for Phase 9


============================================================
71. HANDOFF VALIDATION
============================================================

Before declaring Phase 8 complete:

test -f prd/PHASE_8_HANDOFF.md

If missing:

"PHASE 8 INCOMPLETE — HANDOFF DOCUMENT MISSING"

Do not claim Phase 8 is complete.


============================================================
72. FINAL SUCCESS CRITERION
============================================================

The judge should be able to see:

SIGNAL
↓
EVIDENCE
↓
INCIDENT
↓
RECOMMENDATION
↓
HUMAN APPROVAL
↓
TASK
↓
FIELD INSPECTION
↓
GROUND TRUTH
↓
REASSESSMENT
↓
OUTCOME
↓
RESOLUTION
↓
INTEROPERABILITY

This is the closed-loop One Health workflow.

The system should demonstrate not merely that it can issue an
alert, but that it can determine what happened after the alert
and preserve that information for subsequent decisions.


============================================================
73. FINAL OUTPUT
============================================================

Provide a completion report containing:

- implementation summary
- task lifecycle
- field verification
- evidence workflow
- reassessment
- outcome workflow
- resolution workflow
- Phase 7 interoperability integration
- demo results
- false-alarm results
- uncertain-case results
- test results
- build results
- known limitations
- files changed
- PHASE_8_HANDOFF.md confirmation
- exact Phase 9 starting state