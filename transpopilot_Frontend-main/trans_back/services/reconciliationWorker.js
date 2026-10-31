import { supabase } from '../config/supabase.js';

export async function reconcileUnassignedIncidents(organizationId) {
  let resolved = 0;
  let ambiguous = 0;
  let unresolved = 0;

  try {
    // 1. Fetch unassigned incidents
    const { data: incidents, error: fetchError } = await supabase
      .from('safety_incident_reports')
      .select('id, vehicle_id, provider_driver_id, date')
      .eq('organization_id', organizationId)
      .is('driver_id', null);

    if (fetchError) throw fetchError;
    if (!incidents || incidents.length === 0) {
      return { resolved, ambiguous, unresolved };
    }

    // 2. Fetch drivers with their provider employee_id
    const { data: drivers, error: driversError } = await supabase
      .from('drivers')
      .select('id, employee_id')
      .eq('organization_id', organizationId)
      .not('employee_id', 'is', null);
      
    if (driversError) throw driversError;
    const providerDriverMap = new Map();
    drivers.forEach(d => providerDriverMap.set(d.employee_id, d.id));

    // 3. Fetch current vehicle assignments
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, driver_id')
      .eq('organization_id', organizationId)
      .not('driver_id', 'is', null);

    if (vehiclesError) throw vehiclesError;
    const vehicleDriverMap = new Map();
    vehicles.forEach(v => vehicleDriverMap.set(v.id, v.driver_id));

    // Optional: historical assignments from vehicle_assignments if it exists
    // (Skipping since it doesn't currently exist in schema)

    // 4. Resolve incidents
    const toUpdate = [];

    for (const inc of incidents) {
      let resolvedDriverId = null;

      // Priority 1: provider_driver_id
      if (inc.provider_driver_id && inc.provider_driver_id !== 'UnknownDriverId') {
        resolvedDriverId = providerDriverMap.get(inc.provider_driver_id);
      }

      // Priority 2: Fallback to current vehicle assignment
      if (!resolvedDriverId && inc.vehicle_id) {
        resolvedDriverId = vehicleDriverMap.get(inc.vehicle_id);
      }

      if (resolvedDriverId) {
        toUpdate.push({
          id: inc.id,
          driver_id: resolvedDriverId,
          organization_id: organizationId // for RLS/safety
        });
        resolved++;
      } else {
        unresolved++;
      }
    }

    // 5. Bulk update resolved incidents
    if (toUpdate.length > 0) {
      // Supabase upsert doesn't support bulk partial update without full row, so we loop or use RPC
      // Doing in chunks
      const chunkSize = 500;
      for (let i = 0; i < toUpdate.length; i += chunkSize) {
        const chunk = toUpdate.slice(i, i + chunkSize);
        for (const update of chunk) {
           await supabase
             .from('safety_incident_reports')
             .update({ driver_id: update.driver_id })
             .eq('id', update.id);
        }
      }
    }

    return { resolved, ambiguous, unresolved };

  } catch (err) {
    console.error(`[Reconciliation Worker] Error org ${organizationId}:`, err);
    throw err;
  }
}

if (process.argv[1] && process.argv[1].endsWith('reconciliationWorker.js')) {
  const orgId = process.argv[2];
  if (!orgId) {
    console.log('Usage: node reconciliationWorker.js <organization_id>');
    process.exit(1);
  }
  reconcileUnassignedIncidents(orgId)
    .then(stats => console.log('Reconciliation Complete:', stats))
    .catch(err => console.error(err));
}
