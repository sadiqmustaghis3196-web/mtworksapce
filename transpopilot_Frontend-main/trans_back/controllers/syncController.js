import axios from "axios";
import { supabase } from "../config/supabase.js";
import { getErrorMessage, normalizeCredentials, getDateRange, createStats, chunkArray } from "../utils/helpers.js";
import { authenticateGeotab } from "../services/geotab/geotabApi.js";
import { saveGeotabIntegration, getCachedIntegrations } from "../services/integrationsService.js";
import { syncGeotabVehicles } from "../services/geotab/vehicleSync.js";
import { syncGeotabDrivers } from "../services/geotab/driverSync.js";
import { syncGeotabFuel } from "../services/geotab/fuelSync.js";
import { syncGeotabSafety } from "../services/geotab/safetySync.js";
import { syncGeotabTrips } from "../services/geotab/tripSync.js";
import { syncGeotabDiagnostics } from "../services/geotab/diagnosticsSync.js";
import { processAllVehicleHealthForOrg } from "../services/healthScoring/pipeline.js";
import { reconcileUnassignedIncidents } from "../services/reconciliationWorker.js";
import { aggregateDriverBehavior } from "../services/aggregateDriverBehavior.js";

import { syncSamsaraVehicles } from "../services/samsara/vehicleSync.js";
import { syncSamsaraDrivers } from "../services/samsara/driverSync.js";
import { syncSamsaraFuel } from "../services/samsara/fuelSync.js";
import { syncSamsaraSafety } from "../services/samsara/safetySync.js";
import { syncSamsaraTrips } from "../services/samsara/tripSync.js";
import { syncSamsaraDiagnostics } from "../services/samsara/diagnosticsSync.js";

export async function syncGeotabEndpoint(req, res) {
  const { username, password, database, organizationId, userId, historyDays = 30 } = req.body;

  if (!username || !password || !database || !organizationId) {
    return res.status(400).json({
      success: false,
      error: "Missing username, password, database, or organizationId."
    });
  }

  try {
    const credentials = { 
      username: typeof username === 'string' ? username.trim() : username, 
      password, 
      database: typeof database === 'string' ? database.trim() : database 
    };
    console.log(`\n========== GEOTAB FULL SYNC START ==========`);
    console.log(`[Organization] ${organizationId}`);

    let previousLastSyncAt = null;
    try {
      const prevIntegrations = await getCachedIntegrations(organizationId);
      const prev = prevIntegrations.find(i => i.provider_id === 'geotab');
      if (prev) {
        // If last_sync_at is exactly equal to created_at, this is a brand new integration that just got its default values.
        if (prev.last_sync_at === prev.created_at) {
           previousLastSyncAt = null;
        } else {
           previousLastSyncAt = prev.last_sync_at;
        }
      }
    } catch (e) {
      // Ignore lookup errors
    }

    await authenticateGeotab(credentials);
    await saveGeotabIntegration(organizationId, userId, credentials);

    // If this is a brand new integration, the DB default might have set last_sync_at to now().
    // We want to clear it so the sync logic fetches the full 30 days.
    if (!previousLastSyncAt) {
      await supabase.from('fleet_integrations').update({ last_sync_at: null }).eq('organization_id', organizationId).eq('provider_id', 'geotab');
    }

    let vehicleResult = { stats: { fetched: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 }, deviceToLocalVehicle: new Map() };
    let vehicleError = null;
    try {
      vehicleResult = await syncGeotabVehicles(organizationId, credentials);
    } catch (e) {
      console.error("[Geotab Vehicle Sync Error]", e.message);
      vehicleError = getErrorMessage(e);
    }

    let driverStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    let driverError = null;
    try {
      driverStats = await syncGeotabDrivers(organizationId, credentials);
    } catch (e) {
      console.error("[Geotab Driver Sync Error]", e.message);
      driverError = getErrorMessage(e);
    }
    
    let from, to;
    if (previousLastSyncAt) {
      // Incremental sync: overlap by 12 hours for safety
      const lastSync = new Date(previousLastSyncAt);
      from = new Date(lastSync.getTime() - 12 * 60 * 60 * 1000);
      to = new Date();
    } else {
      // Initial sync
      const range = getDateRange(Math.min(Math.max(Number(historyDays) || 30, 1), 365));
      from = range.from;
      to = range.to;
    }
    
    console.log(`[Geotab Sync] Incremental Range: ${from.toISOString()} -> ${to.toISOString()}`);
    
    let fuelStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    let fuelError = null;
    if (!vehicleError) {
      try {
        fuelStats = await syncGeotabFuel(
          organizationId,
          credentials,
          from,
          to,
          vehicleResult.deviceToLocalVehicle
        );
      } catch (e) {
        console.error("[Geotab Fuel Sync Error]", e.message);
        fuelError = getErrorMessage(e);
      }
    } else {
      fuelError = "Skipped due to vehicle sync failure";
    }

    let safetyStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    let safetyError = null;
    if (!vehicleError) {
      try {
        safetyStats = await syncGeotabSafety(
          organizationId,
          credentials,
          from,
          to,
          vehicleResult.deviceToLocalVehicle
        );
      } catch (e) {
        console.error("[Geotab Safety Sync Error]", e.message);
        safetyError = getErrorMessage(e);
      }
    } else {
      safetyError = "Skipped due to vehicle sync failure";
    }
    
    let tripStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    let tripError = null;
    if (!vehicleError) {
      try {
        tripStats = await syncGeotabTrips(
          organizationId,
          credentials,
          from,
          to,
          vehicleResult.deviceToLocalVehicle
        );
      } catch (e) {
        console.error("[Geotab Trip Sync Error]", e.message);
        tripError = getErrorMessage(e);
      }
    } else {
      tripError = "Skipped due to vehicle sync failure";
    }

    let diagStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    let diagError = null;
    if (!vehicleError) {
      try {
        diagStats = await syncGeotabDiagnostics(
          organizationId,
          credentials,
          from,
          to,
          vehicleResult.deviceToLocalVehicle
        );
      } catch (e) {
        console.error("[Geotab Diagnostics Sync Error]", e.message);
        diagError = getErrorMessage(e);
      }
    } else {
      diagError = "Skipped due to vehicle sync failure";
    }

    // Only update last_sync_at if the sync fully completed without any errors
    if (!vehicleError && !driverError && !fuelError && !safetyError && !tripError && !diagError) {
      await supabase.from('fleet_integrations').update({ last_sync_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('provider_id', 'geotab');
    }

    // Process Vehicle Health Scores (De-risked)
    try {
      await processAllVehicleHealthForOrg(organizationId);
    } catch (healthError) {
      console.error("[Geotab Sync] Health Scoring failed (non-fatal):", getErrorMessage(healthError));
    }

    // Automation: Reconcile missing identity links & aggregate behavior
    try {
      await reconcileUnassignedIncidents(organizationId);
      await aggregateDriverBehavior(organizationId);
    } catch (automationError) {
      console.error("[Geotab Sync] Automation logic failed:", getErrorMessage(automationError));
    }

    console.log(`========== GEOTAB FULL SYNC END ==========\n`);

    return res.json({
      success: true,
      vehicles: {
        fetched: vehicleResult.stats?.fetched || 0,
        inserted: vehicleResult.stats?.inserted || 0,
        updated: vehicleResult.stats?.updated || 0,
        skipped: vehicleResult.stats?.skipped || 0,
        failed: vehicleResult.stats?.failed || 0,
        linked: vehicleResult.deviceToLocalVehicle?.size || 0,
        ...(vehicleError && { error: vehicleError })
      },
      drivers: {
        fetched: driverStats?.fetched || 0,
        inserted: driverStats?.inserted || 0,
        updated: driverStats?.updated || 0,
        skipped: driverStats?.skipped || 0,
        failed: driverStats?.failed || 0,
        ...(driverError && { error: driverError })
      },
      fuel: {
        fetched: fuelStats?.fetched || 0,
        inserted: fuelStats?.inserted || 0,
        updated: fuelStats?.updated || 0,
        skipped: fuelStats?.skipped || 0,
        failed: fuelStats?.failed || 0,
        ...(fuelError && { error: fuelError })
      },
      safety: {
        fetched: safetyStats?.fetched || 0,
        inserted: safetyStats?.inserted || 0,
        updated: safetyStats?.updated || 0,
        skipped: safetyStats?.skipped || 0,
        failed: safetyStats?.failed || 0,
        ...(safetyError && { error: safetyError })
      },
      trips: {
        fetched: tripStats?.fetched || 0,
        inserted: tripStats?.inserted || 0,
        updated: tripStats?.updated || 0,
        skipped: tripStats?.skipped || 0,
        failed: tripStats?.failed || 0,
        ...(tripError && { error: tripError })
      },
      diagnostics: {
        fetched: diagStats?.fetched || 0,
        inserted: diagStats?.inserted || 0,
        updated: diagStats?.updated || 0,
        skipped: diagStats?.skipped || 0,
        failed: diagStats?.failed || 0,
        ...(diagError && { error: diagError })
      }
    });
  } catch (error) {
    if (organizationId) {
      try {
        await supabase.from('fleet_integrations').update({ last_sync_at: previousLastSyncAt || null }).eq('organization_id', organizationId).eq('provider_id', 'geotab');
      } catch (e) {}
    }
    const message = getErrorMessage(error);
    console.error("[Geotab Full Sync Error]", message);
    return res.status(500).json({ success: false, error: message });
  }
}

export async function syncSamsaraEndpoint(req, res) {
  const { apiKey, organizationId, userId, historyDays = 30 } = req.body;

  if (!apiKey || !organizationId) {
    return res.status(400).json({
      success: false,
      error: "Missing apiKey or organizationId."
    });
  }

  try {
    const credentials = { apiKey: apiKey.trim() };
    console.log(`\n========== SAMSARA FULL SYNC START ==========`);
    console.log(`[Organization] ${organizationId}`);

    let previousLastSyncAt = null;
    try {
      const prevIntegrations = await getCachedIntegrations(organizationId);
      const prevSam = prevIntegrations.find(i => i.provider_id === 'samsara');
      if (prevSam) {
        if (prevSam.last_sync_at === prevSam.created_at) {
            previousLastSyncAt = null;
        } else {
            previousLastSyncAt = prevSam.last_sync_at;
        }
      }
    } catch (e) {
      // Ignore lookup errors
    }

    // Save the credentials (also acts as a verification if needed via API later)
    const { saveSamsaraIntegration } = await import("../services/integrationsService.js");
    await saveSamsaraIntegration(organizationId, userId, credentials);

    if (!previousLastSyncAt) {
      await supabase.from('fleet_integrations').update({ last_sync_at: null }).eq('organization_id', organizationId).eq('provider_id', 'samsara');
    }

    let vehicleResult = { stats: { fetched: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 }, deviceToLocalVehicle: new Map() };
    let vehicleError = null;
    try {
      vehicleResult = await syncSamsaraVehicles(organizationId, credentials);
    } catch (e) {
      console.error("[Samsara Vehicle Sync Error]", e.message);
      vehicleError = getErrorMessage(e);
    }

    let driverStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    let driverError = null;
    try {
      driverStats = await syncSamsaraDrivers(organizationId, credentials);
    } catch (e) {
      console.error("[Samsara Driver Sync Error]", e.message);
      driverError = getErrorMessage(e);
    }
    
    let from, to;
    if (previousLastSyncAt) {
      const lastSync = new Date(previousLastSyncAt);
      from = new Date(lastSync.getTime() - 12 * 60 * 60 * 1000);
      to = new Date();
    } else {
      const range = getDateRange(Math.min(Math.max(Number(historyDays) || 30, 1), 365));
      from = range.from;
      to = range.to;
    }
    
    console.log(`[Samsara Sync] Incremental Range: ${from.toISOString()} -> ${to.toISOString()}`);
    
    let fuelStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    let fuelError = null;
    if (!vehicleError) {
      try {
        fuelStats = await syncSamsaraFuel(
          organizationId,
          credentials,
          from,
          to,
          vehicleResult.deviceToLocalVehicle
        );
      } catch (e) {
        console.error("[Samsara Fuel Sync Error]", e.message);
        fuelError = getErrorMessage(e);
      }
    } else {
      fuelError = "Skipped due to vehicle sync failure";
    }

    let safetyStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    let safetyError = null;
    if (!vehicleError) {
      try {
        safetyStats = await syncSamsaraSafety(
          organizationId,
          credentials,
          from,
          to,
          vehicleResult.deviceToLocalVehicle
        );
      } catch (e) {
        console.error("[Samsara Safety Sync Error]", e.message);
        safetyError = getErrorMessage(e);
      }
    } else {
      safetyError = "Skipped due to vehicle sync failure";
    }
    
    let tripStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    let tripError = null;
    if (!vehicleError) {
      try {
        tripStats = await syncSamsaraTrips(
          organizationId,
          credentials,
          from,
          to,
          vehicleResult.deviceToLocalVehicle
        );
      } catch (e) {
        console.error("[Samsara Trip Sync Error]", e.message);
        tripError = getErrorMessage(e);
      }
    } else {
      tripError = "Skipped due to vehicle sync failure";
    }

    let diagStats = { fetched: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    let diagError = null;
    if (!vehicleError) {
      try {
        diagStats = await syncSamsaraDiagnostics(
          organizationId,
          credentials,
          from,
          to,
          vehicleResult.deviceToLocalVehicle
        );
      } catch (e) {
        console.error("[Samsara Diagnostics Sync Error]", e.message);
        diagError = getErrorMessage(e);
      }
    } else {
      diagError = "Skipped due to vehicle sync failure";
    }

    // Only update last_sync_at if the sync fully completed without any errors
    if (!vehicleError && !driverError && !fuelError && !safetyError && !tripError && !diagError) {
      await supabase.from('fleet_integrations').update({ last_sync_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('provider_id', 'samsara');
    }

    // Process Vehicle Health Scores (De-risked)
    try {
      await processAllVehicleHealthForOrg(organizationId);
    } catch (healthError) {
      console.error("[Samsara Sync] Health Scoring failed (non-fatal):", getErrorMessage(healthError));
    }

    // Automation: Reconcile missing identity links & aggregate behavior
    try {
      await reconcileUnassignedIncidents(organizationId);
      await aggregateDriverBehavior(organizationId);
    } catch (automationError) {
      console.error("[Samsara Sync] Automation logic failed:", getErrorMessage(automationError));
    }

    console.log(`========== SAMSARA FULL SYNC END ==========\n`);

    return res.json({
      success: true,
      vehicles: {
        fetched: vehicleResult.stats?.fetched || 0,
        inserted: vehicleResult.stats?.inserted || 0,
        updated: vehicleResult.stats?.updated || 0,
        skipped: vehicleResult.stats?.skipped || 0,
        failed: vehicleResult.stats?.failed || 0,
        linked: vehicleResult.deviceToLocalVehicle?.size || 0,
        ...(vehicleError && { error: vehicleError })
      },
      drivers: {
        fetched: driverStats?.fetched || 0,
        inserted: driverStats?.inserted || 0,
        updated: driverStats?.updated || 0,
        skipped: driverStats?.skipped || 0,
        failed: driverStats?.failed || 0,
        ...(driverError && { error: driverError })
      },
      fuel: {
        fetched: fuelStats?.fetched || 0,
        inserted: fuelStats?.inserted || 0,
        updated: fuelStats?.updated || 0,
        skipped: fuelStats?.skipped || 0,
        failed: fuelStats?.failed || 0,
        ...(fuelError && { error: fuelError })
      },
      safety: {
        fetched: safetyStats?.fetched || 0,
        inserted: safetyStats?.inserted || 0,
        updated: safetyStats?.updated || 0,
        skipped: safetyStats?.skipped || 0,
        failed: safetyStats?.failed || 0,
        ...(safetyError && { error: safetyError })
      },
      trips: {
        fetched: tripStats?.fetched || 0,
        inserted: tripStats?.inserted || 0,
        updated: tripStats?.updated || 0,
        skipped: tripStats?.skipped || 0,
        failed: tripStats?.failed || 0,
        ...(tripError && { error: tripError })
      },
      diagnostics: {
        fetched: diagStats?.fetched || 0,
        inserted: diagStats?.inserted || 0,
        updated: diagStats?.updated || 0,
        skipped: diagStats?.skipped || 0,
        failed: diagStats?.failed || 0,
        ...(diagError && { error: diagError })
      }
    });
  } catch (error) {
    if (organizationId) {
      try {
        await supabase.from('fleet_integrations').update({ last_sync_at: previousLastSyncAt || null }).eq('organization_id', organizationId).eq('provider_id', 'samsara');
      } catch (e) {}
    }
    const message = getErrorMessage(error);
    console.error("[Samsara Full Sync Error]", message);
    return res.status(500).json({ success: false, error: message });
  }
}

export async function syncFuelEndpoint(req, res) {
  try {
    const { organizationId, historyDays = 30 } = req.body;

    if (!organizationId || organizationId === 'undefined' || organizationId === 'null') {
      return res.status(400).json({ success: false, error: "Missing organizationId." });
    }

    const integrations = await getCachedIntegrations(organizationId);
    const geotab = integrations.find(i => i.provider_id === "geotab");

    if (!geotab) {
      return res.json({
        success: true,
        message: "No connected Geotab integration.",
        fuel: createStats()
      });
    }

    const credentials = normalizeCredentials(geotab.credentials);
    if (!credentials) {
      throw new Error("Stored Geotab credentials are invalid.");
    }

    const vehicleResult = await syncGeotabVehicles(organizationId, credentials);
    const { from, to } = getDateRange(Math.min(Math.max(Number(historyDays) || 30, 1), 365));

    const fuelStats = await syncGeotabFuel(
      organizationId,
      credentials,
      from,
      to,
      vehicleResult.deviceToLocalVehicle
    );

    return res.json({
      success: true,
      range: { from: from.toISOString(), to: to.toISOString() },
      fuel: fuelStats,
      count: fuelStats.inserted
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("[Fuel Sync Error]", message);
    return res.status(500).json({ success: false, error: message });
  }
}

export async function syncSafetyEndpoint(req, res) {
  const { organizationId, startDate, endDate } = req.body;

  if (!organizationId || organizationId === 'undefined' || organizationId === 'null') {
    return res.status(400).json({ success: false, error: 'Missing organizationId' });
  }

  try {
    const integrations = await getCachedIntegrations(organizationId);

    console.log('[Safety Sync] Organization:', organizationId);
    console.log('[Safety Sync] Connected integrations:', integrations?.map(item => ({
      provider: item.provider_id,
      status: item.status,
      hasCredentials: Boolean(item.credentials)
    })));

    if (!integrations || integrations.length === 0) {
      return res.json({
        success: true,
        synced: 0,
        message: 'No connected integrations found for this organization.'
      });
    }

    const to = endDate ? new Date(endDate) : new Date();
    const from = startDate ? new Date(startDate) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalSynced = 0;
    const results = [];

    for (const integration of integrations) {
      if (integration.status !== 'connected' || !integration.credentials) {
        results.push({
          provider: integration.provider_id,
          success: false,
          synced: 0,
          reason: 'Integration is not connected or credentials are missing.'
        });
        continue;
      }

      if (integration.provider_id === 'geotab') {
        try {
          const stats = await syncGeotabSafety(
            organizationId,
            integration.credentials,
            from,
            to
          );
          const synced = stats?.inserted || 0;
          totalSynced += synced;
          results.push({ provider: 'geotab', success: true, synced });
        } catch (error) {
          console.error('[Safety Sync] Geotab failed:', error);
          results.push({ provider: 'geotab', success: false, synced: 0, error: error.message || String(error) });
        }
      } else if (integration.provider_id === 'samsara') {
        try {
          const stats = await syncSamsaraSafety(
            organizationId,
            integration.credentials,
            from,
            to
          );
          
          const synced = stats?.inserted || 0;
          totalSynced += synced;
          results.push({ provider: 'samsara', success: true, synced });
        } catch (error) {
          console.error('[Safety Sync] Samsara failed:', error);
          results.push({ provider: 'samsara', success: false, synced: 0, error: error.message || String(error) });
        }
      }
    }

    const { count: databaseCount, error: countError } = await supabase
      .from('safety_incident_reports')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    if (countError) {
      console.error('[Safety Sync] Database verification failed:', countError);
    }

    return res.json({
      success: true,
      organizationId,
      synced: totalSynced,
      databaseCount: countError ? null : databaseCount,
      from: from.toISOString(),
      to: to.toISOString(),
      providers: results
    });

  } catch (error) {
    console.error('[Safety Sync] Fatal error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Safety sync failed.'
    });
  }
}


export async function verifyGeotabEndpoint(req, res) {
  const { username, password, database, organizationId, userId } = req.body;
  if (!username || !password || !database || !organizationId) return res.status(400).json({success: false, error: "Missing credentials"});
  try {
    const { data: existing } = await supabase.from('fleet_integrations').select('id').eq('organization_id', organizationId).eq('provider_id', 'geotab').maybeSingle();
    const isFirstTime = !existing;

    const credentials = { username: typeof username === 'string' ? username.trim() : username, password, database: typeof database === 'string' ? database.trim() : database };
    await authenticateGeotab(credentials);
    await saveGeotabIntegration(organizationId, userId, credentials);

    if (isFirstTime) {
      console.log(`[Verify Geotab] First time save detected for org ${organizationId}. Auto-triggering full sync.`);
      return syncGeotabEndpoint(req, res);
    }

    return res.json({ success: true, message: "Geotab credentials verified and saved." });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
}

export async function verifySamsaraEndpoint(req, res) {
  const { apiKey, organizationId, userId } = req.body;
  if (!apiKey || !organizationId) return res.status(400).json({success: false, error: "Missing credentials"});
  try {
    const { data: existing } = await supabase.from('fleet_integrations').select('id').eq('organization_id', organizationId).eq('provider_id', 'samsara').maybeSingle();
    const isFirstTime = !existing;

    const credentials = { apiKey: apiKey.trim() };
    const { callSamsaraApi } = await import("../services/samsara/samsaraApi.js");
    await callSamsaraApi(credentials.apiKey, "/fleet/vehicles?limit=1");
    const { saveSamsaraIntegration } = await import("../services/integrationsService.js");
    await saveSamsaraIntegration(organizationId, userId, credentials);

    if (isFirstTime) {
      console.log(`[Verify Samsara] First time save detected for org ${organizationId}. Auto-triggering full sync.`);
      return syncSamsaraEndpoint(req, res);
    }

    return res.json({ success: true, message: "Samsara credentials verified and saved." });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
}
