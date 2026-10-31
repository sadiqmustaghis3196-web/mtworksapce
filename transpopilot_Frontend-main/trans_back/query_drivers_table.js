import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Let's count drivers and see if there are any
  const { count, error: countError } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error("Error counting drivers:", countError);
    return;
  }
  console.log("Total drivers in database:", count);

  // Let's fetch the first 10 drivers
  const { data: drivers, error: fetchError } = await supabase
    .from('drivers')
    .select('id, organization_id, first_name, last_name, email, license_number, status, safety_score')
    .limit(10);

  if (fetchError) {
    console.error("Error fetching drivers:", fetchError);
    return;
  }
  console.log("First 10 drivers:");
  console.table(drivers);
}
run();
