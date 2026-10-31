import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function aggregateDriverBehavior(organizationId = null) {
  let driversQuery = sb.from('drivers').select('id, organization_id');
  if (organizationId) {
    driversQuery = driversQuery.eq('organization_id', organizationId);
  }
  const {data: drivers} = await driversQuery;
  
  let vehiclesQuery = sb.from('vehicles').select('id, driver_id');
  if (organizationId) {
    vehiclesQuery = vehiclesQuery.eq('organization_id', organizationId);
  }
  const {data: vehicles} = await vehiclesQuery;
  
  console.log(`Aggregating data for ${drivers?.length || 0} drivers...`);
  
  for (const d of drivers || []) {
    const assignedVehicles = vehicles.filter(v => v.driver_id === d.id).map(v => v.id);
    let totalMiles = 0;
    let totalHours = 0;
    let idleMinutes = 0;
    
    let queryStr = `driver_id.eq.${d.id}`;
    if (assignedVehicles.length > 0) {
      queryStr = `${queryStr},vehicle_id.in.(${assignedVehicles.join(',')})`;
    }
    const {data: trips} = await sb.from('vehicle_trips').select('distance, driving_duration, idle_duration').or(queryStr);
    if (trips) {
      trips.forEach(t => {
        totalMiles += (t.distance || 0);
        totalHours += (t.driving_duration || 0) / 3600; // Assuming driving_duration is in seconds
        idleMinutes += (t.idle_duration || 0) / 60;
      });
    }
    
    const {data: incidents} = await sb.from('safety_incident_reports').select('description, vehicle_id, date').eq('driver_id', d.id);
    let harshBraking = 0;
    let harshAccel = 0;
    let speed = 0;
    if (incidents) {
      const seen = new Set();
      const deduped = [];
      for (const i of incidents) {
        const key = i.vehicle_id + '_' + i.date + '_' + i.description;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(i);
        }
      }
      deduped.forEach(i => {
        const desc = i.description ? i.description.toLowerCase() : '';
        if (desc.includes('braking')) harshBraking++;
        if (desc.includes('acceleration')) harshAccel++;
        if (desc.includes('speed')) speed++;
      });
    }
    
    if (totalMiles > 0 || incidents?.length > 0) {
      await sb.from('driver_behavior_analytics').delete().eq('driver_id', d.id);
      
      const {error} = await sb.from('driver_behavior_analytics').insert({
        driver_id: d.id,
        organization_id: d.organization_id,
        recorded_date: new Date().toISOString().split('T')[0],
        total_distance_miles: totalMiles,
        total_drive_time_hours: totalHours,
        harsh_braking_count: harshBraking,
        harsh_acceleration_count: harshAccel,
        speed_violations_count: speed,
        idle_time_minutes: idleMinutes
      });
      
      if (error) console.error(`Error inserting for driver ${d.id}:`, error);
      else console.log(`Aggregated driver ${d.id}: ${totalMiles.toFixed(2)} miles, ${incidents?.length || 0} incidents`);
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('aggregateDriverBehavior.js')) {
  const orgId = process.argv[2] || null;
  aggregateDriverBehavior(orgId).then(() => console.log('Done')).catch(console.error);
}

