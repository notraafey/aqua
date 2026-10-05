-- ============================================================
-- AquaSentinel Database Migration 007: Phase 8 Closed-Loop Field Response
-- ============================================================

-- 1. Extend tasks table for operational dispatch and completion tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_organization VARCHAR(255);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_actor_id VARCHAR(100);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_requirements TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'UNVERIFIED';

-- 2. Extend verifications table for structured field evidence
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS inspector_data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS observations JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS evidence_data JSONB NOT NULL DEFAULT '{"photos":[], "samples":[]}'::jsonb;
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS assessment TEXT;
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) NOT NULL DEFAULT 'SYNCED';
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS conflict_status VARCHAR(50) DEFAULT 'NONE';
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS client_submission_id VARCHAR(255);
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS location_validation JSONB;

CREATE INDEX IF NOT EXISTS idx_verifications_task ON verifications(task_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);
CREATE INDEX IF NOT EXISTS idx_verifications_client_sub ON verifications(client_submission_id);

-- 3. Operational Actors (Field Inspectors / Response Units)
CREATE TABLE IF NOT EXISTS field_actors (
    actor_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    contact VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed deterministic operational actors
INSERT INTO field_actors (actor_id, name, organization, role, contact, active)
VALUES
    ('actor-alex-rivera', 'Alex Rivera', 'Volos Municipal Environmental Dept', 'FIELD_INSPECTOR', '+30 24210 12345', TRUE),
    ('actor-elena-vasquez', 'Elena Vasquez', 'Thessaly Regional Water Monitoring Agency', 'ENVIRONMENTAL_SPECIALIST', '+30 24210 54321', TRUE),
    ('actor-nikos-katsaros', 'Nikos Katsaros', 'Pagasetic Gulf Coastal Patrol', 'FIELD_INSPECTOR', '+30 24210 98765', TRUE),
    ('actor-maria-dimitriou', 'Maria Dimitriou', 'Volos Municipal Civil Protection', 'MUNICIPAL_OFFICER', '+30 24210 67890', TRUE)
ON CONFLICT (actor_id) DO NOTHING;

-- 4. Incident Outcomes Table (Structured Ground Truth & Decision Records)
CREATE TABLE IF NOT EXISTS incident_outcomes (
    id UUID PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    verification_id UUID REFERENCES verifications(id) ON DELETE SET NULL,
    proposed_outcome VARCHAR(50) NOT NULL,
    confirmed_outcome VARCHAR(50),
    reason TEXT NOT NULL,
    supporting_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence NUMERIC(5,2) NOT NULL,
    determined_at TIMESTAMPTZ NOT NULL,
    determined_by VARCHAR(255) NOT NULL,
    confirmed_at TIMESTAMPTZ,
    confirmed_by VARCHAR(255),
    rule_version VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incident_outcomes_incident ON incident_outcomes(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_outcomes_verification ON incident_outcomes(verification_id);
