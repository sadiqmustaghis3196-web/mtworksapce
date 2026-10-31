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
    
    // First, let's fetch the specific Trip b2364403
    console.log("Fetching Trip b2364403...");
    const tripRes = await callGeotabApi(session, {
        method: "Get",
        params: { typeName: "Trip", search: { id: "b2364403" } }
    });
    
    if (tripRes.result && tripRes.result.length > 0) {
        const trip = tripRes.result[0];
        console.log("Trip data:", JSON.stringify(trip, null, 2));
        
        // Let's fetch LogRecords for this time window + 5 mins padding
        const padFrom = new Date(new Date(trip.start).getTime() - 5 * 60000).toISOString();
        const padTo = new Date(new Date(trip.stop).getTime() + 5 * 60000).toISOString();
        
        console.log(`\nFetching LogRecord for Device ${trip.device.id} from ${padFrom} to ${padTo}...`);
        const logRes = await callGeotabApi(session, {
            method: "Get",
            params: { typeName: "LogRecord", search: { deviceSearch: { id: trip.device.id }, fromDate: padFrom, toDate: padTo } }
        });
        console.log(`LogRecords found: ${logRes.result ? logRes.result.length : 0}`);
        
        console.log(`\nFetching ExceptionEvent for Device ${trip.device.id}...`);
        const excRes = await callGeotabApi(session, {
            method: "Get",
            params: { typeName: "ExceptionEvent", search: { deviceSearch: { id: trip.device.id }, fromDate: padFrom, toDate: padTo } }
        });
        console.log(`ExceptionEvents found: ${excRes.result ? excRes.result.length : 0}`);
        
        // Are there any coordinates in ExceptionEvent or another entity?
    } else {
        console.log("Trip not found.");
    }
}

run();
