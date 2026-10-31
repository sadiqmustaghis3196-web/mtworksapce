import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function cleanOldTrips() {
  const orgId = '387cf3be-c0fe-43af-9abe-93dc55fd9be3';
  
  // Find trips with invalid UUIDs for vehicle_id (length < 36)
  const { data: vt } = await sb.from('vehicle_trips').select('id, vehicle_id').eq('organization_id', orgId);
  
  let deletedCount = 0;
  for (const t of vt || []) {
    if (t.vehicle_id && t.vehicle_id.length < 30) {
      await sb.from('vehicle_trips').delete().eq('id', t.id);
      deletedCount++;
    }
  }
  
  console.log(`Deleted ${deletedCount} malformed trips.`);
}

cleanOldTrips();
