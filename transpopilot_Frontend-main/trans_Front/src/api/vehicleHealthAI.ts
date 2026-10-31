import { supabase } from '../lib/supabase';
import { isDemoMode, DEMO_VEHICLE_HEALTH } from '../lib/demoData';
import { getUserOrganizationId } from './organization';

export interface VehicleDiagnostic {
  id: string;
  vehicle_id: string;
  engine_temperature: number;
  oil_pressure: number;
  brake_wear_percentage: number;
  tire_pressure_fl: number;
  tire_pressure_fr: number;
  tire_pressure_rl: number;
  tire_pressure_rr: number;
  transmission_temp: number;
  diagnostic_codes: string[];
  health_score: number;
  recorded_at: string;
}

export interface VehicleHealthSummary {
  vehicle_id: string;
  vehicle_number: string;
  make: string;
  model: string;
  current_mileage: number;
  health_score: number;
  engine_health: number;
  brake_health: number;
  transmission_health: number;
  tire_health: number;
  overall_status: 'excellent' | 'good' | 'fair' | 'poor';
  next_maintenance_due: number;
  predicted_issues: string[];
  cost_savings_potential: number;
}

export async function getVehicleHealthData(): Promise<any[]> {
  const orgId = await getUserOrganizationId();
  if (!orgId) return [];

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return [];

  try {
    const { API_BASE_URL } = await import('../lib/apiConfig');
    const response = await fetch(`${API_BASE_URL}/api/vehicle-health`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch vehicle health data');
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Error fetching vehicle health data:", error);
    return [];
  }
}

export async function generateVehicleHealthRecommendation(vehicleId: string): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return null;

  try {
    const { API_BASE_URL } = await import('../lib/apiConfig');
    const response = await fetch(`${API_BASE_URL}/api/vehicle-health/${vehicleId}/recommendation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('Failed to generate recommendation', await response.text());
      return null;
    }

    const data = await response.json();
    return data.ai_recommendation;
  } catch (error) {
    console.error("Error generating recommendation:", error);
    return null;
  }
}


export async function getVehicleDiagnostics(vehicleId: string): Promise<VehicleDiagnostic[]> {
  const orgId = await getUserOrganizationId();
  if (!orgId) return [];

  const { data, error } = await supabase
    .from('vehicle_diagnostics')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .eq('organization_id', orgId)
    .order('recorded_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error fetching vehicle diagnostics:', error);
    return [];
  }

  return data || [];
}

export async function getMaintenanceHistory(vehicleId: string) {
  // TODO: Implement with actual vehicle maintenance records table
  return [];
}

function calculateVehicleHealthScore(vehicle: any) {
  const mileage = vehicle.current_mileage || 0;
  const year = vehicle.year || new Date().getFullYear();
  const age = new Date().getFullYear() - year;

  const engineHealth = Math.max(95 - (mileage / 10000) - (age * 2), 50);
  const brakeHealth = Math.max(90 - (mileage / 15000) - (age * 1.5), 50);
  const transmissionHealth = Math.max(92 - (mileage / 12000) - (age * 1.8), 50);
  const tireHealth = Math.max(88 - (mileage / 8000), 50);

  const overall = Math.round((engineHealth + brakeHealth + transmissionHealth + tireHealth) / 4);

  return {
    overall: Math.min(overall, 100),
    engine: Math.min(Math.round(engineHealth), 100),
    brakes: Math.min(Math.round(brakeHealth), 100),
    transmission: Math.min(Math.round(transmissionHealth), 100),
    tires: Math.min(Math.round(tireHealth), 100)
  };
}

async function predictVehicleIssues(vehicle: any): Promise<string[]> {
  const issues: string[] = [];
  const mileage = vehicle.current_mileage || 0;
  const year = vehicle.year || new Date().getFullYear();
  const age = new Date().getFullYear() - year;

  if (mileage > 100000) {
    issues.push('High mileage detected - increased maintenance monitoring recommended');
  }

  if (age > 5) {
    issues.push('Vehicle age may require more frequent inspections');
  }

  if (mileage % 15000 < 500 && mileage > 0) {
    issues.push('Oil change due within 500 miles');
  }

  if (mileage > 50000 && mileage % 50000 < 1000) {
    issues.push('Brake system inspection recommended');
  }

  const { data: fuelRecords } = await supabase
    .from('fuel_records')
    .select('mpg')
    .eq('vehicle_id', vehicle.id)
    .order('transaction_date', { ascending: false })
    .limit(5);

  if (fuelRecords && fuelRecords.length >= 3) {
    const avgMpg = fuelRecords.reduce((sum, r) => sum + (r.mpg || 0), 0) / fuelRecords.length;
    if (avgMpg < 6) {
      issues.push('Fuel efficiency below expected - engine diagnostics recommended');
    }
  }

  return issues;
}

function getOverallStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  return 'poor';
}

function calculateNextMaintenance(vehicle: any): number {
  const mileage = vehicle.current_mileage || 0;
  const nextService = Math.ceil(mileage / 5000) * 5000;
  return nextService - mileage;
}

function calculateCostSavings(issueCount: number, healthScore: number): number {
  let baseSavings = 500;

  if (issueCount > 2) {
    baseSavings += issueCount * 800;
  } else if (issueCount > 0) {
    baseSavings += issueCount * 400;
  }

  if (healthScore < 70) {
    baseSavings += 1500;
  }

  return baseSavings;
}

export async function saveDiagnosticData(diagnostic: Omit<VehicleDiagnostic, 'id' | 'recorded_at'>) {
  const { data, error } = await supabase
    .from('vehicle_diagnostics')
    .insert([{
      ...diagnostic,
      recorded_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    console.error('Error saving diagnostic data:', error);
    throw error;
  }

  return data;
}
