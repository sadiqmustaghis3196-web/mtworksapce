import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('fleet_integrations')
    .select("organization_id, provider_id, status, credentials->>'database' as database");
  if (error) {
    console.error("Error fetching data:", error);
    return;
  }
  console.table(data);
}
run();
