import { getUserOrganizationId } from './organization';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/apiConfig';

export interface FuelRecord {
  id: string;
  vehicle_id: string;
  driver_id?: string;
  gallons: number;
  cost_per_gallon: number;
  total_cost: number;
  station_name?: string;
  location?: string;
  odometer_reading?: number;
  mpg?: number;
  transaction_date: string;
  created_at: string;
  fuel_type?: string;
  receipt_url?: string;
  data_source?: string;
  external_transaction_id?: string;
  verification_status?: string;
  notes?: string;
}

export interface FuelStats {
  totalCost: number;
  totalGallons: number;
  averageMPG: number;
  averageCostPerGallon: number;
  totalMilesDriven: number;
  fuelEfficiency: number;
  co2Reduction: number;
  costChange: number;
  mpgChange: number;
  efficiencyChange: number;
}

export interface VehicleFuelPerformance {
  vehicle_id: string;
  vehicle_number: string;
  make: string;
  model: string;
  totalGallons: number;
  totalCost: number;
  averageMPG: number;
  totalMiles: number;
  efficiency: number;
}

export interface DriverFuelPerformance {
  driver_id: string;
  driver_name: string;
  vehicle_number?: string;
  averageMPG: number;
  totalCost: number;
  totalMiles: number;
  fuelSavings: number;
  efficiency: number;
}

export async function getFuelRecords(
  startDate?: string,
  endDate?: string,
  vehicleId?: string
): Promise<FuelRecord[]> {
  const orgId = await getUserOrganizationId();
  if (!orgId) return [];

  let query = supabase
    .from('fuel_records')
    .select('*')
    .eq('organization_id', orgId)
    .order('transaction_date', { ascending: false });

  if (startDate) {
    query = query.gte('transaction_date', startDate);
  }
  if (endDate) {
    query = query.lte('transaction_date', endDate);
  }
  if (vehicleId) {
    query = query.eq('vehicle_id', vehicleId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getFuelStats(timeframe: 'day' | 'week' | 'month' | 'quarter' | 'year'): Promise<FuelStats> {
  const orgId = await getUserOrganizationId();
  if (!orgId) return { totalCost: 0, totalGallons: 0, averageMPG: 0, averageCostPerGallon: 0, totalMilesDriven: 0, fuelEfficiency: 0, co2Reduction: 0, costChange: 0, mpgChange: 0, efficiencyChange: 0 };
  const now = new Date();
  const startDate = new Date(now);

  switch (timeframe) {
    case 'day':
      startDate.setDate(now.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  const { data: currentPeriod } = await supabase
    .from('fuel_records')
    .select('*')
    .eq('organization_id', orgId)
    .gte('transaction_date', startDate.toISOString());

  const previousStartDate = new Date(startDate);
  const timeDiff = now.getTime() - startDate.getTime();
  previousStartDate.setTime(startDate.getTime() - timeDiff);

  const { data: previousPeriod } = await supabase
    .from('fuel_records')
    .select('*')
    .eq('organization_id', orgId)
    .gte('transaction_date', previousStartDate.toISOString())
    .lt('transaction_date', startDate.toISOString());

  const calculateStats = (records: any[]) => {
    if (!records || records.length === 0) {
      return { cost: 0, gallons: 0, mpg: 0, miles: 0, costPerGallon: 0 };
    }

    const totalCost = records.reduce((sum, r) => sum + (r.total_cost || 0), 0);
    const totalGallons = records.reduce((sum, r) => sum + (r.gallons || 0), 0);

    const validMpgRecords = records.filter(r => r.mpg && r.mpg > 0);
    const averageMPG = validMpgRecords.length > 0
        ? validMpgRecords.reduce((sum, r) => sum + r.mpg, 0) / validMpgRecords.length
        : 0;

    let totalMiles = 0;
    if (averageMPG > 0) {
        totalMiles = totalGallons * averageMPG;
    }

    const costPerGallon = totalGallons > 0 ? totalCost / totalGallons : 0;

    return { cost: totalCost, gallons: totalGallons, mpg: averageMPG, miles: totalMiles, costPerGallon };
  };

  let current = calculateStats(currentPeriod || []);
  let previous = calculateStats(previousPeriod || []);

  const costChange = previous.cost > 0 ? ((current.cost - previous.cost) / previous.cost) * 100 : 0;
  const mpgChange = previous.mpg > 0 ? current.mpg - previous.mpg : 0;

  const baselineEfficiency = 85;
  const efficiency = current.mpg > 0 ? Math.min(100, (current.mpg / 7.5) * 100) : baselineEfficiency;
  const previousEfficiency = previous.mpg > 0 ? Math.min(100, (previous.mpg / 7.5) * 100) : baselineEfficiency;
  const efficiencyChange = previousEfficiency > 0 ? efficiency - previousEfficiency : 0;

  const co2PerGallon = 22.4;
  const baselineCO2 = current.gallons * co2PerGallon;
  const optimizedCO2 = baselineCO2 * 0.875;
  const co2Reduction = baselineCO2 > 0 ? ((baselineCO2 - optimizedCO2) / baselineCO2) * 100 : 0;

  return {
    totalCost: Math.round(current.cost * 100) / 100,
    totalGallons: Math.round(current.gallons * 100) / 100,
    averageMPG: Math.round(current.mpg * 10) / 10,
    averageCostPerGallon: Math.round(current.costPerGallon * 100) / 100,
    totalMilesDriven: Math.round(current.miles),
    fuelEfficiency: Math.round(efficiency * 10) / 10,
    co2Reduction: Math.round(co2Reduction * 10) / 10,
    costChange: Math.round(costChange * 10) / 10,
    mpgChange: Math.round(mpgChange * 10) / 10,
    efficiencyChange: Math.round(efficiencyChange * 10) / 10,
  };
}

export async function getVehicleFuelPerformance(limit: number = 10): Promise<VehicleFuelPerformance[]> {
  const orgId = await getUserOrganizationId();
  if (!orgId) return [];
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, vehicle_number, make, model')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (!vehicles) return [];

  const performance = await Promise.all(
    vehicles.map(async (vehicle) => {
      const { data: fuelRecords } = await supabase
        .from('fuel_records')
    .select('*')
    .eq('organization_id', orgId)
        .eq('vehicle_id', vehicle.id)
        .order('transaction_date', { ascending: false })
        .limit(30);

      const totalGallons = fuelRecords?.reduce((sum, r) => sum + (r.gallons || 0), 0) || 0;
      const totalCost = fuelRecords?.reduce((sum, r) => sum + (r.total_cost || 0), 0) || 0;
      const validMPGs = fuelRecords?.filter(r => r.mpg && r.mpg > 0) || [];
      const averageMPG = validMPGs.length > 0
        ? validMPGs.reduce((sum, r) => sum + r.mpg, 0) / validMPGs.length
        : 0;
      const totalMiles = totalGallons * averageMPG;
      const efficiency = averageMPG > 0 ? Math.min(100, (averageMPG / 7.5) * 100) : 0;

      return {
        vehicle_id: vehicle.id,
        vehicle_number: vehicle.vehicle_number,
        make: vehicle.make,
        model: vehicle.model,
        totalGallons: Math.round(totalGallons * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        averageMPG: Math.round(averageMPG * 10) / 10,
        totalMiles: Math.round(totalMiles),
        efficiency: Math.round(efficiency),
      };
    })
  );

  return performance
    .filter(p => p.averageMPG > 0)
    .sort((a, b) => b.averageMPG - a.averageMPG)
    .slice(0, limit);
}

export async function getDriverFuelPerformance(limit: number = 5, timeframe: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'quarter'): Promise<DriverFuelPerformance[]> {
  const orgId = await getUserOrganizationId();
  if (!orgId) return [];
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, vehicle_number, make, model, driver_id, drivers(first_name, last_name)')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (!vehicles) return [];
  
  const now = new Date();
  const startDate = new Date(now);
  switch (timeframe) {
    case 'day': startDate.setDate(now.getDate() - 1); break;
    case 'week': startDate.setDate(now.getDate() - 7); break;
    case 'month': startDate.setMonth(now.getMonth() - 1); break;
    case 'quarter': startDate.setMonth(now.getMonth() - 3); break;
    case 'year': startDate.setFullYear(now.getFullYear() - 1); break;
  }

  const performance = await Promise.all(
    vehicles.map(async (vehicle) => {
      const { data: fuelRecords } = await supabase
        .from('fuel_records')
        .select('*, drivers(first_name, last_name)')
        .eq('organization_id', orgId)
        .eq('vehicle_id', vehicle.id)
        .gte('transaction_date', startDate.toISOString())
        .order('transaction_date', { ascending: false });

      const totalCost = fuelRecords?.reduce((sum, r) => sum + (r.total_cost || 0), 0) || 0;
      const validMPGs = fuelRecords?.filter(r => r.mpg && r.mpg > 0) || [];
      const averageMPG = validMPGs.length > 0
        ? validMPGs.reduce((sum, r) => sum + r.mpg, 0) / validMPGs.length
        : 0;
      const totalGallons = fuelRecords?.reduce((sum, r) => sum + (r.gallons || 0), 0) || 0;
      const totalMiles = totalGallons * averageMPG;

      const baselineMPG = 7.0;
      const fuelSavings = averageMPG > baselineMPG
        ? ((averageMPG - baselineMPG) / baselineMPG) * totalCost
        : 0;

      const efficiency = averageMPG > 0 ? Math.min(100, (averageMPG / 7.5) * 100) : 0;
      
      let driverName = 'Unknown Driver';
      const lastFuelRecord = fuelRecords && fuelRecords.length > 0 ? fuelRecords[0] : null;
      if (lastFuelRecord?.drivers && (lastFuelRecord.drivers.first_name || lastFuelRecord.drivers.last_name)) {
        driverName = `${lastFuelRecord.drivers.first_name || ''} ${lastFuelRecord.drivers.last_name || ''}`.trim();
      } else if (vehicle.drivers && (vehicle.drivers.first_name || vehicle.drivers.last_name)) {
        driverName = `${vehicle.drivers.first_name || ''} ${vehicle.drivers.last_name || ''}`.trim();
      }

      return {
        driver_id: vehicle.driver_id || vehicle.id,
        driver_name: driverName !== 'Unknown Driver' ? driverName : (vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : 'Vehicle'),
        vehicle_number: vehicle.vehicle_number,
        averageMPG: Math.round(averageMPG * 10) / 10,
        totalCost: Math.round(totalCost * 100) / 100,
        totalMiles: Math.round(totalMiles),
        fuelSavings: Math.round(fuelSavings * 100) / 100,
        efficiency: Math.round(efficiency),
      };
    })
  );

  return performance
    .filter(p => p.averageMPG > 0)
    .sort((a, b) => b.averageMPG - a.averageMPG)
    .slice(0, limit);
}


export interface FuelTelemetryReportItem {
  id: string;
  device: string;
  vin?: string;
  model?: string;
  fuelEconomy: string;
  fuelUsed: string;
  energyUsed: string;
  date: string;
  distance: string;
  engineHours?: string;
  idleTime?: string;
  avgSpeed?: string;
  co2Saved?: string;
  status?: string;
  fuelType?: string;
  totalCost?: string;
  location?: string;
  rawMpg?: number;
  rawGallons?: number;
  rawMiles?: number;
  rawTimestamp?: number;
  provider?: string;
  receiptUrl?: string;
  driver?: string;
}

export async function getFuelTelemetryReport(timeframe: 'day' | 'week' | 'month' | 'quarter' | 'year'): Promise<FuelTelemetryReportItem[]> {
  const orgId = await getUserOrganizationId();
  if (!orgId) return [];
  try {
    let query = supabase
      .from('fuel_records')
      .select(`
        id,
        gallons,
        cost_per_gallon,
        total_cost,
        mpg,
        odometer_reading,
        transaction_date,
        created_at,
        station_name,
        location,
        provider,
        receipt_url,
        driver_id,
        drivers ( first_name, last_name ),
        vehicles (
          id,
          vehicle_number,
          make,
          model,
          vin,
          driver_id,
          drivers ( first_name, last_name )
        )
      `)
      .eq('organization_id', orgId)
      .order('transaction_date', { ascending: false });

    const now = new Date();
    const startDate = new Date(now);
    switch (timeframe) {
      case 'day': startDate.setDate(now.getDate() - 1); break;
      case 'week': startDate.setDate(now.getDate() - 7); break;
      case 'month': startDate.setMonth(now.getMonth() - 1); break;
      case 'quarter': startDate.setMonth(now.getMonth() - 3); break;
      case 'year': startDate.setFullYear(now.getFullYear() - 1); break;
    }
    query = query.gte('transaction_date', startDate.toISOString());

    const { data: records } = await query.limit(50000);

    const items: FuelTelemetryReportItem[] = [];

    if (records && records.length > 0) {
      records.forEach((r: any) => {
        const devName = r.vehicles?.vehicle_number || r.vehicles?.make || 'Unknown Vehicle';
        const gallons = r.gallons || 0;
        const mpg = r.mpg;
        const isValidMpg = mpg !== null && mpg > 0;
        const miles = r.odometer_reading > 0 ? r.odometer_reading : gallons * (isValidMpg ? mpg : 0);

        const liters = (gallons * 3.78541).toFixed(1);
        const fuelEconomyString = isValidMpg 
            ? `${mpg.toFixed(1)} MPG (${(235.215 / mpg).toFixed(1)} L/100km)` 
            : 'Not available';
        const km = Math.round(miles * 1.60934);
        
        let driverName = 'Unknown driver';
        if (r.drivers && (r.drivers.first_name || r.drivers.last_name)) {
          driverName = `${r.drivers.first_name || ''} ${r.drivers.last_name || ''}`.trim();
        } else if (r.vehicles?.drivers && (r.vehicles.drivers.first_name || r.vehicles.drivers.last_name)) {
          driverName = `${r.vehicles.drivers.first_name || ''} ${r.vehicles.drivers.last_name || ''}`.trim();
        }

        items.push({
          id: r.id,
          device: devName,
          vin: r.vehicles?.vin || '--',
          model: r.vehicles?.model || '--',
          fuelEconomy: fuelEconomyString,
          fuelUsed: `${liters} L (${gallons.toFixed(1)} gal)`,
          energyUsed: '0.0 kWh',
          date: r.transaction_date ? new Date(r.transaction_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '--',
          distance: `${km} km (${Math.round(miles)} mi)`,
          engineHours: `${(miles / 45).toFixed(1)} hrs`,
          idleTime: '0 mins',
          avgSpeed: '--',
          co2Saved: `${(gallons * 2.8).toFixed(1)} kg`,
          status: 'Online Telemetry',
          fuelType: 'Diesel',
          totalCost: `$${(r.total_cost || gallons * 3.45).toFixed(2)}`,
          location: r.location || r.station_name || 'Unknown',
          rawMpg: mpg,
          rawGallons: gallons,
          rawMiles: miles,
          rawTimestamp: r.transaction_date ? new Date(r.transaction_date).getTime() : Date.now(),
          provider: r.provider || 'unknown',
          receiptUrl: r.receipt_url,
          driver: driverName
        });
      });
    }

    return items;
  } catch (error) {
    console.error('Failed to get fuel telemetry report:', error);
    return [];
  }
}

export async function createFuelRecord(record: Omit<FuelRecord, 'id' | 'created_at' | 'organization_id'>): Promise<FuelRecord> {
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/api/fuel/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.session?.access_token}`,
    },
    body: JSON.stringify(record)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to create record');
  return json.record;
}

export async function uploadFuelReceipt(recordId: string, file: File): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const formData = new FormData();
  formData.append('receipt', file);

  const res = await fetch(`${API_BASE_URL}/api/fuel/records/${recordId}/receipt`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.session?.access_token}`,
    },
    body: formData
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.path;
}

export async function extractFuelReceipt(file: File): Promise<any> {
  const { data: session } = await supabase.auth.getSession();
  const formData = new FormData();
  formData.append('receipt', file);

  const res = await fetch(`${API_BASE_URL}/api/fuel/extract`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.session?.access_token}`,
    },
    body: formData
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.extraction;
}

export async function getFuelReceiptUrl(recordId: string): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/api/fuel/records/${recordId}/receipt`, {
    headers: {
      Authorization: `Bearer ${session.session?.access_token}`
    }
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.signedUrl;
}

export async function syncFuelTelemetry(organizationId: string) {
  const response = await fetch(`${API_BASE_URL}/api/sync-fuel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId })
  });
  if (!response.ok) throw new Error('Failed to sync fuel telemetry');
  return response.json();
}
