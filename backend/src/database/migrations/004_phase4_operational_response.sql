-- AquaSentinel Phase 4 Migration: Operational Response & Recommendation Engine
-- Establishes Action Catalogue, extends recommendations and operational tasks, and creates task audit trail

-- 1. Action Catalogue Table
CREATE TABLE IF NOT EXISTS action_catalogue (
    measure_id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    measure_type VARCHAR(50) NOT NULL,
    applicable_incident_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    applicable_stressors JSONB NOT NULL DEFAULT '[]'::jsonb,
    applicable_indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
    minimum_evidence_band VARCHAR(50) NOT NULL,
    required_verification JSONB NOT NULL DEFAULT '[]'::jsonb,
    spatial_requirements JSONB,
    temporal_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
    implementation_complexity VARCHAR(50) NOT NULL,
    estimated_time_to_initiate VARCHAR(100) NOT NULL,
    responsible_stakeholder VARCHAR(255) NOT NULL,
    responsible_role VARCHAR(100) NOT NULL,
    contraindications JSONB NOT NULL DEFAULT '[]'::jsonb,
    prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_reference TEXT NOT NULL,
    provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
    human_approval_required BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Extend Recommendations Table
ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS assessment_id UUID REFERENCES evidence_assessments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS measure_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS suitability_score INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS rationale_details JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS supporting_evidence_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS contradicting_evidence_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS missing_prerequisites JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS contraindications JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS required_verification JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS responsible_role VARCHAR(100),
    ADD COLUMN IF NOT EXISTS human_approval_required BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS review_notes TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
    ADD COLUMN IF NOT EXISTS generated_task_id UUID,
    ADD COLUMN IF NOT EXISTS provenance JSONB DEFAULT '{}'::jsonb;

-- 3. Extend Operational Tasks Table
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS assessment_id UUID REFERENCES evidence_assessments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS task_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS assigned_role VARCHAR(100),
    ADD COLUMN IF NOT EXISTS required_evidence JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS fhir_task_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS fhir_task_identifier VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provenance JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Audit Log Table (task_events)
CREATE TABLE IF NOT EXISTS task_events (
    id UUID PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_action_catalogue_type ON action_catalogue(measure_type);
CREATE INDEX IF NOT EXISTS idx_recommendations_assessment ON recommendations(assessment_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_idempotency ON recommendations(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_recommendations_suitability ON recommendations(suitability_score DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_recommendation ON tasks(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_tasks_fhir_id ON tasks(fhir_task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_recommendation ON task_events(recommendation_id);
