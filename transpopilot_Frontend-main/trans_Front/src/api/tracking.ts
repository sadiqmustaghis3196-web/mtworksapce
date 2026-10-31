import { supabase } from '../lib/supabase';
import { VehicleLocation, DriverLocation, VehicleWithLocation, DriverWithLocation } from '../types/tracking';

import { API_BASE_URL } from '../lib/apiConfig';

async function getAuthHeaders() {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  return { 
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// getVehicleLocations was removed as dead code
export async function fetchLiveLocations(organizationId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/tracking/live-locations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ organizationId })
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'You do not have access to Live Tracking.');
    }
    throw new Error(`Failed to fetch live locations (HTTP ${response.status})`);
  }

  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to fetch live locations');
  return result;
}

export async function insertVehicleLocation(location: Omit<VehicleLocation, 'id' | 'created_at'>): Promise<VehicleLocation> {
  const { data, error } = await supabase
    .from('vehicle_locations')
    .insert(location)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getDriverLocations(): Promise<DriverLocation[]> {
  const { data, error } = await supabase
    .from('driver_locations')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getLatestDriverLocation(driverId: string): Promise<DriverLocation | null> {
  const { data, error } = await supabase
    .from('driver_locations')
    .select('*')
    .eq('driver_id', driverId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getDriversWithLocations(): Promise<DriverWithLocation[]> {
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('*');

  if (driversError) throw driversError;

  const driversWithLocations = await Promise.all(
    (drivers || []).map(async (driver) => {
      const location = await getLatestDriverLocation(driver.id);

      let vehicleName = undefined;
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, name')
        .eq('driver_id', driver.id)
        .maybeSingle();

      if (vehicles) {
        vehicleName = vehicles.name;
      }

      return {
        ...driver,
        location,
        vehicle_id: vehicles?.id,
        vehicle_name: vehicleName,
      };
    })
  );

  return driversWithLocations;
}

export async function insertDriverLocation(location: Omit<DriverLocation, 'id' | 'created_at'>): Promise<DriverLocation> {
  const { data, error } = await supabase
    .from('driver_locations')
    .insert(location)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function subscribeToVehicleLocations(
  callback: (location: VehicleLocation) => void
) {
  return supabase
    .channel('vehicle_locations_channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'vehicle_locations',
      },
      (payload) => {
        callback(payload.new as VehicleLocation);
      }
    )
    .subscribe();
}

export async function subscribeToDriverLocations(
  callback: (location: DriverLocation) => void
) {
  return supabase
    .channel('driver_locations_channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'driver_locations',
      },
      (payload) => {
        callback(payload.new as DriverLocation);
      }
    )
    .subscribe();
}
