import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const OTHER_ORG_ID = 'bd53a21e-0cc5-41fb-9338-cae90835b5c9';

async function run() {
  console.log(`🧹 Starting database cleanup for old organization: ${OTHER_ORG_ID}...`);

  // 1. Delete integrations to prevent future auto-sync runs for this old org
  const { data: delInt, error: errInt } = await supabase
    .from('fleet_integrations')
    .delete()
    .eq('organization_id', OTHER_ORG_ID);

  if (errInt) {
    console.error("Error deleting old integrations:", errInt);
  } else {
    console.log("✅ Successfully deleted old fleet integrations.");
  }

  // 2. Delete drivers for the old org
  const { data: delDrivers, error: errDrivers } = await supabase
    .from('drivers')
    .delete()
    .eq('organization_id', OTHER_ORG_ID);

  if (errDrivers) {
    console.error("Error deleting old drivers:", errDrivers);
  } else {
    console.log("✅ Successfully deleted old drivers from database.");
  }

  // 3. Delete vehicles for the old org
  const { data: delVehicles, error: errVehicles } = await supabase
    .from('vehicles')
    .delete()
    .eq('organization_id', OTHER_ORG_ID);

  if (errVehicles) {
    console.error("Error deleting old vehicles:", errVehicles);
  } else {
    console.log("✅ Successfully deleted old vehicles from database.");
  }

  console.log("🎉 Cleanup complete!");
}
run();
