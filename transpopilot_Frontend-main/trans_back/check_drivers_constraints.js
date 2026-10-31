import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Let's run a query to get unique constraints on the table 'drivers'
  const { data, error } = await supabase.rpc('get_table_constraints', { table_name_param: 'drivers' });
  
  if (error) {
    console.error("RPC Error (might not exist):", error);
    
    // Fallback: Let's fetch all records and group them by email to see if email duplicates exist
    console.log("Fetching all drivers to inspect duplicates...");
    const { data: drivers, error: fetchError } = await supabase
      .from('drivers')
      .select('id, organization_id, email, first_name, last_name');
      
    if (fetchError) {
      console.error("Fetch Error:", fetchError);
    } else {
      console.log(`Total drivers in database: ${drivers.length}`);
      const emailCounts = {};
      drivers.forEach(d => {
        emailCounts[d.email] = (emailCounts[d.email] || 0) + 1;
      });
      console.log("Email counts (to find duplicates):", emailCounts);
      console.log("Sample records:");
      console.log(drivers.slice(0, 15));
    }
  } else {
    console.table(data);
  }
}
run();
