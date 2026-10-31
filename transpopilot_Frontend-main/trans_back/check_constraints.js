import { supabase } from './config/supabase.js';

async function checkConstraints() {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conname LIKE '%organization%';
    `
  });
  console.log("Constraints:", data || error);
}

checkConstraints();
