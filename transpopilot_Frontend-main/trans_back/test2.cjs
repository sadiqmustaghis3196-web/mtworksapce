const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const supabase = createClient('https://zmgxveuiyqmajxtyskwo.supabase.co', 'REPLACE_WITH_SUPABASE_KEY');

async function test() {
    const { data: integrations, error } = await supabase.from('fleet_integrations').select('*').eq('status', 'connected');
    console.log('Connected integrations:', integrations?.length);
    const integration = integrations.find(p => p.provider_id === 'geotab') || integrations[0];
    if (!integration) { console.log('no integration found'); return; }
    console.log('Using integration for org:', integration.organization_id);
    const credentials = integration.credentials;

    async function callG(payload) {
        const serverPath = credentials.serverPath || 'my.geotab.com';
        const url = `https://${serverPath}/apiv1`;
        payload.params.credentials = credentials;
        const res = await axios.post(url, payload);
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
                console.log(`First trip preview: ${JSON.stringify(trips[0]).substring(0, 200)}`);
            }
        }
    };

    await testDriver('Demo - 01');
    await testDriver('Demo - 17');
}

test().catch(console.error);
