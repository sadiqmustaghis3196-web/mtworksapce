import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/apiConfig';

export interface SafetyOverview {
  safetyScore: number;
  incidentsThisMonth: number;
  incidentsLastMonth: number;
  milesDriven: number;
  violationsCount: number;
  topPerformers: Array<{
    name: string;
    score: number;
    streak: string;
  }>;
}

export interface SafetyIncident {
  id: string;
  type: string;
  driver: string;
  vehicle: string;
  date: string;
  severity: string;
  description: string;
  status: string;
  provider: string;
}

const getMonthRange = () => {
  const now = new Date();

  const thisMonthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
    0
  );

  const lastMonthStart = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1,
    0,
    0,
    0,
    0
  );

  return {
    now,
    thisMonthStart,
    lastMonthStart,
  };
};

function safeNumber(value: unknown): number {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function calculateMilesFromOdometerRecords(
  records: Array<{
    vehicle_id?: string | null;
    odometer_reading?: number | null;
    transaction_date?: string | null;
  }>
): number {
  const vehicleReadings = new Map<
    string,
    Array<{
      odometer: number;
      date: string;
    }>
  >();

  for (const record of records) {
    const vehicleId = record.vehicle_id;

    const odometer = safeNumber(record.odometer_reading);

    if (!vehicleId || odometer <= 0) {
      continue;
    }

    const list = vehicleReadings.get(vehicleId) || [];

    list.push({
      odometer,
      date: record.transaction_date || '',
    });

    vehicleReadings.set(vehicleId, list);
  }

  let totalMiles = 0;

  for (const readings of vehicleReadings.values()) {
    if (readings.length < 2) {
      continue;
    }

    readings.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      return dateA - dateB;
    });

    const validReadings = readings.filter(
      item => Number.isFinite(item.odometer) && item.odometer > 0
    );

    if (validReadings.length < 2) {
      continue;
    }

    const first = validReadings[0].odometer;
    const last = validReadings[validReadings.length - 1].odometer;

    if (last >= first) {
      totalMiles += last - first;
    }
  }

  return Math.round(totalMiles);
}

function normalizeProvider(
  incident: Record<string, any>
): string {
  if (incident.provider) {
    return String(incident.provider).toLowerCase();
  }

  const description = String(incident.description || '').toLowerCase();

  if (description.includes('geotab')) {
    return 'geotab';
  }

  if (description.includes('samsara')) {
    return 'samsara';
  }

  if (description.includes('motive')) {
    return 'motive';
  }

  return 'unknown';
}

// API_BASE_URL imported from config

export async function getDriverComplianceOverview() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    console.error('[Safety API] No active session');
    return [];
  }

  const response = await fetch(`${API_BASE_URL}/api/admin/drivers/compliance-overview`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  });

  const result = await response.json();
  if (!result.success) {
    console.error('[Safety] Error fetching compliance overview:', result.error);
    return [];
  }

  return result.data || [];
}

export async function getDriverOnboardingDetails(driverId: string) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    console.error('[Safety API] No active session');
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/api/admin/drivers/${driverId}/onboarding`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  });

  const result = await response.json();
  if (!result.success) {
    console.error('[Safety] Error fetching onboarding details:', result.error);
    return null;
  }

  return result.data;
}

function getDriverName(driver: any): string {
  if (!driver) {
    return 'Unassigned';
  }

  const parts = [
    driver.first_name,
    driver.last_name,
  ]
    .filter(Boolean)
    .map((value: string) => value.trim());

  return parts.length > 0
    ? parts.join(' ')
    : 'Unassigned';
}

function getVehicleName(vehicle: any): string {
  if (!vehicle) {
    return 'Unknown Vehicle';
  }

  return (
    vehicle.vehicle_number ||
    vehicle.name ||
    vehicle.id ||
    'Unknown Vehicle'
  );
}

export async function getSafetyOverview(
  organizationId: string
): Promise<SafetyOverview | null> {
  if (!organizationId) {
    console.error('[Safety] Missing organizationId while loading overview.');
    return null;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const response = await fetch(`${API_BASE_URL}/api/admin/safety/overview`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      }
    });
    
    if (!response.ok) throw new Error(`Overview fetch failed: ${response.status}`);
    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('[Safety] Failed to get safety overview:', error);
    return null;
  }
}

export async function getSafetyIncidents(
  organizationId: string
): Promise<SafetyIncident[]> {
  if (!organizationId) {
    console.error(
      '[Safety] Missing organizationId while loading incidents.'
    );

    return [];
  }

  try {
    const { data, error } = await supabase
      .from('safety_incident_reports')
      .select(`
        id,
        organization_id,
        vehicle_id,
        driver_id,
        type,
        severity,
        description,
        date,
        resolved,
        vehicles (
          vehicle_number
        ),
        drivers (
          first_name,
          last_name
        )
      `)
      .eq('organization_id', organizationId)
      .order('date', {
        ascending: false,
      });

    if (error) {
      console.error(
        '[Safety] Error fetching incidents:',
        error
      );

      throw error;
    }

    return (data || []).map((incident: any) => {
      return {
        id: String(incident.id),

        type:
          incident.type ||
          'other',

        driver:
          getDriverName(incident.drivers),

        vehicle:
          getVehicleName(incident.vehicles),

        date:
          incident.date ||
          new Date().toISOString(),

        severity:
          incident.severity ||
          'low',

        description:
          incident.description ||
          'No description available.',

        status:
          incident.resolved
            ? 'resolved'
            : 'pending',

        provider:
          normalizeProvider(incident),
      };
    });
  } catch (error) {
    console.error(
      '[Safety] Incident loading failed:',
      error
    );

    return [];
  }
}