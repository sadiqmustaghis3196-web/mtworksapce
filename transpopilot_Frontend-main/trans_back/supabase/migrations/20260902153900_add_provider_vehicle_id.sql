-- Migration to add provider and provider_vehicle_id to vehicles table if they don't exist

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'provider') THEN
        ALTER TABLE vehicles ADD COLUMN provider TEXT DEFAULT 'geotab';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'provider_vehicle_id') THEN
        ALTER TABLE vehicles ADD COLUMN provider_vehicle_id TEXT;
        -- Create an index to speed up lookups by provider_vehicle_id
        CREATE INDEX IF NOT EXISTS idx_vehicles_provider_vehicle_id ON vehicles(provider, provider_vehicle_id);
    END IF;
END $$;
