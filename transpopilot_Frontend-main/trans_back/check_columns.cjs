const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'safety_incident_reports';
`;

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', { sql: sql });
  console.log("execute_sql error:", error);
}

run();
