const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function count() {
    const { count, error } = await supabase.from('fuel_records').select('*', { count: 'exact', head: true });
    if (error) console.error(error);
    console.log(`Total fuel_records in DB: ${count}`);
    
    // Select one
    const { data } = await supabase.from('fuel_records').select('*').limit(1);
    console.log(data);
}
count();
