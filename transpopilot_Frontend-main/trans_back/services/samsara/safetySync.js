import { fetchAllSamsaraPages } from "./samsaraApi.js";
import { syncSamsaraVehicles } from "./vehicleSync.js";
import { supabase } from "../../config/supabase.js";
import { createStats, addError, chunkArray, stableId, getErrorMessage } from "../../utils/helpers.js";

export function classifySafetyEvent(eventName, event) {
  const text = `${eventName || ""}`.toLowerCase();

  if (text.includes("collision") || text.includes("accident") || text.includes("crash")) {
    return { type: "accident", severity: "critical" };
  }

  if (text.includes("speed")) {
    return { type: "violation", severity: "medium" };
  }

  if (text.includes("harsh braking") || text.includes("hard braking")) {
    return { type: "near-miss", severity: "high" };
  }

  if (text.includes("harsh acceleration") || text.includes("hard acceleration")) {
    return { type: "near-miss", severity: "high" };
  }

  if (text.includes("corner") || text.includes("turning")) {
    return { type: "near-miss", severity: "medium" };
  }

  return { type: "other", severity: "low" };
}

export async function syncSamsaraSafety(
  organizationId,
  credentials,
  from,
  to,
  existingVehicleMap = null
) {
  const stats = createStats();

  try {
    console.log(`[Samsara Safety] ${from.toISOString()} → ${to.toISOString()}`);

    const rawEvents = await fetchAllSamsaraPages(credentials.apiKey, "/fleet/safety-events", {
      startTime: from.toISOString(),
      endTime: to.toISOString()
    });

    stats.fetched = rawEvents.length;
    console.log(`[Samsara Safety] Fetched ${stats.fetched}`);

    let deviceToLocalVehicle = existingVehicleMap;

    if (!deviceToLocalVehicle) {
      const vehicleSync = await syncSamsaraVehicles(organizationId, credentials);
      deviceToLocalVehicle = vehicleSync.deviceToLocalVehicle;
    }

    let existingSafety = [];
    let fetchMore = true;
    let offset = 0;
    while (fetchMore) {
      const { data: chunk, error: existingError } = await supabase
        .from("safety_incident_reports")
        .select("vehicle_id, created_at, type, description")
        .eq("organization_id", organizationId)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .range(offset, offset + 999);

      if (existingError) {
        throw new Error(`[Supabase Safety Lookup] ${existingError.message}.`);
      }
      
      existingSafety = existingSafety.concat(chunk || []);
      if (!chunk || chunk.length < 1000) {
        fetchMore = false;
      } else {
        offset += 1000;
      }
    }

    const existingIds = new Set(
      (existingSafety || []).map(s => {
        const eventId = s.provider_event_id ? s.provider_event_id : `${new Date(s.created_at).toISOString()}_${s.type}`;
        return `${s.vehicle_id}_${eventId}`;
      })
    );

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
      console.warn("[Samsara Safety] Failed to fetch driver assignments", e.message);
    }

    const rows = [];

    for (const event of rawEvents) {
      try {
        const deviceId = stableId(event.vehicle?.id);
        if (!deviceId) {
          stats.skipped += 1;
          continue;
        }

        const vehicleId = deviceToLocalVehicle.get(deviceId);
        if (!vehicleId) {
          stats.skipped += 1;
          console.warn(`[Samsara Safety] Missing vehicle mapping for ${deviceId}`);
          continue;
        }

        const ruleName = event.behaviorLabels?.length > 0 ? event.behaviorLabels[0].name : "Safety Event";

        const eventDate = event.time;
        if (!eventDate) {
          stats.skipped += 1;
          continue;
        }

        let provider_event_id = event.id || null;
        if (provider_event_id && typeof provider_event_id !== 'string') {
           provider_event_id = String(provider_event_id);
        }

        const classification = classifySafetyEvent(ruleName, event);
        const compositeKey = `${vehicleId}_${provider_event_id || `${new Date(eventDate).toISOString()}_${classification.type}`}`;

        if (existingIds.has(compositeKey)) {
          stats.skipped += 1;
          continue;
        }

        existingIds.add(compositeKey);

        // Use the native Samsara driver mapping instead of relying on local vehicle assignment
        const providerDriverId = event.driver?.id || event.driverId ? String(event.driver?.id || event.driverId) : null;
        const driver_id = providerDriverId ? (providerDriverToLocalDriver.get(providerDriverId) || null) : null;

        rows.push({
          organization_id: organizationId,
          vehicle_id: vehicleId,
          driver_id: driver_id,
          date: new Date(eventDate).toISOString(),
          type: classification.type,
          severity: classification.severity,
          description: `Samsara Event: ${ruleName}`,
          resolved: false,
          created_at: new Date(eventDate).toISOString(),
          provider: 'samsara',
          provider_event_id: provider_event_id || null
        });

        stats.mapped += 1;
      } catch (rowError) {
        stats.failed += 1;
        console.error("[Samsara Safety Row Error]", getErrorMessage(rowError));
      }
    }

    for (const chunk of chunkArray(rows, 500)) {
      const { error } = await supabase
        .from("safety_incident_reports")
        .insert(chunk);

      if (error) {
        // If a unique constraint violation occurs (e.g. concurrent sync race condition),
        // fallback to inserting row-by-row to skip duplicates safely.
        console.warn(`[Samsara Safety] Chunk insert failed (${error.code}). Falling back to row-by-row.`);
        for (const row of chunk) {
          const { error: rowError } = await supabase.from("safety_incident_reports").insert(row);
          if (rowError) {
             if (rowError.code === '23505') {
                 // Ignore database-level duplicate
                 stats.skipped += 1;
             } else {
                 stats.failed += 1;
                 console.error("[Samsara Safety Insert Error]", getErrorMessage(rowError));
             }
          } else {
             stats.inserted += 1;
          }
        }
      } else {
        stats.inserted += chunk.length;
      }
    }

    console.log(
      `[Samsara Safety] RESULT Fetched=${stats.fetched} Mapped=${stats.mapped} Inserted=${stats.inserted} Skipped=${stats.skipped}`
    );

    return stats;
  } catch (error) {
    addError(stats, error);
    throw error;
  }
}
