import { supabase } from "../config/supabase.js";

// Keep track of which vehicles are currently being "watched" by frontend clients
// Map of vehicleId -> timestamp of last heartbeat
const watchedVehicles = new Map();

// Endpoint called by trackingController to register a heartbeat
export function pingWatch(vehicleId) {
  watchedVehicles.set(vehicleId, Date.now());
}

async function pollProviders() {
  try {
    // Clean up stale watches (no heartbeat in 30 seconds)
    const now = Date.now();
    for (const [vId, lastPing] of watchedVehicles.entries()) {
      if (now - lastPing > 30000) {
        watchedVehicles.delete(vId);
      }
    }

    // 1. Fetch all active integrations
    const { data: integrations, error: intError } = await supabase
      .from("fleet_integrations")
      .select("*")
      .eq("status", "connected");
      
    if (intError) throw intError;
    if (!integrations || integrations.length === 0) return;

    // We need to fetch vehicles by org to match with their provider API keys
    const orgIntegrations = {};
    for (const intg of integrations) {
      if (!orgIntegrations[intg.organization_id]) orgIntegrations[intg.organization_id] = [];
      orgIntegrations[intg.organization_id].push(intg);
    }

    // Run polling for each organization in parallel
    const orgPromises = Object.keys(orgIntegrations).map(async (orgId) => {
      try {
        const orgIntgs = orgIntegrations[orgId];
        
        // Fetch all vehicles for this org
        const { data: vehicles, error: vError } = await supabase
          .from("vehicles")
          .select("id, provider, provider_vehicle_id, organization_id")
          .eq("organization_id", orgId);
          
        if (vError) throw vError;
        if (!vehicles || vehicles.length === 0) return;

        const geotabVehicles = vehicles.filter(v => (v.provider || "geotab").toLowerCase() === "geotab");
        const samsaraVehicles = vehicles.filter(v => (v.provider || "").toLowerCase() === "samsara");
        
        const providerTasks = [];
        const locationUpdates = [];

        // Samsara Task
        const sam = orgIntgs.find(i => i.provider_id === "samsara");
        if (sam && samsaraVehicles.length > 0) {
          providerTasks.push((async () => {
            try {
              const { callSamsaraApi } = await import("./samsara/samsaraApi.js");
              const samsaraLocations = await callSamsaraApi(sam.credentials.apiKey || sam.credentials.api_key, "/fleet/vehicles/locations");
              if (samsaraLocations && samsaraLocations.data) {
                const locMap = new Map();
                for (const item of samsaraLocations.data) {
                  if (item.location) {
                    locMap.set(String(item.id), {
                      lat: item.location.latitude,
                      lng: item.location.longitude,
                      speed: item.location.speed ? (item.location.speed * 0.621371) : 0,
                      heading: item.location.heading || 0,
                      time: item.location.time
                    });
                  }
                }
                
                for (const v of samsaraVehicles) {
                  if (v.provider_vehicle_id) {
                    const loc = locMap.get(v.provider_vehicle_id);
                    if (loc && loc.lat && loc.lng) {
                      locationUpdates.push({ id: v.id, orgId: v.organization_id, ...loc });
                    }
                  }
                }
              }
            } catch(e) { console.error(`[Worker] Samsara Fetch Error for org ${orgId}:`, e.message); }
          })());
        }

        // Geotab Task
        const geo = orgIntgs.find(i => i.provider_id === "geotab");
        if (geo && geotabVehicles.length > 0) {
          providerTasks.push((async () => {
            try {
              const { callGeotabApi } = await import("./geotab/geotabApi.js");
              const logs = await callGeotabApi(orgId, geo.credentials, {
                method: "Get",
                params: { typeName: "DeviceStatusInfo" }
              });
              if (logs && Array.isArray(logs)) {
                const locMap = new Map();
                for (const log of logs) {
                  if (log.device && log.device.id) {
                    locMap.set(String(log.device.id), {
                      lat: log.latitude,
                      lng: log.longitude,
                      speed: log.speed ? (log.speed * 0.621371) : 0,
                      heading: log.bearing || 0,
                      time: log.dateTime
                    });
                  }
                }
                
                for (const v of geotabVehicles) {
                  if (v.provider_vehicle_id) {
                    const loc = locMap.get(v.provider_vehicle_id);
                    if (loc && loc.lat && loc.lng) {
                      locationUpdates.push({ id: v.id, orgId: v.organization_id, ...loc });
                    }
                  }
                }
              }
            } catch(e) { console.error(`[Worker] Geotab Fetch Error for org ${orgId}:`, e.message); }
          })());
        }

        await Promise.all(providerTasks);

        // Process location updates
        if (locationUpdates.length > 0) {
          for (const update of locationUpdates) {
             // 1. Always update the vehicle's current location in DB
             supabase.from("vehicles")
               .update({ 
                 current_latitude: update.lat, 
                 current_longitude: update.lng,
               })
               .eq("id", update.id)
               .then(({error}) => {
                   if (error) console.error(`[Worker] Failed to update vehicle ${update.id}:`, error);
               });
               
             // 2. Conditionally write to vehicle_location_history if being watched
             if (watchedVehicles.has(update.id)) {
                supabase.from("vehicle_location_history")
                  .insert({
                    organization_id: update.orgId,
                    vehicle_id: update.id,
                    latitude: update.lat,
                    longitude: update.lng,
                    speed: update.speed,
                    heading: update.heading,
                    recorded_at: update.time || new Date().toISOString()
                  })
                  .then(({error}) => {
                     if (error) console.error(`[Worker] Failed to insert history for ${update.id}:`, error);
                  });
             }
          }
        }
      } catch (err) {
        console.error(`[Worker] Error processing org ${orgId}:`, err);
      }
    });

    await Promise.all(orgPromises);
    
  } catch (err) {
    console.error("[LiveTrackingWorker] Error:", err.message);
  }
}

// Start the daemon interval
export function startWorker() {
  console.log("[LiveTrackingWorker] Started background daemon (15s polling)");
  // Run immediately once
  pollProviders();
  // Then run every 15 seconds
  setInterval(pollProviders, 15000);
}
