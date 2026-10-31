import { callGeotabApi } from "./geotabApi.js";
import { syncGeotabVehicles } from "./vehicleSync.js";
import { supabase } from "../../config/supabase.js";
import { createStats, addError, chunkArray, stableId, getErrorMessage } from "../../utils/helpers.js";

export async function syncGeotabTrips(
  organizationId,
  credentials,
  from,
  to,
  existingVehicleMap = null
) {
  const stats = createStats();

  try {
    console.log(`[Geotab Trip] ${from.toISOString()} → ${to.toISOString()}`);

    let deviceToLocalVehicle = existingVehicleMap;
    if (!deviceToLocalVehicle) {
      const vehicleSync = await syncGeotabVehicles(organizationId, credentials);
      deviceToLocalVehicle = vehicleSync.deviceToLocalVehicle;
    }

    const rawTrips = await callGeotabApi(
      organizationId,
      credentials,
      {
        method: "Get",
        params: {
          typeName: "Trip",
          search: {
            fromDate: from.toISOString(),
            toDate: to.toISOString()
          },
          resultsLimit: 50000
        }
      }
    );

    stats.fetched = rawTrips.length;
    console.log(`[Geotab Trip] Fetched ${stats.fetched}`);

    if (!rawTrips.length) {
      return stats;
    }

    rawTrips.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    // Pre-fetch the most recent known stop locations from the DB for chronological stitching
    const lastStopByVehicle = new Map();
    try {
      const { data: lastTrips } = await supabase
        .from('vehicle_trips')
        .select('vehicle_id, end_lat, end_lng')
        .eq('organization_id', organizationId)
        .not('end_lat', 'is', null)
        .order('start_time', { ascending: false });

      if (lastTrips && lastTrips.length > 0) {
         for (const lt of lastTrips) {
            if (!lastStopByVehicle.has(lt.vehicle_id)) {
               lastStopByVehicle.set(lt.vehicle_id, { lat: lt.end_lat, lng: lt.end_lng });
            }
         }
      }
    } catch (e) {
      console.warn("[Geotab Trip] Failed to fetch previous stop points", e.message);
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
      console.warn("[Geotab Trip] Failed to fetch driver assignments", e.message);
    }

    const uniquePayload = new Map();

    for (const trip of rawTrips) {
      try {
        const deviceId = stableId(trip.device?.id);
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
        const prevStop = lastStopByVehicle.get(vehicleId);
        if (prevStop) {
          start_lat = prevStop.lat;
          start_lng = prevStop.lng;
        }

        let end_lat = null;
        let end_lng = null;
        if (trip.stopPoint && trip.stopPoint.x !== 0 && trip.stopPoint.y !== 0) {
          end_lng = trip.stopPoint.x;
          end_lat = trip.stopPoint.y;
          // Update tracker for the next trip
          lastStopByVehicle.set(vehicleId, { lat: end_lat, lng: end_lng });
        }
        
        // Map the driver correctly
        const providerDriverId = trip.driver?.id || trip.driverId;
        const driver_id = (providerDriverId && providerDriverId !== 'UnknownDriverId') 
            ? (providerDriverToLocalDriver.get(providerDriverId) || null) 
            : null;

        uniquePayload.set(duplicateKey, {
          organization_id: organizationId,
          provider: 'geotab',
          provider_trip_id: trip.id,
          vehicle_id: vehicleId,
          driver_id: driver_id,
          start_time: trip.start,
          end_time: trip.stop,
          distance: trip.distance || 0,
          driving_duration: trip.drivingDuration ? parseDurationString(trip.drivingDuration) : null,
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
    console.log(`[Geotab Trip] unique payload: ${rows.length}`);

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
      `[Geotab Trip] RESULT Fetched=${stats.fetched} Mapped=${stats.mapped} Inserted=${stats.inserted} Skipped=${stats.skipped}`
    );

    return stats;
  } catch (error) {
    addError(stats, error);
    throw error;
  }
}

function parseDurationString(timespan) {
  // timespan format "00:05:30.450" or similar
  if (!timespan) return null;
  const parts = timespan.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return (hours * 3600) + (minutes * 60) + Math.round(seconds);
  }
  return null;
}
