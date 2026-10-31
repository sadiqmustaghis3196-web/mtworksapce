import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log("Checking vehicle_trips...");
    const { data: vtData, error: vtErr } = await supabase.from('vehicle_trips').select('id').limit(1);
    if (vtErr) {
        console.error("vehicle_trips error:", vtErr);
    } else {
        console.log("vehicle_trips exists!");
    }

    console.log("Checking trip_gps_points...");
    const { data: gpsData, error: gpsErr } = await supabase.from('trip_gps_points').select('id').limit(1);
    if (gpsErr) {
        console.error("trip_gps_points error:", gpsErr);
    } else {
        console.log("trip_gps_points exists!");
    }
}

checkTables();
