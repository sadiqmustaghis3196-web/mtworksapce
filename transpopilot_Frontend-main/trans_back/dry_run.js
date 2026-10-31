import { createClient } from '@supabase/supabase-js';
import { callGeotabApi } from './services/geotab/geotabApi.js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const orgId = 'a609d7e3-78b1-4acd-a5ea-92c06e625a48';
  
  // 1. Get current null counts
  const { data: nullTrips } = await sb.from('vehicle_trips').select('provider_trip_id').eq('organization_id', orgId).is('driver_id', null);
  const { data: nullSafety } = await sb.from('safety_incident_reports').select('type, date').eq('organization_id', orgId).is('driver_id', null);
  
  console.log(`Current null driver_id in a609d7e3:`);
  console.log(`- Trips: ${nullTrips ? nullTrips.length : 0}`);
  console.log(`- Safety Incidents: ${nullSafety ? nullSafety.length : 0}`);

  // 2. Fetch driver mappings directly from Geotab
  // First, we need to know what driver Dedrick is in Geotab
  const { data: ints } = await sb.from('fleet_integrations').select('credentials').eq('organization_id', orgId).eq('provider_id', 'geotab').single();
  const credentials = ints.credentials; 
  
  const users = await callGeotabApi(orgId, credentials, {
    method: "Get",
    params: { typeName: "User" }
  });
  const dedrick = users.find(u => u.name && u.name.toLowerCase().includes('partners@transpopilotai'));
  
  if (!dedrick) {
    console.log("Could not find Dedrick in Geotab payload");
    return;
  }
  
  console.log(`\nGeotab Driver ID for Dedrick: ${dedrick.id}`);

  // Fetch Trips
  const geotabTrips = await callGeotabApi(orgId, credentials, {
    method: "Get",
    params: {
      typeName: "Trip",
      search: {
        fromDate: new Date(Date.now() - 30*24*60*60*1000).toISOString(),
        toDate: new Date().toISOString()
      },
      resultsLimit: 50000
    }
  });

  // Fetch Exceptions
  const geotabExceptions = await callGeotabApi(orgId, credentials, {
    method: "Get",
    params: {
      typeName: "ExceptionEvent",
      search: {
        fromDate: new Date(Date.now() - 30*24*60*60*1000).toISOString(),
        toDate: new Date().toISOString()
      },
      resultsLimit: 50000
    }
  });

  let resolvableTrips = 0;
  for (const trip of geotabTrips) {
    const driverId = trip.driver?.id || trip.driverId;
    if (driverId === dedrick.id) {
       // Check if this trip exists in our null list
       const exists = nullTrips.find(t => t.provider_trip_id === trip.id);
       if (exists) resolvableTrips++;
    }
  }

  let resolvableSafety = 0;
  for (const ev of geotabExceptions) {
    const driverId = ev.driver?.id || ev.driverId;
    if (driverId === dedrick.id) {
       resolvableSafety++; // Simplified match check
    }
  }

  console.log(`\nDry-run Resolution (matching Geotab driver ${dedrick.id}):`);
  console.log(`- Trips that would resolve: ${resolvableTrips}`);
  console.log(`- Safety Incidents that would resolve: ${resolvableSafety}`);
}

run();
