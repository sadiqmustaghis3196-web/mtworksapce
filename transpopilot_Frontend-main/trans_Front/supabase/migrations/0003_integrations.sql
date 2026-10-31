-- 0003_integrations.sql
-- Create integration tables

CREATE TABLE IF NOT EXISTS fleet_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  api_key text,
  api_secret text,
  username text,
  password text,
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, provider)
);

CREATE TABLE IF NOT EXISTS integration_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (name IN ('geotab', 'samsara', 'motive', 'custom')),
  display_name text NOT NULL,
  logo_url text,
  is_enabled boolean DEFAULT true,
  connection_status text DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'connecting')),
  last_sync_at timestamptz,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  api_key text,
  api_secret text,
  username text,
  database_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  configuration jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  sync_type text NOT NULL CHECK (sync_type IN ('vehicles', 'drivers', 'locations', 'fuel', 'safety', 'compliance', 'maintenance')),
  status text NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'running')),
  records_processed integer DEFAULT 0,
  records_success integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('vehicle', 'driver', 'route')),
  internal_id uuid NOT NULL,
  external_id text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(provider_id, entity_type, internal_id),
  UNIQUE(provider_id, entity_type, external_id)
);

-- Indexes
CREATE INDEX idx_fleet_integrations_org ON fleet_integrations(organization_id);
CREATE INDEX idx_integration_providers_org ON integration_providers(organization_id);
CREATE INDEX idx_integration_credentials_org ON integration_credentials(organization_id);
CREATE INDEX idx_integration_sync_logs_org ON integration_sync_logs(organization_id);
CREATE INDEX idx_integration_sync_logs_provider ON integration_sync_logs(provider_id, started_at DESC);
CREATE INDEX idx_integration_mappings_internal ON integration_mappings(internal_id);

-- Updated at triggers
CREATE TRIGGER update_fleet_integrations_updated_at BEFORE UPDATE ON fleet_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_providers_updated_at BEFORE UPDATE ON integration_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_credentials_updated_at BEFORE UPDATE ON integration_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
