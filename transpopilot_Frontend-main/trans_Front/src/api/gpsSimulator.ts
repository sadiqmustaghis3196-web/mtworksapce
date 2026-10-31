const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function simulateGPSUpdates(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/gps-simulator?action=simulate`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to simulate GPS updates: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error simulating GPS updates:', error);
    throw error;
  }
}

export async function simulateSingleVehicle(vehicleId: string): Promise<{ success: boolean; location: any }> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/gps-simulator?action=single&vehicle_id=${vehicleId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to simulate vehicle location: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error simulating vehicle location:', error);
    throw error;
  }
}

export async function startAutoSimulation(intervalMs: number = 5000): Promise<() => void> {
  const interval = setInterval(async () => {
    try {
      await simulateGPSUpdates();
    } catch (error) {
      console.error('Auto-simulation error:', error);
    }
  }, intervalMs);

  return () => clearInterval(interval);
}
