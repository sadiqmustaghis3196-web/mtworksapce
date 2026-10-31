import axios from "axios";
import { callGeotabApi } from "../services/geotab/geotabApi.js";
import { parseTimeSpanToSeconds } from "../utils/helpers.js";
import { supabase } from "../config/supabase.js";
import { resolveGeotabIntegration } from "../services/geotab/integrationService.js";

// ==========================================
// 🚀 TIMEOUT HELPER (this was the #1 cause of infinite "Loading...")
// A previous fix removed the timeout entirely (see old comment
// "Removed manual Timeout constraint entirely!"). That meant a single
// slow/stuck Geotab call could hang the whole request forever, and the
// frontend had nothing to fall back on either. We bring timeouts back,
// but scoped per-call so one slow LogRecord fetch can't block everything.
// ==========================================
function withTimeout(promise, ms, label = "Geotab request") {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

const TRIP_LIST_TIMEOUT_MS = 25000;   // main Trip list fetch
const LOGRECORD_TIMEOUT_MS = 8000;    // per start/stop coordinate lookup
const LOGRECORD_BATCH_SIZE = 8;       // was 5 — bumped slightly, still Geotab-friendly

export async function vehiclesListEndpoint(req, res) {
  try {
    const { organizationId } = req.query;
    if (!organizationId || organizationId === 'undefined' || organizationId === 'null') {
      return res.status(400).json({ success: false, error: "Missing organizationId" });
    }

    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('id, vehicle_number, make, model, year, vin, status, provider, provider_vehicle_id, drivers!driver_id(first_name, last_name)')
      .eq('organization_id', organizationId);

    if (error) throw error;

    const normalized = vehicles.map(v => ({
      id: v.id,
      vehicleId: v.id,
      provider: v.provider || "geotab",
      providerVehicleId: v.provider_vehicle_id,
      name: v.vehicle_number || "Unknown",
      vehicleNumber: v.vehicle_number,
      vin: v.vin,
      status: v.status,
      driver_name: v.drivers ? `${v.drivers.first_name || ''} ${v.drivers.last_name || ''}`.trim() : "Driver Unassigned"
    }));

    res.json({ success: true, data: normalized });
  } catch (err) {
    console.error("Error in /api/vehicles-list:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function vehicleTripsEndpoint(req, res) {
  try {
    const { organizationId, provider = "geotab", vehicleId, timeframe, page = 1, limit = 20 } = req.body;
    if (!organizationId || organizationId === 'undefined' || organizationId === 'null') {
      return res.status(400).json({ success: false, error: "Missing organizationId" });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (vehicleId && !uuidRegex.test(vehicleId)) {
      return res.status(400).json({ success: false, error: "Invalid vehicle ID format. Must be a valid UUID." });
    }

    const tf = (timeframe || '').toLowerCase();
    const tz = 'America/Chicago';
    const now = new Date();
    const tzString = now.toLocaleString('en-US', { timeZone: tz });
    const tzDate = new Date(tzString);
    const diff = now.getTime() - tzDate.getTime();

    let fromLocal = new Date(tzDate);
    let toLocal = new Date(tzDate);

    if (tf === 'today') {
      fromLocal.setHours(0, 0, 0, 0);
      toLocal.setHours(23, 59, 59, 999);
    } else if (tf === 'yesterday') {
      fromLocal.setDate(fromLocal.getDate() - 1);
      fromLocal.setHours(0, 0, 0, 0);
      toLocal.setDate(toLocal.getDate() - 1);
      toLocal.setHours(23, 59, 59, 999);
    } else if (tf === 'week') {
      fromLocal.setDate(fromLocal.getDate() - 7);
      fromLocal.setHours(0, 0, 0, 0);
    } else if (tf === 'month') {
      fromLocal.setDate(fromLocal.getDate() - 30);
      fromLocal.setHours(0, 0, 0, 0);
    } else {
      fromLocal.setDate(fromLocal.getDate() - 7);
      fromLocal.setHours(0, 0, 0, 0);
    }

    const fromDate = new Date(fromLocal.getTime() + diff);
    const toDate = new Date(toLocal.getTime() + diff);

    // 1. Resolve local vehicle & validate org (only if vehicleId is provided)
    let resolvedProvider = provider;
    let localVehicle = null;

    if (vehicleId) {
      const { data: vehicleData, error: lookupError } = await supabase
        .from('vehicles')
        .select('id, provider, provider_vehicle_id, vehicle_number')
        .eq('id', vehicleId)
        .eq('organization_id', organizationId)
        .single();

      if (lookupError || !vehicleData) {
        return res.status(404).json({ success: false, error: "Vehicle not found in organization." });
      }
      localVehicle = vehicleData;
      resolvedProvider = localVehicle.provider || provider;
    }

    // 2. Query Supabase
    let query = supabase
      .from('vehicle_trips')
      .select('*, drivers(first_name, last_name)', { count: 'exact' })
      .eq('organization_id', organizationId)
      .gte('start_time', fromDate.toISOString())
      .lte('start_time', toDate.toISOString())
      .order('start_time', { ascending: false });

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId).eq('provider', resolvedProvider);
    }
    
    // Apply true pagination via range (0-indexed)
    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (parsedPage - 1) * parsedLimit;
    query = query.range(offset, offset + parsedLimit - 1);

    const { data: existingTrips, error: tripsError, count } = await query;

    if (tripsError) {
      console.error("[Trip DB] Error fetching trips from DB:", tripsError);
      return res.status(500).json({ success: false, error: "Database error fetching trips." });
    }

    if (!existingTrips || existingTrips.length === 0) {
      return res.json({
        success: true,
        source: "database",
        data: [],
        total: 0,
        syncRequired: false
      });
    }

    // 3. Manually join vehicles for the retrieved trips
    let matchedVehicles = [];
    const vehicleIds = [...new Set(existingTrips.map(t => t.vehicle_id).filter(Boolean))];
    
    if (vehicleIds.length > 0) {
      const { data: vData } = await supabase
        .from('vehicles')
        .select('id, vehicle_number')
        .eq('organization_id', organizationId)
        .in('id', vehicleIds);
      if (vData) matchedVehicles = vData;
    }

    const isValidCoord = (lat, lng) =>
      lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

    const normalized = existingTrips.map(t => {
      const matched = matchedVehicles.find(v => v.id === t.vehicle_id);
      const driverName = t.drivers ? `${t.drivers.first_name} ${t.drivers.last_name}` : 'Driver Unassigned';
      return {
        id: t.provider_trip_id || t.id,
        start: t.start_time,
        stop: t.end_time,
        distance: t.distance,
        drivingDurationSec: t.driving_duration,
        stopDurationSec: t.stopped_duration,
        idleDurationSec: t.idle_duration,
        start_location: isValidCoord(t.start_lat, t.start_lng) ? { lat: t.start_lat, lng: t.start_lng } : null,
        end_location: isValidCoord(t.end_lat, t.end_lng) ? { lat: t.end_lat, lng: t.end_lng } : null,
        startAddress: t.start_address || 'Location unavailable',
        stopAddress: t.end_address || 'Location unavailable',
        maxSpeed: t.max_speed || 0,
        driver_id: t.driver_id,
        driver_name: driverName,
        vehicle_name: (localVehicle && localVehicle.vehicle_number) || (matched && matched.vehicle_number) || 'Unknown'
      };
    });

    return res.json({
      success: true,
      source: "database",
      cached: true,
      data: normalized,
      total: count || normalized.length,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil((count || 0) / parsedLimit)
    });

  } catch (err) {
    console.error("Error in /api/vehicle-trips:", err);
    res.status(500).json({ success: false, error: err.message || "An unexpected error occurred." });
  }
}

const routeCache = new Map();
const ROUTE_CACHE_TTL = 1000 * 60 * 60 * 24;
const ROUTE_FETCH_TIMEOUT_MS = 20000;

export async function tripRouteEndpoint(req, res) {
  try {
    const { organizationId, tripId, vehicleId } = req.body;
    if (!organizationId || !vehicleId || !tripId) {
      return res.status(400).json({ success: false, error: "Missing required parameters" });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(vehicleId)) {
      return res.status(400).json({ success: false, error: "Invalid vehicle ID format. Must be a valid UUID." });
    }

    const { data: localVehicle, error: lookupError } = await supabase
      .from('vehicles')
      .select('id, provider, provider_vehicle_id')
      .eq('id', vehicleId)
      .eq('organization_id', organizationId)
      .single();

    if (lookupError || !localVehicle) {
      return res.status(404).json({ success: false, error: "Vehicle not found in organization." });
    }

    const providerVehicleId = localVehicle.provider_vehicle_id;

    const { data: localTrip, error: tripError } = await supabase
      .from('vehicle_trips')
      .select('start_time, end_time, provider_trip_id')
      .eq('provider_trip_id', tripId)
      .eq('organization_id', organizationId)
      .single();

    if (tripError || !localTrip) {
      return res.status(404).json({ success: false, error: "Trip not found in database. Must be synced first." });
    }

    const cacheKey = `${organizationId}:${providerVehicleId}:${tripId}`;
    const cachedData = routeCache.get(cacheKey);
    if (cachedData && Date.now() - cachedData.timestamp < ROUTE_CACHE_TTL) {
      return res.json({ success: true, data: cachedData.points });
    }

    const provider = localVehicle.provider?.toLowerCase() || 'geotab';

    let points = [];

    if (provider === 'geotab') {
      const credentials = await resolveGeotabIntegration(organizationId);
      if (!credentials) return res.status(400).json({ success: false, error: "No Geotab credentials" });

      let logs;
      try {
        logs = await withTimeout(
          callGeotabApi(organizationId, credentials, {
            method: "Get",
            params: {
              typeName: "LogRecord",
              search: {
                deviceSearch: { id: providerVehicleId },
                fromDate: localTrip.start_time,
                toDate: localTrip.end_time
              },
              resultsLimit: 2000
            }
          }),
          ROUTE_FETCH_TIMEOUT_MS,
          "Trip route fetch"
        );
      } catch (geotabErr) {
        console.error("Geotab route fetch failed:", geotabErr);
        return res.status(504).json({ success: false, error: "Route provider took too long. Please retry." });
      }

      points = (logs || []).map(l => ({
        lat: l.latitude,
        lng: l.longitude,
        timestamp: l.dateTime,
        speed: l.speed || 0
      }));

    } else if (provider === 'samsara') {
      const { getCachedIntegrations } = await import("../services/integrationsService.js");
      const integrations = await getCachedIntegrations(organizationId);
      const sam = integrations.find(i => i.provider_id === 'samsara');
      if (!sam) return res.status(400).json({ success: false, error: "No Samsara credentials" });

      const { fetchAllSamsaraPages } = await import("../services/samsara/samsaraApi.js");
      try {
        const locations = await withTimeout(
          fetchAllSamsaraPages(sam.credentials.apiKey || sam.credentials.api_key, "/fleet/vehicles/locations/history", {
            startTime: localTrip.start_time,
            endTime: localTrip.end_time,
            vehicleIds: providerVehicleId
          }),
          ROUTE_FETCH_TIMEOUT_MS,
          "Samsara route fetch"
        );

        if (locations && locations.length > 0 && locations[0].locations) {
          points = locations[0].locations.map(l => ({
            lat: l.latitude,
            lng: l.longitude,
            timestamp: l.time,
            speed: l.speed ? (l.speed * 0.621371) : 0 // km/h to mph
          }));
        }
      } catch (samErr) {
        console.error("Samsara route fetch failed:", samErr);
        return res.status(504).json({ success: false, error: "Route provider took too long. Please retry." });
      }
    } else {
      return res.status(400).json({ success: false, error: "Unsupported provider" });
    }

    routeCache.set(cacheKey, { timestamp: Date.now(), points });

    return res.json({ success: true, data: points });

  } catch (err) {
    console.error("Error in /api/trip-route:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

const liveCache = new Map();
const LIVE_CACHE_TTL = 15000;

export async function liveLocationsEndpoint(req, res) {
  try {
    const adminOrgId = req.user?.organization_id;
    if (!adminOrgId) return res.status(403).json({ success: false, code: "NO_ORGANIZATION", error: "Unauthorized: Missing organization_id" });

    // 1. Fetch connected providers from fleet_integrations
    const { getCachedIntegrations } = await import("../services/integrationsService.js");
    const integrations = await getCachedIntegrations(adminOrgId);
    
    // 2. Fetch all vehicles for this org
    const { data: vehicles, error } = await supabase
      .from("vehicles")
      .select("id, vehicle_number, current_latitude, current_longitude, status, provider, provider_vehicle_id, driver_id, drivers ( first_name, last_name )")
      .eq("organization_id", adminOrgId);

    if (error) throw error;
    if (!vehicles || vehicles.length === 0) return res.json({ success: true, data: [] });

    const responseData = [...vehicles];
    const locationUpdates = [];

    const geotabVehicles = vehicles.filter(v => (v.provider || "geotab").toLowerCase() === "geotab");
    const samsaraVehicles = vehicles.filter(v => (v.provider || "").toLowerCase() === "samsara");

    const providerTasks = [];

    const sam = integrations.find(i => i.provider_id === "samsara");
    if (sam && samsaraVehicles.length > 0) {
      providerTasks.push((async () => {
        const cacheKey = `live_${adminOrgId}_samsara`;
        let locMap = liveCache.get(cacheKey);
        
        if (!locMap || Date.now() - locMap.timestamp > LIVE_CACHE_TTL) {
          try {
            const { callSamsaraApi } = await import("../services/samsara/samsaraApi.js");
                        const samsaraLocations = await withTimeout(
              callSamsaraApi(sam.credentials.apiKey || sam.credentials.api_key, "/fleet/vehicles/locations"),
              10000,
              "Samsara Live Fetch"
            );
            
            if (samsaraLocations && samsaraLocations.data) {
              locMap = { timestamp: Date.now(), map: new Map() };
              for (const item of samsaraLocations.data) {
                if (item.location) {
                  locMap.map.set(String(item.id), {
                    lat: item.location.latitude,
                    lng: item.location.longitude,
                    speed: item.location.speed,
                    time: item.location.time
                  });
                }
              }
              liveCache.set(cacheKey, locMap);
            }
          } catch(e) { 
            console.error("Samsara Live Tracking Error:", e.message); 
          }
        }
        
        if (locMap && locMap.map) {
          for (let i = 0; i < responseData.length; i++) {
             const v = responseData[i];
             if ((v.provider || "").toLowerCase() === "samsara" && v.provider_vehicle_id) {
                const loc = locMap.map.get(v.provider_vehicle_id);
                if (loc && loc.lat && loc.lng) {
                   responseData[i].current_latitude = loc.lat;
                   responseData[i].current_longitude = loc.lng;
                   responseData[i].speed = loc.speed ? (loc.speed * 0.621371) : 0;
                   responseData[i].last_update = loc.time;
                   locationUpdates.push({ id: v.id, current_latitude: loc.lat, current_longitude: loc.lng });
                }
             }
          }
        }
      })());
    }

    const geo = integrations.find(i => i.provider_id === "geotab");
    if (geo && geotabVehicles.length > 0) {
      providerTasks.push((async () => {
        const cacheKey = `live_${adminOrgId}_geotab`;
        let locMap = liveCache.get(cacheKey);
        
        if (!locMap || Date.now() - locMap.timestamp > LIVE_CACHE_TTL) {
          try {
            const { callGeotabApi } = await import("../services/geotab/geotabApi.js");
                        const credentials = geo.credentials;
            if (credentials) {
              const logs = await withTimeout(
                callGeotabApi(adminOrgId, credentials, {
                  method: "Get",
                  params: {
                    typeName: "DeviceStatusInfo"
                  }
                }),
                10000,
                "Geotab Live Fetch"
              );
              
              if (logs && Array.isArray(logs)) {
                locMap = { timestamp: Date.now(), map: new Map() };
                for (const log of logs) {
                  if (log.device && log.device.id) {
                    locMap.map.set(String(log.device.id), {
                      lat: log.latitude,
                      lng: log.longitude,
                      speed: log.speed || 0,
                      isDriving: log.isDriving,
                      time: log.dateTime
                    });
                  }
                }
                liveCache.set(cacheKey, locMap);
              }
            }
          } catch(e) {
            console.error("Geotab Live Tracking Error:", e.message);
          }
        }
        
        if (locMap && locMap.map) {
          for (let i = 0; i < responseData.length; i++) {
             const v = responseData[i];
             if ((v.provider || "geotab").toLowerCase() === "geotab" && v.provider_vehicle_id) {
                const loc = locMap.map.get(v.provider_vehicle_id);
                if (loc && loc.lat && loc.lng) {
                   responseData[i].current_latitude = loc.lat;
                   responseData[i].current_longitude = loc.lng;
                   responseData[i].speed = loc.speed * 0.621371;
                   responseData[i].isDriving = loc.isDriving;
                   responseData[i].last_update = loc.time;
                   locationUpdates.push({ id: v.id, current_latitude: loc.lat, current_longitude: loc.lng });
                }
             }
          }
        }
      })());
    }

    await Promise.all(providerTasks);

    if (locationUpdates.length > 0) {
       for (const update of locationUpdates) {
           supabase.from("vehicles")
             .update({ current_latitude: update.current_latitude, current_longitude: update.current_longitude })
             .eq("id", update.id)
             .then(({error}) => {
                 if (error) console.error("Failed to update live locations in DB:", error);
             });
       }
    }

    const mappedData = responseData.map(v => {
      const isStale = v.last_update ? (Date.now() - new Date(v.last_update).getTime() > 1000 * 60 * 30) : false;
      return {
        id: v.id,
        vehicle_number: v.vehicle_number,
        lat: v.current_latitude || 0,
        lng: v.current_longitude || 0,
        speed: v.speed || 0,
        is_moving: v.isDriving !== undefined ? v.isDriving : (v.speed > 5),
        driver_name: v.drivers ? `${v.drivers.first_name} ${v.drivers.last_name}` : "Unassigned",
        status: isStale ? "inactive" : v.status,
        provider: v.provider,
        last_update: v.last_update || null
      };
    });

    return res.json({ success: true, data: mappedData });

  } catch (err) {
    console.error("Error in /api/live-locations:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function watchVehicleEndpoint(req, res) {
  try {
    const adminOrgId = req.user?.organization_id;
    if (!adminOrgId) return res.status(403).json({ success: false, error: "Unauthorized" });
    
    const { vehicleId } = req.params;
    if (!vehicleId) return res.status(400).json({ success: false, error: "vehicleId required" });

    // Verify vehicle belongs to org
    const { data: v, error } = await supabase
      .from("vehicles")
      .select("id")
      .eq("id", vehicleId)
      .eq("organization_id", adminOrgId)
      .single();
      
    if (error || !v) return res.status(404).json({ success: false, error: "Vehicle not found" });

    // Send heartbeat to the background worker
    const { pingWatch } = await import("../services/liveTrackingWorker.js");
    pingWatch(vehicleId);

    return res.json({ success: true, message: "Watch heartbeat received" });
  } catch (err) {
    console.error("Error in /api/watch-vehicle:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getVehicleHistoryEndpoint(req, res) {
  try {
    const adminOrgId = req.user?.organization_id;
    if (!adminOrgId) return res.status(403).json({ success: false, error: "Unauthorized" });

    const { vehicleId } = req.params;
    if (!vehicleId) return res.status(400).json({ success: false, error: "vehicleId required" });

    // Fetch the trail for the last 24 hours, ordered by most recent first
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from("vehicle_location_history")
      .select("latitude, longitude, speed, heading, recorded_at")
      .eq("organization_id", adminOrgId)
      .eq("vehicle_id", vehicleId)
      .gte("recorded_at", twentyFourHoursAgo)
      .order("recorded_at", { ascending: false });

    if (error) throw error;

    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error("Error in /api/vehicle-history:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
