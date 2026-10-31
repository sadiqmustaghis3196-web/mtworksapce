const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const organizationId = 'f52120ba-ea09-4a9e-9887-c852b9f1944a'; // known from previous logs

async function runTests() {
    console.log("=== PHASE 4 & 10: VERIFICATION TESTS ===");
    
    console.log("\n1. Truncating fuel_records (Simulated via DELETE loop)...");
    
    const { error: delErr } = await supabase.from('fuel_records').delete().eq('organization_id', organizationId);
    if (delErr) {
        console.error("Delete Error:", delErr);
    } else {
        console.log("Successfully deleted all records for organization.");
    }

    const { count: countAfterDel } = await supabase.from('fuel_records').select('*', { count: 'exact', head: true });
    console.log(`4. Clean database verification (Count after truncate): ${countAfterDel}`);

    console.log("\n5. Running Geotab sync (exactly 2 months rolling)...");
    try {
        const syncStart = Date.now();
        const res = await axios.post('http://localhost:5000/api/sync-fuel', {
            organizationId: organizationId
        }, { timeout: 300000 }); // 5 minutes timeout
        
        console.log(`Sync Response (Time: ${((Date.now() - syncStart) / 1000).toFixed(2)}s):`, res.data);
    } catch (err) {
        console.error("Sync Error:", err.response ? err.response.data : err.message);
    }

    console.log("\n6. Verifying inserted count...");
    const { count: finalCount } = await supabase.from('fuel_records').select('*', { count: 'exact', head: true });
    console.log(`Total fuel_records in DB: ${finalCount}`);

    console.log("\n7. Verifying date range...");
    // Fetch all dynamically to get exact dates (up to Supabase limit of 1000 if no loop, but let's loop for precision if needed. But even 1000 is enough to verify 2 months boundary)
    const { data: allDatesData } = await supabase.from('fuel_records').select('transaction_date, vehicle_id, gallons, location, mpg').limit(5000);
    
    if (allDatesData && allDatesData.length > 0) {
        const dates = allDatesData.map(r => new Date(r.transaction_date).getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        console.log(`Oldest record: ${minDate.toISOString()}`);
        console.log(`Latest record: ${maxDate.toISOString()}`);
        console.log(`Total records checked: ${allDatesData.length}`);

        console.log("\n8. Verify unique vehicles...");
        const uniqueVehicles = new Set(allDatesData.map(r => r.vehicle_id));
        console.log(`Unique vehicles: ${uniqueVehicles.size}`);

        console.log("\n9. Verify data diversity...");
        const uniqueGallons = new Set(allDatesData.map(r => r.gallons));
        const uniqueMpg = new Set(allDatesData.map(r => r.mpg));
        const uniqueLocations = new Set(allDatesData.map(r => r.location));
        
        console.log(`Unique gallons: ${uniqueGallons.size}`);
        console.log(`Unique mpg: ${uniqueMpg.size}`);
        console.log(`Unique locations: ${uniqueLocations.size}`);

        console.log("\n10. Running sync a second time for duplicate protection test...");
        try {
            await axios.post('http://localhost:5000/api/sync-fuel', {
                organizationId: organizationId
            }, { timeout: 300000 });
            console.log("Second sync completed.");
        } catch (err) {
            console.error("Second Sync Error:", err.message);
        }

        console.log("\n11. Check duplicates...");
        // Check if length increased
        const { count: doubleSyncCount } = await supabase.from('fuel_records').select('*', { count: 'exact', head: true });
        console.log(`Total fuel_records after second sync: ${doubleSyncCount}`);
        if (doubleSyncCount === finalCount) {
            console.log("Expected: No rows returned. -> Passed: No duplicates found (Counts match).");
        } else {
            console.log(`FAILED: Duplicates created! Initial count: ${finalCount}, After second sync: ${doubleSyncCount}`);
        }
    } else {
        console.log("No data returned for verification.");
    }
}

runTests();
