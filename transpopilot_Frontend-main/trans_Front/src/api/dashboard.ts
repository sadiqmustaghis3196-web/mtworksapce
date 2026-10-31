import { API_BASE_URL } from '../lib/apiConfig';
import { supabase } from '../lib/supabase';

export interface DashboardStats {
  fleetEfficiency: number;
  fuelSavings: number;
  safetyScore: number;
  activeDrivers: number;
  activeVehicles: number;
  onTimeRate: number;
}

export interface Alert {
  id: string;
  type: 'warning' | 'success' | 'info' | 'error';
  message: string;
  time: string;
  priority: string;
}

async function getAuthHeaders() {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  return { Authorization: `Bearer ${token}` };
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/admin/dashboard/stats`, { headers });
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
  }
  return {
    fleetEfficiency: 0,
    fuelSavings: 0,
    safetyScore: 0,
    activeDrivers: 0,
    activeVehicles: 0,
    onTimeRate: 0,
  };
};

export const getRecentAlerts = async (): Promise<Alert[]> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/admin/dashboard/alerts`, { headers });
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (error) {
    console.error('Error fetching alerts:', error);
  }
  return [];
};

export const getTodayOperations = async (): Promise<any> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/operations/today`, { headers });
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (error) {
    console.error('Error fetching operations:', error);
  }
  return null;
};

export const dispatchFleet = async (routeIds?: string[]): Promise<any> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/operations/dispatch`, { 
      method: 'POST', 
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: routeIds ? JSON.stringify({ route_ids: routeIds }) : JSON.stringify({})
    });
    const json = await res.json();
    return json;
  } catch (error: any) {
    console.error('Error dispatching fleet:', error);
    return { success: false, message: error.message || 'Server error' };
  }
};
