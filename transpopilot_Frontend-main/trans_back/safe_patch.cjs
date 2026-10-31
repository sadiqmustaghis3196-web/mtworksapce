const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

const safetySyncFunction = `
async function syncGeotabSafety(organizationId, credentials, from, to) {
    try {
        const devices = await getGeotabDevices(organizationId, credentials);
        const rules = await getGeotabRules(organizationId, credentials);
        
        const { data: vehiclesData } = await supabase
            .from('vehicles')
            .select('id, vehicle_number')
            .eq('organization_id', organizationId);
            
        const vehicleMap = {};
        if (vehiclesData) {
            vehiclesData.forEach(v => {
                vehicleMap[v.vehicle_number] = v.id;
            });
        }
        
        const { data: existingIncidents } = await supabase
            .from('safety_incident_reports')
            .select('description')
            .eq('organization_id', organizationId);
            
        const existingEventIds = new Set();
        if (existingIncidents) {
            existingIncidents.forEach(inc => {
                const match = inc.description.match(/\\[GeotabEvent:([^\\]]+)\\]/);
                if (match) existingEventIds.add(match[1]);
            });
        }

        const upserts = [];
        const ruleMap = {};
        rules.forEach(r => { ruleMap[r.id] = r.name; });

        const res = await callGeotabApi(organizationId, credentials, {
            method: "Get",
            params: {
                typeName: "ExceptionEvent",
                search: { fromDate: from.toISOString(), toDate: to.toISOString() }
            }
        });
        
        const events = res.data.result || [];
        
        for (const ev of events) {
            if (existingEventIds.has(ev.id)) continue;
            
            const ruleName = ev.rule && ev.rule.id ? (ruleMap[ev.rule.id] || ev.rule.id) : 'Unknown Rule';
            
            let type = 'other';
            let severity = 'low';
            let ruleLower = ruleName.toLowerCase();
            
            if (ruleLower.includes('speed') || ruleLower.includes('speeding')) {
                type = 'violation';
                severity = 'medium';
            } else if (ruleLower.includes('acceleration')) {
                type = 'violation';
                severity = 'medium';
            } else if (ruleLower.includes('brake') || ruleLower.includes('braking')) {
                type = 'violation';
                severity = 'high';
            } else if (ruleLower.includes('corner')) {
                type = 'violation';
                severity = 'medium';
            } else if (ruleLower.includes('accident') || ruleLower.includes('crash')) {
                type = 'accident';
                severity = 'critical';
            }
            
            let vehicleId = null;
            if (ev.device && ev.device.id) {
                const device = devices.find(d => d.id === ev.device.id);
                if (device) {
                    vehicleId = vehicleMap[device.name];
                }
            }
            
            upserts.push({
                organization_id: organizationId,
                vehicle_id: vehicleId,
                date: ev.activeFrom || new Date().toISOString(),
                type: type,
                severity: severity,
                description: \`\${ruleName} [\${type}] - [GeotabEvent:\${ev.id}]\`,
                location: 'Geotab Telemetry',
                resolved: false
            });
        }
        
        if (upserts.length > 0) {
            const chunkSize = 1000;
            for (let i = 0; i < upserts.length; i += chunkSize) {
                const chunk = upserts.slice(i, i + chunkSize);
                const { error } = await supabase.from('safety_incident_reports').insert(chunk);
                if (error) {
                    console.error(\`[Geotab Safety Sync] Insert chunk error:\`, error.message);
                }
            }
        }
        return upserts.length;
    } catch (err) {
        console.error("[Geotab Safety Sync] Error:", err.message);
        return 0;
    }
}
`;

// 1. Inject safety sync func
if (!code.includes('async function syncGeotabSafety')) {
    code = code.replace(
        'async function syncGeotabFuel(organizationId, credentials, from, to) {',
        safetySyncFunction + '\nasync function syncGeotabFuel(organizationId, credentials, from, to) {'
    );
}

// 2. Inject it into `/api/sync-geotab`
const oldGeotabSync = `// 4. REAL GEOTAB FUEL / FILLUPEVENT SYNC
        let fuelCount = 0;
        try {
            const to = new Date();
            const from = new Date(to.getTime());
            from.setMonth(from.getMonth() - 2);
            
            console.log(\`> [Geotab] Fetching real FillUpEvents from \${from.toISOString()} to \${to.toISOString()}\`);
            fuelCount = await syncGeotabFuel(organizationId, creds, from, to);
        } catch (e) {
            console.error("[Geotab Fuel Sync Runtime Error]:", e.message);
        }

        return res.json({
            success: true,
            vehicleCount: rawVehicles.length,
            driverCount: driversToInsert.length,
            fuelCount
        });`;

const newGeotabSync = `// 4. REAL GEOTAB FUEL AND SAFETY SYNC
        let fuelCount = 0;
        let safetyCount = 0;
        try {
            const to = new Date();
            const from = new Date(to.getTime());
            from.setMonth(from.getMonth() - 2);
            
            console.log(\`[Geotab] Fetching real FillUpEvents from \${from.toISOString()} to \${to.toISOString()}\`);
            fuelCount = await syncGeotabFuel(organizationId, creds, from, to);
            
            console.log(\`[Geotab] Fetching real ExceptionEvents for Safety from \${from.toISOString()} to \${to.toISOString()}\`);
            safetyCount = await syncGeotabSafety(organizationId, creds, from, to);
        } catch (e) {
            console.error("[Geotab Sync Runtime Error]:", e.message);
        }

        return res.json({
            success: true,
            vehicleCount: rawVehicles.length,
            driverCount: driversToInsert.length,
            fuelCount,
            safetyCount
        });`;

if (!code.includes('safetyCount = await syncGeotabSafety')) {
    code = code.replace(oldGeotabSync, newGeotabSync);
}

// 3. Fix integrations reference error safely without duplicates
const endpoints = ['/api/geotab-compliance', '/api/geotab-incidents', '/api/geotab-speed-profile'];

endpoints.forEach(route => {
    const routeIndex = code.indexOf(route);
    if (routeIndex !== -1) {
        const targetStr = 'if (!integrations || integrations.length === 0) {';
        const targetIndex = code.indexOf(targetStr, routeIndex);
        if (targetIndex !== -1 && targetIndex - routeIndex < 2000) {
            // Check if we already injected it right before this
            const checkRegion = code.substring(routeIndex, targetIndex);
            if (!checkRegion.includes('const integrations = await getCachedIntegrations(organizationId);')) {
                code = code.substring(0, targetIndex) + 'const integrations = await getCachedIntegrations(organizationId);\n        ' + code.substring(targetIndex);
            }
        }
    }
});

fs.writeFileSync('server.js', code);
console.log('Safe patch applied');
