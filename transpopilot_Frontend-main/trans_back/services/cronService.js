import cron from 'node-cron';
import { supabase } from '../config/supabase.js';
import { getErrorMessage, getDateRange } from '../utils/helpers.js';

import { authenticateGeotab } from './geotab/geotabApi.js';
import { syncGeotabVehicles } from './geotab/vehicleSync.js';
import { syncGeotabDrivers } from './geotab/driverSync.js';
import { syncGeotabFuel } from './geotab/fuelSync.js';
import { syncGeotabSafety } from './geotab/safetySync.js';
import { syncGeotabTrips } from './geotab/tripSync.js';
import { syncGeotabDiagnostics } from './geotab/diagnosticsSync.js';
import { processAllVehicleHealthForOrg } from './healthScoring/pipeline.js';

import { syncSamsaraVehicles } from './samsara/vehicleSync.js';
import { syncSamsaraDrivers } from './samsara/driverSync.js';
import { syncSamsaraFuel } from './samsara/fuelSync.js';
import { syncSamsaraSafety } from './samsara/safetySync.js';
import { syncSamsaraTrips } from './samsara/tripSync.js';
import { syncSamsaraDiagnostics } from './samsara/diagnosticsSync.js';

import { aggregateDriverBehavior } from './aggregateDriverBehavior.js';async function performGeotabSync(integration) {
    const { organization_id, credentials } = integration;
    console.log(`[Auto-Sync] Starting Geotab sync for org ${organization_id}`);
    
    let previousLastSyncAt = integration.last_sync_at;
    if (integration.last_sync_at === integration.created_at) {
        previousLastSyncAt = null;
    }

    try {
        await authenticateGeotab(credentials);

        let vehicleResult = await syncGeotabVehicles(organization_id, credentials);
        await syncGeotabDrivers(organization_id, credentials);

        let from, to;
        if (previousLastSyncAt) {
            const lastSync = new Date(previousLastSyncAt);
            from = new Date(lastSync.getTime() - 12 * 60 * 60 * 1000); // 12 hours overlap
            to = new Date();
        } else {
            const range = getDateRange(30);
            from = range.from;
            to = range.to;
        }

        console.log(`[Auto-Sync Geotab] Incremental Range: ${from.toISOString()} -> ${to.toISOString()}`);

        await syncGeotabFuel(organization_id, credentials, from, to, vehicleResult.deviceToLocalVehicle);
        await syncGeotabSafety(organization_id, credentials, from, to, vehicleResult.deviceToLocalVehicle);
        await syncGeotabTrips(organization_id, credentials, from, to, vehicleResult.deviceToLocalVehicle);
        await syncGeotabDiagnostics(organization_id, credentials, from, to, vehicleResult.deviceToLocalVehicle);

        await supabase.from('fleet_integrations')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('id', integration.id);

        try {
            await processAllVehicleHealthForOrg(organization_id);
        } catch (healthError) {
            console.error("[Auto-Sync Geotab] Health Scoring failed (non-fatal):", getErrorMessage(healthError));
        }

        console.log(`[Auto-Sync] Geotab sync completed for org ${organization_id}`);
    } catch (error) {
        const errMsg = getErrorMessage(error);
        console.error(`[Auto-Sync] Geotab sync failed for org ${organization_id}:`, errMsg);
        if (errMsg && errMsg.toLowerCase().includes('credential')) {
            console.error(`[Auto-Sync] Invalid credentials detected for org ${organization_id}. Marking as auth_failed to prevent lockouts.`);
            await supabase.from('fleet_integrations')
                .update({ status: 'auth_failed' })
                .eq('id', integration.id);
        }
    }
}

async function performSamsaraSync(integration) {
    const { organization_id, credentials } = integration;
    console.log(`[Auto-Sync] Starting Samsara sync for org ${organization_id}`);
    
    let previousLastSyncAt = integration.last_sync_at;
    if (integration.last_sync_at === integration.created_at) {
        previousLastSyncAt = null;
    }

    try {
        let vehicleResult = await syncSamsaraVehicles(organization_id, credentials);
        await syncSamsaraDrivers(organization_id, credentials);

        let from, to;
        if (previousLastSyncAt) {
            const lastSync = new Date(previousLastSyncAt);
            from = new Date(lastSync.getTime() - 12 * 60 * 60 * 1000); // 12 hours overlap
            to = new Date();
        } else {
            const range = getDateRange(30);
            from = range.from;
            to = range.to;
        }

        console.log(`[Auto-Sync Samsara] Incremental Range: ${from.toISOString()} -> ${to.toISOString()}`);

        await syncSamsaraFuel(organization_id, credentials, from, to, vehicleResult.deviceToLocalVehicle);
        await syncSamsaraSafety(organization_id, credentials, from, to, vehicleResult.deviceToLocalVehicle);
        await syncSamsaraTrips(organization_id, credentials, from, to, vehicleResult.deviceToLocalVehicle);
        await syncSamsaraDiagnostics(organization_id, credentials, from, to, vehicleResult.deviceToLocalVehicle);

        await supabase.from('fleet_integrations')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('id', integration.id);

        try {
            await processAllVehicleHealthForOrg(organization_id);
        } catch (healthError) {
            console.error("[Auto-Sync Samsara] Health Scoring failed (non-fatal):", getErrorMessage(healthError));
        }

        console.log(`[Auto-Sync] Samsara sync completed for org ${organization_id}`);
    } catch (error) {
        const errMsg = getErrorMessage(error);
        console.error(`[Auto-Sync] Samsara sync failed for org ${organization_id}:`, errMsg);
        if (errMsg && (errMsg.toLowerCase().includes('credential') || errMsg.toLowerCase().includes('unauthorized') || errMsg.toLowerCase().includes('401'))) {
            console.error(`[Auto-Sync] Invalid credentials detected for org ${organization_id}. Marking as auth_failed to prevent lockouts.`);
            await supabase.from('fleet_integrations')
                .update({ status: 'auth_failed' })
                .eq('id', integration.id);
        }
    }
}

export async function runAutoSync() {
    console.log("⏱️ [Auto-Sync] Triggering background sync for all connected organizations...");
    try {
        const { data: integrations, error } = await supabase
            .from('fleet_integrations')
            .select('*')
            .eq('status', 'connected')
            .not('credentials', 'is', null);

        if (error) {
            console.error("❌ [Auto-Sync] Error fetching integrations:", getErrorMessage(error));
            return;
        }

        if (!integrations || integrations.length === 0) {
            console.log("⏱️ [Auto-Sync] No connected integrations found.");
            return;
        }

        const { chunkArray } = await import('../utils/helpers.js');
        const chunks = chunkArray(integrations, 5);

        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (integration) => {
                if (integration.provider_id === 'geotab') {
                    await performGeotabSync(integration);
                } else if (integration.provider_id === 'samsara') {
                    await performSamsaraSync(integration);
                }
            }));
        }
        
        try {
            console.log("⏱️ [Auto-Sync] Aggregating Driver Behavior...");
            await aggregateDriverBehavior();
        } catch (aggError) {
            console.error("❌ [Auto-Sync] Driver Behavior Aggregation failed (non-fatal):", getErrorMessage(aggError));
        }
        
        console.log("✅ [Auto-Sync] Background sync finished for all orgs.");
    } catch (err) {
        console.error("❌ [Auto-Sync] Background sync error:", getErrorMessage(err));
    }
}

export function initCronJobs() {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', () => {
        runAutoSync();
    });
    
    // Also run once on startup shortly after boot
    setTimeout(() => {
        runAutoSync();
    }, 5000);
}
