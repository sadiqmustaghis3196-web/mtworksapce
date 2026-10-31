import { supabase } from './config/supabase.js';

async function run() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('fuel_records')
    .select('id, organization_id, vehicle_id, transaction_date, gallons, total_cost, data_source, verification_status, receipt_url, created_at')
    .eq('organization_id', '6aa356e7-4f30-4c5a-9457-9ebbb6dc0f1a')
    .gte('created_at', twoHoursAgo);

  if (error) {
    console.error('Error fetching:', error);
  } else {
    console.log('Fuel records created in last 2 hours:');
    console.table(data);
  }
}
run();
