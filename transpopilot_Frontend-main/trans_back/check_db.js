import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkData() {
  const orgId = '14e11bc7-193e-46cf-8b8b-6a2b43477cbe'; // Extracted from logs

  console.log("Checking vehicles for org:", orgId);
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, vehicle_number, vin, provider, provider_vehicle_id')
    .eq('organization_id', orgId);

  const geotabCount = vehicles?.filter(v => v.provider === 'geotab').length || 0;
  const samsaraCount = vehicles?.filter(v => v.provider === 'samsara').length || 0;
  
  console.log(`Vehicles: Geotab=${geotabCount}, Samsara=${samsaraCount}, Total=${vehicles?.length || 0}`);
  
  if (vehicles && vehicles.length > 0) {
    console.log("Sample Vehicles:", vehicles.slice(0, 3));
  }

  const { count: fuelGeoCount } = await supabase.from('fuel_records').select('*', { count: 'exact', head: true }).eq('organization_id', orgId); // Wait, fuel_records uses vehicle_id, let's query via vehicle provider
}

checkData();
