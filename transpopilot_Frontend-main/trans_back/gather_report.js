import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('--- Issue 2: Checking duplicates ---');
  const {data: allIncidents} = await sb.from('safety_incident_reports').select('id, vehicle_id, type, date');
  
  const groups = {};
  let distinct = 0;
  let duplicates = 0;
  
  if (allIncidents) {
    allIncidents.forEach(r => {
      const key = r.vehicle_id + '_' + r.date + '_' + r.type;
      if (!groups[key]) {
        groups[key] = 1;
        distinct++;
      } else {
        groups[key]++;
        duplicates++;
      }
    });
  }
  
  console.log('Total rows:', allIncidents?.length);
  console.log('Distinct events:', distinct);
  console.log('Duplicates to remove:', duplicates);

  console.log('\n--- Stray Orgs ---');
  const {data: orgs} = await sb.from('fleet_integrations').select('organization_id, provider_id, status').eq('status', 'connected');
  console.log('Connected Orgs for Sync:');
  orgs.forEach(o => {
    console.log(`Org: ${o.organization_id} | Provider: ${o.provider_id}`);
  });
}

run();
