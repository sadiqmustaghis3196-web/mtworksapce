import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const { data, error } = await sb.rpc('execute_sql', { query: `SELECT 1;` });
    if(error) {
        console.error("Error:", error);
    } else {
        console.log(data);
    }
}
test();
