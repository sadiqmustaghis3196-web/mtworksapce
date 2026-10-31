import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
   const { data } = await supabase.from('integration_settings').select('*').not('geotab_credentials', 'is', null).limit(1);
   console.log(data[0].organization_id);
}
run();
