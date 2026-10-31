// inspect_constraints.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('information_schema.table_constraints')
    .select('constraint_name, constraint_type')
    .eq('table_name', 'drivers');
  if (error) {
    console.error('Error fetching constraints via table:', error);
    // fallback: use rpc to run raw SQL if allowed
    const { data: raw, error: rawErr } = await supabase.rpc('execute_sql', { sql: `SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name='drivers';` });
    if (rawErr) console.error('Raw sql error', rawErr);
    else console.log('Raw constraints', raw);
  } else {
    console.log('Constraints:', data);
  }
}
run();
