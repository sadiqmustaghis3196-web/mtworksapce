const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const supabase = createClient('https://zmgxveuiyqmajxtyskwo.supabase.co', 'REPLACE_WITH_SUPABASE_KEY');

async function getGeotabSession(credentialsObj) {
    const auth = await axios.post("https://my.geotab.com/apiv1", {
        method: "Authenticate",
        params: { userName: credentialsObj.username, password: credentialsObj.password, database: credentialsObj.database }
    });
    if (auth.data.error) throw new Error("Geotab Auth Failed: " + auth.data.error.message);
    const credentials = auth.data.result.credentials;
    const serverPath = auth.data.result.path === "ThisServer" ? "my.geotab.com" : auth.data.result.path;
    return { credentials, serverPath };
}

async function test() {
    const organizationId = 'bcf1d0f5-4dc0-4352-be7f-0b32f22b9b55';
    let { data: integrations, error } = await supabase.from('fleet_integrations').select('*').eq('organization_id', organizationId).eq('status', 'connected');
    if (!integrations || integrations.length === 0) {
        integrations = (await supabase.from('fleet_integrations').select('*').eq('status', 'connected')).data;
    }
    const integration = integrations.find(p => p.provider_id === 'geotab');
    const session = await getGeotabSession(integration.credentials);

    async function callG(payload) {
        payload.params.credentials = session.credentials;
        const res = await axios.post(`https://${session.serverPath}/apiv1`, payload);
        return res;
    }

    const testDriver = async (driverId) => {
        console.log('\n=======================================');
        console.log('Testing driver:', driverId);
        const days = 7;
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(toDate.getDate() - days);
        console.log(`Calculated Date Range: from ${fromDate.toISOString()} to ${toDate.toISOString()}`);

        const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetNormalized = normalize(driverId);
        
        const byName = await callG({ method: 'Get', params: { typeName: 'Device' } });
        const allDevices = byName.data.result || [];
        
        let realId = null;
        let matchedName = null;
        for (const d of allDevices) {
            if (d.name && normalize(d.name) === targetNormalized) {
                realId = d.id;
                matchedName = d.name;
                break;
            }
        }
        if (!realId) {
            for (const d of allDevices) {
                if (d.id === driverId) {
                    realId = d.id;
                    matchedName = d.name;
                    break;
                }
            }
        }

        console.log(`Matched Geotab Device ID: ${realId || 'NONE'}, Name: ${matchedName || 'NONE'}`);

        if (realId) {
            const tripsRes = await callG({
                method: 'Get',
                params: {
                    typeName: 'Trip',
                    search: { deviceSearch: { id: realId }, fromDate: fromDate.toISOString(), toDate: toDate.toISOString() }
                }
            });
            const trips = tripsRes.data.result || [];
            console.log(`Raw Geotab trips returned: ${trips.length}`);
            if (trips.length > 0) {
                console.log(`First trip preview: ${JSON.stringify(trips[0]).substring(0, 300)}`);
            } else {
                console.log('No trips found in this date range.');
            }
        }
    };

    await testDriver('Demo - 01');
    await testDriver('Demo - 17');
}

test().catch(console.error);
