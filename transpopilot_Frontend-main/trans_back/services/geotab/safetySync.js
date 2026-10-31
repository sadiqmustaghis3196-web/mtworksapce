import { callGeotabApi } from "./geotabApi.js";
import { syncGeotabVehicles } from "./vehicleSync.js";
import { supabase } from "../../config/supabase.js";
import { createStats, addError, chunkArray, stableId, getErrorMessage } from "../../utils/helpers.js";

const geotabRuleCache = new Map();

export async function getGeotabRules(organizationId, credentials, forceRefresh = false) {
  const cacheKey = String(organizationId);
  const cached = geotabRuleCache.get(cacheKey);

  if (!forceRefresh && cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.rules;
  }

  console.log(`[Geotab Rules] Fetching rules for org ${organizationId}`);

  const rules = await callGeotabApi(organizationId, credentials, {
    method: "Get",
    params: {
      typeName: "Rule",
      resultsLimit: 50000
    }
  });

  geotabRuleCache.set(cacheKey, {
    rules,
    timestamp: Date.now()
  });

  console.log(`[Geotab Rules] Fetched ${rules.length}`);
  return rules;
}

export function classifySafetyEvent(ruleName, rule) {
  const text = `${ruleName || ""} ${rule?.comment || ""} ${rule?.name || ""}`.toLowerCase();

  if (text.includes("collision") || text.includes("accident")) {
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

export async function syncGeotabSafety(
  organizationId,
  credentials,
  from,
  to,
  existingVehicleMap = null
) {
  const stats = createStats();

  try {
    console.log(`[Geotab Safety] ${from.toISOString()} → ${to.toISOString()}`);

    const rawEvents = await callGeotabApi(organizationId, credentials, {
      method: "Get",
      params: {
        typeName: "ExceptionEvent",
        search: {
          fromDate: from.toISOString(),
          toDate: to.toISOString()
        },
        resultsLimit: 50000
      }
    });

    stats.fetched = rawEvents.length;
    console.log(`[Geotab Safety] Fetched ${stats.fetched}`);

    if (!rawEvents.length) {
      return stats;
    }

    const rules = await getGeotabRules(organizationId, credentials);
    const ruleMap = new Map();

    for (const rule of rules) {
      if (!rule.id) continue;
      ruleMap.set(String(rule.id), rule);
    }

    let deviceToLocalVehicle = existingVehicleMap;

    if (!deviceToLocalVehicle) {
      const vehicleSync = await syncGeotabVehicles(organizationId, credentials);
      deviceToLocalVehicle = vehicleSync.deviceToLocalVehicle;
    }

    // Fetch existing safety records within this timeframe to avoid 1000-row limit truncation
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
      console.warn("[Geotab Safety] Failed to fetch driver assignments", e.message);
    }

    const vehicleToDriver = new Map();
    try {
      const vehicleIds = Array.from(deviceToLocalVehicle.values());
      if (vehicleIds.length > 0) {
        const { data: vehiclesData } = await supabase
          .from('vehicles')
          .select('id, driver_id')
          .eq('organization_id', organizationId)
          .in('id', vehicleIds)
          .not('driver_id', 'is', null);
        if (vehiclesData) {
          vehiclesData.forEach(v => vehicleToDriver.set(v.id, v.driver_id));
        }
      }
    } catch (e) {
      console.warn("[Geotab Safety] Failed to fetch vehicle driver assignments", e.message);
    }

    const rows = [];

    for (const event of rawEvents) {
      try {
        const deviceId = stableId(event.device?.id || event.deviceId);
        if (!deviceId) {
          stats.skipped += 1;
          continue;
        }

        const vehicleId = deviceToLocalVehicle.get(deviceId);
        if (!vehicleId) {
          stats.skipped += 1;
          console.warn(`[Geotab Safety] Missing vehicle mapping for ${deviceId}`);
          continue;
        }

        const ruleId = stableId(event.rule?.id || event.ruleId);
        const rule = ruleId ? ruleMap.get(ruleId) : null;
        const ruleName = rule?.name || rule?.comment || event.rule?.name || ruleId || "Unknown Geotab Rule";

        const eventDate = event.activeFrom || event.dateTime || event.fromDate;
        if (!eventDate) {
          stats.skipped += 1;
          continue;
        }

        const classification = classifySafetyEvent(ruleName, rule);
        
        let provider_event_id = event.id || event.eventId || null;
        if (provider_event_id && typeof provider_event_id !== 'string') {
           provider_event_id = String(provider_event_id);
        }

        const compositeKey = `${vehicleId}_${provider_event_id || `${new Date(eventDate).toISOString()}_${classification.type}`}`;

        if (existingIds.has(compositeKey)) {
          stats.skipped += 1;
          continue;
        }

        existingIds.add(compositeKey);

        let providerDriverId = null;
        if (typeof event.driver === 'string') {
          providerDriverId = event.driver;
        } else if (event.driver?.id) {
          providerDriverId = event.driver.id;
        } else if (event.driverId) {
          providerDriverId = event.driverId;
        }

        let driver_id = null;
        if (providerDriverId && providerDriverId !== "UnknownDriverId") {
          driver_id = providerDriverToLocalDriver.get(providerDriverId) || null;
        }


        rows.push({
          organization_id: organizationId,
          vehicle_id: vehicleId,
          driver_id: driver_id,
          date: new Date(eventDate).toISOString(),
          type: classification.type,
          severity: classification.severity,
          description: `Geotab Exception: ${ruleName}`,
          resolved: false,
          created_at: new Date(eventDate).toISOString(),
          provider: 'geotab',
          provider_event_id: provider_event_id || null
        });

        stats.mapped += 1;
      } catch (rowError) {
        stats.failed += 1;
        console.error("[Geotab Safety Row Error]", getErrorMessage(rowError));
      }
    }

    try {
      const dvirs = await callGeotabApi(organizationId, credentials, {
        method: "Get",
        params: {
          typeName: "DVIRLog",
          search: {
            fromDate: from.toISOString(),
            toDate: to.toISOString()
          },
          resultsLimit: 50000
        }
      });
      
      const complianceRows = [];
      const now = new Date();
      
      for (const dvir of dvirs) {
        const needsRepair = dvir.repairStatus === 'Needed' || dvir.isSafeToOperate === false;
        if (needsRepair) {
          const dvirDate = new Date(dvir.dateTime || dvir.date || new Date());
          const daysOld = Math.floor((now.getTime() - dvirDate.getTime()) / (1000 * 3600 * 24));
          const isOverdue = daysOld > 7;
          const deviceId = dvir.device?.id || dvir.deviceId;
          
          complianceRows.push({
            organization_id: organizationId,
            type: 'Vehicle Inspection',
            entity: deviceId || "Unknown Vehicle",
            due_date: new Date(dvirDate.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString(),
            status: isOverdue ? 'overdue' : 'pending',
            priority: isOverdue ? 'high' : 'medium',
            provider: 'geotab'
          });
        }
      }
      
      for (const chunk of chunkArray(complianceRows, 500)) {
        const { error: compError } = await supabase.from("compliance_items").insert(chunk);
        if (compError) {
          console.error("[Supabase Compliance Insert Error (Geotab)]", compError);
        }
      }
    } catch (dvirErr) {
      console.error("[Geotab Safety] DVIR fetch failed:", getErrorMessage(dvirErr));
    }

    for (const chunk of chunkArray(rows, 500)) {
      const { error } = await supabase
        .from("safety_incident_reports")
        .insert(chunk);

      if (error) {
        // If a unique constraint violation occurs (e.g. concurrent sync race condition),
        // fallback to inserting row-by-row to skip duplicates safely.
        console.warn(`[Geotab Safety] Chunk insert failed (${error.code}). Falling back to row-by-row.`);
        for (const row of chunk) {
          const { error: rowError } = await supabase.from("safety_incident_reports").insert(row);
          if (rowError) {
             if (rowError.code === '23505') {
                 // Ignore database-level duplicate
                 stats.skipped += 1;
             } else {
                 stats.failed += 1;
                 console.error("[Geotab Safety Insert Error]", getErrorMessage(rowError));
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
      `[Geotab Safety] RESULT Fetched=${stats.fetched} Mapped=${stats.mapped} Inserted=${stats.inserted} Skipped=${stats.skipped}`
    );

    return stats;
  } catch (error) {
    addError(stats, error);
    throw error;
  }
}
