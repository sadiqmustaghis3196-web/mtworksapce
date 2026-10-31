import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/apiConfig';

export async function getUserOrganizationId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });
    const data = await res.json();
    if (data.success && data.data) {
      return data.data.organization_id || null;
    }
  } catch (err) {
    console.error('Failed to fetch user profile from backend:', err);
  }

  return null;
}

export async function getOrganizationTierLimits() {
  const orgId = await getUserOrganizationId();

  if (!orgId) {
    throw new Error('No organization found for user');
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .select('max_vehicles, max_drivers, subscription_tier, subscription_status')
    .eq('id', orgId)
    .maybeSingle();

  if (error || !org) {
    throw new Error('Failed to fetch organization limits');
  }

  return org;
}

export async function checkVehicleLimit(): Promise<boolean> {
  try {
    const orgId = await getUserOrganizationId();
    if (!orgId) return false;

    const limits = await getOrganizationTierLimits();

    const { count } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    return (count || 0) < limits.max_vehicles;
  } catch (error) {
    console.error('Error checking vehicle limit:', error);
    return false;
  }
}

export async function checkDriverLimit(): Promise<boolean> {
  try {
    const orgId = await getUserOrganizationId();
    if (!orgId) return false;

    const limits = await getOrganizationTierLimits();

    const { count } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    return (count || 0) < limits.max_drivers;
  } catch (error) {
    console.error('Error checking driver limit:', error);
    return false;
  }
}

export async function getOrganizationStats() {
  const orgId = await getUserOrganizationId();

  if (!orgId) {
    return null;
  }

  const [limits, vehicleCount, driverCount] = await Promise.all([
    getOrganizationTierLimits(),
    supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId),
  ]);

  return {
    organizationId: orgId,
    tier: limits.subscription_tier,
    status: limits.subscription_status,
    vehiclesUsed: vehicleCount.count || 0,
    vehiclesLimit: limits.max_vehicles,
    driversUsed: driverCount.count || 0,
    driversLimit: limits.max_drivers,
    vehiclesRemaining: limits.max_vehicles - (vehicleCount.count || 0),
    driversRemaining: limits.max_drivers - (driverCount.count || 0),
  };
}
