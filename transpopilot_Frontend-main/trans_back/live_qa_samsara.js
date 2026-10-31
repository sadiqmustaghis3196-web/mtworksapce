import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { syncSamsaraSafety } from './services/samsara/safetySync.js';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const orgId = 'a609d7e3-78b1-4acd-a5ea-92c06e625a48';
  
  const { data: ints } = await supabase.from('fleet_integrations').select('credentials').eq('organization_id', orgId).eq('provider_id', 'samsara').single();
  
  if (!ints || !ints.credentials) {
     console.log("No Samsara credentials found!");
     return;
  }
  const credentials = ints.credentials; 
  
  const from = new Date(Date.now() - 24*60*60*1000); 
  const to = new Date();
  
  console.log("Running Samsara Sync 1...");
  try {
     let stats1 = await syncSamsaraSafety(orgId, credentials, from, to);
     console.log("Sync 1:", stats1);
  } catch (e) {
     console.log("Samsara Error:", e.message);
  }
}

run();
