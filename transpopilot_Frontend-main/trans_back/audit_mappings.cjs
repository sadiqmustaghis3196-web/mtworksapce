const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkMapping() {
  const { data: vehicles, error } = await supabase.from('vehicles').select('id, vehicle_number, provider, provider_vehicle_id, organization_id');
  
  if (error) {
    console.error("Supabase Error:", error);
    return;
  }
  
  let geotabCount = 0;
  let nullProviderVehicleId = 0;
  
  vehicles.forEach(v => {
    if (v.provider === 'geotab') {
      geotabCount++;
      if (!v.provider_vehicle_id) nullProviderVehicleId++;
    }
  });
  
  console.log(`Total vehicles: ${vehicles.length}`);
  console.log(`Geotab vehicles: ${geotabCount}`);
  console.log(`Geotab vehicles with null provider_vehicle_id: ${nullProviderVehicleId}`);

  const nullList = vehicles.filter(v => v.provider === 'geotab' && !v.provider_vehicle_id).map(v => v.id + ' | ' + (v.name || v.vehicle_number));
  console.log("Null provider_vehicle_id vehicles:", nullList.slice(0, 5));
}

checkMapping();
