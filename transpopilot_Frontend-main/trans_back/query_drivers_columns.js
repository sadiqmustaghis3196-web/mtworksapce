import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_table_columns_info', { table_name_param: 'drivers' });
  
  if (error) {
    // If the RPC does not exist, let's try querying information_schema via SQL if allowed,
    // or just fetch a single driver and inspect its keys, or try inserting an empty object to see what fails.
    console.error("RPC Error (might not exist):", error);
    
    console.log("Trying direct query on a driver to inspect columns...");
    const { data: drivers, error: driverError } = await supabase.from('drivers').select('*').limit(1);
    if (driverError) {
      console.error("Error fetching driver:", driverError);
    } else if (drivers && drivers.length > 0) {
      console.log("Driver columns:", Object.keys(drivers[0]));
    } else {
      console.log("No drivers in DB to inspect. Trying to insert empty driver to see NOT NULL errors...");
      const { error: insertError } = await supabase.from('drivers').insert({});
      console.error("Insert empty driver error (details):", insertError);
    }
  } else {
    console.table(data);
  }
}
run();
