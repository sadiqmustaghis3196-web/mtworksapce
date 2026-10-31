-- 0006_health_security_ai.sql
-- Create system health, security, AI QA, and data quality tables

CREATE TABLE IF NOT EXISTS system_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy', 'degraded', 'down', 'maintenance')),
  latency_ms integer,
  error_rate numeric(5, 2),
  details jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message text NOT NULL,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  ip_address text,
  user_agent text,
  success boolean NOT NULL,
  failure_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_model_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  model_version text NOT NULL,
  input_data jsonb NOT NULL,
  prediction_result jsonb NOT NULL,
  confidence_score numeric(5, 4),
  actual_outcome jsonb,
  is_accurate boolean,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  check_type text NOT NULL,
  records_scanned integer NOT NULL,
  anomalies_found integer NOT NULL,
  status text NOT NULL CHECK (status IN ('passed', 'warning', 'failed')),
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comments text,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fleet_kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  total_vehicles integer,
  active_vehicles integer,
  total_drivers integer,
  active_drivers integer,
  total_distance numeric(12, 2),
  fuel_efficiency_avg numeric(8, 2),
  safety_score_avg numeric(5, 2),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_system_health_checks_component ON system_health_checks(component, recorded_at DESC);
CREATE INDEX idx_security_audit_logs_user ON security_audit_logs(user_id);
CREATE INDEX idx_security_audit_logs_org ON security_audit_logs(organization_id);
CREATE INDEX idx_ai_model_predictions_model ON ai_model_predictions(model_name);

-- Updated at triggers
CREATE TRIGGER update_system_alerts_updated_at BEFORE UPDATE ON system_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feedback_submissions_updated_at BEFORE UPDATE ON feedback_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
