-- 0002_tracking_routes.sql
-- Create tracking and route optimization tables

CREATE TABLE IF NOT EXISTS vehicle_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  latitude numeric(10, 8) NOT NULL,
  longitude numeric(11, 8) NOT NULL,
  speed numeric(6, 2) DEFAULT 0,
  heading numeric(5, 2),
  altitude numeric(8, 2),
  odometer numeric(10, 2),
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  latitude numeric(10, 8) NOT NULL,
  longitude numeric(11, 8) NOT NULL,
  status text NOT NULL DEFAULT 'off_duty' CHECK (status IN ('active', 'break', 'off_duty', 'driving')),
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gps_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  speed numeric DEFAULT 0,
  heading numeric,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS geofences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('circular', 'polygon')),
  coordinates jsonb NOT NULL,
  alert_on_entry boolean DEFAULT false,
  alert_on_exit boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS geofence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geofence_id uuid NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('entry', 'exit')),
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  optimization_score numeric(5, 2),
  estimated_distance numeric(10, 2),
  estimated_duration numeric(10, 2),
  actual_distance numeric(10, 2),
  actual_duration numeric(10, 2),
  fuel_estimate numeric(8, 2),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS route_waypoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  name text NOT NULL,
  address text,
  latitude numeric(10, 8) NOT NULL,
  longitude numeric(11, 8) NOT NULL,
  estimated_arrival timestamptz,
  actual_arrival timestamptz,
  estimated_departure timestamptz,
  actual_departure timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'completed', 'skipped')),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(route_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS route_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  metric_type text NOT NULL CHECK (metric_type IN ('fuel_efficiency', 'time_savings', 'distance_optimization', 'cost_savings')),
  baseline_value numeric(10, 2),
  optimized_value numeric(10, 2),
  improvement_percentage numeric(5, 2),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_vehicle_locations_vehicle_timestamp ON vehicle_locations(vehicle_id, timestamp DESC);
CREATE INDEX idx_vehicle_locations_timestamp ON vehicle_locations(timestamp DESC);
CREATE INDEX idx_driver_locations_driver_timestamp ON driver_locations(driver_id, timestamp DESC);
CREATE INDEX idx_gps_tracking_vehicle_time ON gps_tracking(vehicle_id, recorded_at DESC);
CREATE INDEX idx_geofence_events_timestamp ON geofence_events(timestamp DESC);
CREATE INDEX idx_routes_vehicle ON routes(vehicle_id);
CREATE INDEX idx_routes_driver ON routes(driver_id);
CREATE INDEX idx_routes_status ON routes(status);
CREATE INDEX idx_routes_org ON routes(organization_id);
CREATE INDEX idx_route_waypoints_route ON route_waypoints(route_id, sequence_number);
CREATE INDEX idx_route_analytics_route ON route_analytics(route_id);
