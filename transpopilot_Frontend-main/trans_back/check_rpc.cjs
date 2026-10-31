const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const {data, error} = await sb.rpc('exec_sql', { query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'driver_invitations' AND column_name = 'expires_at'" });
  console.log('Result:', data);
  console.log('Error:', error);
}
check();
