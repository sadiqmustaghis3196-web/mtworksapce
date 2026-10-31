import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDiagnostics() {
  const orgId = 'a609d7e3-78b1-4acd-a5ea-92c06e625a48'; // Org A
  const testVehicleId = '9d25b07e-09ba-40ba-bde6-f8be4382646d';

  console.log("Checking structure of vehicle_diagnostics...");
  const { data: cols } = await supabase.from('vehicle_diagnostics').select('*').limit(1);
  if (cols && cols.length > 0) {
    console.log("Columns:", Object.keys(cols[0]));
  }

  // Fetch all diagnostics for the org's vehicles
  const { data: vehicles } = await supabase.from('vehicles').select('id, vehicle_number').eq('organization_id', orgId);
  const vehicleIds = vehicles.map(v => v.id);

  console.log(`\nFound ${vehicles.length} vehicles for org ${orgId}`);

  const { data: diagnostics, error } = await supabase
    .from('vehicle_diagnostics')
    .select('*')
    .in('vehicle_id', vehicleIds)
    .order('recorded_at', { ascending: false });

  if (error) {
    console.error("Error fetching diagnostics:", error);
    return;
  }

  console.log(`Found ${diagnostics.length} diagnostic rows for these vehicles.`);
  
  diagnostics.forEach(d => {
    const v = vehicles.find(veh => veh.id === d.vehicle_id);
    const isFakeTemp = d.engine_temperature >= 180 && d.engine_temperature <= 220;
    const isFakeOil = d.oil_pressure >= 30 && d.oil_pressure <= 60;
    const isFakeTire = d.tire_pressure_fl >= 100 && d.tire_pressure_fl <= 115;
    const suspect = (isFakeTemp && isFakeOil && isFakeTire) ? "YES" : "NO";
    
    console.log(`\nRow ID: ${d.id}`);
    console.log(`Vehicle: ${v?.vehicle_number} (${d.vehicle_id})`);
    console.log(`Recorded: ${d.recorded_at}`);
    console.log(`Provider/Source info:`, d.provider || d.data_source || d.source || 'N/A');
    console.log(`Eng Temp: ${d.engine_temperature} | Oil Press: ${d.oil_pressure} | Trans Temp: ${d.transmission_temp}`);
    console.log(`Tires: FL=${d.tire_pressure_fl} FR=${d.tire_pressure_fr} RL=${d.tire_pressure_rl} RR=${d.tire_pressure_rr}`);
    console.log(`Codes:`, d.diagnostic_codes || d.fault_codes || []);
    console.log(`Health Score value in row: ${d.health_score}`);
    console.log(`Suspect Fake? ${suspect}`);
  });
}

checkDiagnostics();
