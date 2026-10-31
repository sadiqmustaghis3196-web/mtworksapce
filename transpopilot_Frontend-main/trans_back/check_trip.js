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
    
    console.log("Fetching 1 trip...");
    const tripRes = await callGeotabApi(session, {
        method: "Get",
        params: { typeName: "Trip", resultsLimit: 1 }
    });
    
    if (tripRes.result && tripRes.result.length > 0) {
        console.log("Trip Object Keys:", Object.keys(tripRes.result[0]));
        console.log("Trip Object:", JSON.stringify(tripRes.result[0], null, 2));
    }
}

run();
