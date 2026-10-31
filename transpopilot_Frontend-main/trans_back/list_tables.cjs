require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function listTables() {
  const { data, error } = await sb.rpc('exec_sql', { query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'" }).catch(e => sb.from('users').select('*').limit(1));
  console.log(data);
}
listTables();
