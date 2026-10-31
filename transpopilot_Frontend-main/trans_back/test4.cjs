const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const supabase = createClient('https://zmgxveuiyqmajxtyskwo.supabase.co', 'REPLACE_WITH_SUPABASE_KEY');

async function test() {
    let { data: integrations, error } = await supabase.from('fleet_integrations').select('*').eq('provider_id', 'geotab').eq('status', 'connected');
    
    for (const integration of integrations) {
        const credentials = integration.credentials;
        async function callG(payload) {
            const serverPath = credentials.serverPath || 'my.geotab.com';
            const url = `https://${serverPath}/apiv1`;
            payload.params.credentials = credentials;
            try {
                const res = await axios.post(url, payload);
                return res;
            } catch(e) { return { data: { result: [] } }; }
        }

        const byName = await callG({ method: 'Get', params: { typeName: 'Device' } });
        const allDevices = byName.data?.result || [];
        console.log(`Org: ${integration.organization_id}, DB: ${credentials.database}, Devices: ${allDevices.length}`);
        if (allDevices.length > 0) {
            console.log('Sample device names:');
            allDevices.slice(0, 10).forEach(d => console.log(`ID: ${d.id}, Name: ${d.name}`));
            
            // Test Demo - 17
            const demo17 = allDevices.find(d => d.name === 'Demo - 17');
            if (demo17) {
                console.log('FOUND Demo - 17! ID:', demo17.id);
                
                const days = 7;
                const toDate = new Date();
                const fromDate = new Date();
                fromDate.setDate(toDate.getDate() - days);

                const tripsRes = await callG({
                    method: 'Get',
                    params: {
                        typeName: 'Trip',
                        search: { deviceSearch: { id: demo17.id }, fromDate: fromDate.toISOString(), toDate: toDate.toISOString() }
                    }
                });
                const trips = tripsRes.data?.result || [];
                console.log(`Raw Geotab trips returned for Demo - 17: ${trips.length}`);
                
                if (trips.length > 0) {
                    console.log(`First trip preview: ${JSON.stringify(trips[0]).substring(0, 200)}`);
                }
            } else {
                 console.log('Demo - 17 NOT FOUND in this org.');
            }
            console.log('-----------------');
        }
    }
}

test().catch(console.error);
