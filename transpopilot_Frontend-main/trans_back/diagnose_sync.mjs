import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("--- STEP 1: Find Geotab Vehicle & Credentials ---");
  
  const { data: integrations, error: intErr } = await supabase
    .from('fleet_integrations')
    .select('*')
    .eq('provider_id', 'geotab')
    .not('credentials', 'is', null);
    
  if (intErr || !integrations || integrations.length === 0) {
    console.error("Could not find any geotab fleet integrations", intErr);
    return;
  }
  
  let workingIntegration = null;
  let sessionId, serverUrl;
  
  for (const integration of integrations) {
    const { database, username, password, server } = integration.credentials;
    try {
      const authRes = await fetch(`https://${server || 'my.geotab.com'}/apiv1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: "Authenticate",
          params: { userName: username, password, database }
        })
      });
      const authData = await authRes.json();
      if (!authData.error) {
        workingIntegration = integration;
        sessionId = authData.result.credentials.sessionId;
        serverUrl = authData.result.path === 'ThisServer' ? 'my.geotab.com' : authData.result.path;
        console.log(`Successfully authenticated to Geotab for org ${integration.organization_id}. serverUrl: ${serverUrl}`);
        break;
      }
    } catch (e) {}
  }
  
  if (!workingIntegration) {
    console.log("No working geotab credentials found in DB!");
    return;
  }
  
  const { database, username } = workingIntegration.credentials;
  const integration = workingIntegration;
  console.log(`  last_sync_at: ${integration.last_sync_at}`);
  
  // Find a vehicle for this org
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, provider_vehicle_id, organization_id')
    .eq('organization_id', integration.organization_id)
    .eq('provider', 'geotab')
    .limit(1);
    
  if (!vehicles || vehicles.length === 0) {
    console.log("No geotab vehicles for this working org.");
    return;
  }
  const vehicle = vehicles[0];
  console.log("Selected Vehicle:", { id: vehicle.id, provider_vehicle_id: vehicle.provider_vehicle_id });
  
  const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  console.log(`\nFetching Geotab trips for device ${vehicle.provider_vehicle_id} from ${fromDate}...`);
  
  try {
    const tripRes = await fetch(`https://${serverUrl}/apiv1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: "Get",
        params: {
          typeName: "Trip",
          search: {
            deviceSearch: { id: vehicle.provider_vehicle_id },
            fromDate: fromDate
          },
          credentials: { database, sessionId, userName: username }
        }
      })
    });
    const tripData = await tripRes.json();
    if (tripData.error) {
      console.error("Error fetching trips:", tripData.error);
    } else {
      console.log(`Found ${tripData.result.length} trips in Geotab for the last 24 hours.`);
      if (tripData.result.length > 0) {
        console.log("Most recent Geotab trip:", {
           start: tripData.result[tripData.result.length-1].start,
           stop: tripData.result[tripData.result.length-1].stop,
           distance: tripData.result[tripData.result.length-1].distance
        });
      }
    }
    
    // Fetch DeviceStatusInfo (which trackingController uses)
    console.log(`\nFetching Geotab DeviceStatusInfo for device ${vehicle.provider_vehicle_id}...`);
    const statusRes = await fetch(`https://${serverUrl}/apiv1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: "Get",
        params: {
          typeName: "DeviceStatusInfo",
          search: {
            deviceSearch: { id: vehicle.provider_vehicle_id }
          },
          credentials: { database, sessionId, userName: username }
        }
      })
    });
    const statusData = await statusRes.json();
    if (statusData.error) {
      console.error("Error fetching DeviceStatusInfo:", statusData.error);
    } else {
      console.log(`Found ${statusData.result ? statusData.result.length : 0} DeviceStatusInfo records.`);
      if (statusData.result && statusData.result.length > 0) {
        console.log("Recent DeviceStatusInfo:", {
           dateTime: statusData.result[0].dateTime,
           latitude: statusData.result[0].latitude,
           longitude: statusData.result[0].longitude,
           isDriving: statusData.result[0].isDriving
        });
      }
    }
    
  } catch (e) {
    console.error("Error calling Geotab API:", e.message);
  }
  
  console.log("\n--- STEP 3: Check Our Database ---");
  const { data: dbTrips, error: dbTripErr } = await supabase
    .from('vehicle_trips')
    .select('start_time, end_time, distance')
    .eq('vehicle_id', vehicle.id)
    .gte('start_time', fromDate)
    .order('start_time', { ascending: false });
    
  if (dbTripErr) {
    console.error("Error getting db trips", dbTripErr);
  } else {
    console.log(`Found ${dbTrips.length} trips in our DB for this vehicle in the last 24 hours.`);
    if (dbTrips.length > 0) {
      console.log("Most recent DB trip:", dbTrips[0]);
    }
  }
  
  const { data: dbSafety, error: dbSafErr } = await supabase
    .from('safety_events')
    .select('timestamp, type')
    .eq('vehicle_id', vehicle.id)
    .order('timestamp', { ascending: false })
    .limit(1);
    
  if (dbSafErr) {
    console.error("Error getting db safety events", dbSafErr);
  } else {
    console.log(`Most recent safety_event entry timestamp: ${dbSafety.length > 0 ? dbSafety[0].timestamp : 'NONE'}`);
  }
}

run();
