const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCols() {
   const { data, error } = await supabase
       .from('safety_incident_reports')
       .select('provider, provider_event_id')
       .limit(1);
   
   if (error) {
       console.log("Columns likely missing:", error.message);
   } else {
       console.log("Columns exist!");
   }
}

checkCols();
