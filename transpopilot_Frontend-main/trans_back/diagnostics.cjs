const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnostics() {
    console.log("Starting diagnostics...");
    const orgId = 'f52120ba-ea09-4a9e-9887-c852b9f1944a'; 

    const { data: integrations } = await supabase
        .from('fleet_integrations')
        .select('*')
        .eq('organization_id', orgId)
        .eq('status', 'connected');

    const geotabInt = integrations.find(i => i.provider_id === 'geotab');
    if (!geotabInt) {
        console.log("No Geotab integration found.");
        return;
    }

    console.log("Authenticating Geotab...");
    const authRes = await axios.post(`https://my.geotab.com/apiv1`, {
        method: "Authenticate",
        params: {
            database: geotabInt.credentials.database,
            userName: geotabInt.credentials.username,
            password: geotabInt.credentials.password
        }
    });
    
    if (authRes.data.error) {
        console.log("Geotab authentication failed: ", authRes.data.error.message);
        return;
    }
    
    const creds = authRes.data.result.credentials;
    const serverPath = authRes.data.result.path === "ThisServer" ? "my.geotab.com" : authRes.data.result.path;

    async function callGeotabApi(method, params) {
        return axios.post(`https://${serverPath}/apiv1`, {
            method: method,
            params: {
                credentials: creds,
                ...params
            }
        });
    }

    const res = await callGeotabApi("Get", { typeName: "Device" });
    const devices = res.data.result || [];
    console.log(`1. Total Geotab devices returned from the API: ${devices.length}`);

    console.log("2. Exact IDs and names of all devices returned:");
    devices.forEach(d => console.log(`   - ID: ${d.id}, Name: ${d.name}`));

    let skippedCount = 0;
    const skippedReasons = [];
    const stats = {};

    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - 20); // 20 days

    console.log("\nFetching trips for each device (processing sequentially)...");
    
    let processed = 0;
    for (const d of devices) {
        processed++;
        stats[d.id] = { name: d.name, tripsFetched: 0, tripsInserted: 0, gpsPointsInserted: 0, apiError: null };
        console.log(`Processing device ${processed}/${devices.length}: ${d.name} (${d.id})`);
        
        try {
            const tripsRes = await callGeotabApi("Get", {
                typeName: "Trip", search: { deviceSearch: { id: d.id }, fromDate: fromDate.toISOString(), toDate: toDate.toISOString() } 
            });
            
            if (!tripsRes.data || !tripsRes.data.result) {
                skippedCount++;
                skippedReasons.push({ id: d.id, name: d.name, reason: "No trips array in response" });
                continue;
            }
            
            const trips = tripsRes.data.result;
            stats[d.id].tripsFetched = trips.length;
            
            if (trips.length === 0) {
                skippedCount++;
                skippedReasons.push({ id: d.id, name: d.name, reason: "0 trips fetched for the date range" });
            } else {
                const { count: dbTrips } = await supabase.from('vehicle_trips').select('*', { count: 'exact', head: true })
                    .eq('organization_id', orgId).eq('vehicle_id', d.id);
                stats[d.id].tripsInserted = dbTrips;
                
                const { data: dbTripsData } = await supabase.from('vehicle_trips').select('provider_trip_id')
                    .eq('organization_id', orgId).eq('vehicle_id', d.id);
                
                if (dbTripsData && dbTripsData.length > 0) {
                    const tripIds = dbTripsData.map(t => t.provider_trip_id);
                    const { count: gpsCount } = await supabase.from('trip_gps_points').select('*', { count: 'exact', head: true })
                        .in('trip_id', tripIds);
                    stats[d.id].gpsPointsInserted = gpsCount;
                } else {
                    stats[d.id].gpsPointsInserted = 0;
                }
            }

        } catch (e) {
            skippedCount++;
            skippedReasons.push({ id: d.id, name: d.name, reason: `API Error: ${e.message}` });
            stats[d.id].apiError = e.message;
        }
    }

    console.log(`\n3. Number of devices skipped (or 0 trips): ${skippedCount}`);
    console.log("4. Exact reason each skipped device is skipped:");
    skippedReasons.forEach(r => console.log(`   - ${r.name} (${r.id}): ${r.reason}`));

    console.log("\n5/6/7/8. Vehicle Stats:");
    Object.values(stats).forEach(s => {
        console.log(`   - ${s.name}: Fetched=${s.tripsFetched}, Inserted=${s.tripsInserted}, GPS Inserted=${s.gpsPointsInserted}, Err=${s.apiError || 'None'}`);
    });
}

runDiagnostics().catch(console.error);
