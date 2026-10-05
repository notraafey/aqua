PHASE 2 PRD — ENVIRONMENTAL DATA LAYER

Project: AquaSentinel
Phase: 2 of 9
Phase Name: Environmental Data Layer
Depends On: Phase 1 — Foundation & Infrastructure
Primary Objective: Implement a reliable, provenance-preserving, multi-source environmental data ingestion and normalization layer that can supply AquaSentinel with satellite, weather, and citizen-science observations.

1. PHASE OBJECTIVE

Phase 2 transforms the Phase 1 software foundation into a functioning environmental-data platform.

Phase 1 established:

the repository;
database;
domain models;
observation API;
provenance infrastructure;
adapter boundaries;
live/demo architecture;
FHIR boundary;
event bus;
seeded stream reaches.

Phase 2 must now populate that architecture with real environmental data pathways.

The three principal evidence sources are:

Satellite / Earth observation
Weather / environmental context
Citizen-science observations

The central objective is:

Take heterogeneous environmental data from external sources, validate and normalize it into AquaSentinel's canonical observation model, preserve provenance and quality metadata, associate it with relevant stream reaches, and make it available to later phases through a consistent internal interface.

Phase 2 is therefore the bridge between:

External environmental systems

and:

AquaSentinel's canonical evidence model.

2. MANDATORY DOCUMENTS

Before doing any implementation, the Phase 2 agent MUST verify that it has access to:

MAIN_PRD
PHASE_2_PRD
PRD/PHASE_1_HANDOFF.md

The Phase 1 handoff is a mandatory dependency.

The Phase 2 agent must read the Phase 1 handoff completely before implementation.

The agent must understand what Phase 1 actually built, rather than assuming that every Phase 1 requirement was implemented exactly as originally specified.

Missing handoff rule

If:

PRD/PHASE_1_HANDOFF.md

is missing, inaccessible, corrupted, or clearly incomplete, the agent MUST STOP.

It must report:

BLOCKED — PHASE 1 HANDOFF DOCUMENT MISSING

It must not:

reconstruct Phase 1 from the Main PRD;
guess the repository architecture;
recreate Phase 1 components;
silently proceed.

The handoff is the authoritative description of the implementation inherited from Phase 1.

3. STATE OF THE SYSTEM WHEN ENTERING PHASE 2

According to the Phase 1 handoff, Phase 2 inherits:

Repository

A functioning monorepo containing:

shared/
backend/
frontend/
PRD/
infrastructure and scripts.
Persistence

PostgreSQL/PostGIS infrastructure with repositories and migrations.

The initial schema includes:

stream_reaches
observations
provenance_records
incidents
evidence_items
evidence_assessments
recommendations
tasks
verifications
incident_events
Existing observation API

The backend already exposes:

POST /api/v1/observations

with validation, provenance attachment, persistence/event behavior.

Existing adapter interfaces

Phase 1 created:

ISatelliteAdapter
IWeatherAdapter
ICitizenAdapter

These currently contain placeholder/mock behavior and are intended to be implemented in Phase 2.

Existing FHIR boundary

A FHIR adapter and mapper already exist.

Phase 2 should reuse these rather than create a second FHIR architecture.

Existing event bus

A decoupled in-memory event bus exists.

Phase 2 should emit appropriate observation/data-ingestion events into this infrastructure.

Existing seeded stream reaches

The current seed includes:

Almyros Stream, Greece
Kladissos River, Greece

The Phase 2 agent must inspect the actual seed data and implementation before making assumptions about geometry or metadata.

Existing demo/live modes

Phase 1 established:

APP_MODE=demo
APP_MODE=live

Phase 2 must preserve this architecture.

4. PHASE 2 SUCCESS DEFINITION

Phase 2 is complete when AquaSentinel can reliably perform:

External source → adapter → validation → normalization → quality assessment → provenance → stream association → canonical Observation → persistence → event

for the environmental data sources that are successfully integrated.

At the end of Phase 2, Phase 3 should not need to understand:

Sentinel Hub request formats;
Open-Meteo response formats;
citizen portal schemas;
authentication mechanisms;
external source-specific field names.

Phase 3 should receive canonical AquaSentinel observations.

This separation is critical.

5. CORE ARCHITECTURAL PRINCIPLE

External data formats must never become AquaSentinel's internal data model.

For example:

Sentinel-2 response
        ↓
SentinelAdapter
        ↓
Canonical Observation
        ↓
AquaSentinel

not:

Sentinel-2 JSON
        ↓
Evidence Engine

Similarly:

Open-Meteo response
        ↓
WeatherAdapter
        ↓
Canonical Observation

and:

Citizen platform response
        ↓
CitizenAdapter
        ↓
Canonical Observation
6. DATA SOURCES

Phase 2 should implement three source pathways.

6.1 Satellite

Primary target:

Sentinel-2 Level-2A

The current Copernicus Data Space Ecosystem provides Sentinel-2 access through multiple APIs, including Sentinel Hub processing/catalog interfaces and other data-access mechanisms. Sentinel-2 L2A is available through the Sentinel Hub Processing API, with sentinel-2-l2a as the data type.

The agent should use the existing Phase 1 ISatelliteAdapter rather than coupling the application to one particular provider.

6.2 Weather

Primary target:

Open-Meteo

Weather data should provide contextual variables useful to later evidence assessment, especially:

precipitation;
rainfall;
temperature;
cloud cover;
potentially wind and humidity where justified.

Open-Meteo provides historical weather data as well as historical forecast data, with hourly precipitation and temperature variables available.

The agent should use the existing IWeatherAdapter.

6.3 Citizen Science

The existing ICitizenAdapter must become capable of consuming the selected citizen-observation source.

The agent must first inspect the available OAH/public citizen-science interfaces and the existing project assumptions.

Do not invent an API endpoint.

If a production OAH citizen API cannot be reliably accessed, the agent must implement the adapter boundary and a documented demo/fixture pathway rather than fabricate an integration.

7. SOURCE ADAPTER CONTRACT

Each adapter must have a consistent lifecycle:

Request
 ↓
External source
 ↓
Raw response
 ↓
Validation
 ↓
Normalization
 ↓
Quality assessment
 ↓
Provenance
 ↓
Canonical Observation
 ↓
Persistence
 ↓
Event

The adapter must not directly create incidents.

That belongs to later phases.

8. CANONICAL OBSERVATION MODEL

The existing Phase 1 Observation model is the canonical internal representation.

The Phase 2 implementation may extend it where necessary.

At minimum, an observation should preserve:

id
source
timestamp
location
streamReachId
indicator
value
unit
quality
provenance

Where required, additional metadata may include:

sourceIdentifier
acquisitionTimestamp
ingestionTimestamp
processingTimestamp
processingMethod
sensor/platform
rawReference
qualityFlags

The agent must avoid adding fields merely because they exist in an external API.

Every new field must have a clear AquaSentinel purpose.

9. OBSERVATION TYPES

Phase 2 should support at least three broad observation categories.

9.1 Satellite Observation

Examples:

NDCI
NDWI
MNDWI
other approved remote-sensing indicators

The system must preserve:

indicator name;
numerical value;
unit;
acquisition time;
source/platform;
spatial footprint;
quality metadata.

The Phase 2 agent must not claim that an index directly proves a hazard.

A satellite observation is evidence.

9.2 Weather Observation

Examples:

precipitation
temperature
cloud_cover
humidity
wind

These should be represented as contextual environmental observations.

The system should preserve the variable's:

name;
value;
unit;
timestamp;
coordinates;
source;
temporal resolution.
9.3 Citizen Observation

Potential fields:

observation timestamp;
location;
description;
environmental indicator;
photo/media reference;
source identifier;
observer/source metadata where appropriate;
quality information.

Citizen observations must not be treated as automatically authoritative.

The observation should carry source-quality metadata that Phase 3 can use.

10. SENTINEL-2 IMPLEMENTATION
10.1 Objective

Implement a working Sentinel-2 adapter capable of obtaining the environmental information required by AquaSentinel.

The agent should prefer a processing/statistics pathway rather than downloading massive raw satellite datasets.

Copernicus Data Space currently exposes Sentinel Hub processing and catalog APIs for Earth-observation access.

11. SATELLITE QUERY FLOW

The adapter should conceptually support:

Stream Reach
      ↓
Geometry / bounding region
      ↓
Date/time window
      ↓
Satellite catalogue/search
      ↓
Suitable Sentinel-2 acquisition
      ↓
Quality filtering
      ↓
Processing/statistics request
      ↓
Indicator calculation
      ↓
Canonical Observation

The exact implementation can differ if technically superior.

12. SATELLITE DATA QUALITY GATES

The satellite adapter must not return every available observation as equally valid.

At minimum, evaluate:

Cloud quality

Reject or downgrade scenes with excessive cloud contamination.

Acquisition validity

Verify:

valid acquisition timestamp;
usable response;
correct satellite product;
expected bands/variables.
Spatial validity

Determine whether the requested geometry actually intersects useful water pixels.

Water coverage

Record whether there is sufficient valid water coverage.

Geometry appropriateness

Narrow urban streams are especially vulnerable to mixed-pixel contamination.

The adapter must therefore preserve enough metadata for later phases to determine whether an observation is spatially trustworthy.

The adapter must not silently imply that a narrow stream has been reliably measured merely because a satellite request succeeded.

13. REMOTE-SENSING INDICATOR HANDLING

The initial Phase 2 implementation should support the indicator(s) required for the MVP.

NDCI may be the primary indicator because it is already aligned with the AquaSentinel concept and OAH remote-sensing work.

However:

NDCI is an environmental indicator, not a direct measurement of a confirmed aquatic hazard.

The implementation must preserve the raw/derived indicator value and processing method.

Do not hardcode suspicious or fabricated values.

If an external source returns a value such as:

0.59

that value must remain traceable to the actual processing result.

14. SATELLITE AUTHENTICATION

Credentials must be supplied through environment variables.

For example:

SENTINEL_CLIENT_ID
SENTINEL_CLIENT_SECRET

The exact names may be chosen by the agent.

Credentials must never be:

hardcoded;
committed;
printed in logs;
included in demo fixtures.

Copernicus documentation currently describes OAuth credentials for Sentinel Hub access.

15. SENTINEL FALLBACK STRATEGY

The satellite integration must support:

Live mode

Actual Copernicus/Sentinel processing.

Demo mode

Deterministic fixture data representing valid satellite observations.

The demo data must include realistic provenance such as:

source
sourceIdentifier
acquisitionTimestamp
processingMethod
indicator
value
quality

It must be explicitly marked as demo/fixture data.

It must never be represented as live satellite data.

16. WEATHER ADAPTER

Implement the Phase 1 IWeatherAdapter.

The adapter must retrieve contextual environmental variables for a specified:

latitude
longitude
time range

At minimum support:

precipitation;
temperature.

Where useful and technically straightforward, support:

cloud cover;
relative humidity;
wind.

Do not collect dozens of weather variables simply because the API exposes them.

Only ingest variables that have a plausible downstream use in AquaSentinel.

17. WEATHER TEMPORAL NORMALIZATION

Weather data often arrives as a time series.

The adapter must preserve the original temporal resolution while normalizing observations into the AquaSentinel model.

For example:

2026-09-17 10:00
2026-09-17 11:00
2026-09-17 12:00

must remain distinguishable.

Do not collapse time-series observations prematurely.

Phase 3 will decide how to aggregate or correlate them.

18. WEATHER CONTEXT WINDOWS

Phase 2 should make it possible for later phases to query weather context around an environmental observation.

For example:

observation timestamp
       ↓
preceding hours/days
       ↓
weather observations

The exact correlation window belongs to Phase 3.

Phase 2 should therefore preserve sufficient timestamp precision rather than hardcoding a scientific interpretation.

19. CITIZEN ADAPTER

Implement the Phase 1 ICitizenAdapter.

The adapter must normalize citizen observations into the canonical observation model.

The agent must investigate the actual available source/interface before implementation.

If the OAH Citizen Science system provides an accessible integration route, use the real route.

If it does not:

document the limitation;
implement the adapter contract;
provide deterministic fixtures;
make the adapter ready for future real integration.

Do not invent a nonexistent public API.

20. CITIZEN MEDIA

Where citizen observations contain photos/media:

The system should preserve a reference to the media rather than unnecessarily duplicating large media files.

At minimum preserve:

media reference
source
observation ID
timestamp

Phase 2 does not need to build a sophisticated media-management platform.

It must, however, avoid destroying the provenance relationship between:

Citizen Observation
        ↓
Photo
21. SOURCE QUALITY

Every adapter must produce source-quality metadata.

Quality should be represented explicitly rather than inferred later from missing fields.

Potential dimensions:

source reliability
measurement validity
spatial quality
temporal quality
completeness
processing quality

The precise numerical model does not need to be the final Phase 3 evidence score.

Phase 2 should provide quality facts.

Phase 3 decides how those facts contribute to evidence confidence.

22. PROVENANCE

Every normalized observation must have provenance.

At minimum:

source
sourceIdentifier
acquisitionTimestamp
ingestionTimestamp
processingTimestamp
processingMethod
quality

The provenance system from Phase 1 must be reused.

Do not create a competing provenance system.

23. RAW DATA PRESERVATION

Where practical, preserve enough raw-source metadata to reproduce or inspect the observation.

However, do not indiscriminately store enormous raw satellite files in PostgreSQL.

The architecture should distinguish:

Raw source reference

from:

Canonical observation

The database should store the canonical observation and relevant metadata/reference.

Large remote assets should remain external or in an appropriate object/reference system where required.

24. IDEMPOTENCY

External data ingestion must be idempotent.

The same external observation should not create duplicate AquaSentinel observations if the ingestion process is repeated.

Use a stable combination of:

source;
source identifier;
acquisition timestamp;
relevant location/indicator identity;

or another appropriate deterministic identity strategy.

The exact deduplication key must be documented.

25. VALIDATION

Every incoming observation must pass validation before persistence.

Validate:

Source

Known/allowed source.

Timestamp

Valid ISO timestamp.

Location

Valid WGS84 geometry.

Indicator

Recognized indicator.

Value

Valid numeric or structured value appropriate to the indicator.

Unit

Valid for the indicator.

Provenance

Required provenance fields present.

Source identifier

Present where the source provides one.

Invalid records must be rejected or explicitly marked invalid according to the source and ingestion context.

Do not silently coerce invalid environmental data into apparently valid observations.

26. GEOSPATIAL ASSOCIATION

Phase 2 must implement the first practical version of:

Observation → Stream Reach

association.

Use the stream-reach geometries already present in the Phase 1 database.

The system should determine whether an observation is:

directly associated;
within an appropriate spatial relationship;
not associated with any monitored reach.

The exact advanced spatial correlation model belongs to Phase 3.

Phase 2 should establish the reliable foundational association mechanism.

27. SATELLITE GEOMETRY REQUIREMENTS

Satellite observations are spatially different from point observations.

The adapter should preserve enough geometry/footprint information to distinguish:

observation point;
requested area;
scene/processing footprint;
stream reach geometry.

Do not reduce a raster/area observation to a point without retaining the original spatial context.

28. DATA NORMALIZATION

All sources must ultimately produce the same canonical internal representation.

Conceptually:

Satellite
    ↓
SatelliteAdapter
    ↓
Observation

Weather
    ↓
WeatherAdapter
    ↓
Observation

Citizen Science
    ↓
CitizenAdapter
    ↓
Observation

This is one of the most important deliverables of Phase 2.

Phase 3 must be able to process observations without knowing their external origin format.

29. OBSERVATION INGESTION SERVICE

Create a reusable ingestion service.

Conceptually:

Adapter
   ↓
IngestionService
   ↓
Validate
   ↓
Normalize
   ↓
Attach provenance
   ↓
Quality assessment
   ↓
Deduplicate
   ↓
Associate stream reach
   ↓
Persist
   ↓
Emit event

The ingestion service should be shared across adapters.

Do not duplicate ingestion logic separately in every adapter.

30. EVENTS

When a valid observation is successfully ingested, emit an appropriate event using the Phase 1 event bus.

For example:

ObservationReceived

or another appropriately named canonical event.

The event should contain enough information for future phases to react without requiring the entire raw external response.

At minimum:

eventId
eventType
timestamp
observationId
source

The event architecture must remain decoupled.

31. DATABASE PERSISTENCE

Reuse the Phase 1 repositories.

Extend the database schema only when required.

Do not replace the Phase 1 persistence architecture.

Every migration must be versioned and reproducible.

The agent must verify that:

observations persist;
provenance persists;
stream associations persist;
duplicate ingestion behaves correctly.
32. API EXPOSURE

Phase 2 should extend the existing observation API where useful.

At minimum support:

POST /api/v1/observations
GET /api/v1/observations

The GET endpoint should eventually support filtering by relevant fields such as:

source;
stream reach;
indicator;
time range.

The agent should implement only filters that are actually useful for Phase 2/3.

Do not create a giant generic query language.

33. SOURCE-SPECIFIC INGESTION ENDPOINTS

Where appropriate, provide controlled application endpoints or internal services for triggering source ingestion.

For example:

POST /api/v1/ingestion/satellite
POST /api/v1/ingestion/weather
POST /api/v1/ingestion/citizen

The exact API design may differ.

The important requirement is that ingestion should be callable through a clear service boundary.

Do not expose credentials or provider-specific internals through the public API.

34. DEMO INGESTION

The Phase 2 demo mode must support deterministic ingestion scenarios.

At minimum create fixtures for:

Satellite

A valid satellite environmental observation.

Weather

A corresponding contextual weather time series.

Citizen

A citizen observation spatially/temporally associated with a monitored reach.

These fixtures should be deliberately designed so Phase 3 can use them to test evidence correlation.

35. DEMO DATA MUST BE HONESTLY LABELLED

Demo data must never be presented as actual live environmental measurements.

Use metadata such as:

mode: DEMO
sourceType: FIXTURE

or an equivalent mechanism.

The UI and logs must be able to distinguish:

LIVE

from:

DEMO
36. ERROR HANDLING & RETRIES

External API failures must not crash AquaSentinel.

Handle:

timeout;
HTTP errors;
authentication failure;
malformed response;
rate limit;
unavailable provider;
invalid data;
partial response.

The adapter should return structured errors to the ingestion layer.

Where retrying is appropriate, use bounded retries with sensible backoff.

Do not create infinite retry loops.

37. RATE LIMITING & EXTERNAL API SAFETY

The implementation must avoid unnecessary API calls.

Use:

bounded requests;
appropriate query windows;
caching where useful;
deduplication;
controlled concurrency.

Do not repeatedly request identical satellite scenes merely because a page refresh occurred.

External API credentials and quotas must be respected.

38. SATELLITE-SPECIFIC SAFETY

The system must not infer:

“Satellite request succeeded = water quality measurement is valid.”

A satellite observation must pass quality checks.

If:

cloud contamination is excessive;
water coverage is insufficient;
geometry is unsuitable;
requested data is unavailable;

the observation should be:

rejected;
downgraded;
or explicitly marked unusable,

depending on the situation.

Do not silently turn poor-quality imagery into normal-quality evidence.

39. SCIENTIFIC BOUNDARIES

Phase 2 must not:

diagnose human illness;
claim an environmental hazard is confirmed solely from satellite data;
claim that NDCI directly measures cyanobacterial concentration;
fabricate ground-truth measurements;
produce calibrated probabilities;
convert an environmental index into a medical risk score.

Phase 2's responsibility is data acquisition and normalization.

Interpretation belongs to later phases.

40. FHIR INTEGRATION

Reuse the Phase 1 FHIR adapter.

Where appropriate, normalized environmental observations should be representable as OAH-compatible FHIR resources.

However, Phase 2 must not allow FHIR complexity to contaminate the core ingestion model.

The intended flow is:

External Source
      ↓
Canonical Observation
      ↓
FHIR Mapper
      ↓
FHIR Observation

not:

External Source
      ↓
FHIR JSON
      ↓
Core Domain
41. FRONTEND CHANGES

Phase 2 does not require the complete Phase 6 command console.

However, the existing Phase 1 frontend should be extended enough to demonstrate that environmental data is actually entering the system.

Useful Phase 2 functionality includes:

observation list;
source;
timestamp;
stream reach;
indicator;
value;
quality;
live/demo badge;
ingestion status;
basic map/location representation.

Do not spend most of Phase 2 polishing the UI.

The data layer is the priority.

42. DATA QUALITY DASHBOARD

A lightweight data-quality view should be provided if practical.

It should help developers/operators see:

observations received;
observations accepted;
observations rejected;
source errors;
duplicate observations;
low-quality observations.

This is primarily an engineering/debugging capability, not the final product interface.

43. TESTING

Phase 2 must substantially expand automated tests.

Unit tests

Test:

each adapter;
normalization;
validation;
provenance;
source quality;
deduplication;
geospatial association;
timestamp handling.
Integration tests

Test:

Adapter
→ Ingestion Service
→ Database
→ Event Bus

for each source.

Failure tests

Test:

provider unavailable;
malformed provider response;
invalid coordinates;
invalid timestamp;
missing source identifier;
duplicate observation;
cloud/quality failure;
no matching stream reach.
44. LIVE INTEGRATION TESTS

Live external APIs may be unavailable in CI.

Therefore distinguish between:

Deterministic automated tests

Must always run without external services.

Optional live integration tests

Run only when appropriate credentials/configuration exist.

For example:

RUN_LIVE_INTEGRATION_TESTS=true

Live integration tests must never make the standard test suite unreliable.

45. SENTINEL TEST SCENARIO

At minimum, demonstrate one successful Sentinel-2 pathway using:

stream reach
→ spatial query
→ suitable acquisition
→ processing request
→ indicator extraction
→ canonical observation
→ persistence

If live credentials/API access cannot be established, the agent must:

document the blocker;
implement the adapter correctly;
implement deterministic fixtures;
test the adapter with recorded/mock responses;
leave the live configuration ready for later activation.

Do not fake successful live integration.

46. WEATHER TEST SCENARIO

Demonstrate:

stream reach coordinates
→ weather request
→ time series
→ normalized observations
→ provenance
→ persistence

The test must verify that precipitation and temperature retain correct units and timestamps.

47. CITIZEN TEST SCENARIO

Demonstrate:

citizen source
→ raw observation
→ normalization
→ location
→ timestamp
→ provenance
→ canonical observation
→ persistence

If live OAH citizen access is unavailable, use deterministic fixture data and document why.

48. PERFORMANCE EXPECTATIONS

Phase 2 does not need production-scale performance.

However:

ingestion must not block unnecessarily;
external calls should be asynchronous where appropriate;
duplicate requests should be avoided;
large satellite payloads should not be loaded unnecessarily into memory;
database operations should use efficient queries.

The architecture should remain capable of later asynchronous processing.

49. SECURITY

External credentials must be:

environment-based;
excluded from Git;
never logged.

External responses must be treated as untrusted input.

Validate before persistence.

Do not allow arbitrary URLs supplied by users to become outbound requests without strict controls.

50. DOCUMENTATION

Phase 2 must update the project documentation.

At minimum document:

Data Architecture

How each source becomes a canonical observation.

Satellite Integration
provider;
authentication;
query process;
indicators;
quality gates;
limitations.
Weather Integration
provider;
variables;
units;
temporal resolution.
Citizen Integration
source;
schema;
normalization;
limitations.
Adapter Development

Explain how a future source can be added.

Environment Variables

Document every new configuration variable.

Demo Mode

Explain how deterministic environmental data can be generated/loaded.

51. ACCEPTANCE CRITERIA

Phase 2 is complete only when:

Environmental sources
 Satellite adapter implemented.
 Weather adapter implemented.
 Citizen adapter implemented or real integration limitation explicitly documented with a complete fixture pathway.
Normalization
 All sources produce canonical AquaSentinel observations.
 External schemas are isolated inside adapters.
 Units are normalized.
 timestamps are normalized.
 coordinates are validated.
Quality
 Source quality recorded.
 Satellite quality gates implemented.
 Invalid observations handled.
 Missing data handled.
Provenance
 Every accepted observation has provenance.
 Acquisition/ingestion/processing timestamps are distinguishable.
 Source identifiers preserved.
Persistence
 Observations persist.
 Provenance persists.
 Stream association persists.
 Duplicate ingestion is controlled.
Geospatial
 Observations can be associated with monitored stream reaches.
 Unmatched observations are handled explicitly.
Events
 Successful ingestion emits canonical observation events.
APIs
 Observation retrieval works.
 Useful filtering works.
 Ingestion pathways are accessible through clear service boundaries.
Demo
 Satellite fixture works.
 Weather fixture works.
 Citizen fixture works.
 Demo/live state is distinguishable.
Testing
 Unit tests pass.
 Integration tests pass.
 Failure paths tested.
 Live integration tests are isolated from the normal suite.
Documentation
 Data architecture documented.
 External integrations documented.
 Configuration documented.
 Limitations documented.
 Phase 2 handoff created.
52. WHAT PHASE 3 MUST INHERIT

At the end of Phase 2, Phase 3 should inherit a system in which:

Satellite ──────┐
Weather ────────┼──→ Canonical Observations
Citizen ────────┘
                         ↓
                    Provenance
                         ↓
                   Quality Metadata
                         ↓
                  Stream Association
                         ↓
                     Event Bus

Phase 3 should not need to know how any external API works.

Its job will be to take these canonical observations and determine how strongly they corroborate one another.

53. MANDATORY PHASE 2 HANDOFF

At completion, create:

PRD/PHASE_2_HANDOFF.md

This file is mandatory.

It will be given directly to the Phase 3 agent.

The handoff must describe the actual implementation, not simply repeat this PRD.

It must contain:

Phase completion status.
Actual features implemented.
Repository changes.
Actual adapter implementations.
External providers used.
API endpoints.
Database/schema changes.
Observation model changes.
Provenance implementation.
Quality model.
Geospatial association implementation.
Deduplication strategy.
Event behavior.
Live-mode configuration.
Demo-mode configuration.
External credentials required.
Tests and results.
Known bugs.
Known limitations.
Deviations from Phase 2 PRD.
Deviations from Main PRD.
What Phase 3 inherits.
What Phase 3 must preserve.
What Phase 3 must not assume.
Phase 3 readiness checklist.

The file MUST be located at:

PRD/PHASE_2_HANDOFF.md
54. PHASE 3 READINESS CHECKLIST

The handoff must end with:

PHASE 3 READINESS

[ ] Satellite adapter implemented/tested
[ ] Weather adapter implemented/tested
[ ] Citizen adapter implemented/tested or limitation documented
[ ] Canonical Observation pipeline works
[ ] Provenance works
[ ] Quality metadata works
[ ] Stream association works
[ ] Deduplication works
[ ] Observation persistence works
[ ] Observation events work
[ ] Demo fixtures work
[ ] Live integrations documented
[ ] External credentials documented
[ ] Failure handling tested
[ ] API filtering works
[ ] Documentation complete
[ ] Known limitations documented
[ ] PHASE_2_HANDOFF.md created
55. DEFINITION OF DONE

Phase 2 is complete only when:

AquaSentinel can receive environmental information from its supported data sources, validate it, normalize it into a canonical observation model, attach provenance and quality metadata, associate it with monitored stream reaches, persist it, and emit a clean event for downstream intelligence — while remaining resilient to external API failures and fully reproducible in demo mode.