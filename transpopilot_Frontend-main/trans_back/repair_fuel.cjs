const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function repairFuelEconomy() {
    console.log("=== Fuel Economy Backfill Script ===");
    
    // 1. Fetch all fuel records grouped by vehicle_id, ordered chronologically
    const { data: records, error } = await supabase
        .from('fuel_records')
        .select('id, vehicle_id, transaction_date, odometer_reading, gallons, mpg')
        .order('vehicle_id', { ascending: true })
        .order('transaction_date', { ascending: true });

    if (error) {
        console.error("Error fetching fuel records:", error);
        return;
    }

    if (!records || records.length === 0) {
        console.log("No fuel records found.");
        return;
    }

    console.log(`Fetched ${records.length} total fuel records.`);

    let successfulCalculations = 0;
    let missingData = 0;
    let impossibleMpg = 0;
    const updates = [];

    // Group records by vehicle to process chronologically
    const byVehicle = {};
    for (const record of records) {
        if (!byVehicle[record.vehicle_id]) {
            byVehicle[record.vehicle_id] = [];
        }
        byVehicle[record.vehicle_id].push(record);
    }

    // 2. Process each vehicle's timeline
    for (const [vehicleId, vehicleRecords] of Object.entries(byVehicle)) {
        let prevOdometer = null;
        
        for (let i = 0; i < vehicleRecords.length; i++) {
            const current = vehicleRecords[i];
            
            let calculatedMpg = null;

            // If it already has valid MPG, keep it
            if (current.mpg > 0) {
                prevOdometer = current.odometer_reading;
                continue;
            }

            if (current.odometer_reading && current.odometer_reading > 0 && current.gallons && current.gallons > 0) {
                if (prevOdometer !== null && prevOdometer > 0) {
                    const distanceMiles = current.odometer_reading - prevOdometer;
                    
                    // Validate distance
                    if (distanceMiles > 0 && distanceMiles < 5000) {
                        const mpg = distanceMiles / current.gallons;
                        
                        // Validate realistic MPG (e.g. 1 to 300 MPG)
                        if (mpg >= 1 && mpg < 300) {
                            calculatedMpg = mpg;
                            successfulCalculations++;
                        } else {
                            impossibleMpg++;
                        }
                    } else {
                        impossibleMpg++;
                    }
                } else {
                    missingData++;
                }
            } else {
                missingData++;
            }

            if (calculatedMpg !== null && calculatedMpg !== current.mpg) {
                updates.push({
                    id: current.id,
                    mpg: calculatedMpg
                });
            }

            // Always update prevOdometer for the next record
            if (current.odometer_reading && current.odometer_reading > 0) {
                prevOdometer = current.odometer_reading;
            }
        }
    }

    console.log(`Ready to update ${updates.length} records.`);
    console.log(`Successfully calculated: ${successfulCalculations}`);
    console.log(`Missing data (no prev odo/volume): ${missingData}`);
    console.log(`Impossible MPG (distance negative/huge): ${impossibleMpg}`);

    // 3. Batch Update
    const chunkSize = 500;
    for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        
        // Supabase upsert requires the full unique key or PK
        // We only have PK 'id', so we must do it via upsert or update. 
        // Using upsert requires all NOT NULL fields unless we only update specifically.
        // It's safer to loop update if it's just a few, but we can do a Promise.all
        const promises = chunk.map(u => 
            supabase.from('fuel_records').update({ mpg: u.mpg }).eq('id', u.id)
        );
        
        await Promise.all(promises);
        console.log(`Updated batch ${Math.floor(i/chunkSize) + 1}`);
    }

    console.log("=== Backfill Complete ===");
}

repairFuelEconomy();
