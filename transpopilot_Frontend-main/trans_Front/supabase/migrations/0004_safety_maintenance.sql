-- 0004_safety_maintenance.sql
-- Create safety, maintenance, and compliance tables

CREATE TABLE IF NOT EXISTS vehicle_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  engine_hours numeric,
  fuel_level numeric(5, 2),
  battery_voltage numeric(5, 2),
  coolant_temp numeric(5, 2),
  dtc_codes jsonb DEFAULT '[]'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safety_incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('accident', 'violation', 'near-miss', 'inspection', 'other')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description text NOT NULL,
  location text,
  resolved boolean DEFAULT false,
  actions_taken text[],
  cost numeric(10, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  audit_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  auditor_name text,
  audit_date date,
  findings jsonb DEFAULT '[]'::jsonb,
  score numeric(5, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hours_of_service_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  violation_date timestamptz NOT NULL,
  violation_type text NOT NULL,
  description text,
  severity text NOT NULL CHECK (severity IN ('warning', 'minor', 'major', 'critical')),
  resolved boolean DEFAULT false,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certification_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  certification_type text NOT NULL,
  issue_date date NOT NULL,
  expiry_date date NOT NULL,
  document_url text,
  status text NOT NULL CHECK (status IN ('active', 'expired', 'revoked', 'pending_renewal')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_inspection_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  inspector_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  inspection_date timestamptz NOT NULL DEFAULT now(),
  inspection_type text NOT NULL CHECK (inspection_type IN ('pre-trip', 'post-trip', 'annual', 'random')),
  passed boolean NOT NULL,
  defects jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_vehicle_diagnostics_vehicle ON vehicle_diagnostics(vehicle_id, recorded_at DESC);
CREATE INDEX idx_safety_incident_reports_driver ON safety_incident_reports(driver_id);
CREATE INDEX idx_safety_incident_reports_vehicle ON safety_incident_reports(vehicle_id);
CREATE INDEX idx_hours_of_service_driver ON hours_of_service_violations(driver_id);
CREATE INDEX idx_certification_tracking_driver ON certification_tracking(driver_id);
CREATE INDEX idx_vehicle_inspection_records_vehicle ON vehicle_inspection_records(vehicle_id);

-- Updated at triggers
CREATE TRIGGER update_safety_incident_reports_updated_at BEFORE UPDATE ON safety_incident_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compliance_audits_updated_at BEFORE UPDATE ON compliance_audits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hours_of_service_violations_updated_at BEFORE UPDATE ON hours_of_service_violations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_certification_tracking_updated_at BEFORE UPDATE ON certification_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicle_inspection_records_updated_at BEFORE UPDATE ON vehicle_inspection_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
