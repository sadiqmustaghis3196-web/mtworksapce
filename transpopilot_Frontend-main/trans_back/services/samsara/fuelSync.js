import { fetchAllSamsaraPages } from "./samsaraApi.js";
import { syncSamsaraVehicles } from "./vehicleSync.js";
import { supabase } from "../../config/supabase.js";
import { createStats, addError, chunkArray, stableId, getErrorMessage } from "../../utils/helpers.js";

export async function syncSamsaraFuel(
  organizationId,
  credentials,
  from,
  to,
  existingVehicleMap = null
) {
  const stats = createStats();

  try {
    console.log(`[Samsara Fuel] ${from.toISOString()} → ${to.toISOString()}`);

    let deviceToLocalVehicle = existingVehicleMap;

    if (!deviceToLocalVehicle) {
      const vehicleSync = await syncSamsaraVehicles(organizationId, credentials);
      deviceToLocalVehicle = vehicleSync.deviceToLocalVehicle;
    }

    // Samsara doesn't expose a GET endpoint for discrete "fuel purchases/fill-ups" like Geotab does.
    // Instead, we fetch raw telematics (fuelPercent and obdOdometerMeters) and look for positive jumps
    // in fuelPercent to derive "fill-up events".
    const rawStats = await fetchAllSamsaraPages(credentials.apiKey, "/fleet/vehicles/stats/history", {
      startTime: from.toISOString(),
      endTime: to.toISOString(),
      types: "fuelPercents,obdOdometerMeters"
    });

    stats.fetched = rawStats.length;
    console.log(`[Samsara Fuel] Fetched stats for ${stats.fetched} vehicles`);

    if (!rawStats.length) {
      return stats;
    }

    const uniquePayload = new Map();

    for (const vehicleStats of rawStats) {
      try {
        const deviceId = stableId(vehicleStats.id);
        if (!deviceId) continue;

        const vehicleId = deviceToLocalVehicle.get(deviceId);
        if (!vehicleId) {
          console.warn(`[Samsara Fuel] Vehicle mapping missing for device ${deviceId}`);
          continue;
        }

        const fuelReadings = vehicleStats.fuelPercents || [];
        const odometerReadings = vehicleStats.obdOdometerMeters || [];
        
        if (fuelReadings.length < 2) continue; // Need at least 2 readings to detect a jump

        // Sort by time just in case
        fuelReadings.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        let lastFuelPercent = fuelReadings[0].value;
        
        for (let i = 1; i < fuelReadings.length; i++) {
          const reading = fuelReadings[i];
          const currentPercent = reading.value;
          
          // Detect a jump of at least 10% to count as a fill-up
          if (currentPercent - lastFuelPercent > 10) {
            const transactionDate = reading.time;
            const normalizedDate = new Date(transactionDate).toISOString();
            const duplicateKey = `${vehicleId}|${normalizedDate}`;
            
            // We don't know the exact gallons from fuel percent without tank capacity.
            // We can estimate or just provide a placeholder / use mpg calculations.
            // For now, we record the jump percentage as a reference, but we must map to 'gallons' 
            // since that's what the schema requires. We'll estimate based on a standard 100-gal tank.
            const estimatedGallons = (currentPercent - lastFuelPercent) / 100 * 100; // Assuming 100 gallon tank

            // Find closest odometer reading
            let odometer = null;
            if (odometerReadings.length > 0) {
              const readingTime = new Date(transactionDate).getTime();
              // Find the closest odometer reading in time
              const closestOdo = odometerReadings.reduce((prev, curr) => {
                return (Math.abs(new Date(curr.time).getTime() - readingTime) < Math.abs(new Date(prev.time).getTime() - readingTime) ? curr : prev);
              });
              odometer = Number(closestOdo.value) * 0.000621371; // Convert Meters to Miles
            }

            uniquePayload.set(duplicateKey, {
              organization_id: organizationId,
              vehicle_id: vehicleId,
              transaction_date: normalizedDate,
              gallons: estimatedGallons,
              cost_per_gallon: 0, // Unknown
              total_cost: 0, // Unknown
              odometer_reading: odometer,
              location: null,
              mpg: null, // Hard to calculate accurate MPG just from a single jump without previous fill-up distance
              created_at: new Date().toISOString()
            });
            
            stats.mapped += 1;
          }
          
          lastFuelPercent = currentPercent;
        }

      } catch (rowError) {
        stats.failed += 1;
        console.error("[Samsara Fuel Row Error]", getErrorMessage(rowError));
      }
    }

    const rows = Array.from(uniquePayload.values());
    console.log(`[Samsara Fuel] unique payload: ${rows.length}`);

    for (const chunk of chunkArray(rows, 500)) {
      const vehicleIds = [...new Set(chunk.map(r => r.vehicle_id))];
      
      const { data: existingRecords } = await supabase
        .from("fuel_records")
        .select("vehicle_id, transaction_date")
        .in("vehicle_id", vehicleIds);

      const existingSet = new Set(
        (existingRecords || []).map(r => `${r.vehicle_id}_${new Date(r.transaction_date).getTime()}`)
      );

      let insertedInChunk = 0;
      let skippedInChunk = 0;

      for (const row of chunk) {
        const key = `${row.vehicle_id}_${new Date(row.transaction_date).getTime()}`;
        if (existingSet.has(key)) {
          skippedInChunk++;
        } else {
          insertedInChunk++;
        }
      }

      const { error } = await supabase
        .from("fuel_records")
        .upsert(chunk, {
          onConflict: "vehicle_id,transaction_date",
          ignoreDuplicates: true
        });

      if (error) {
        throw new Error(`[Supabase Fuel Upsert] ${error.message}`);
      }

      stats.inserted += insertedInChunk;
      stats.skipped += skippedInChunk;
    }

    console.log(
      `[Samsara Fuel] RESULT Fetched=${stats.fetched} Mapped=${stats.mapped} Inserted=${stats.inserted} Skipped=${stats.skipped}`
    );

    return stats;
  } catch (error) {
    addError(stats, error);
    throw error;
  }
}
