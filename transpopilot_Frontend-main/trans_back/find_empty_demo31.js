import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function getGeotabSession(organizationId, credentialsObj) {
    const auth = await axios.post("https://my.geotab.com/apiv1", {
        method: "Authenticate",
        params: { userName: credentialsObj.username, password: credentialsObj.password, database: credentialsObj.database }
    });
    return auth.data.result;
}

async function callGeotabApi(session, payload) {
    payload.params = payload.params || {};
    payload.params.credentials = session.credentials;
    const res = await axios.post(`https://${session.path === "ThisServer" ? "my.geotab.com" : session.path}/apiv1`, payload);
    return res.data;
}

async function run() {
    const { data: integrations } = await supabase.from('fleet_integrations').select('*').eq('provider_id', 'geotab').eq('status', 'connected').limit(1);
    const orgId = integrations[0].organization_id;
    const credentials = integrations[0].credentials;
    
    const session = await getGeotabSession(orgId, credentials);
    
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - 7 * 24 * 3600 * 1000); // 7 days
    
    console.log("Fetching devices...");
    const devRes = await callGeotabApi(session, {
        method: "Get",
        params: { typeName: "Device" }
    });
    
    const demo31 = (devRes.result || []).find(d => d.name === "Demo - 31");
    if (!demo31) {
        console.log("Demo - 31 not found.");
        return;
    }
    
    console.log("Fetching trips for Demo - 31...");
    const tripRes = await callGeotabApi(session, {
        method: "Get",
        params: { typeName: "Trip", search: { deviceSearch: { id: demo31.id }, fromDate: fromDate.toISOString(), toDate: toDate.toISOString() } }
    });
    
    const trips = tripRes.result || [];
    for (const trip of trips) {
        const logRes = await callGeotabApi(session, {
            method: "Get",
            params: { typeName: "LogRecord", search: { deviceSearch: { id: trip.device.id }, fromDate: trip.start, toDate: trip.stop } }
        });
        const logs = logRes.result || [];
        if (logs.length === 0) {
            console.log(`\nFound Trip with 0 logs! Trip ID: ${trip.id}, Distance: ${trip.distance}`);
            console.log("Trip object:", JSON.stringify(trip, null, 2));
            
            // Try fetching ExceptionEvent
            const excRes = await callGeotabApi(session, {
                method: "Get",
                params: { typeName: "ExceptionEvent", search: { deviceSearch: { id: trip.device.id }, fromDate: trip.start, toDate: trip.stop } }
            });
            console.log(`ExceptionEvents found: ${excRes.result ? excRes.result.length : 0}`);
            
            break;
        }
    }
}

run();
