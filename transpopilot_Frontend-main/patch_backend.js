const fs = require('fs');
let code = fs.readFileSync('trans_back/server.js', 'utf8');

// 1. Add clearCachesForOrganization function
const cacheClearingFunc = `
function clearCachesForOrganization(organizationId, provider = null) {
    console.log(\`[Cache] Clearing caches for org \${organizationId}, provider \${provider || 'all'}\`);
    if (!provider || provider === 'geotab') {
        delete geotabSessionCache[organizationId];
        delete geotabDeviceCache[organizationId];
        delete geotabUserCache[organizationId];
        delete geotabRuleCache[organizationId];
    }
    delete integrationCache[organizationId];
    
    Object.keys(riskStatsCache).forEach(key => { if (key.startsWith(organizationId + ':')) delete riskStatsCache[key]; });
    Object.keys(overviewStatsCache).forEach(key => { if (key.startsWith(organizationId + ':')) delete overviewStatsCache[key]; });
    Object.keys(speedProfileCache).forEach(key => { if (key.startsWith(organizationId + ':')) delete speedProfileCache[key]; });
}
`;
code = code.replace('const integrationCache = {};', 'const integrationCache = {};\n' + cacheClearingFunc);

// 2. Call clearCachesForOrganization in sync-geotab
code = code.replace(
    /await supabase\.from\('fleet_integrations'\)\.upsert\(\{[\s\S]*?provider_id:\s*'geotab'[\s\S]*?\}\s*,\s*\{\s*onConflict:\s*'user_id,\s*provider_id'\s*\}\);/,
    (match) => match + `\n        clearCachesForOrganization(organizationId, 'geotab');`
);

// 3. Call clearCachesForOrganization in sync-samsara
code = code.replace(
    /await supabase\.from\('fleet_integrations'\)\.upsert\(\{[\s\S]*?provider_id:\s*'samsara'[\s\S]*?\}\s*,\s*\{\s*onConflict:\s*'user_id,\s*provider_id'\s*\}\);/,
    (match) => match + `\n        clearCachesForOrganization(organizationId, 'samsara');`
);

// 4. Update riskStatsCache
code = code.replace(
    /const riskStatsCache = \{\};/g,
    `const riskStatsCache = {};\nfunction getCacheKey(orgId, integrations, endpoint, filters = 'none') {\n    const providers = integrations ? integrations.map(i => i.provider_id).sort().join(',') : 'none';\n    return \`\${orgId}:\${providers}:\${endpoint}:\${filters}\`;\n}`
);

// risk report usage
code = code.replace(
    /if \(!forceRefresh && riskStatsCache\[organizationId\] && \(nowCache - riskStatsCache\[organizationId\]\.timestamp < 10 \* 60 \* 1000\)\) \{/,
    `const integrations = await getCachedIntegrations(organizationId);
        const cacheKey = getCacheKey(organizationId, integrations, 'risk-report');
        if (!forceRefresh && riskStatsCache[cacheKey] && (nowCache - riskStatsCache[cacheKey].timestamp < 10 * 60 * 1000)) {`
);
code = code.replace(/riskStatsCache\[organizationId\]\.data/g, 'riskStatsCache[cacheKey].data');
code = code.replace(/riskStatsCache\[organizationId\]\.providers/g, 'riskStatsCache[cacheKey].providers');
code = code.replace(/riskStatsCache\[organizationId\]\.partial/g, 'riskStatsCache[cacheKey].partial');
code = code.replace(/riskStatsCache\[organizationId\]\.timestamp/g, 'riskStatsCache[cacheKey].timestamp');
code = code.replace(/riskStatsCache\[organizationId\] =/g, 'riskStatsCache[cacheKey] =');
// Note: We need to remove the extra `const integrations = await getCachedIntegrations(organizationId);` later in risk report if it exists.
code = code.replace(
    /const integrations = await getCachedIntegrations\(organizationId\);\s+if \(!integrations \|\| integrations\.length === 0\) \{/g,
    `if (!integrations || integrations.length === 0) {`
);

// overview stats usage
code = code.replace(
    /if \(!forceRefresh && overviewStatsCache\[organizationId\] && \(nowCache - overviewStatsCache\[organizationId\]\.timestamp < 10 \* 60 \* 1000\)\) \{/,
    `const integrations = await getCachedIntegrations(organizationId);
        const cacheKey = getCacheKey(organizationId, integrations, 'overview');
        if (!forceRefresh && overviewStatsCache[cacheKey] && (nowCache - overviewStatsCache[cacheKey].timestamp < 10 * 60 * 1000)) {`
);
code = code.replace(/overviewStatsCache\[organizationId\]\.data/g, 'overviewStatsCache[cacheKey].data');
code = code.replace(/overviewStatsCache\[organizationId\]\.providers/g, 'overviewStatsCache[cacheKey].providers');
code = code.replace(/overviewStatsCache\[organizationId\]\.partial/g, 'overviewStatsCache[cacheKey].partial');
code = code.replace(/overviewStatsCache\[organizationId\]\.timestamp/g, 'overviewStatsCache[cacheKey].timestamp');
code = code.replace(/overviewStatsCache\[organizationId\] =/g, 'overviewStatsCache[cacheKey] =');

// speed profile usage
code = code.replace(
    /const cacheKey = \`\$\{organizationId\}_.*\`;/,
    `const cacheKey = getCacheKey(organizationId, integrations, 'speed-profile', \`\${deviceId}:\${timeframe}\`);`
);

fs.writeFileSync('trans_back/server.js', code);
console.log('Backend patched successfully.');
