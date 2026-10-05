-- AquaSentinel Initial Schema Migration (001_initial_schema.sql)
-- Sets up core tables for stream reaches, observations, provenance, incidents, recommendations, tasks, verifications

-- 1. Migrations Tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stream Reaches
CREATE TABLE IF NOT EXISTS stream_reaches (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    geometry JSONB NOT NULL,
    city VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    monitoring_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    water_coverage_constraint JSONB,
    baseline_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stream_reaches_city ON stream_reaches(city);
CREATE INDEX IF NOT EXISTS idx_stream_reaches_status ON stream_reaches(monitoring_status);

-- 3. Provenance Records
CREATE TABLE IF NOT EXISTS provenance_records (
    id UUID PRIMARY KEY,
    entity_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    source VARCHAR(100) NOT NULL,
    source_identifier VARCHAR(255) NOT NULL,
    acquisition_timestamp TIMESTAMPTZ NOT NULL,
    ingestion_timestamp TIMESTAMPTZ NOT NULL,
    processing_timestamp TIMESTAMPTZ NOT NULL,
    processing_method VARCHAR(255) NOT NULL,
    quality_status VARCHAR(50) NOT NULL,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_provenance_entity ON provenance_records(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_provenance_source ON provenance_records(source, source_identifier);

-- 4. Environmental Observations
CREATE TABLE IF NOT EXISTS observations (
    id UUID PRIMARY KEY,
    source VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    location JSONB NOT NULL,
    stream_reach_id UUID REFERENCES stream_reaches(id) ON DELETE CASCADE,
    indicator VARCHAR(100) NOT NULL,
    value VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    quality VARCHAR(50) NOT NULL,
    provenance_id UUID REFERENCES provenance_records(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_observations_reach ON observations(stream_reach_id);
CREATE INDEX IF NOT EXISTS idx_observations_timestamp ON observations(timestamp);
CREATE INDEX IF NOT EXISTS idx_observations_indicator ON observations(indicator);

-- 5. Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY,
    stream_reach_id UUID REFERENCES stream_reaches(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    hazard_type VARCHAR(50) NOT NULL,
    evidence_confidence NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    severity VARCHAR(50) NOT NULL DEFAULT 'LOW',
    verification_status VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED',
    resolution TEXT
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_reach ON incidents(stream_reach_id);

-- 6. Evidence Items
CREATE TABLE IF NOT EXISTS evidence_items (
    id UUID PRIMARY KEY,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL,
    observation_id UUID REFERENCES observations(id) ON DELETE CASCADE,
    relevance VARCHAR(50) NOT NULL,
    spatial_match JSONB NOT NULL,
    temporal_match JSONB NOT NULL,
    quality_score NUMERIC(4, 3) NOT NULL DEFAULT 1.000,
    contribution VARCHAR(50) NOT NULL,
    provenance_id UUID REFERENCES provenance_records(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_evidence_incident ON evidence_items(incident_id);

-- 7. Evidence Assessments
CREATE TABLE IF NOT EXISTS evidence_assessments (
    id UUID PRIMARY KEY,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    score NUMERIC(5, 2) NOT NULL,
    confidence_band VARCHAR(50) NOT NULL,
    supporting_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    contradicting_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    rationale TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assessments_incident ON evidence_assessments(incident_id);

-- 8. Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    rationale TEXT NOT NULL,
    source_rule VARCHAR(255),
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(50) NOT NULL DEFAULT 'PROPOSED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recommendations_incident ON recommendations(incident_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);

-- 9. Operational Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
    assigned_to VARCHAR(255) NOT NULL,
    location JSONB NOT NULL,
    priority VARCHAR(50) NOT NULL,
    instructions TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_incident ON tasks(incident_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- 10. Field Verifications
CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    observer VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    location JSONB NOT NULL,
    result VARCHAR(50) NOT NULL,
    photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    sample_collected BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verifications_incident ON verifications(incident_id);

-- 11. Incident Events (Timeline / Audit Log)
CREATE TABLE IF NOT EXISTS incident_events (
    id UUID PRIMARY KEY,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_events_incident ON incident_events(incident_id, timestamp);
