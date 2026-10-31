import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('--- 1. Schema of safety_incident_reports ---');
  const {data: sampleRows} = await sb.from('safety_incident_reports').select('*').limit(1);
  if (sampleRows && sampleRows.length > 0) {
    const sample = sampleRows[0];
    console.log('Columns:', Object.keys(sample).join(', '));
    console.log('Sample data:', sample);
  } else {
    console.log('Table is empty.');
  }

  console.log('\n--- 4. Cleanup Plan: DRY-RUN read-only query ---');
  // Fetch ALL rows with pagination
  let allIncidents = [];
  let page = 0;
  while (true) {
    const {data} = await sb.from('safety_incident_reports').select('id, organization_id, vehicle_id, type, date').range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allIncidents = allIncidents.concat(data);
    page++;
  }
  
  const statsByOrgVehicle = {};
  const groups = {};
  let totalDistinct = 0;
  let totalDuplicates = 0;
  
  allIncidents.forEach(r => {
    // Unique key: vehicle_id + date + type
    const key = r.vehicle_id + '_' + r.date + '_' + r.type;
    const orgVehKey = r.organization_id + ' | ' + r.vehicle_id;
    
    if (!statsByOrgVehicle[orgVehKey]) {
      statsByOrgVehicle[orgVehKey] = { totalRows: 0, distinct: 0, duplicates: 0 };
    }
    
    statsByOrgVehicle[orgVehKey].totalRows++;
    
    if (!groups[key]) {
      groups[key] = 1;
      statsByOrgVehicle[orgVehKey].distinct++;
      totalDistinct++;
    } else {
      groups[key]++;
      statsByOrgVehicle[orgVehKey].duplicates++;
      totalDuplicates++;
    }
  });

  console.log(`Global Totals -> Rows: ${allIncidents.length}, Distinct: ${totalDistinct}, Duplicates: ${totalDuplicates}`);
  console.log('Per Org/Vehicle Breakdown:');
  for (const [ov, stats] of Object.entries(statsByOrgVehicle)) {
    console.log(`  ${ov}: Rows=${stats.totalRows}, Distinct=${stats.distinct}, Duplicates=${stats.duplicates}`);
  }

  console.log('\n--- 5. Stray Orgs lookup ---');
  const {data: orgs} = await sb.from('fleet_integrations').select('organization_id, provider_id, status').eq('status', 'connected');
  
  const orgIds = [...new Set(orgs.map(o => o.organization_id))];
  
  const {data: orgDetails} = await sb.from('organizations').select('id, name').in('id', orgIds);
  const {data: users} = await sb.from('user_profiles').select('organization_id, email, role').in('organization_id', orgIds).eq('role', 'owner');
  
  const orgMap = {};
  if (orgDetails) orgDetails.forEach(o => orgMap[o.id] = { name: o.name, emails: [] });
  if (users) users.forEach(u => {
    if (orgMap[u.organization_id]) orgMap[u.organization_id].emails.push(u.email);
  });
  
  orgs.forEach(o => {
    const details = orgMap[o.organization_id];
    console.log(`Org: ${o.organization_id} | Provider: ${o.provider_id}`);
    if (details) {
      console.log(`  Name: ${details.name}`);
      console.log(`  Owner(s): ${details.emails.join(', ')}`);
    } else {
      console.log(`  Name: NOT FOUND`);
    }
  });
}

run();
