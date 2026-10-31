import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('id, organization_id, email, role');

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }
  console.log("User Profiles in Database:");
  console.table(profiles);
}
run();
