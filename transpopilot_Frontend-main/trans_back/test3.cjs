const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const supabase = createClient('https://zmgxveuiyqmajxtyskwo.supabase.co', 'REPLACE_WITH_SUPABASE_KEY');

async function test() {
    // We should use the specific organizationId the user is testing with
    // The previous curl hit had "bcf1d0f5-4dc0-4352-be7f-0b32f22b9b55"
    const organizationId = 'bcf1d0f5-4dc0-4352-be7f-0b32f22b9b55';
    let { data: integrations, error } = await supabase.from('fleet_integrations').select('*').eq('organization_id', organizationId).eq('status', 'connected');
    
    // If not found, just grab any geotab
    if (!integrations || integrations.length === 0) {
        console.log("Org specific not found, getting any geotab...");
        const res = await supabase.from('fleet_integrations').select('*').eq('status', 'connected');
        integrations = res.data;
    }

    const integration = integrations.find(p => p.provider_id === 'geotab') || integrations[0];
    const credentials = integration.credentials;

    async function callG(payload) {
        const serverPath = credentials.serverPath || 'my.geotab.com';
        const url = `https://${serverPath}/apiv1`;
        payload.params.credentials = credentials;
        const res = await axios.post(url, payload);
        return res;
    }

    const byName = await callG({ method: 'Get', params: { typeName: 'Device' } });
    const allDevices = byName.data.result || [];
    console.log('Total Devices in Geotab:', allDevices.length);
    console.log('Sample device names:');
    allDevices.slice(0, 20).forEach(d => console.log(`ID: ${d.id}, Name: ${d.name}`));
}

test().catch(console.error);
