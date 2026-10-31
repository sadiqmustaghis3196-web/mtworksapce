require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await sb.from('vehicle_trips').insert({ 
    organization_id: '387cf3be-c0fe-43af-9abe-93dc55fd9be3',
    provider: 'geotab',
    provider_trip_id: 'b2104767',
    vehicle_id: 'b6',
    start_time: '2026-08-27T03:34:57.2+00:00',
    end_time: '2026-08-27T03:34:57.2+00:00'
  });
  console.log(error);
}
run();
