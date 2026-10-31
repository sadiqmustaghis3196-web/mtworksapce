import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runSync() {
  const orgId = 'a609d7e3-78b1-4acd-a5ea-92c06e625a48';
  
  const { data: ints } = await sb.from('fleet_integrations')
    .select('provider_id, credentials')
    .eq('organization_id', orgId);

  const geotab = ints.find(i => i.provider_id === 'geotab');
  const samsara = ints.find(i => i.provider_id === 'samsara');

  console.log("Triggering Geotab Sync...");
  if (geotab) {
    try {
      const res = await axios.post('http://localhost:5000/api/sync-geotab', {
        organizationId: orgId,
        username: geotab.credentials.username,
        password: geotab.credentials.password,
        database: geotab.credentials.database
      });
      console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
      console.error(e.response?.data || e.message);
    }
  }

  console.log("\nTriggering Samsara Sync...");
  if (samsara) {
    try {
      const res = await axios.post('http://localhost:5000/api/sync-samsara', {
        organizationId: orgId,
        apiKey: samsara.credentials.apiKey
      });
      console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
      console.error(e.response?.data || e.message);
    }
  }
}

runSync();
