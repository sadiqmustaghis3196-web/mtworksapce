require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await sb.rpc('exec_sql', {
    sql: 'ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_organization_id_vin_key;'
  });
  console.log('Drop constraint error via RPC:', error);
}
run();
