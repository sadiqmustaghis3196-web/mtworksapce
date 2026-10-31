const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

const ORG_ID = '387cf3be-c0fe-43af-9abe-93dc55fd9be3'; // The org we used previously
const API_URL = 'http://localhost:5000/api/sync-geotab';

async function getCount(table, queryBuilder = (q) => q) {
    let query = supabase.from(table).select('*', { count: 'exact', head: true }).eq('organization_id', ORG_ID);
    query = queryBuilder(query);
    const { count, error } = await query;
    if (error) {
        if (error.code === 'PGRST204') {
            console.log(`Column missing for table ${table}, count may be inaccurate.`);
            return 0;
        }
        throw new Error(`Count error on ${table}: ${error.message}`);
    }
    return count;
}

async function getCounts() {
    return {
        // Fallback for when the provider column isn't migrated yet
        vehicles: await getCount('vehicles'),
        drivers: await getCount('drivers'),
        fuel: await getCount('fuel_records'),
        safety: await getCount('safety_incident_reports'),
        trips: await getCount('vehicle_trips')
    };
}

async function runVerification() {
    console.log("=== Geotab Sync Verification ===");
    try {
        const countsBefore = await getCounts();
        console.log("1. Counts Before Sync:", countsBefore);

        const { data: orgData } = await supabase.from('fleet_integrations')
            .select('credentials')
            .eq('organization_id', ORG_ID)
            .eq('provider_id', 'geotab')
            .limit(1);
            
        if (!orgData || orgData.length === 0 || !orgData[0].credentials) {
            console.error("Missing Geotab credentials in DB for org", ORG_ID);
            return;
        }

        const credentials = orgData[0].credentials;

        console.log("2. Running First Sync...");
        const res = await axios.post(API_URL, {
            organizationId: ORG_ID,
            username: credentials.username || credentials.email,
            password: credentials.password,
            database: credentials.database
        });

        const syncStats = res.data;
        console.log("Sync Response:", JSON.stringify(syncStats, null, 2));

        const countsAfter = await getCounts();
        console.log("3. Counts After Sync:", countsAfter);

        console.log("4. Running Second Sync (Idempotency Check)...");
        const res2 = await axios.post(API_URL, {
            organizationId: ORG_ID,
            username: credentials.username || credentials.email,
            password: credentials.password,
            database: credentials.database
        });
        
        console.log("Second Sync Response:", JSON.stringify(res2.data, null, 2));
        
        const countsAfter2 = await getCounts();
        console.log("5. Counts After Second Sync:", countsAfter2);

        // Fetch one actual vehicle ID
        const { data: vData } = await supabase.from('vehicles')
            .select('id, vehicle_number')
            .eq('organization_id', ORG_ID)
            .limit(1);

        if (vData && vData.length > 0) {
            console.log("6. Sample Vehicle Mapping:", vData[0]);
            
            console.log("7. Testing Driver Tracking Route...");
            try {
                const tripRes = await axios.post('http://localhost:5000/api/vehicle-trips', {
                    organizationId: ORG_ID,
                    vehicleId: vData[0].id,
                    from: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
                    to: new Date().toISOString()
                });
                console.log(`Trip History returned ${tripRes.data.trips?.length || 0} trips for vehicle ${vData[0].id}.`);
                if (tripRes.data.trips?.length > 0) {
                    console.log("Sample Trip GPS coords present:", tripRes.data.trips[0].start_lat !== null);
                }
            } catch (e) {
                console.error("Trip API Error:", e.response?.data || e.message);
            }
        }
        
    } catch (e) {
        console.error("Verification failed:", e.message);
    }
}

runVerification();
