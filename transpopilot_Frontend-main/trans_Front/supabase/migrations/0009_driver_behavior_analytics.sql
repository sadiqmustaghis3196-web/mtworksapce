-- 0009_driver_behavior_analytics.sql

CREATE TABLE IF NOT EXISTS driver_behavior_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    recorded_date date NOT NULL,
    harsh_acceleration_count integer DEFAULT 0,
    harsh_braking_count integer DEFAULT 0,
    speed_violations_count integer DEFAULT 0,
    idle_time_minutes integer DEFAULT 0,
    total_distance_miles numeric(10, 2) DEFAULT 0,
    total_drive_time_hours numeric(10, 2) DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(driver_id, recorded_date)
);

CREATE INDEX IF NOT EXISTS idx_driver_behavior_driver_date ON driver_behavior_analytics(driver_id, recorded_date DESC);
CREATE TRIGGER update_driver_behavior_analytics_updated_at BEFORE UPDATE ON driver_behavior_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
