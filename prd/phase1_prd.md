PHASE 1 PRD — FOUNDATION & INFRASTRUCTURE

Project: AquaSentinel
Phase: 1 of 9
Phase Name: Foundation & Infrastructure
Primary Objective: Establish the complete, runnable, extensible technical foundation on which Phases 2–9 will be built.

1. PHASE OBJECTIVE

Phase 1 establishes the technical foundation of AquaSentinel.

The purpose of this phase is not to implement the environmental intelligence, evidence-fusion engine, incident workflow, recommendation engine, FHIR workflow, or final command console.

Instead, Phase 1 must create the underlying system architecture, repository structure, development environment, persistence layer, application skeleton, configuration system, testing infrastructure, logging, and foundational domain model required for those capabilities to be implemented cleanly in later phases.

At the end of Phase 1, another developer or coding agent should be able to clone the repository, follow the documented instructions, start the application locally, run the tests, inspect the architecture, and begin implementing Phase 2 without having to restructure the project.

The Phase 1 implementation must therefore optimize for:

clean architecture;
maintainability;
extensibility;
reproducibility;
testability;
security;
clear separation of concerns;
future FHIR integration;
future event-driven processing;
future external API integrations;
reliable local development.
2. MANDATORY DOCUMENTS

The Phase 1 agent MUST receive and read:

AquaSentinel Main PRD
This Phase 1 PRD

The Main PRD is the source of truth for the overall product vision, architecture, scientific guardrails, data model, API philosophy, FHIR strategy, UX philosophy, and nine-phase development roadmap.

This Phase 1 PRD is the source of truth for what must be implemented during Phase 1.

Phase 1 has no Phase 0 handoff.

Therefore, a Phase 0 handoff document is not required.

However, the agent must still verify that the Main PRD and Phase 1 PRD are available before beginning implementation.

If either required document is missing or inaccessible, the agent must stop and explicitly report:

BLOCKED — REQUIRED PRD DOCUMENT MISSING

It must identify the missing document and must not reconstruct its requirements from assumptions.

3. SYSTEM CONTEXT

AquaSentinel is an evidence-driven early-warning and incident-response platform for urban freshwater ecosystems.

The complete product will eventually implement:

Detect → Corroborate → Assess → Recommend → Approve → Act → Verify → Resolve

Phase 1 establishes the infrastructure required for this loop.

The eventual system architecture is broadly:

Environmental Data Sources
        ↓
Data Ingestion
        ↓
FHIR / OAH Integration Layer
        ↓
Event Layer
        ↓
AquaSentinel Evidence Engine
        ↓
Incident State Machine
        ↓
Recommendation Engine
        ↓
Human-in-the-Loop Command Console
        ↓
FHIR Operational Workflow
        ↓
Field Verification
        ↓
Resolution

Phase 1 does not implement the complete pipeline.

It creates the foundation through which later phases will implement it.

4. PHASE 1 SUCCESS DEFINITION

Phase 1 is successful when:

AquaSentinel exists as a clean, runnable, tested software system with a documented architecture and foundational domain model, ready for Phase 2 to begin environmental-data implementation without architectural restructuring.

A successful Phase 1 should allow the next agent to say:

“I understand where environmental observations belong, where business logic belongs, where external integrations belong, how data is persisted, how the application is configured, how tests run, and how the system is started.”

5. ARCHITECTURAL PRINCIPLES

The Phase 1 implementation MUST follow these principles.

5.1 Separation of Concerns

Keep separate:

frontend;
backend/API;
domain logic;
persistence;
external integrations;
FHIR integration;
asynchronous/event processing;
configuration;
testing.

Do not create one monolithic file or service containing the entire application.

5.2 Domain Logic Must Not Depend Directly on External APIs

Core AquaSentinel logic must not directly call:

Sentinel APIs;
weather APIs;
citizen-science APIs;
GEOSSIP;
FHIR servers.

Instead, later phases should be able to implement adapters/interfaces around these systems.

Example conceptual structure:

AquaSentinel Core
       ↓
Application Interface
       ↓
Adapter
       ↓
External System

This allows external integrations to be replaced with mocks or demo data.

5.3 Frontend Must Not Depend Directly on Raw FHIR

The eventual frontend should interact primarily with AquaSentinel's application/domain API.

FHIR should be behind the appropriate service/adapter layer.

Do not architect the frontend around raw FHIR JSON.

5.4 External Services Must Be Replaceable

Every external dependency must have a clean boundary.

This is particularly important because later phases may use:

Sentinel-2/Sentinel Hub;
weather APIs;
citizen observations;
OAH-FHIR;
HAPI FHIR.

The Phase 1 architecture must make it possible to substitute:

LIVE API

with:

MOCK API

or:

SEEDED DEMO DATA

without rewriting the core application.

6. TECHNOLOGY STACK

The implementation should use the architecture established in the Main PRD unless the agent identifies a concrete technical reason to change it.

The intended stack is:

Frontend
React
TypeScript
Tailwind CSS
Map-oriented UI architecture prepared for Mapbox or equivalent mapping integration
Backend
TypeScript / Node.js
REST API architecture
Database

Use a relational database appropriate for:

structured domain entities;
geospatial data;
timestamps;
relationships;
future incident/evidence queries.

PostgreSQL is the preferred choice.

If geospatial functionality is required by the implementation, structure the database so PostGIS can be used.

FHIR

Prepare an integration boundary for:

HAPI FHIR R4;
OAH-FHIR profiles/resources.

FHIR should not become a hard dependency for basic Phase 1 application startup unless required.

Infrastructure
Docker
Docker Compose
environment-based configuration
Testing

Use an appropriate TypeScript testing framework and establish:

unit tests;
integration-test structure;
API testing capability.

The exact libraries may be selected by the agent based on the chosen implementation architecture.

7. REPOSITORY STRUCTURE

Create a clear repository structure.

The precise organization may be adapted if the agent has a strong architectural reason, but it must preserve clear separation between major system concerns.

A suitable structure is:

aquasentinel/
│
├── frontend/
│
├── backend/
│
├── shared/
│
├── infrastructure/
│
├── tests/
│
├── docs/
│
├── data/
│
├── scripts/
│
├── PRD/
│   ├── MAIN_PRD.md
│   ├── PHASE_1_PRD.md
│   └── PHASE_1_HANDOFF.md
│
├── .env.example
├── .gitignore
├── docker-compose.yml
├── README.md
└── ...

The agent may modify this structure if a better architecture is justified.

However, the final repository must make it immediately obvious:

where frontend code lives;
where backend code lives;
where shared contracts/types live;
where infrastructure lives;
where tests live;
where documentation lives;
where PRDs and handoffs live.
8. APPLICATION SKELETON

The agent must create a working application skeleton.

At minimum:

Backend
application startup;
configuration loading;
API server;
health endpoint;
structured error handling;
database connection;
logging.
Frontend
application startup;
routing foundation;
basic application shell;
error/loading states;
API connection layer;
environment configuration.

The UI does not need to implement the final command console in Phase 1.

However, it should have enough foundation that Phase 6 can build the operational console without replacing the frontend architecture.

9. DATABASE FOUNDATION

Create the initial relational database infrastructure.

The database must support future implementation of:

stream reaches;
observations;
evidence;
incidents;
evidence assessments;
recommendations;
tasks;
verification records;
incident events;
provenance.

Phase 1 does not need to fully implement every future table.

However, the foundational schema must not prevent these entities from being added cleanly.

The agent must establish:

migrations;
database connection;
schema management;
development database;
test database strategy.

Database changes must be reproducible.

Do not manually modify the production/development database without corresponding migration files.

10. FOUNDATIONAL DOMAIN TYPES

Create foundational domain types/interfaces for the system described in the Main PRD.

At minimum, establish structures for:

Stream Reach

Conceptually:

id
name
geometry
city/region
monitoring status
Observation

Conceptually:

id
source
timestamp
location
streamReach
indicator
value
unit
quality
provenance
Evidence Item

Conceptually:

source
observation
relevance
spatialMatch
temporalMatch
quality
contribution
provenance
Incident

Conceptually:

id
streamReach
createdAt
updatedAt
status
hazardType
evidenceConfidence
severity
Recommendation

Conceptually:

actionType
priority
rationale
requiresApproval
status
Task

Conceptually:

incidentId
recommendationId
assignedTo
location
priority
instructions
status
Verification

Conceptually:

observer
timestamp
location
result
photos
sampleCollected
notes
Incident Event

Conceptually:

incidentId
eventType
timestamp
actor
metadata

These structures are foundational contracts.

Later phases may expand them.

11. PROVENANCE FOUNDATION

Because AquaSentinel combines evidence from multiple sources, provenance must be treated as a first-class architectural concern.

The foundation must support recording:

source;
source identifier;
acquisition timestamp;
processing timestamp;
original observation identifier;
processing method;
quality information.

Derived information must remain distinguishable from directly measured information.

The architecture must make it possible for later phases to answer:

“Where did this piece of evidence come from?”

12. CONFIGURATION MANAGEMENT

Create centralized configuration management.

Configuration must support:

application environment;
database connection;
API ports;
FHIR endpoint;
external API endpoints;
API credentials;
authentication configuration;
demo/live mode;
logging configuration.

Use environment variables.

Create:

.env.example

with placeholder values.

Never commit:

API keys;
passwords;
tokens;
private credentials;
production secrets.
13. LIVE MODE VS DEMO MODE

The architecture must explicitly support two operating modes.

LIVE

External adapters can connect to real services.

DEMO

The application uses deterministic local data.

Phase 1 does not need to implement all external adapters.

It must, however, establish the configuration and architectural pattern that allows later phases to implement:

ExternalAdapter

and:

DemoAdapter

under the same interface.

This requirement is critical for hackathon reliability.

14. API FOUNDATION

Create the foundational backend API structure.

At minimum, establish:

/api/health

and an appropriate versioning strategy such as:

/api/v1/

The backend should be prepared for future domains:

/api/v1/observations
/api/v1/incidents
/api/v1/evidence
/api/v1/recommendations
/api/v1/tasks
/api/v1/verification

Phase 1 does not need to fully implement these endpoints.

However, the API architecture must make their later implementation straightforward.

15. ERROR HANDLING

Implement centralized API error handling.

Errors should be:

structured;
predictable;
logged appropriately;
safe for users;
free of secret information.

The API should distinguish common classes such as:

validation errors;
authentication/authorization errors;
not found;
conflict;
external dependency failure;
internal server error.

Do not expose stack traces or credentials through production API responses.

16. LOGGING & OBSERVABILITY FOUNDATION

Implement structured logging.

Logs should support fields such as:

timestamp
service
level
eventId
requestId
incidentId
message

Later phases will use these fields for tracing:

Observation
→ Evidence
→ Incident
→ Recommendation
→ Task

Do not build a massive observability platform in Phase 1.

Establish a clean foundation.

17. IDENTIFIERS

Establish a consistent identifier strategy.

Identifiers must be:

unique;
stable;
serializable;
safe to expose through APIs.

The agent should choose an appropriate strategy such as UUIDs.

The decision must be documented in the Phase 1 handoff.

18. TIME HANDLING

AquaSentinel is heavily dependent on temporal correlation.

The system must establish a consistent approach to timestamps.

Store timestamps in a consistent canonical representation, preferably UTC internally.

The architecture must preserve:

observation timestamp;
ingestion timestamp;
processing timestamp;
incident creation/update timestamp.

The frontend can later convert timestamps to the user's display timezone.

19. GEOSPATIAL FOUNDATION

AquaSentinel will eventually correlate observations with stream reaches.

Therefore Phase 1 must establish a geospatially appropriate foundation.

The system must be able to represent:

latitude;
longitude;
observation locations;
stream/reach geometry.

Where PostgreSQL/PostGIS is used, establish the correct spatial data architecture.

Do not implement the full spatial correlation engine yet.

That belongs primarily to Phase 3.

20. SECURITY FOUNDATION

Implement reasonable prototype-level security foundations.

At minimum:

environment-based secrets;
input validation;
safe error handling;
basic authentication architecture where appropriate;
role architecture prepared for future implementation;
no unnecessary PII;
secure password/token handling if authentication is implemented;
dependency hygiene.

Potential roles from the Main PRD include:

admin
decision maker
scientist
field inspector
citizen

Phase 1 does not need to implement the complete authorization matrix.

It must not, however, make later role-based access control difficult.

21. TESTING FOUNDATION

Establish automated testing infrastructure.

At minimum, create:

Unit-test infrastructure

For future:

evidence engine;
recommendation engine;
state machine;
validation logic.
Integration-test infrastructure

For future:

API
→ Database

and eventually:

Observation
→ FHIR
→ Event
→ Evidence
→ Incident
→ Recommendation
Basic Phase 1 tests

The agent must create actual tests demonstrating:

application startup;
configuration validation;
database connectivity;
health endpoint;
basic API response;
foundational domain-model validation.

Tests must actually run successfully.

Do not create placeholder tests merely to satisfy a checklist.

22. API CONTRACTS & TYPES

Establish a strategy for keeping API contracts consistent between frontend and backend.

The exact approach may be selected by the agent.

Possible approaches include:

shared TypeScript types;
OpenAPI;
generated client;
schema validation.

The chosen approach must be documented.

The critical requirement is:

Frontend and backend must have a reliable shared understanding of data contracts.

23. FHIR INTEGRATION BOUNDARY

Phase 1 does not need to implement the full OAH-FHIR workflow.

It must establish an integration boundary.

Create an architectural location/interface for:

FHIRAdapter

or equivalent.

It should eventually support:

creating/retrieving FHIR resources;
validating resources;
interacting with HAPI FHIR;
translating AquaSentinel domain objects to FHIR;
translating relevant FHIR resources back into domain objects.

The Phase 1 implementation should avoid embedding FHIR-specific logic throughout the application.

24. EVENT ARCHITECTURE FOUNDATION

The eventual system is event-driven.

Phase 1 should establish the architectural pattern for internal events.

Examples of future events:

ObservationReceived
EvidenceUpdated
IncidentCreated
IncidentReassessed
IncidentStateChanged
RecommendationCreated
RecommendationApproved
TaskCreated
TaskCompleted
VerificationSubmitted
IncidentResolved

Phase 1 does not need to implement the complete event-processing engine.

It should establish:

event naming convention;
event structure;
event identifiers;
timestamp;
metadata;
basic event interface;
location for future event infrastructure.
25. FRONTEND FOUNDATION

Create the foundation for the eventual React command console.

At minimum:

Application shell
navigation;
page structure;
consistent layout;
responsive foundation.
API layer

Create a dedicated client/service layer.

The UI should not scatter raw fetch() calls throughout components.

State management

Choose an appropriate architecture that can support:

incident queue;
incident detail;
evidence;
recommendations;
tasks;
verification.

Do not over-engineer state management in Phase 1.

Design system foundation

Establish reusable:

buttons;
cards;
badges;
status indicators;
tables/lists;
modals;
loading states;
error states.

The final visual design will be developed in Phase 6.

26. DOCUMENTATION

Phase 1 must produce meaningful documentation.

At minimum:

README

Must explain:

what AquaSentinel is;
architecture at a high level;
prerequisites;
installation;
environment configuration;
running locally;
running tests;
starting Docker;
repository structure.
Architecture documentation

Document:

frontend;
backend;
database;
adapters;
FHIR boundary;
event architecture;
future phases.
Development documentation

Explain:

coding conventions;
how to add an API endpoint;
how to add a domain model;
how to add an external adapter;
how to run tests;
how to add migrations.

Documentation should be sufficient for another coding agent to understand the foundation without reverse-engineering the entire repository.

27. DO NOT BUILD IN PHASE 1

The Phase 1 agent must explicitly avoid prematurely implementing the following:

complete Sentinel-2 ingestion;
satellite anomaly detection;
evidence-fusion scoring;
incident state machine;
recommendation engine;
complete command console;
field verification workflow;
full FHIR workflow;
autonomous remediation;
clinical/medical functionality;
black-box AI;
unnecessary machine-learning infrastructure;
production-scale cloud infrastructure.

Those belong to later phases.

Phase 1 should create the interfaces and foundations that make those implementations possible.

28. ARCHITECTURAL DECISION RECORDS

Whenever the agent makes a significant technical decision that differs from an obvious/default implementation, it must document:

Decision.
Alternatives considered.
Reason for selection.
Consequences.
Impact on future phases.

Examples:

database ORM;
API framework;
state management;
authentication architecture;
event architecture;
testing framework;
repository structure.

Do not generate dozens of meaningless ADRs.

Document meaningful decisions.

29. PHASE 1 ACCEPTANCE CRITERIA

Phase 1 is complete only if all applicable criteria below are satisfied.

Repository
 Repository is logically organized.
 PRD directory exists.
 Main PRD is available.
 Phase 1 PRD is available.
 README exists.
Backend
 Backend starts successfully.
 Health endpoint works.
 Configuration is centralized.
 Error handling exists.
 Logging exists.
 API versioning strategy exists.
Frontend
 Frontend starts successfully.
 Application shell exists.
 API client layer exists.
 Basic reusable UI foundation exists.
Database
 Database starts.
 Application can connect.
 Migration strategy exists.
 Test database strategy exists.
 Foundational models/types exist.
Architecture
 External integrations have adapter boundaries.
 FHIR has a dedicated integration boundary.
 Event architecture has been established conceptually.
 Demo/live configuration architecture exists.
 Domain logic is separated from infrastructure.
Testing
 Automated tests exist.
 Tests execute successfully.
 Health/API behavior is tested.
 Database behavior is tested.
 Configuration validation is tested.
Security
 Secrets are environment-based.
 .env is excluded from version control.
 .env.example exists.
 No credentials are committed.
Documentation
 README complete.
 Architecture documented.
 Development instructions documented.
 Important technical decisions documented.
 Phase 1 handoff prepared.
30. MANDATORY PHASE 1 HANDOFF DOCUMENT

At the conclusion of Phase 1, the agent MUST create:

PRD/PHASE_1_HANDOFF.md

This file is mandatory.

It will be handed directly to the Phase 2 agent.

The Phase 1 agent must not consider Phase 1 complete until this document has been created.

30.1 Handoff Contents

PHASE_1_HANDOFF.md must contain:

1. Phase information
Phase number.
Phase name.
Completion date.
Implementation status.
2. What was actually built

List the actual implemented functionality.

Do not merely copy the Phase 1 PRD.

3. Repository structure

Explain important directories/files.

4. Technology stack

Document actual technologies used.

5. Architecture

Explain the architecture actually implemented.

6. Database

Document:

database;
schema;
migrations;
models;
important decisions.
7. APIs

Document every API endpoint actually created.

8. Domain models

Document actual domain types/models and important fields.

9. Configuration

Document every required environment variable.

Do not include secret values.

10. How to run

Provide verified instructions for:

install
configure
start
test
docker start
database setup
11. Tests

Document:

tests created;
tests executed;
results;
known failures.
12. Known limitations

Be completely honest.

If something is incomplete, say so.

13. Known bugs

Document any known bugs.

14. Deviations from Phase 1 PRD

Explicitly state:

Requirement
Expected
Actual
Reason
15. Deviations from Main PRD

Identify any architectural/product deviations.

16. Important technical decisions

Document decisions that Phase 2 must know.

17. Phase 2 starting state

Explicitly explain:

What already exists when Phase 2 begins?

This section is particularly important.

18. Phase 2 dependencies

State exactly what Phase 2 can now build on.

19. Things Phase 2 must preserve

Identify architectural contracts that should not be broken.

20. Phase 2 readiness checklist

End with:

PHASE 2 READINESS

[ ] Application starts
[ ] Database starts
[ ] Backend starts
[ ] Frontend starts
[ ] Tests pass
[ ] API foundation works
[ ] Domain foundation exists
[ ] Adapter architecture exists
[ ] FHIR boundary exists
[ ] Configuration documented
[ ] Demo/live architecture documented
[ ] Known issues documented
[ ] Phase 2 dependencies documented
[ ] Handoff complete
31. HANDOFF INTEGRITY REQUIREMENT

The Phase 1 agent must understand that the handoff document is not optional documentation.

It is a formal engineering artifact connecting Phase 1 and Phase 2.

The Phase 2 agent will receive:

MAIN_PRD.md
+
PHASE_2_PRD.md
+
PHASE_1_HANDOFF.md

The Phase 2 agent must use the handoff to understand the actual implementation state.

The Phase 1 agent must therefore document reality, including failures and deviations, rather than presenting an idealized version of the implementation.

32. FINAL PHASE 1 DEFINITION OF DONE

Phase 1 is complete only when:

The application runs, the foundational architecture exists, the database and API foundations work, the frontend foundation works, automated tests run, configuration and security foundations exist, the architecture is documented, and PRD/PHASE_1_HANDOFF.md accurately describes the actual implementation and is ready for the Phase 2 agent.

The agent must not declare completion merely because the code has been written.

It must verify that the system actually runs.