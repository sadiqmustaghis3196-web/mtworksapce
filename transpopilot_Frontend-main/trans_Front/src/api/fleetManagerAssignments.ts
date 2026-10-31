import { supabase } from '../lib/supabase';

export interface FleetManagerAssignment {
  id: string;
  user_id: string;
  vehicle_id?: string;
  driver_id?: string;
  assigned_at: string;
  assigned_by?: string;
  is_active: boolean;
  created_at: string;
}

export const getFleetManagerAssignments = async (userId: string) => {
  const { data, error } = await supabase
    .from('fleet_manager_assignments')
    .select(`
      *,
      vehicles(id, vehicle_number, make, model),
      drivers(id, first_name, last_name)
    `)
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) throw error;
  return data;
};

export const assignVehicleToFleetManager = async (
  fleetManagerId: string,
  vehicleId: string
) => {
  const { data: user } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('fleet_manager_assignments')
    .insert({
      user_id: fleetManagerId,
      vehicle_id: vehicleId,
      assigned_by: user.user?.id,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const assignDriverToFleetManager = async (
  fleetManagerId: string,
  driverId: string
) => {
  const { data: user } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('fleet_manager_assignments')
    .insert({
      user_id: fleetManagerId,
      driver_id: driverId,
      assigned_by: user.user?.id,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const removeFleetManagerAssignment = async (assignmentId: string) => {
  const { error } = await supabase
    .from('fleet_manager_assignments')
    .update({ is_active: false })
    .eq('id', assignmentId);

  if (error) throw error;
};

export const getAllFleetManagers = async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, email:id')
    .eq('role', 'fleet_manager');

  if (error) throw error;
  return data;
};

export const promoteToFleetManager = async (userId: string) => {
  const { error } = await supabase
    .from('user_profiles')
    .update({ role: 'fleet_manager' })
    .eq('id', userId);

  if (error) throw error;
};
