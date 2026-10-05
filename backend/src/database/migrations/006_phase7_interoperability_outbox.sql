-- Phase 7: Event-Driven One Health Interoperability Outbox Schema
-- Implements persistent outbox, acknowledgements, audit trail, and FHIR subscriptions

CREATE TABLE IF NOT EXISTS outbox_events (
  id VARCHAR(64) PRIMARY KEY,
  event_id VARCHAR(64) UNIQUE NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  event_version VARCHAR(16) NOT NULL DEFAULT '1.0.0',
  occurred_at TIMESTAMPTZ NOT NULL,
  producer VARCHAR(128) NOT NULL,
  subject VARCHAR(256) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(128) NOT NULL,
  correlation_id VARCHAR(128) NOT NULL,
  causation_id VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  destination VARCHAR(256) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  dead_letter_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  acknowledgement_id VARCHAR(64),
  replay_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status);
CREATE INDEX IF NOT EXISTS idx_outbox_event_type ON outbox_events(event_type);
CREATE INDEX IF NOT EXISTS idx_outbox_correlation_id ON outbox_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_outbox_next_retry ON outbox_events(next_retry_at) WHERE status = 'RETRYING';
CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON outbox_events(created_at DESC);

CREATE TABLE IF NOT EXISTS interoperability_acknowledgements (
  id VARCHAR(64) PRIMARY KEY,
  event_id VARCHAR(64) NOT NULL,
  consumer_id VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  details TEXT,
  processed_resource_type VARCHAR(64),
  processed_resource_id VARCHAR(128),
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ack_event_id ON interoperability_acknowledgements(event_id);
CREATE INDEX IF NOT EXISTS idx_ack_consumer_id ON interoperability_acknowledgements(consumer_id);

CREATE TABLE IF NOT EXISTS interoperability_audit_log (
  id VARCHAR(64) PRIMARY KEY,
  event_id VARCHAR(64) NOT NULL,
  stage VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interop_audit_event_id ON interoperability_audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_interop_audit_timestamp ON interoperability_audit_log(timestamp DESC);

CREATE TABLE IF NOT EXISTS fhir_subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  reason TEXT NOT NULL,
  criteria TEXT NOT NULL,
  channel_type VARCHAR(32) NOT NULL DEFAULT 'rest-hook',
  endpoint VARCHAR(256) NOT NULL,
  payload VARCHAR(64) DEFAULT 'application/fhir+json',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_fhir_sub_status ON fhir_subscriptions(status);
