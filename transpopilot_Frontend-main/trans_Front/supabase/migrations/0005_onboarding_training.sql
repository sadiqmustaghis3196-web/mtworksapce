-- 0005_onboarding_training.sql
-- Create onboarding and training tables

CREATE TABLE IF NOT EXISTS driver_onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  background_check_status text DEFAULT 'pending',
  drug_screen_status text DEFAULT 'pending',
  mvr_check_status text DEFAULT 'pending',
  orientation_completed boolean DEFAULT false,
  road_test_completed boolean DEFAULT false,
  overall_status text DEFAULT 'in_progress',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('safety', 'compliance', 'skills', 'orientation', 'other')),
  duration_minutes integer,
  required boolean DEFAULT true,
  prerequisites jsonb DEFAULT '[]'::jsonb,
  content jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_training_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed', 'failed')),
  score numeric(5, 2),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(driver_id, module_id)
);

CREATE TABLE IF NOT EXISTS document_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  document_type text NOT NULL,
  is_required boolean DEFAULT true,
  expires boolean DEFAULT false,
  validity_period_days integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES document_requirements(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  document_url text NOT NULL,
  status text NOT NULL CHECK (status IN ('uploaded', 'verified', 'rejected', 'expired')),
  uploaded_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  verified_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  expires_at date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_driver_onboarding_progress_driver ON driver_onboarding_progress(driver_id);
CREATE INDEX idx_driver_training_completions_driver ON driver_training_completions(driver_id);
CREATE INDEX idx_driver_documents_driver ON driver_documents(driver_id);

-- Updated at triggers
CREATE TRIGGER update_driver_onboarding_progress_updated_at BEFORE UPDATE ON driver_onboarding_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_modules_updated_at BEFORE UPDATE ON training_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_driver_training_completions_updated_at BEFORE UPDATE ON driver_training_completions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_document_requirements_updated_at BEFORE UPDATE ON document_requirements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_driver_documents_updated_at BEFORE UPDATE ON driver_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
