import { calculateVehicleHealth } from './scorer.js';
import { mapGeotabDiagnostics, mapSamsaraDiagnostics } from './mapper.js';
import { supabase } from '../../config/supabase.js';
import crypto from 'crypto';

export async function processVehicleHealth(organizationId, vehicleId, diagnosticRow, maintenanceRecords, provider) {
  let normalizedData;

  if (provider === 'geotab') {
    normalizedData = mapGeotabDiagnostics(diagnosticRow, maintenanceRecords);
  } else if (provider === 'samsara') {
    normalizedData = mapSamsaraDiagnostics(diagnosticRow, maintenanceRecords);
  } else {
    normalizedData = {
      batteryVoltage: null,
      coolantTemp: null,
      isPmOverdue: null,
      hasCriticalFault: false,
      hasWarningFault: false,
      componentFaults: { engine: null, dpf: null, transmission: null }
    };
  }

  const scores = calculateVehicleHealth(normalizedData);
  
  if (scores.isInsufficientData) {
    const { error } = await supabase
      .from('vehicle_health_scores')
      .upsert({
        organization_id: organizationId,
        vehicle_id: vehicleId,
        overall_score: null,
        engine_score: null,
        cooling_score: null,
        pm_score: null,
        dpf_score: null,
        transmission_score: null,
        battery_score: null,
        has_critical_fault: false,
        has_warning_fault: false,
        data_source: 'calculated',
        score_version: 'v1',
        updated_at: new Date().toISOString()
      }, { onConflict: 'vehicle_id' });
      
    if (error) console.error("Error upserting insufficient data score", error);
    return;
  }

  // Generate Hash
  const hashString = JSON.stringify(normalizedData);
  const diagnosticHash = crypto.createHash('sha256').update(hashString).digest('hex');

  // Check if hash changed from last score
  const { data: existingScore } = await supabase
    .from('vehicle_health_scores')
    .select('last_diagnostic_hash, ai_recommendation')
    .eq('vehicle_id', vehicleId)
    .maybeSingle();

  // No longer generating AI recommendations automatically in the background due to rate limits
  let aiRecommendation = existingScore ? existingScore.ai_recommendation : null;

  // Estimated repair cost based on historical maintenance records for this org
  let estimatedRepairCost = null;
  if (scores.has_critical_fault || scores.has_warning_fault) {
    const repairRecords = maintenanceRecords.filter(r => r.service_type === 'General Repair' && r.cost);
    if (repairRecords.length > 0) {
      const avg = repairRecords.reduce((sum, r) => sum + Number(r.cost), 0) / repairRecords.length;
      estimatedRepairCost = avg;
    }
  }

  const { error } = await supabase
    .from('vehicle_health_scores')
    .upsert({
      organization_id: organizationId,
      vehicle_id: vehicleId,
      overall_score: scores.overall_score,
      engine_score: scores.engine_score,
      cooling_score: scores.cooling_score,
      pm_score: scores.pm_score,
      dpf_score: scores.dpf_score,
      transmission_score: scores.transmission_score,
      battery_score: scores.battery_score,
      has_critical_fault: scores.has_critical_fault,
      has_warning_fault: scores.has_warning_fault,
      ai_recommendation: aiRecommendation,
      estimated_repair_cost: estimatedRepairCost,
      last_diagnostic_hash: diagnosticHash,
      data_source: 'calculated',
      score_version: 'v1',
      updated_at: new Date().toISOString()
    }, { onConflict: 'vehicle_id' });
    
  if (error) console.error("Error upserting health score", error);
}

export async function processAllVehicleHealthForOrg(organizationId) {
  try {
    const { data: diagnostics, error: diagError } = await supabase
      .from('vehicle_diagnostics')
      .select('*, vehicles!inner(provider)')
      .eq('organization_id', organizationId);
      
    if (diagError) throw diagError;

    const { data: maintenance, error: maintError } = await supabase
      .from('maintenance_records')
      .select('*')
      .eq('organization_id', organizationId);
      
    if (maintError) throw maintError;

    for (const row of (diagnostics || [])) {
      const vehicleMaintenance = (maintenance || []).filter(m => m.vehicle_id === row.vehicle_id);
      const provider = row.vehicles?.provider || 'geotab';
      await processVehicleHealth(organizationId, row.vehicle_id, row, vehicleMaintenance, provider);
    }
  } catch (error) {
    console.error('[Health Scoring] Failed to process fleet health scores:', error);
  }
}
