-- AquaSentinel Phase 3 Migration: Evidence Fusion Engine
-- Upgrades evidence_assessments and evidence_items tables to support full intelligence layer fields

-- 1. Extend evidence_assessments
ALTER TABLE evidence_assessments
    ADD COLUMN IF NOT EXISTS stream_reach_id UUID REFERENCES stream_reaches(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS candidate_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS scoring_version VARCHAR(50) DEFAULT 'v1.0',
    ADD COLUMN IF NOT EXISTS baseline_status VARCHAR(50) DEFAULT 'UNAVAILABLE',
    ADD COLUMN IF NOT EXISTS baseline_deviation JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS independent_source_groups JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS supporting_evidence JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS contradicting_evidence JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS rationale_details JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- 2. Extend evidence_items
ALTER TABLE evidence_items
    ADD COLUMN IF NOT EXISTS assessment_id UUID REFERENCES evidence_assessments(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS indicator VARCHAR(100),
    ADD COLUMN IF NOT EXISTS value VARCHAR(255),
    ADD COLUMN IF NOT EXISTS unit VARCHAR(50),
    ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS corroboration_group VARCHAR(50),
    ADD COLUMN IF NOT EXISTS quality_flags JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS score_delta NUMERIC(5, 2) DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS rule VARCHAR(100);

-- 3. Composite query indexes for fast assessment lookups
CREATE INDEX IF NOT EXISTS idx_assessments_reach_created
    ON evidence_assessments(stream_reach_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessments_band_score
    ON evidence_assessments(confidence_band, score DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_assessment_id
    ON evidence_items(assessment_id);
