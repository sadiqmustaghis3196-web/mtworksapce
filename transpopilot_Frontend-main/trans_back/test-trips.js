import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: integrations, error } = await supabase
        .from('fleet_integrations')
        .select('*')
        .eq('provider_id', 'geotab')
        .eq('status', 'connected')
        .limit(1);

    if (error || !integrations || integrations.length === 0) {
        console.error("Could not find a connected geotab integration:", error);
        return;
    }

    const orgId = integrations[0].organization_id;
    console.log(`Using Organization ID: ${orgId}`);

    console.log("Calling /api/vehicle-trips...");
    try {
        const start = Date.now();
        const res = await axios.post('http://localhost:5000/api/vehicle-trips', {
            organizationId: orgId,
            driverId: 'Demo - 17',
            days: 7
        });
        const end = Date.now();
        console.log(`Response received in ${end - start}ms`);
        console.log(`Data length:`, res.data.data ? res.data.data.length : 0);
        if (res.data.debug) {
            console.log(`Debug Info:`, res.data.debug);
        }
    } catch (err) {
        console.error("API Call Error:", err.message);
    }
}

run();
