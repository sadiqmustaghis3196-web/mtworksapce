import { callGeotabApi } from "../services/geotab/geotabApi.js";
import { getErrorMessage } from "../utils/helpers.js";
import { supabase } from "../config/supabase.js";
import { resolveGeotabIntegration } from "../services/geotab/integrationService.js";

const telemetryCache = new Map();
const inFlightRequests = new Map();

const TELEMETRY_CACHE_TTL = 1000 * 60 * 60; // 1 hour

function isValidUUID(value) {
  if (!value || typeof value !== "string") return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function resolveHours(timeframe, period) {
  const value = timeframe || period || "1d";

  const ranges = {
    "1h": 1,
    "24h": 24,
    "1d": 24,
    "7d": 24 * 7,
    "1w": 24 * 7,
    "30d": 24 * 30,
    "1m": 24 * 30,
  };

  return ranges[value] || 24;
}

async function resolveVehicle({
  organizationId,
  deviceId,
  vehicleId,
}) {
  const lookupValue = vehicleId || deviceId;

  if (!lookupValue) {
    throw new Error("Vehicle identifier is required.");
  }

  let query = supabase
    .from("vehicles")
    .select(`
      id,
      organization_id,
      provider,
      provider_vehicle_id,
      vehicle_number
    `)
    .eq("organization_id", organizationId);

  let result;

  /*
   * Case 1:
   * Frontend sends local UUID
   */
  if (isValidUUID(lookupValue)) {
    result = await query.eq("id", lookupValue).maybeSingle();

    if (result.error) {
      throw new Error(
        `Vehicle lookup failed: ${result.error.message}`
      );
    }

    if (result.data) {
      return result.data;
    }
  }

  /*
   * Case 2:
   * Frontend sends actual Geotab Device ID
   */
  result = await supabase
    .from("vehicles")
    .select(`
      id,
      organization_id,
      provider,
      provider_vehicle_id,
      vehicle_number
    `)
    .eq("organization_id", organizationId)
    .eq("provider_vehicle_id", lookupValue)
    .maybeSingle();

  if (result.error) {
    throw new Error(
      `Provider vehicle lookup failed: ${result.error.message}`
    );
  }

  if (result.data) {
    return result.data;
  }

  /*
   * Case 3:
   * Frontend sends vehicle_number or name
   */
  result = await query.eq("vehicle_number", lookupValue).maybeSingle();
  if (result.error) {
    throw new Error(
      `Vehicle number lookup failed: ${result.error.message}`
    );
  }

  if (result.data) {
    return result.data;
  }

  throw new Error(
    "Unable to resolve vehicle. Provide a valid local vehicle UUID or mapped provider ID."
  );
}

export async function speedProfileEndpoint(req, res) {
  try {
    const {
      organizationId,
      deviceId,
      vehicleId,
      timeframe,
      period = "1d",
    } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "Missing organizationId.",
      });
    }

    if (!deviceId && !vehicleId) {
      return res.status(400).json({
        success: false,
        error: "Missing vehicle identifier.",
      });
    }

    /*
     * STEP 1
     * Resolve the vehicle safely.
     *
     * Supports:
     * - local vehicle UUID
     * - Geotab provider_vehicle_id
     * - vehicle_number
     * - name
     */
    const localVehicle = await resolveVehicle({
      organizationId,
      deviceId,
      vehicleId,
    });

    if (
      !localVehicle.provider_vehicle_id ||
      typeof localVehicle.provider_vehicle_id !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "This vehicle is not mapped to a valid Geotab Device ID.",
        meta: {
          localVehicleId: localVehicle.id,
          vehicleName:
            localVehicle.vehicle_number ||
            null,
        },
      });
    }

    const resolvedGeotabId =
      localVehicle.provider_vehicle_id.trim();

    const provider = (
      localVehicle.provider || "geotab"
    ).toLowerCase();

    /*
     * STEP 2
     * Resolve organization-specific credentials.
     */
    let credentials;
    if (provider === "geotab") {
      credentials = await resolveGeotabIntegration(organizationId);
      if (!credentials) {
        return res.status(400).json({
          success: false,
          error: "No active Geotab integration found for this organization.",
        });
      }
    } else if (provider === "samsara") {
      const { getCachedIntegrations } = await import("../services/integrationsService.js");
      const integrations = await getCachedIntegrations(organizationId);
      const sam = integrations.find(i => i.provider_id === 'samsara');
      if (!sam) {
        return res.status(400).json({
          success: false,
          error: "No active Samsara integration found for this organization.",
        });
      }
      credentials = sam.credentials;
    } else {
      return res.status(400).json({ success: false, error: `Provider ${provider} not supported.` });
    }

    /*
     * STEP 3
     * Calculate date range.
     */
    const hours = resolveHours(timeframe, period);

    const to = new Date();
    const from = new Date(
      to.getTime() - hours * 60 * 60 * 1000
    );

    /*
     * Cache by:
     * organization
     * local vehicle
     * provider device
     * timeframe
     */
    const cacheKey = [
      organizationId,
      provider,
      resolvedGeotabId, // this is providerVehicleId
      timeframe,
      hours,
    ].join("_");

    const cached = telemetryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < TELEMETRY_CACHE_TTL) {
      return res.json({
        success: true,
        data: cached.data,
        meta: {
          source: "cache",
          vehicleId: localVehicle.id,
          providerVehicleId: resolvedGeotabId,
          from: cached.from,
          to: cached.to,
          totalRecords: cached.data.length,
        },
      });
    }

    if (inFlightRequests.has(cacheKey)) {
      const sharedResult = await inFlightRequests.get(cacheKey);
      return res.json({
        success: true,
        data: sharedResult.data,
        meta: sharedResult.meta,
      });
    }

    const requestPromise = (async () => {
      let data = [];

      if (provider === "geotab") {
        const logs = await callGeotabApi(
          organizationId,
          credentials,
          {
            method: "Get",
            params: {
              typeName: "LogRecord",
              search: {
                deviceSearch: { id: resolvedGeotabId },
                fromDate: from.toISOString(),
                toDate: to.toISOString(),
              },
              resultsLimit: 20000,
            },
          }
        );

        if (!Array.isArray(logs)) {
          throw new Error("Geotab returned an invalid telemetry response.");
        }

        data = logs
          .filter(log => log && log.dateTime && Number.isFinite(Number(log.speed)))
          .map(log => ({
            timestamp: log.dateTime,
            speed: Number(log.speed),
            latitude: log.latitude != null ? Number(log.latitude) : null,
            longitude: log.longitude != null ? Number(log.longitude) : null,
            speedLimit: null,
            estimatedSpeedLimit: null,
            meta: { isRisk: false, source: "geotab" },
          }));
      } else if (provider === "samsara") {
        const { fetchAllSamsaraPages } = await import("../services/samsara/samsaraApi.js");
        const locations = await fetchAllSamsaraPages(credentials.apiKey || credentials.api_key, "/fleet/vehicles/locations/history", {
          startTime: from.toISOString(),
          endTime: to.toISOString(),
          vehicleIds: resolvedGeotabId
        });
        
        const records = [];
        if (locations && locations.length > 0 && locations[0].locations) {
          for (const loc of locations[0].locations) {
            records.push({
              timestamp: loc.time,
              speed: loc.speed ? (Number(loc.speed) * 0.621371) : 0, // Convert km/h to mph
              latitude: Number(loc.latitude),
              longitude: Number(loc.longitude),
              speedLimit: null,
              estimatedSpeedLimit: null,
              meta: { isRisk: false, source: "samsara" },
            });
          }
        }
        data = records;
      }

      const result = {
        data,
        meta: {
          source: provider,
          vehicleId: localVehicle.id,
          providerVehicleId: resolvedGeotabId,
          from: from.toISOString(),
          to: to.toISOString(),
          totalRecords: data.length,
        },
      };

      telemetryCache.set(cacheKey, {
        timestamp: Date.now(),
        data,
        from: from.toISOString(),
        to: to.toISOString(),
      });

      return result;
    })();

    inFlightRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;

      return res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  } catch (error) {
    const message = getErrorMessage(error);

    console.error(
      "[Speed Profile Error]",
      message
    );

    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}