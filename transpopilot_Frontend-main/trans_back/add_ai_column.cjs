const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

const sql = `
ALTER TABLE fuel_records
ADD COLUMN IF NOT EXISTS ai_extraction jsonb;
`;

async function runSQL() {
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.error("RPC exec_sql failed:", error);
    const { data: d2, error: e2 } = await supabase.rpc('execute_sql', { sql: sql });
    if (e2) {
      console.error("RPC execute_sql failed:", e2);
      console.log("Could not find a way to execute SQL via RPC. Using psql or REST might be needed.");
    } else {
      console.log("Executed successfully with execute_sql:", d2);
    }
  } else {
    console.log("Executed successfully with exec_sql:", data);
  }
}

runSQL();
