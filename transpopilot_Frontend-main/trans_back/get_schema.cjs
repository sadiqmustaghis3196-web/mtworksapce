const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await supabase.from('fuel_records').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    if (data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    } else {
      console.log("No data in table. Fetching columns via swagger...");
      // Supabase exposes a REST endpoint for OpenAPI
      fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/?apikey=${process.env.VITE_SUPABASE_ANON_KEY}`)
        .then(r => r.json())
        .then(schema => {
            console.log("Found definition for fuel_records:", schema.definitions.fuel_records.properties);
        })
        .catch(console.error);
    }
  }
}
checkSchema();
