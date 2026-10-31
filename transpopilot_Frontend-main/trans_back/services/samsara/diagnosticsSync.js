import { callSamsaraApi, fetchAllSamsaraPages } from "./samsaraApi.js";
import { syncSamsaraVehicles } from "./vehicleSync.js";
import { supabase } from "../../config/supabase.js";
import { createStats, addError, chunkArray, stableId } from "../../utils/helpers.js";

export async function syncSamsaraDiagnostics(
  organizationId,
  credentials,
  from,
  to,
  existingVehicleMap = null
) {
  const stats = createStats();

  try {
    console.log(`[Samsara Diagnostics] Syncing for org ${organizationId}`);

    let deviceToLocalVehicle = existingVehicleMap;
    if (!deviceToLocalVehicle) {
      const vehicleSync = await syncSamsaraVehicles(organizationId, credentials);
      deviceToLocalVehicle = vehicleSync.deviceToLocalVehicle;
    }

    const { apiKey } = credentials;

    // We can fetch vehicle IDs first or fetch stats directly.
    // Assuming we fetch stats for all vehicles using /fleet/vehicles/stats
    // This API allows passing types.
    // In our test, there was an empty array.
    const rawStats = await fetchAllSamsaraPages(apiKey, "/fleet/vehicles/stats", {
      types: "engineStates,obdEngineSeconds,faultCodes,obdOdometerMeters"
    });

    stats.fetched = rawStats.length;
    console.log(`[Samsara Diagnostics] Fetched ${rawStats.length} vehicle stats`);

    if (!rawStats.length) {
      return stats;
    }

    const diagnosticsByVehicle = new Map();

    const getVehicleRow = (deviceId) => {
      const vId = deviceToLocalVehicle.get(stableId(deviceId));
      if (!vId) return null;
      if (!diagnosticsByVehicle.has(vId)) {
        diagnosticsByVehicle.set(vId, {
          vehicle_id: vId,
          organization_id: organizationId,
          dtc_codes: [],
          battery_voltage: null,
          coolant_temp: null,
          fuel_level: null, // Often requires separate endpoint or type
          engine_hours: null,
          recorded_at: new Date().toISOString()
        });
      }
      return diagnosticsByVehicle.get(vId);
    };

    for (const vehicleStat of rawStats) {
      const deviceId = vehicleStat.id;
      const row = getVehicleRow(deviceId);
      if (!row) continue;

      if (vehicleStat.faultCodes && vehicleStat.faultCodes.length > 0) {
        // Collect active faults
        for (const faultCodeGroup of vehicleStat.faultCodes) {
           if (faultCodeGroup.j1939 && faultCodeGroup.j1939.activeFaultCodes) {
              for (const code of faultCodeGroup.j1939.activeFaultCodes) {
                row.dtc_codes.push(code);
              }
           }
        }
      }

      if (vehicleStat.obdEngineSeconds) {
        row.engine_hours = vehicleStat.obdEngineSeconds.value / 3600;
      }
      
      // Could also map engineStates if we need active running status, but not strictly a diagnostic score metric
    }

    const rows = Array.from(diagnosticsByVehicle.values());
    stats.mapped = rows.length;

    if (rows.length > 0) {
      for (const chunk of chunkArray(rows, 500)) {
        const { error } = await supabase
          .from("vehicle_diagnostics")
          .insert(chunk);

        if (error) {
          throw new Error(`[Supabase Diagnostics Insert] ${error.message}`);
        }
        stats.inserted += chunk.length;
      }
    }

    console.log(
      `[Samsara Diagnostics] RESULT Fetched=${stats.fetched} Mapped=${stats.mapped} Inserted=${stats.inserted}`
    );

    return stats;
  } catch (error) {
    addError(stats, error);
    throw error;
  }
}
