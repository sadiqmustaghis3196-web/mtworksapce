-- Add provider tracking to safety incident reports
ALTER TABLE safety_incident_reports
ADD COLUMN IF NOT EXISTS provider text,
ADD COLUMN IF NOT EXISTS provider_event_id text;

-- Add provider tracking to compliance audits
ALTER TABLE compliance_audits
ADD COLUMN IF NOT EXISTS provider text,
ADD COLUMN IF NOT EXISTS provider_event_id text;

-- Add unique constraints to prevent duplicates during sync
ALTER TABLE safety_incident_reports
ADD CONSTRAINT uq_safety_incident_provider_event UNIQUE NULLS NOT DISTINCT (organization_id, provider_event_id);

ALTER TABLE compliance_audits
ADD CONSTRAINT uq_compliance_audit_provider_event UNIQUE NULLS NOT DISTINCT (organization_id, provider_event_id);
