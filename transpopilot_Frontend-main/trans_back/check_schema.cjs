require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await sb.from('vehicle_trips').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log(data);
  }
}
checkSchema();
