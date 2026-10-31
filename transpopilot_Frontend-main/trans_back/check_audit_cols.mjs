import { supabase } from './config/supabase.js';

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_table_columns_debug', { table_name: 'audit_logs' });
  if (error) {
     // fallback if RPC doesn't exist
     const { data: qData, error: qErr } = await supabase.from('audit_logs').select('*').limit(1);
     if (qErr) console.error("Error:", qErr);
     if (qData) console.log("Columns inferred from data:", qData.length ? Object.keys(qData[0]) : "Empty table, cannot infer columns.");
  } else {
     console.log("Columns from RPC:", data);
  }
}
checkColumns();
