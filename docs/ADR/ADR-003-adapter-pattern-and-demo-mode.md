# ADR-003: External Adapter Pattern & Dual LIVE / DEMO Operating Modes

## Status
Accepted

## Context
AquaSentinel relies on external data sources: Sentinel-2 satellite imagery, weather data (Open-Meteo), citizen science observations, and HAPI FHIR servers. Hardcoding live HTTP requests throughout the application would create brittle runtime dependencies, especially during demonstrations, local offline development, or automated CI test runs.

## Decision
1. Isolate every external dependency behind a clean TypeScript interface in `backend/src/adapters/`:
   - `IFhirAdapter` (FHIR R4 operations)
   - `ISatelliteAdapter` (Sentinel-2 query & normalization boundary for Phase 2)
   - `IWeatherAdapter` (Rainfall/temperature context boundary for Phase 2)
   - `ICitizenAdapter` (Citizen reports boundary for Phase 2)
2. Support dual operating modes configured via `APP_MODE=live` or `APP_MODE=demo`:
   - `DEMO`: Uses deterministic local mock adapters with verified data scenarios (e.g. Almyros stream bloom event).
   - `LIVE`: Connects over HTTP to live remote servers with timeouts and graceful error handling.

## Consequences
- Guaranteed reliability during demonstrations and local testing.
- Phase 2 can implement live ingestion connectors without refactoring core domain models or the API layer.
