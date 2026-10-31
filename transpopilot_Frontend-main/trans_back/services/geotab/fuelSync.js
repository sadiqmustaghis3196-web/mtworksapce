import { callGeotabApi } from "./geotabApi.js";
import { syncGeotabVehicles } from "./vehicleSync.js";
import { supabase } from "../../config/supabase.js";
import { createStats, addError, chunkArray, stableId, getErrorMessage } from "../../utils/helpers.js";

export async function syncGeotabFuel(
  organizationId,
  credentials,
  from,
  to,
  existingVehicleMap = null
) {
  const stats = createStats();

  try {
    console.log(`[Geotab Fuel] ${from.toISOString()} → ${to.toISOString()}`);

    const rawFuel = await callGeotabApi(
      organizationId,
      credentials,
      {
        method: "Get",
        params: {
          typeName: "FillUp",
          search: {
            fromDate: from.toISOString(),
            toDate: to.toISOString()
          },
          resultsLimit: 50000
        }
      }
    );

    stats.fetched = rawFuel.length;
    console.log(`[Geotab Fuel] Fetched ${stats.fetched}`);

    if (!rawFuel.length) {
      return stats;
    }

    let deviceToLocalVehicle = existingVehicleMap;

    if (!deviceToLocalVehicle) {
      const vehicleSync = await syncGeotabVehicles(organizationId, credentials);
      deviceToLocalVehicle = vehicleSync.deviceToLocalVehicle;
    }

    const uniquePayload = new Map();

    for (const fuel of rawFuel) {
      try {
        const deviceId = stableId(fuel.device?.id || fuel.deviceId);
        if (!deviceId) {
          stats.skipped += 1;
          continue;
        }

        const vehicleId = deviceToLocalVehicle.get(deviceId);
        if (!vehicleId) {
          stats.skipped += 1;
          console.warn(`[Geotab Fuel] Vehicle mapping missing for device ${deviceId}`);
          continue;
        }

        const transactionDate = fuel.dateTime || fuel.date || fuel.transactionDate;
        if (!transactionDate) {
          stats.skipped += 1;
          continue;
        }

        const normalizedDate = new Date(transactionDate).toISOString();
        const duplicateKey = `${vehicleId}|${normalizedDate}`;

        // Geotab natively returns volume in Liters. We need Gallons.
        const rawVolumeLiters = Number(fuel.volume ?? fuel.fuelVolume ?? fuel.totalFuelUsed ?? 0);
        const volume = rawVolumeLiters * 0.264172; // Convert Liters to Gallons
        
        const cost = Number(fuel.cost ?? fuel.totalCost ?? 0);
        
        let odometer = null;
        if (fuel.odometer !== undefined && fuel.odometer !== null) {
          // Geotab odometer is usually in meters
          odometer = Number(fuel.odometer) * 0.000621371; // Convert Meters to Miles
        }
        
        let location = null;
        if (fuel.location?.x !== undefined && fuel.location?.y !== undefined) {
          location = `${fuel.location.x},${fuel.location.y}`;
        }

        let mpg = null;
        const rawDistanceMeters = fuel.distance;
        if (
          rawDistanceMeters !== undefined &&
          rawDistanceMeters !== null &&
          rawDistanceMeters > 0 &&
          volume > 0
        ) {
          const distanceMiles = rawDistanceMeters * 0.000621371;
          const calculatedMpg = distanceMiles / volume;
          if (calculatedMpg > 0 && calculatedMpg < 300) {
            mpg = calculatedMpg;
          }
        }

        if (uniquePayload.has(duplicateKey)) {
          const existing = uniquePayload.get(duplicateKey);
          uniquePayload.set(duplicateKey, {
            ...existing,
            gallons: Math.max(existing.gallons, volume),
            total_cost: Math.max(existing.total_cost, cost),
            odometer_reading: odometer || existing.odometer_reading,
            mpg: mpg || existing.mpg,
          });
          continue;
        }

        uniquePayload.set(duplicateKey, {
          organization_id: organizationId,
          vehicle_id: vehicleId,
          transaction_date: normalizedDate,
          gallons: volume,
          cost_per_gallon: volume > 0 ? cost / volume : 0,
          total_cost: cost,
          odometer_reading: odometer,
          location,
          mpg: mpg,
          created_at: new Date().toISOString()
        });

        stats.mapped += 1;
      } catch (rowError) {
        stats.failed += 1;
        console.error("[Geotab Fuel Row Error]", getErrorMessage(rowError));
      }
    }

    const rows = Array.from(uniquePayload.values());
    console.log(`[Geotab Fuel] unique payload: ${rows.length}`);

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
      `[Geotab Fuel] RESULT Fetched=${stats.fetched} Mapped=${stats.mapped} Inserted=${stats.inserted} Skipped=${stats.skipped}`
    );

    return stats;
  } catch (error) {
    addError(stats, error);
    throw error;
  }
}
