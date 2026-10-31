-- Migration to add provider and provider_event_id to safety_incident_reports if they don't exist

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'safety_incident_reports' AND column_name = 'provider') THEN
        ALTER TABLE safety_incident_reports ADD COLUMN provider TEXT DEFAULT 'geotab';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'safety_incident_reports' AND column_name = 'provider_event_id') THEN
        ALTER TABLE safety_incident_reports ADD COLUMN provider_event_id TEXT;
    END IF;
END $$;
