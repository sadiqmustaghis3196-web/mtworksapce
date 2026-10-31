import { supabase } from './config/supabase.js';

async function checkIncidents() {
    let allData = [];
    let from = 0;
    let step = 999;
    while(true) {
        const { data } = await supabase
            .from('safety_incident_reports')
            .select('*')
            .range(from, from + step);
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length <= step) break;
        from += step + 1;
    }
    const counts = {};
    for (const r of allData) {
        counts[r.organization_id] = (counts[r.organization_id] || 0) + 1;
    }
    console.log("Incident counts by Org:");
    console.log(counts);
    
    // Pick the one with around 1480 incidents
    const targetOrg = Object.keys(counts).find(id => counts[id] >= 1480) || Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    console.log("Analyzing Org ID:", targetOrg);
    
    const orgData = allData.filter(r => r.organization_id === targetOrg);
    console.log("Total DB count for org:", orgData.length);
    
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let thisMonthCount = 0;
    
    const groupings = {};
    const externalIds = new Set();
    let duplicates = 0;

    for (const row of orgData) {
        const rowDate = new Date(row.date).getTime();
        if (rowDate >= thisMonthStart) {
            thisMonthCount++;
        }
    
        const key = `${row.provider}_${row.type}_${row.driver_id}_${row.vehicle_id}_${row.date}_${row.external_event_id}`;
        if (!groupings[key]) groupings[key] = 0;
        groupings[key]++;

        if (row.external_event_id) {
            if (externalIds.has(row.external_event_id)) {
                duplicates++;
            }
            externalIds.add(row.external_event_id);
        }
    }

    console.log("This Month Count:", thisMonthCount);
    console.log("Unique external events:", externalIds.size);
    console.log("Duplicates found (by external_event_id):", duplicates);
}

checkIncidents().catch(console.error);
