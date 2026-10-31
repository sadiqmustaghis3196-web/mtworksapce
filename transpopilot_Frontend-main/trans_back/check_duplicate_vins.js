import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Query to find duplicate VINs per organization
  // Since we can't use raw SQL easily with anon key, let's fetch all non-null VINs and check in JS
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, organization_id, vin, vehicle_number, created_at, updated_at')
    .not('vin', 'is', null);

  if (error) {
    console.error("Error fetching vehicles:", error);
    return;
  }

  const counts = {};
  const duplicates = [];

  for (const v of data) {
    if (!v.vin) continue;
    const key = `${v.organization_id}_${v.vin}`;
    if (!counts[key]) {
      counts[key] = [];
    }
    counts[key].push(v);
  }

  for (const key in counts) {
    if (counts[key].length > 1) {
      duplicates.push(counts[key]);
    }
  }

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate pairs/groups!`);
    console.log(JSON.stringify(duplicates, null, 2));
  } else {
    console.log("No duplicate VINs found.");
  }
}
run();
