-- Phase 6: Resilience Intelligence & Scenario Simulation Schema
-- Forecasts, Scenarios, Early Warnings, and Model Evaluation Metrics

CREATE TABLE IF NOT EXISTS forecasts (
  id VARCHAR(64) PRIMARY KEY,
  stream_reach_id VARCHAR(64) NOT NULL REFERENCES stream_reaches(id) ON DELETE CASCADE,
  reach_name VARCHAR(255) NOT NULL,
  indicator VARCHAR(64) NOT NULL,
  origin_timestamp TIMESTAMPTZ NOT NULL,
  horizon_hours INTEGER NOT NULL,
  current_value NUMERIC NOT NULL,
  historical_baseline NUMERIC,
  baseline_deviation_percent NUMERIC,
  trend VARCHAR(32) NOT NULL,
  trend_slope_per_day NUMERIC NOT NULL,
  uncertainty VARCHAR(32) NOT NULL,
  confidence VARCHAR(32) NOT NULL,
  model_id VARCHAR(64) NOT NULL,
  model_version VARCHAR(32) NOT NULL,
  model_name VARCHAR(128) NOT NULL,
  training_window JSONB NOT NULL,
  input_observation_ids JSONB NOT NULL,
  projections JSONB NOT NULL,
  explanation TEXT NOT NULL,
  labels JSONB NOT NULL,
  is_sufficient_data BOOLEAN NOT NULL DEFAULT true,
  data_quality_reasons JSONB,
  generated_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forecasts_reach_ind ON forecasts(stream_reach_id, indicator, generated_timestamp DESC);

CREATE TABLE IF NOT EXISTS scenarios (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL,
  description TEXT,
  stream_reach_id VARCHAR(64) NOT NULL REFERENCES stream_reaches(id) ON DELETE CASCADE,
  reach_name VARCHAR(255) NOT NULL,
  indicator VARCHAR(64) NOT NULL,
  origin_timestamp TIMESTAMPTZ NOT NULL,
  horizon_hours INTEGER NOT NULL,
  baseline_forecast_id VARCHAR(64),
  changed_parameters JSONB NOT NULL,
  assumptions JSONB NOT NULL,
  projections JSONB NOT NULL,
  uncertainty VARCHAR(32) NOT NULL,
  confidence VARCHAR(32) NOT NULL,
  model_version VARCHAR(32) NOT NULL,
  generated_timestamp TIMESTAMPTZ NOT NULL,
  is_hypothetical BOOLEAN NOT NULL DEFAULT true,
  labels JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scenarios_reach ON scenarios(stream_reach_id, generated_timestamp DESC);

CREATE TABLE IF NOT EXISTS early_warnings (
  id VARCHAR(64) PRIMARY KEY,
  stream_reach_id VARCHAR(64) NOT NULL REFERENCES stream_reaches(id) ON DELETE CASCADE,
  reach_name VARCHAR(255) NOT NULL,
  indicator VARCHAR(64) NOT NULL,
  warning_level VARCHAR(32) NOT NULL,
  trigger_reason TEXT NOT NULL,
  contributing_factors JSONB NOT NULL,
  confidence VARCHAR(32) NOT NULL,
  recommended_action TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  incident_id VARCHAR(64),
  evidence_assessment_id VARCHAR(64),
  labels JSONB NOT NULL,
  dismissed BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_early_warnings_active ON early_warnings(timestamp DESC) WHERE dismissed = false;

CREATE TABLE IF NOT EXISTS model_evaluations (
  id VARCHAR(64) PRIMARY KEY,
  model_id VARCHAR(64) NOT NULL,
  model_name VARCHAR(128) NOT NULL,
  model_version VARCHAR(32) NOT NULL,
  horizon_hours INTEGER NOT NULL,
  sample_size INTEGER NOT NULL,
  mae NUMERIC NOT NULL,
  rmse NUMERIC NOT NULL,
  mape NUMERIC,
  directional_accuracy NUMERIC NOT NULL,
  evaluation_period JSONB NOT NULL,
  baseline_model_comparison JSONB,
  evaluated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_evaluations_model ON model_evaluations(model_id, horizon_hours, evaluated_at DESC);
