export interface VehicleLocation {
  id: string;
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  altitude?: number;
  odometer?: number;
  timestamp: string;
  created_at: string;
}

export interface DriverLocation {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'break' | 'off_duty' | 'driving';
  timestamp: string;
  created_at: string;
}

export interface Geofence {
  id: string;
  name: string;
  type: 'circular' | 'polygon';
  coordinates: {
    center?: { lat: number; lng: number };
    radius?: number;
    points?: Array<{ lat: number; lng: number }>;
  };
  alert_on_entry: boolean;
  alert_on_exit: boolean;
  created_at: string;
}

export interface GeofenceEvent {
  id: string;
  geofence_id: string;
  vehicle_id: string;
  event_type: 'entry' | 'exit';
  timestamp: string;
  created_at: string;
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  vehicle_id?: string;
  driver_id?: string;
  organization_id?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  optimization_score?: number;
  estimated_distance?: number;
  estimated_duration?: number;
  actual_distance?: number;
  actual_duration?: number;
  fuel_estimate?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface RouteWaypoint {
  id: string;
  route_id: string;
  sequence_number: number;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  estimated_arrival?: string;
  actual_arrival?: string;
  estimated_departure?: string;
  actual_departure?: string;
  status: 'pending' | 'arrived' | 'completed' | 'skipped';
  notes?: string;
  created_at: string;
}

export interface RouteAnalytics {
  id: string;
  route_id: string;
  metric_type: 'fuel_efficiency' | 'time_savings' | 'distance_optimization' | 'cost_savings';
  baseline_value: number;
  optimized_value: number;
  improvement_percentage: number;
  created_at: string;
}

export interface IntegrationProvider {
  id: string;
  name: 'geotab' | 'samsara' | 'motive' | 'custom';
  display_name: string;
  logo_url?: string;
  is_enabled: boolean;
  connection_status: 'connected' | 'disconnected' | 'error' | 'connecting';
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IntegrationCredentials {
  id: string;
  provider_id: string;
  api_key?: string;
  api_secret?: string;
  username?: string;
  database_name?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IntegrationSyncLog {
  id: string;
  provider_id: string;
  sync_type: 'vehicles' | 'drivers' | 'locations' | 'fuel' | 'safety' | 'compliance' | 'maintenance';
  status: 'success' | 'partial' | 'failed' | 'running';
  records_processed: number;
  records_success: number;
  records_failed: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  created_at: string;
}

export interface IntegrationMapping {
  id: string;
  provider_id: string;
  entity_type: 'vehicle' | 'driver' | 'route';
  internal_id: string;
  external_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface VehicleWithLocation {
  id: string;
  name: string;
  license_plate: string;
  vin: string;
  status: string;
  location?: VehicleLocation;
  driver_id?: string;
  driver_name?: string;
}

export interface DriverWithLocation {
  id: string;
  first_name: string;
  last_name: string;
  license_number: string;
  status: string;
  location?: DriverLocation;
  vehicle_id?: string;
  vehicle_name?: string;
}
