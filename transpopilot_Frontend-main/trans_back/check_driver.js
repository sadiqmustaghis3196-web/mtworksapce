import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const driverId = '24429a41-3c23-47dd-a15a-339e9765bd5f';
  console.log(`Checking data for driver: ${driverId}`);
  
  const { data: metrics } = await sb.from('driver_behavior_analytics').select('*').eq('driver_id', driverId);
  console.log('--- driver_behavior_analytics rows ---');
  console.log(metrics);
  
  const { data: incidents } = await sb.from('safety_incident_reports').select('id, type, date').eq('driver_id', driverId).limit(1005);
  console.log(`\n--- safety_incident_reports count ---`);
  console.log(incidents ? incidents.length : 0, 'rows (limited to 1005)');
}

run();
