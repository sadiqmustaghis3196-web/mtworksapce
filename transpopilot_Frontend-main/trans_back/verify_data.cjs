const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function check() {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    
    const { count: tCount } = await supabase.from('vehicle_trips').select('*', { count: 'exact', head: true });
    const { count: gCount } = await supabase.from('trip_gps_points').select('*', { count: 'exact', head: true });
    
    let allTrips = [];
    let page = 0;
    while(true) {
        const { data: trips } = await supabase.from('vehicle_trips').select('vehicle_name, provider_trip_id, id').range(page*1000, (page+1)*1000-1);
        if(!trips || trips.length === 0) break;
        allTrips = allTrips.concat(trips);
        page++;
    }
    
    const byVehicle = {};
    for(const t of allTrips) {
        if(!byVehicle[t.vehicle_name]) byVehicle[t.vehicle_name] = { trips: 0 };
        byVehicle[t.vehicle_name].trips++;
    }
    
    const devicesWithTrips = Object.keys(byVehicle).length;
    
    console.log(`\n--- Supabase Verification ---`);
    console.log(`Total Trips: ${tCount}`);
    console.log(`Total GPS Points: ${gCount}`);
    console.log(`Devices with Trips (in DB): ${devicesWithTrips}`);
    console.log(`Trips Grouped by Vehicle:`);
    for(const k of Object.keys(byVehicle)) {
        console.log(`  - ${k}: ${byVehicle[k].trips} trips`);
    }

    if (allTrips.length > 3) {
        const sampleTrips = allTrips.slice(0, 3);
        console.log(`\n--- Verifying Routes for 3 Trips ---`);
        for (const t of sampleTrips) {
            const { data: pts } = await supabase.from('trip_gps_points').select('latitude, longitude').eq('trip_id', t.provider_trip_id).limit(5);
            console.log(`Trip ${t.provider_trip_id} (Vehicle ${t.vehicle_name}) has ${pts ? pts.length : 0} GPS points in first page.`);
        }
    }
}
check();
