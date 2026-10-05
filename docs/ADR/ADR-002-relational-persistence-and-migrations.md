# ADR-002: Relational PostgreSQL Persistence with Versioned SQL Migrations

## Status
Accepted

## Context
AquaSentinel requires persistent relational storage for stream reaches, observations, multi-factor evidence items, incidents, recommendations, operational tasks, field verifications, and audit events. While PostGIS enables spatial indexing, local development and continuous integration environments must remain easy to set up and resilient against heavyweight ORM complexities.

## Decision
1. Use PostgreSQL as the primary relational database. Store GeoJSON geometries in standard JSONB structures indexed for spatial attribute queries, with PostGIS extension initialization supported out-of-the-box in container environments.
2. Implement a transparent, zero-magic SQL migration runner (`backend/src/database/migrator.ts`) reading versioned migration files from `backend/src/database/migrations/`.
3. Implement a dual repository pattern:
   - `Postgres*Repository` for live and container operations.
   - `InMemory*Repository` for automated unit/integration tests and zero-dependency local demo runs when Postgres is unreachable.

## Consequences
- Full transactional safety on migrations via `schema_migrations` tracking.
- Zero ORM compilation overhead or runtime schema synchronization fragility.
- High test velocity: unit and API integration tests execute in < 2 seconds in-memory while full PostgreSQL validation remains fully supported.
