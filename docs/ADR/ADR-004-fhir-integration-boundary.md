# ADR-004: FHIR R4 Integration Boundary & Anti-Corruption Layer

## Status
Accepted

## Context
AquaSentinel uses HL7 FHIR R4 (and OneAquaHealth profiles) for standardized environmental interoperability and workflow tasks. However, binding frontend React components and core intelligence algorithms directly to verbose FHIR JSON resources would introduce unnecessary complexity, fragile coupling, and slow iteration.

## Decision
1. Establish a strict Anti-Corruption Layer (`FhirMapper` and `IFhirAdapter`).
2. Internal domain types (`Observation`, `Incident`, `Task`) remain pure TypeScript interfaces optimized for decision support, UI rendering, and multi-source evidence fusion.
3. Bidirectional translation is centralized:
   - `FhirMapper.toFhirObservation()` & `fromFhirObservation()`
   - `FhirMapper.toFhirTask()`
   - `FhirMapper.toFhirFlag()`
4. The frontend interacts strictly with clean AquaSentinel REST API contracts, never raw FHIR payloads.

## Consequences
- Clean separation between healthcare/environmental interoperability standards and internal incident intelligence.
- Easy to update FHIR profiles or mapping rules without touching UI components or database schemas.
