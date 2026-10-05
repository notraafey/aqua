# AquaSentinel — Phase 7 PRD
## Event-Driven One Health Interoperability

Version: 1.0
Phase: 7 of 9

Depends on:
Phase 1 — Foundation & Infrastructure
Phase 2 — Environmental Data Ingestion
Phase 3 — Evidence Fusion & Confidence
Phase 4 — Operational Intelligence & Human Approval
Phase 5 — Municipal Command Console
Phase 6 — Resilience Intelligence & Scenario Simulation


============================================================
1. PHASE OBJECTIVE
============================================================

Phase 7 transforms AquaSentinel from an application that merely
USES FHIR into an actual event-driven interoperability layer.

The system must demonstrate:

ENVIRONMENTAL DATA
        ↓
AquaSentinel
        ↓
FHIR R4
        ↓
EVENT
        ↓
DOWNSTREAM SYSTEM
        ↓
ACTIONABLE RESPONSE

The purpose is to demonstrate that environmental intelligence can
move across organizational and technological boundaries in a
standardized way.

The core Track 7 contribution is:

AquaSentinel does not merely store environmental observations in
FHIR.

It actively publishes meaningful state changes and operational
events so that external systems can respond automatically.


============================================================
2. WHAT PHASE 7 MUST NOT DO
============================================================

Do NOT rebuild:

- the Phase 1 FHIR adapter
- the Phase 1 HAPI FHIR integration
- the Phase 1 event bus
- Phase 3 evidence scoring
- Phase 4 recommendation logic
- Phase 5 Command Console
- Phase 6 forecasting

Instead, Phase 7 consumes these capabilities.

Phase 7 is the interoperability layer connecting them.


============================================================
3. CORE INTEROPERABILITY CONCEPT
============================================================

AquaSentinel must expose a canonical interoperability boundary.

Internal domain model:

Observation
Evidence
Assessment
Incident
Recommendation
Task
Forecast
Warning

must remain independent from raw FHIR JSON.

The existing FHIR anti-corruption layer must translate between:

AquaSentinel Domain Model
↕
FHIR R4


============================================================
4. FHIR RESOURCES
============================================================

Use the existing FHIR R4 architecture.

Where appropriate, represent:

Environmental observation
→ Observation

Environmental location
→ Location

Incident/operational state
→ Flag or appropriate supported resource

Operational task
→ Task

Communication/event
→ Communication where appropriate

Forecast/analytical observation
→ Observation or another appropriate resource only where
semantically defensible.

Do NOT create semantically incorrect FHIR resources merely to
increase the number of resources.


============================================================
5. OAH-FHIR COMPATIBILITY
============================================================

Preserve compatibility with the existing OAH-FHIR implementation
used by AquaSentinel.

The implementation must document:

- canonical URLs
- profiles
- coding systems
- resource mappings
- required fields
- reference relationships

For environmental observations, preserve the OAH-FHIR profile
mapping established in Phase 1.


============================================================
6. EVENT-DRIVEN ARCHITECTURE
============================================================

Build the event-driven interoperability pipeline:

Internal Event
↓
Event Qualification
↓
FHIR Resource Creation/Update
↓
FHIR Transaction
↓
FHIR Subscription / REST Hook
↓
External Consumer
↓
Acknowledgement
↓
Audit Record


============================================================
7. EVENT TYPES
============================================================

Define a canonical event taxonomy.

At minimum support:

ObservationCreated

EvidenceAssessmentUpdated

IncidentCreated

IncidentSeverityChanged

RecommendationApproved

TaskCreated

TaskCompleted

EarlyWarningCreated

ForecastUpdated

ScenarioCompleted

Not every event must be externally published.

The system must distinguish:

INTERNAL EVENT

from:

INTEROPERABILITY EVENT.


============================================================
8. EVENT QUALIFICATION
============================================================

Before publishing an external event, determine whether it is
interoperability-relevant.

Examples:

Routine observation:
May remain internal.

Validated environmental anomaly:
May become externally relevant.

Approved operational response:
May become externally relevant.

High-confidence early warning:
May become externally relevant.

This prevents downstream systems from receiving unnecessary noise.


============================================================
9. EVENT CONTRACT
============================================================

Create a versioned event envelope.

Every external event should contain:

eventId
eventType
eventVersion
occurredAt
producer
subject
resource
resourceType
resourceId
correlationId
causationId
provenance
severity where applicable


============================================================
10. CORRELATION
============================================================

Events belonging to the same incident must be traceable.

Example:

Observation
→ Evidence Assessment
→ Incident
→ Recommendation
→ Task

All related events should be linked through:

correlationId

Individual causal relationships should use:

causationId


============================================================
11. IDEMPOTENCY
============================================================

External event delivery must be idempotent.

If the same event is delivered twice:

The consumer must not accidentally create two operational actions.

Implement:

eventId

and appropriate deduplication handling.

Test duplicate delivery explicitly.


============================================================
12. DELIVERY SEMANTICS
============================================================

Document the delivery model.

The system should support reliable:

at-least-once delivery

where practical.

Do not claim exactly-once delivery unless technically guaranteed.

If delivery fails:

- preserve the event
- record the failure
- retry according to configured policy
- expose delivery status


============================================================
13. OUTBOX PATTERN
============================================================

Implement a persistent event-outbox boundary.

When a domain event becomes externally publishable:

1. Persist domain change.
2. Persist outbound event.
3. Process event asynchronously.
4. Deliver to FHIR/external consumer.
5. Record result.

This prevents:

database success
+
external notification failure

from silently losing the event.


============================================================
14. DELIVERY STATUS
============================================================

Track:

PENDING
DELIVERING
DELIVERED
FAILED
RETRYING
DEAD_LETTER

Every outbound event must have an auditable state.


============================================================
15. RETRY STRATEGY
============================================================

Implement configurable retry behaviour.

Include:

- retry count
- retry delay
- maximum attempts
- failure reason
- next retry timestamp

Do not retry permanently invalid payloads indefinitely.


============================================================
16. DEAD-LETTER HANDLING
============================================================

After maximum retries:

Move the event to a dead-letter state.

The operator must be able to inspect:

- event
- destination
- error
- attempts
- timestamps
- payload/resource
- correlation ID


============================================================
17. FHIR SUBSCRIPTIONS
============================================================

Integrate with FHIR Subscription functionality.

The system must demonstrate a real:

FHIR resource change
→
FHIR Subscription
→
REST-hook notification

workflow.

Use HAPI FHIR in the local/demo environment.


============================================================
18. EXTERNAL CONSUMER
============================================================

Build a small deterministic external consumer.

This should intentionally behave like a separate municipal/public
health system.

It must NOT directly access AquaSentinel's internal database.

It should receive events through the interoperability boundary.

This is important for proving actual interoperability.


============================================================
19. EXTERNAL CONSUMER BEHAVIOUR
============================================================

The external consumer should:

1. Receive a FHIR event.
2. Validate the payload.
3. Extract the relevant resource.
4. Display/log the received event.
5. Generate an acknowledgement.
6. Preserve the original event ID.
7. Avoid duplicate processing.


============================================================
20. GOLDEN-PATH EVENT
============================================================

The demo must support this complete path:

Sentinel-2 Observation
↓
FHIR Observation
↓
Evidence Assessment
↓
Incident
↓
Approved Recommendation
↓
Operational Task
↓
FHIR Task / relevant resource
↓
External Subscriber
↓
Municipal/Public Health Consumer
↓
Acknowledgement
↓
AquaSentinel Audit Trail


============================================================
21. ENVIRONMENTAL ALERT EVENT
============================================================

Demonstrate an environmental warning workflow.

Example:

NDCI anomaly detected.

↓

Evidence engine evaluates corroboration.

↓

Confidence reaches configured warning threshold.

↓

AquaSentinel creates an early warning.

↓

Warning is represented through the interoperability layer.

↓

FHIR resource is created/updated.

↓

FHIR Subscription triggers downstream consumer.

↓

External consumer receives the notification.

Important:

The external event must NOT claim:

"confirmed algal bloom"

unless actual validated evidence supports that claim.

Use scientifically appropriate wording such as:

"Elevated chlorophyll-related remote-sensing signal detected."


============================================================
22. OPERATIONAL ACTION EVENT
============================================================

Demonstrate a second workflow:

Incident
↓
Recommendation
↓
Human approval
↓
Task
↓
FHIR Task
↓
External system


The external system should understand:

what task exists
who/what it concerns
priority
status
provenance
correlation


============================================================
23. HUMAN-IN-THE-LOOP
============================================================

Automated environmental detection must NOT automatically authorize
high-impact operational actions.

The architecture should distinguish:

AUTOMATED DETECTION

from:

HUMAN APPROVAL

from:

EXTERNAL NOTIFICATION.


============================================================
24. SAFETY BOUNDARY
============================================================

AquaSentinel is not a clinical diagnostic system.

The interoperability layer must never automatically generate:

- medical diagnoses
- patient treatment instructions
- clinical diagnoses from satellite data

The external workflow is intended for:

environmental/public-health operations
and resilience coordination.


============================================================
25. FHIR VALIDATION
============================================================

Every outbound FHIR resource must be validated before delivery.

Validation should check:

- resourceType
- required fields
- profile
- references
- coding
- timestamps
- identifiers

Invalid resources must not silently enter the outbound pipeline.


============================================================
26. FHIR ERROR HANDLING
============================================================

If the FHIR server rejects a resource:

Record:

- event ID
- resource ID
- HTTP status
- OperationOutcome if available
- error message
- timestamp
- retry status

Do not discard the original event.


============================================================
27. VERSIONING
============================================================

FHIR mappings must be versioned.

Record:

FHIR version
OAH-FHIR profile version
AquaSentinel mapping version

Changing a mapping must not silently change historical event
interpretation.


============================================================
28. PROVENANCE
============================================================

Every externally published resource must remain traceable to its
source evidence.

Example:

FHIR Observation
→ source observation
→ Sentinel-2 acquisition
→ processing pipeline
→ evidence assessment
→ incident


============================================================
29. AUDIT TRAIL
============================================================

Build an interoperability audit trail.

Track:

event created
event qualified
FHIR resource generated
FHIR validation
delivery attempt
delivery result
retry
acknowledgement
consumer processing


============================================================
30. SECURITY BOUNDARY
============================================================

Implement a clean separation between:

internal application
FHIR server
external consumer

Credentials must not be hard-coded.

Use environment variables.

Never expose secrets in frontend code.


============================================================
31. AUTHENTICATION
============================================================

If the target FHIR deployment requires authentication:

support configurable authentication at the adapter layer.

Demo mode may use local unauthenticated HAPI FHIR.

LIVE mode must not assume that authentication is unnecessary.


============================================================
32. EXTERNAL ENDPOINT CONFIGURATION
============================================================

External endpoints must be configuration-driven.

Example:

FHIR_BASE_URL
FHIR_AUTH_MODE
FHIR_CLIENT_ID
FHIR_CLIENT_SECRET
EXTERNAL_CONSUMER_URL

Do not hard-code deployment-specific endpoints.


============================================================
33. API
============================================================

Provide APIs for:

GET /api/v1/interoperability/events

GET /api/v1/interoperability/events/:id

GET /api/v1/interoperability/deliveries

GET /api/v1/interoperability/deliveries/:id

POST /api/v1/interoperability/events/:id/retry

GET /api/v1/interoperability/dead-letter

POST /api/v1/interoperability/dead-letter/:id/replay

Exact naming may follow existing API conventions.


============================================================
34. EVENT INSPECTOR
============================================================

Extend the Command Console with:

INTEROPERABILITY

Views:

- Event Stream
- Delivery Queue
- Failed Deliveries
- Dead Letter
- FHIR Resources
- External Consumers


============================================================
35. EVENT DETAIL
============================================================

Selecting an event must show:

Event ID
Type
Version
Created
Occurred
Correlation ID
Causation ID
Source
Destination
FHIR Resource
Delivery status
Attempts
Acknowledgement
Provenance


============================================================
36. DELIVERY MONITOR
============================================================

Display:

Pending
Delivered
Retrying
Failed
Dead-lettered

Allow filtering by:

- event type
- destination
- status
- time
- correlation ID


============================================================
37. FHIR RESOURCE INSPECTOR
============================================================

Allow operators to inspect:

FHIR JSON

and:

Human-readable interpretation.

Show:

resource type
profile
identifier
subject
timestamp
references


============================================================
38. EXTERNAL CONSUMER SIMULATOR
============================================================

The demo environment must include an external consumer service.

It should be independently runnable.

It should provide:

GET /health

GET /events

POST /webhook/fhir

GET /events/:id


============================================================
39. CONSUMER FAILURE SIMULATION
============================================================

Support deterministic demo failures.

Example:

Consumer unavailable.

Expected behaviour:

Delivery fails
→ retry
→ status displayed
→ eventual delivery
→ acknowledgement.

This demonstrates that the architecture handles real-world
interoperability failures.


============================================================
40. DUPLICATE DELIVERY TEST
============================================================

Send the same event twice.

The external consumer must recognize the duplicate event ID.

Expected:

first delivery:
processed

second delivery:
deduplicated

No duplicate operational record.


============================================================
41. EVENT REPLAY
============================================================

Allow a dead-letter event to be manually replayed.

Replay must preserve:

original event ID

and add:

replay metadata

Do not create a completely unrelated new event.


============================================================
42. EVENT SCHEMA
============================================================

Create versioned JSON schemas for outbound events.

Validate events before publication.

Schemas must live in the shared package where appropriate.


============================================================
43. CONTRACT TESTING
============================================================

Create contract tests between:

AquaSentinel
and
External Consumer.

Test:

- valid event
- invalid event
- missing fields
- duplicate event
- unsupported version
- malformed FHIR
- rejected FHIR resource


============================================================
44. FHIR INTEGRATION TEST
============================================================

Run the complete:

Domain Event
→
FHIR Mapping
→
HAPI FHIR
→
Subscription
→
REST Hook
→
External Consumer

integration test.

This is one of the most important Phase 7 tests.


============================================================
45. DEMO MODE
============================================================

The entire interoperability demo must run locally.

Required services:

PostgreSQL/PostGIS
HAPI FHIR
Backend
Frontend
External Consumer

No external credentials should be required for the golden path.


============================================================
46. LIVE MODE
============================================================

LIVE mode should allow:

real FHIR server
real external consumer
real environmental ingestion

through configuration.

Do not hard-code any production service.


============================================================
47. OBSERVABILITY
============================================================

Expose interoperability health metrics:

FHIR connection
FHIR validation failures
outbox queue
delivery success
delivery failure
retry count
dead-letter count
external consumer availability


============================================================
48. DEMO MODE TELEMETRY
============================================================

The Command Console must show:

FHIR:
CONNECTED

OUTBOX:
0 PENDING

DELIVERIES:
X SUCCESSFUL

FAILED:
0

EXTERNAL CONSUMER:
CONNECTED


============================================================
49. SCIENTIFIC TRACEABILITY
============================================================

The external consumer must be able to trace a notification back to:

environmental observation
→ evidence
→ incident/warning
→ operational event.

This demonstrates that interoperability does not destroy provenance.


============================================================
50. NO DIRECT DATABASE COUPLING
============================================================

The external consumer MUST NOT import:

AquaSentinel database models
AquaSentinel database credentials
AquaSentinel internal repository code

Communication must happen through the defined interoperability
boundary.


============================================================
51. TESTING
============================================================

Write tests for:

- event qualification
- event envelope
- schema validation
- idempotency
- correlation
- causation
- outbox persistence
- delivery
- retries
- dead-letter
- replay
- FHIR mapping
- FHIR validation
- Subscription
- REST hook
- acknowledgement
- external consumer
- duplicate delivery
- malformed resources
- authentication configuration


============================================================
52. REGRESSION
============================================================

Run:

npm test -- --run

npm run build

All Phase 1–6 tests must remain green.

Do not remove or weaken previous tests.


============================================================
53. DOCUMENTATION
============================================================

Create/update:

docs/INTEROPERABILITY.md

Document:

- event architecture
- FHIR architecture
- OAH-FHIR mappings
- event contracts
- outbox
- retries
- dead-letter
- replay
- external consumer
- security
- authentication
- deployment
- failure modes


============================================================
54. ARCHITECTURE DOCUMENT
============================================================

Update:

docs/ARCHITECTURE.md

Include a diagram showing:

Environmental Sources
        ↓
AquaSentinel
        ↓
Domain Event
        ↓
Outbox
        ↓
FHIR Mapper
        ↓
HAPI / External FHIR Server
        ↓
FHIR Subscription
        ↓
External Consumer


============================================================
55. WALKTHROUGH
============================================================

Update walkthrough.md.

The Phase 7 walkthrough must demonstrate:

1. Start all services.
2. Verify HAPI FHIR.
3. Verify external consumer.
4. Generate environmental observation.
5. Show FHIR Observation.
6. Trigger evidence processing.
7. Trigger warning/incident.
8. Generate qualified external event.
9. Show outbound event.
10. Show FHIR resource.
11. Show Subscription.
12. Show REST-hook delivery.
13. Show external consumer receiving event.
14. Show acknowledgement.
15. Show AquaSentinel audit trail.
16. Simulate consumer failure.
17. Show retry.
18. Restore consumer.
19. Show successful delivery.
20. Demonstrate duplicate-event handling.
21. Demonstrate dead-letter/replay.


============================================================
56. DEFINITION OF DONE
============================================================

[ ] Event taxonomy implemented.

[ ] Event envelope implemented.

[ ] Versioned event contracts implemented.

[ ] Event qualification implemented.

[ ] Correlation IDs implemented.

[ ] Causation IDs implemented.

[ ] Persistent outbox implemented.

[ ] Delivery worker implemented.

[ ] Retry logic implemented.

[ ] Dead-letter handling implemented.

[ ] Replay implemented.

[ ] FHIR validation implemented.

[ ] FHIR mapping implemented.

[ ] OAH-FHIR compatibility preserved.

[ ] HAPI FHIR integration verified.

[ ] FHIR Subscription verified.

[ ] REST-hook verified.

[ ] External consumer implemented.

[ ] External consumer does not access internal DB.

[ ] Consumer acknowledgement implemented.

[ ] Duplicate delivery protection implemented.

[ ] Contract tests implemented.

[ ] Failure simulation implemented.

[ ] Interoperability Command Console implemented.

[ ] Event inspector implemented.

[ ] Delivery monitor implemented.

[ ] FHIR resource inspector implemented.

[ ] Provenance chain implemented.

[ ] Audit trail implemented.

[ ] Configuration-driven endpoints implemented.

[ ] Secrets excluded from frontend.

[ ] Demo mode works without external credentials.

[ ] Live mode configuration implemented.

[ ] Observability implemented.

[ ] Documentation updated.

[ ] Walkthrough updated.

[ ] Phase 1–6 regression tests pass.

[ ] npm build passes.

[ ] PHASE_7_HANDOFF.md created.


============================================================
57. MANDATORY PHASE 7 HANDOFF
============================================================

Create:

prd/PHASE_7_HANDOFF.md

The handoff must contain:

1. Phase objective
2. Architecture implemented
3. Event taxonomy
4. Event contracts
5. Event schemas
6. Outbox architecture
7. Delivery worker
8. Retry strategy
9. Dead-letter strategy
10. Replay behaviour
11. FHIR mappings
12. OAH-FHIR compatibility
13. FHIR Subscription configuration
14. REST-hook implementation
15. External consumer architecture
16. Consumer contract
17. Idempotency implementation
18. Correlation/causation
19. Provenance
20. Audit trail
21. API endpoints
22. Frontend routes
23. Frontend components
24. Configuration/environment variables
25. Authentication
26. Demo mode
27. Live mode
28. Failure simulation
29. Tests
30. Test results
31. Integration-test results
32. Build result
33. Known limitations
34. Technical debt
35. Files created
36. Files modified
37. Exact Phase 8 starting state
38. What Phase 8 should reuse
39. What Phase 8 must not rewrite
40. Extension points for Phase 8


============================================================
58. HANDOFF VALIDATION
============================================================

Before declaring Phase 7 complete:

test -f prd/PHASE_7_HANDOFF.md

Verify it is non-empty.

If missing:

"HANDOFF DOCUMENT NOT CREATED — PHASE 7 INCOMPLETE"

Do not claim completion.


============================================================
59. FINAL PHASE 7 SUCCESS CRITERION
============================================================

A judge should be able to watch:

ENVIRONMENTAL SIGNAL
        ↓
EVIDENCE
        ↓
AQUASENTINEL DECISION
        ↓
FHIR RESOURCE
        ↓
EVENT
        ↓
SUBSCRIPTION
        ↓
EXTERNAL SYSTEM
        ↓
ACKNOWLEDGEMENT
        ↓
AUDIT TRAIL

and understand that AquaSentinel is not merely displaying data.

It is enabling systems that previously operated separately to
exchange standardized, traceable, actionable information.

============================================================
60. FINAL OUTPUT
============================================================

Provide a completion report containing:

- implemented architecture
- event architecture
- FHIR architecture
- OAH-FHIR compatibility
- outbox
- retry/dead-letter
- external consumer
- subscription
- REST-hook result
- golden-path result
- failure simulation result
- duplicate handling result
- replay result
- test count
- integration test result
- build result
- known limitations
- files created/modified
- confirmation of PHASE_7_HANDOFF.md
- exact Phase 8 starting state

IMPLEMENT THE ENTIRE PHASE 7 PRD.

DO NOT MERELY DESCRIBE IT.

START BY READING THE MAIN PRD AND PHASE_6_HANDOFF.md.