const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function runVerification() {
    console.log("1. Finding Orgs with Geotab integrations...");
    // test_reset.cjs used fleet_integrations with provider_id? Let's check fuel_records to find orgs that already have fuel.
    const { data: existingFuel } = await supabase.from('fuel_records').select('organization_id, provider').not('provider', 'is', null).limit(10);
    
    let geotabOrg = existingFuel.find(f => f.provider === 'geotab')?.organization_id;
    let samsaraOrg = existingFuel.find(f => f.provider === 'samsara')?.organization_id;

    if (!geotabOrg && !samsaraOrg) {
        // Fallback to getting any org
        const { data: anyOrg } = await supabase.from('organizations').select('id').limit(1);
        if (anyOrg && anyOrg.length > 0) geotabOrg = anyOrg[0].id;
    }

    if (geotabOrg) {
        console.log(`- Testing Sync for Org: ${geotabOrg}`);
        
        // Count before
        const { count: countBefore } = await supabase.from('fuel_records').select('*', { count: 'exact', head: true }).eq('organization_id', geotabOrg);
        console.log(`  Records before sync: ${countBefore}`);

        try {
            console.log("  Running Sync via /api/sync-fuel...");
            const res = await axios.post('http://localhost:5000/api/sync-fuel', {
                organizationId: geotabOrg
            });
            console.log("  Sync Response:", res.data);
        } catch (err) {
            console.error("  Sync Error:", err.response ? err.response.data : err.message);
        }

        // Count after
        const { count: countAfter } = await supabase.from('fuel_records').select('*', { count: 'exact', head: true }).eq('organization_id', geotabOrg);
        console.log(`  Records after sync: ${countAfter} (Diff: ${countAfter - countBefore})`);
    }

    console.log("\n2. Checking data_source NULL status for existing telematics records...");
    const { data: nullCheck, error: nullErr } = await supabase.from('fuel_records')
        .select('id, data_source, provider')
        .in('provider', ['geotab', 'samsara'])
        .limit(5);

    if (nullErr) {
        console.error("  Error querying fuel_records:", nullErr.message);
    } else {
        console.log("  Sample telematics fuel records:");
        nullCheck.forEach(r => {
            console.log(`  ID: ${r.id} | Provider: ${r.provider} | data_source: ${r.data_source === null ? 'NULL' : `'${r.data_source}'`}`);
        });
        
        // Count total non-null for telematics
        const { count: nonNullCount } = await supabase.from('fuel_records')
            .select('*', { count: 'exact', head: true })
            .in('provider', ['geotab', 'samsara'])
            .not('data_source', 'is', null);
            
        console.log(`  Total telematics rows with non-NULL data_source: ${nonNullCount}`);
    }
}

runVerification();
