# ADR-001: Monorepo Architecture with Shared Contracts

## Status
Accepted

## Context
AquaSentinel requires tight coordination between frontend, backend, database models, external FHIR resources, and event contracts across 9 implementation phases. Maintaining separated repositories would introduce version drift, manual type duplication, and complex local orchestration.

## Decision
Adopt an npm workspaces monorepo structure containing:
- `backend/`: Node.js, Express, TypeScript API and service engine
- `frontend/`: React, TypeScript, Vite, Tailwind CSS Command Console
- `shared/`: Canonical domain types, API contracts, event payloads, and FHIR DTOs
- `infrastructure/`: Docker Compose and container initialization scripts
- `docs/`: Architectural documentation, developer guides, and ADRs
- `data/`: Seed data and test fixtures
- `scripts/`: Development and automation scripts
- `PRD/`: Product Requirements Documents and Phase Handoffs

## Consequences
- Single `npm install` installs and links dependencies across all workspaces.
- Shared domain contracts (`@aquasentinel/shared`) provide a single source of truth for both backend and frontend.
- Zero type drift between API endpoints and UI consumers.
