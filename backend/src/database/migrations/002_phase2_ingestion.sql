-- AquaSentinel Phase 2 Schema Migration (002_phase2_ingestion.sql)
-- Adds deduplication hash, metadata column, and performance indexes for environmental data ingestion

-- 1. Ensure stream_reach_id in observations is nullable (for unmatched / out-of-reach observations)
ALTER TABLE observations ALTER COLUMN stream_reach_id DROP NOT NULL;

-- 2. Add deduplication_hash and metadata to observations
ALTER TABLE observations ADD COLUMN IF NOT EXISTS deduplication_hash VARCHAR(64);
ALTER TABLE observations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Create unique index for idempotent deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_observations_dedup_hash ON observations(deduplication_hash) WHERE deduplication_hash IS NOT NULL;

-- 4. Additional indexes for multi-source queries
CREATE INDEX IF NOT EXISTS idx_observations_source ON observations(source);
CREATE INDEX IF NOT EXISTS idx_observations_quality ON observations(quality);
CREATE INDEX IF NOT EXISTS idx_observations_source_indicator_time ON observations(source, indicator, timestamp DESC);
