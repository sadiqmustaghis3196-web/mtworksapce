import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getGeotabApi } from './services/geotab/geotabApi.js';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const orgId = 'a609d7e3-78b1-4acd-a5ea-92c06e625a48';
  const { data: ints } = await supabase.from('fleet_integrations').select('credentials').eq('organization_id', orgId).eq('provider_id', 'geotab').single();
  const credentials = ints.credentials; 
  const from = new Date(Date.now() - 24*60*60*1000); 
  const to = new Date();
  
  const { data: existingSafety } = await supabase
      .from("safety_incident_reports")
      .select("vehicle_id, created_at, type, description")
      .eq("organization_id", orgId)
      .gte("date", from.toISOString())
      .lte("date", to.toISOString())
      .limit(5);
      
  const existingIds = new Set(
      (existingSafety || []).map(s => {
        const match = (s.description || "").match(/\(ID: (.*?)\)/);
        const eventId = match ? match[1] : `${new Date(s.created_at).toISOString()}_${s.type}`;
        return `${s.vehicle_id}_${eventId}`;
      })
  );
  
  console.log("existingIds sample:", Array.from(existingIds).slice(0, 5));
  
  // fetch 1 event from Geotab
  const api = await getGeotabApi(credentials);
  const events = await api.call("Get", {
        typeName: "ExceptionEvent",
        search: {
          fromDate: from.toISOString(),
          toDate: to.toISOString()
        },
        resultsLimit: 1
  });
  
  const event = events[0];
  let provider_event_id = event.id || event.eventId || null;
  const eventDate = event.activeFrom || event.dateTime || event.fromDate;
  const compositeKey = `vehicleIdHere_${provider_event_id || `${new Date(eventDate).toISOString()}_other`}`;
  
  console.log("provider_event_id:", provider_event_id);
  console.log("eventDate:", eventDate);
  console.log("compositeKey:", compositeKey);
}

run();
