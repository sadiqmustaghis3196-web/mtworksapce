import { callGeotabApi } from "./geotabApi.js";
import { supabase } from "../../config/supabase.js";
import { createStats, addError, chunkArray } from "../../utils/helpers.js";

export async function fetchGeotabDevices(organizationId, credentials) {
  console.log(`[Geotab Vehicles] Fetching devices for org ${organizationId}`);

  const devices = await callGeotabApi(
    organizationId,
    credentials,
    {
      method: "Get",
      params: {
        typeName: "Device",
        resultsLimit: 50000
      }
    }
  );

  console.log(`[Geotab Vehicles] Received ${devices.length} devices`);
  return devices;
}

export async function syncGeotabVehicles(organizationId, credentials) {
  const stats = createStats();

  try {
    const devices = await fetchGeotabDevices(organizationId, credentials);
    stats.fetched = devices.length;

    if (!devices.length) {
      return { stats, devices, deviceToLocalVehicle: new Map() };
    }

    const { data: existingVehicles, error: lookupError } = await supabase
      .from("vehicles")
      .select("id, vehicle_number, vin")
      .eq("organization_id", organizationId);

    if (lookupError) {
      throw new Error(`[Supabase Vehicles Lookup] ${lookupError.message}`);
    }

    const dbVinMap = new Map();
    const dbNumberMap = new Map();
    
    for (const v of existingVehicles || []) {
      if (v.vin) dbVinMap.set(v.vin.toLowerCase(), v);
      if (v.vehicle_number) dbNumberMap.set(v.vehicle_number.toLowerCase(), v);
    }

    const uniqueVins = new Set(Array.from(dbVinMap.keys()));
    const uniqueNumbers = new Set(Array.from(dbNumberMap.keys()));
    
    const finalPayload = [];
    const geotabIdToVehicleNumber = new Map();

    for (const device of devices) {
      const fallbackStr = `GEOTAB-${organizationId}-${device.id}`;
      
      let rawVin = device.vehicleIdentificationNumber || device.serialNumber || null;
      let rawNumber = device.name ? String(device.name).trim() : null;
      
      let finalVin = rawVin ? String(rawVin).trim() : null;
      let finalNumber = rawNumber;

      let matchedDbRecord = null;

      // Match existing record to avoid uniqueness regeneration if already synced
      if (finalNumber && dbNumberMap.has(finalNumber.toLowerCase())) {
        matchedDbRecord = dbNumberMap.get(finalNumber.toLowerCase());
      } else if (finalVin && dbVinMap.has(finalVin.toLowerCase())) {
        matchedDbRecord = dbVinMap.get(finalVin.toLowerCase());
      }

      // If we matched an existing record, we can reuse its exact DB values for keys to prevent conflicts
      if (matchedDbRecord) {
        finalVin = matchedDbRecord.vin;
        finalNumber = matchedDbRecord.vehicle_number;
      } else {
        // This is a NEW record (or unmatched), so enforce uniqueness against BOTH payload and DB
        if (!finalVin || uniqueVins.has(finalVin.toLowerCase())) {
          finalVin = `${fallbackStr}-VIN`;
        }
        uniqueVins.add(finalVin.toLowerCase());

        if (!finalNumber || uniqueNumbers.has(finalNumber.toLowerCase())) {
          finalNumber = `${fallbackStr}-NUM`;
        }
        uniqueNumbers.add(finalNumber.toLowerCase());
      }

      geotabIdToVehicleNumber.set(String(device.id), finalNumber);

      const finalRow = {
        organization_id: organizationId,
        vehicle_number: finalNumber,
        make: device.vehicle?.make || device.productId || "Geotab",
        model: device.vehicle?.model || device.deviceType || "Geotab Device",
        year: device.vehicle?.year || 2024,
        vin: finalVin,
        status: device.activeTo && new Date(device.activeTo) < new Date() ? "inactive" : "active",
        provider: "geotab",
        provider_vehicle_id: String(device.id),
        updated_at: new Date().toISOString()
      };

      if (matchedDbRecord) {
        finalRow.id = matchedDbRecord.id;
        stats.updated += 1;
      } else {
        stats.inserted += 1;
      }

      finalPayload.push(finalRow);
    }

    for (const chunk of chunkArray(finalPayload, 500)) {
      const { error } = await supabase
        .from("vehicles")
        .upsert(chunk, { onConflict: "id" });

      if (error) {
        throw new Error(`[Supabase Vehicles Upsert] ${error.message}`);
      }

      stats.mapped += chunk.length;
    }

    const { data: latestVehicles, error: latestError } = await supabase
      .from("vehicles")
      .select("id, vehicle_number")
      .eq("organization_id", organizationId);

    if (latestError) {
      throw new Error(`[Supabase Vehicles Post-Lookup] ${latestError.message}`);
    }

    const byVehicleNumber = new Map();
    for (const vehicle of latestVehicles || []) {
      byVehicleNumber.set(String(vehicle.vehicle_number).toLowerCase(), vehicle.id);
    }

    const deviceToLocalVehicle = new Map();
    for (const device of devices) {
      const finalNum = geotabIdToVehicleNumber.get(String(device.id));
      if (finalNum) {
        const localId = byVehicleNumber.get(finalNum.toLowerCase());
        if (localId) {
          deviceToLocalVehicle.set(String(device.id), localId);
        }
      }
    }

    console.log(`[Geotab Vehicles] Fetched=${stats.fetched}, Mapped=${deviceToLocalVehicle.size}`);

    return { stats, devices, deviceToLocalVehicle };
  } catch (error) {
    addError(stats, error);
    throw error;
  }
}
