require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await sb.from('vehicle_locations').insert({ 
    vehicle_id: '8583a696-27a4-4a25-901d-7cd1ce9dfcd7', // Valid vehicle ID from demo
    organization_id: '387cf3be-c0fe-43af-9abe-93dc55fd9be3' // Valid org ID
  }).select('*');
  console.log(error || data);
}
checkSchema();
