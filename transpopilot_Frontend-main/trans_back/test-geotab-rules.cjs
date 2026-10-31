const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkGeotabRules() {
    const { data: integrations } = await supabase
        .from('fleet_integrations')
        .select('provider_id, credentials')
        .eq('provider_id', 'geotab')
        .eq('status', 'connected');

    if (!integrations || integrations.length === 0) {
        console.log("No connected Geotab integrations found in DB.");
        return;
    }

    const { username, password, database } = integrations[0].credentials;
    
    // Authenticate
    const authRes = await axios.post("https://my.geotab.com/apiv1", {
        method: "Authenticate",
        params: { userName: username, password: password, database: database }
    });

    if (authRes.data.error) {
        console.error("Geotab Auth Error:", authRes.data.error);
        return;
    }

    const credentials = authRes.data.result.credentials;
    const serverPath = authRes.data.result.path === "ThisServer" ? "my.geotab.com" : authRes.data.result.path;

    // Fetch Rules
    const rulesRes = await axios.post(`https://${serverPath}/apiv1`, {
        method: "Get",
        params: {
            typeName: "Rule",
            credentials
        }
    });

    const rules = rulesRes.data.result || [];
    console.log("Total Geotab Rules Found:", rules.length);
    
    const relevantRules = rules.filter(r => 
        r.name.toLowerCase().includes('harsh') ||
        r.name.toLowerCase().includes('hard') ||
        r.name.toLowerCase().includes('brake') ||
        r.name.toLowerCase().includes('braking') ||
        r.name.toLowerCase().includes('acceleration') ||
        r.name.toLowerCase().includes('speed')
    );

    console.log("=== Configured Safety Rules ===");
    relevantRules.forEach(r => {
        console.log(`- Rule Name: "${r.name}", ID: "${r.id}", BaseType: "${r.baseType}"`);
    });
}

checkGeotabRules().catch(console.error);
