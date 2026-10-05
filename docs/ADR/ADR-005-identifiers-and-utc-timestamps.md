# ADR-005: Canonical Identifiers and Universal UTC Timestamps

## Status
Accepted

## Context
AquaSentinel correlates signals across disparate spatial and temporal dimensions (e.g. satellite overpasses, citizen mobile reports, weather front passages). Unsynchronized time representations or non-standard identifiers create data correlation bugs and audit gaps.

## Decision
1. **Identifiers**: Use RFC 4122 UUIDv4 strings for all internal entities (`streamReachId`, `observationId`, `incidentId`, `evidenceId`, `taskId`, `verificationId`, `eventId`). UUIDs are stable, serializable, collision-resistant, and map directly to PostgreSQL `UUID` and FHIR logical IDs.
2. **Timestamps**: All timestamps are formatted as strict ISO-8601 UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ`) internally and stored as `TIMESTAMPTZ` in PostgreSQL.
3. **Temporal Provenance**: The data model strictly separates:
   - `acquisitionTimestamp`: Real-world sensor or human capture time
   - `ingestionTimestamp`: AquaSentinel system ingestion time
   - `processingTimestamp`: Normalization or evidence calculation time
   - `createdAt` / `updatedAt`: Database record lifecycle times

## Consequences
- Unambiguous temporal correlation across multi-source evidence fusion.
- No timezone offset bugs or daylight saving calculation discrepancies.
