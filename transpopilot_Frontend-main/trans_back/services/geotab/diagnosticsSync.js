import { callGeotabApi } from "./geotabApi.js";
import { syncGeotabVehicles } from "./vehicleSync.js";
import { supabase } from "../../config/supabase.js";
import { createStats, addError, chunkArray, stableId } from "../../utils/helpers.js";

export async function syncGeotabDiagnostics(
  organizationId,
  credentials,
  from,
  to,
  existingVehicleMap = null
) {
  const stats = createStats();

  try {
    console.log(`[Geotab Diagnostics] Syncing for org ${organizationId}`);

    let deviceToLocalVehicle = existingVehicleMap;
    if (!deviceToLocalVehicle) {
      const vehicleSync = await syncGeotabVehicles(organizationId, credentials);
      deviceToLocalVehicle = vehicleSync.deviceToLocalVehicle;
    }

    // 1. Fetch active FaultData
    const rawFaults = await callGeotabApi(
      organizationId,
      credentials,
      {
        method: "Get",
        params: {
          typeName: "FaultData",
          search: {
            fromDate: from.toISOString(),
            toDate: to.toISOString()
          },
          resultsLimit: 50000
        }
      }
    );

    // 2. Fetch StatusData (coolant, voltage, fuel, engine hours)
    // In Geotab, we query specific DiagnosticIds. 
    // EngineHours: DiagnosticEngineHoursId
    // BatteryVoltage: DiagnosticGoDeviceVoltageId
    // CoolantTemp: DiagnosticCoolantTemperatureId
    // FuelLevel: DiagnosticFuelLevelId
    const searchParams = {
      fromDate: from.toISOString(),
      toDate: to.toISOString()
    };

    const rawStatus = await callGeotabApi(
      organizationId,
      credentials,
      {
        method: "Get",
        params: {
          typeName: "StatusData",
          search: searchParams,
          resultsLimit: 50000
        }
      }
    );

    stats.fetched = rawFaults.length + rawStatus.length;
    console.log(`[Geotab Diagnostics] Fetched ${rawFaults.length} faults and ${rawStatus.length} statuses`);

    if (!rawFaults.length && !rawStatus.length) {
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
          fuel_level: null,
          engine_hours: null,
          recorded_at: new Date().toISOString()
        });
      }
      return diagnosticsByVehicle.get(vId);
    };

    for (const fault of rawFaults) {
      const row = getVehicleRow(fault.device?.id);
      if (!row) continue;
      // Filter only active faults
      if (fault.faultState !== "Active") continue;
      
      row.dtc_codes.push(fault);
    }

    for (const status of rawStatus) {
      const row = getVehicleRow(status.device?.id);
      if (!row) continue;
      
      const diagId = status.diagnostic?.id || "";
      
      // Map relevant metrics
      if (diagId === "DiagnosticGoDeviceVoltageId" || diagId === "DiagnosticOemVoltageId") {
        row.battery_voltage = status.data;
      } else if (diagId === "DiagnosticCoolantTemperatureId") {
        row.coolant_temp = status.data;
      } else if (diagId === "DiagnosticFuelLevelId") {
        row.fuel_level = status.data;
      } else if (diagId === "DiagnosticEngineHoursId") {
        row.engine_hours = status.data;
      }
    }

    const rows = Array.from(diagnosticsByVehicle.values());
    stats.mapped = rows.length;

    // Delete existing diagnostics for these vehicles to avoid stale rows? Or just upsert?
    // vehicle_diagnostics doesn't have a unique constraint on vehicle_id in the provided schema (id is PK).
    // Let's just insert them. We might want to query the most recent one.
    if (rows.length > 0) {
      // First, remove old diagnostics for these vehicles (so we only keep the latest per sync)
      // or we just insert and always order by recorded_at DESC.
      // Inserting is fine.
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
      `[Geotab Diagnostics] RESULT Fetched=${stats.fetched} Mapped=${stats.mapped} Inserted=${stats.inserted}`
    );

    return stats;
  } catch (error) {
    addError(stats, error);
    throw error;
  }
}
