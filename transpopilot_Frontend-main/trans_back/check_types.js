import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const driverId = '24429a41-3c23-47dd-a15a-339e9765bd5f';
  const { data: incidents } = await sb.from('safety_incident_reports').select('type').eq('driver_id', driverId);
  const types = [...new Set(incidents.map(i => i.type))];
  console.log("Unique incident types:", types);
}

run();
