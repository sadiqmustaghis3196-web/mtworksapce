import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { count, error } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', 'demo-org-12345');

  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Total drivers for organization demo-org-12345:", count);
}
run();
