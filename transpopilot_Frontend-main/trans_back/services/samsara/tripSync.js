import { fetchAllSamsaraPages } from "./samsaraApi.js";
import { syncSamsaraVehicles } from "./vehicleSync.js";
import { supabase } from "../../config/supabase.js";
import { createStats, addError, chunkArray, stableId } from "../../utils/helpers.js";

export async function syncSamsaraTrips(
  organizationId,
  credentials,
  from,
  to,
  existingVehicleMap = null
) {
  const stats = createStats();

  try {
    console.log(`[Samsara Trip] ${from.toISOString()} → ${to.toISOString()}`);

    let deviceToLocalVehicle = existingVehicleMap;
    if (!deviceToLocalVehicle) {
      const vehicleSync = await syncSamsaraVehicles(organizationId, credentials);
      deviceToLocalVehicle = vehicleSync.deviceToLocalVehicle;
    }

    const deviceIds = Array.from(deviceToLocalVehicle.keys()).join(',');
    if (!deviceIds) {
      console.log('[Samsara Trip] No vehicles to sync trips for.');
      return stats;
    }

    const rawTrips = await fetchAllSamsaraPages(credentials.apiKey, "/trips/stream", {
      startTime: from.toISOString(),
      endTime: to.toISOString(),
      ids: deviceIds
    });

    stats.fetched = rawTrips.length;
    console.log(`[Samsara Trip] Fetched ${stats.fetched}`);

    if (!rawTrips.length) {
      return stats;
    }
    
    // Fetch active provider driver ID to local driver ID mappings
    // employee_id stores the provider's (Geotab/Samsara) driver ID for event-to-driver matching — NOT an HR employee number
    const providerDriverToLocalDriver = new Map();
    try {
      const { data: drivers } = await supabase
        .from('drivers')
        .select('id, employee_id')
        .eq('organization_id', organizationId)
        .not('employee_id', 'is', null);
      if (drivers) {
        drivers.forEach(d => providerDriverToLocalDriver.set(d.employee_id, d.id));
      }
    } catch (e) {
      console.warn("[Samsara Trip] Failed to fetch driver assignments", e.message);
    }
    
    const uniquePayload = new Map();

    for (const trip of rawTrips) {
      try {
        const deviceId = stableId(trip.vehicle?.id);
        if (!deviceId) {
          stats.skipped += 1;
          continue;
        }

        const vehicleId = deviceToLocalVehicle.get(deviceId);
        if (!vehicleId) {
          stats.skipped += 1;
          continue;
        }

        const duplicateKey = `${vehicleId}|${trip.id}`;

        let start_lat = null;
        let start_lng = null;
        if (trip.startLocation) {
           start_lat = trip.startLocation.latitude;
           start_lng = trip.startLocation.longitude;
        }

        let end_lat = null;
        let end_lng = null;
        if (trip.endLocation) {
           end_lat = trip.endLocation.latitude;
           end_lng = trip.endLocation.longitude;
        }

        // Map the driver correctly
        const providerDriverId = trip.driver?.id || trip.driverId ? String(trip.driver?.id || trip.driverId) : null;
        const driver_id = providerDriverId ? (providerDriverToLocalDriver.get(providerDriverId) || null) : null;

        uniquePayload.set(duplicateKey, {
          organization_id: organizationId,
          provider: 'samsara',
          provider_trip_id: trip.id,
          vehicle_id: vehicleId,
          driver_id: driver_id,
          start_time: trip.startTime,
          end_time: trip.endTime,
          distance: trip.distanceMeters || 0,
          driving_duration: trip.endTime && trip.startTime ? (new Date(trip.endTime).getTime() - new Date(trip.startTime).getTime()) / 1000 : null,
          start_lat: start_lat,
          start_lng: start_lng,
          end_lat: end_lat,
          end_lng: end_lng,
          synced_at: new Date().toISOString()
        });

        stats.mapped += 1;
      } catch (rowError) {
        stats.failed += 1;
      }
    }

    const rows = Array.from(uniquePayload.values());
    console.log(`[Samsara Trip] unique payload: ${rows.length}`);

    for (const chunk of chunkArray(rows, 500)) {
      const { error } = await supabase
        .from("vehicle_trips")
        .upsert(chunk, { onConflict: "organization_id,provider,provider_trip_id" });

      if (error) {
        throw new Error(`[Supabase Trip Upsert] ${error.message}`);
      }

      stats.inserted += chunk.length;
    }

    console.log(
      `[Samsara Trip] RESULT Fetched=${stats.fetched} Mapped=${stats.mapped} Inserted=${stats.inserted} Skipped=${stats.skipped}`
    );

    return stats;
  } catch (error) {
    addError(stats, error);
    throw error;
  }
}
