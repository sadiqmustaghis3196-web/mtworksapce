require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await sb.rpc('exec_sql', {
    sql: 'ALTER TABLE vehicle_trips ADD CONSTRAINT vehicle_trips_provider_trip_id_key UNIQUE (provider, provider_trip_id);'
  });
  console.log(error || data);
}
run();
