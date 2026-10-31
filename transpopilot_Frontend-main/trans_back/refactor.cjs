const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

const helperCode = `
// ==========================================
// GEOTAB SESSION CACHING HELPER
// ==========================================
const geotabSessionCache = {};

async function getGeotabSession(organizationId, credentialsObj) {
    const now = Date.now();
    if (geotabSessionCache[organizationId] && (now - geotabSessionCache[organizationId].timestamp < 10 * 60 * 1000)) {
        console.log(\`[Geotab] Using cached session for org: \${organizationId}\`);
        return geotabSessionCache[organizationId].session;
    }

    console.log(\`[Geotab] Authenticating fresh for org: \${organizationId}\`);
    const auth = await axios.post("https://my.geotab.com/apiv1", {
        method: "Authenticate",
        params: { userName: credentialsObj.username, password: credentialsObj.password, database: credentialsObj.database }
    });

    if (auth.data.error) throw new Error("Geotab Auth Failed: " + auth.data.error.message);
    
    const credentials = auth.data.result.credentials;
    const serverPath = auth.data.result.path === "ThisServer" ? "my.geotab.com" : auth.data.result.path;
    const session = { credentials, serverPath };

    geotabSessionCache[organizationId] = { session, timestamp: now };
    return session;
}

async function callGeotabApi(organizationId, credentialsObj, payload) {
    let session = await getGeotabSession(organizationId, credentialsObj);
    payload.params = payload.params || {};
    payload.params.credentials = session.credentials;

    try {
        let res = await axios.post(\`https://\${session.serverPath}/apiv1\`, payload);
        if (res.data && res.data.error && (res.data.error.name === "InvalidUserException" || res.data.error.message.includes("Invalid credentials") || res.data.error.message.includes("Session"))) {
            console.log(\`[Geotab] Session expired for org \${organizationId}. Clearing cache and retrying...\`);
            delete geotabSessionCache[organizationId];
            session = await getGeotabSession(organizationId, credentialsObj);
            payload.params.credentials = session.credentials;
            res = await axios.post(\`https://\${session.serverPath}/apiv1\`, payload);
        }
        return res;
    } catch (err) {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            console.log(\`[Geotab] Session expired (HTTP \${err.response.status}) for org \${organizationId}. Clearing cache and retrying...\`);
            delete geotabSessionCache[organizationId];
            session = await getGeotabSession(organizationId, credentialsObj);
            payload.params.credentials = session.credentials;
            return await axios.post(\`https://\${session.serverPath}/apiv1\`, payload);
        }
        throw err;
    }
}
`;

// Insert the helper at the top, right after standard setup
code = code.replace("app.get('/', (req, res) => {\r\n    res.send('TranspoPilot Backend is Running 🚀');\r\n});", "app.get('/', (req, res) => {\r\n    res.send('TranspoPilot Backend is Running 🚀');\r\n});\n" + helperCode);
// If Linux line endings
code = code.replace("app.get('/', (req, res) => {\n    res.send('TranspoPilot Backend is Running 🚀');\n});", "app.get('/', (req, res) => {\n    res.send('TranspoPilot Backend is Running 🚀');\n});\n" + helperCode);

// 1. sync-geotab
code = code.replace(
    /const auth = await axios\.post\("https:\/\/my\.geotab\.com\/apiv1", \{\s*method: "Authenticate",\s*params: \{ userName: username, password: password, database: database \}\s*\}\);\s*if \(auth\.data\.error\) throw new Error\("Geotab Auth Failed: " \+ auth\.data\.error\.message\);\s*const credentials = auth\.data\.result\.credentials;\s*let serverPath = auth\.data\.result\.path === "ThisServer" \? "my\.geotab\.com" : auth\.data\.result\.path;\s*console\.log\(`✅ \[Geotab\] Auth Success\. Server: \$\{serverPath\}`\);/g,
    "const creds = { username, password, database };"
);

// 2. live-locations
code = code.replace(
    /const \{ username, database, password \} = integration\.credentials;\s*const auth = await axios\.post\("https:\/\/my\.geotab\.com\/apiv1", \{\s*method: "Authenticate",\s*params: \{ userName: username, password: password, database: database \}\s*\}\);\s*if \(auth\.data\.error\) throw new Error\(auth\.data\.error\.message\);\s*const credentials = auth\.data\.result\.credentials;\s*const serverPath = auth\.data\.result\.path === "ThisServer" \? "my\.geotab\.com" : auth\.data\.result\.path;/g,
    ""
);

// 3. driver-history
code = code.replace(
    /const \{ username, database, password \} = provider\.credentials;\s*const auth = await axios\.post\("https:\/\/my\.geotab\.com\/apiv1", \{\s*method: "Authenticate",\s*params: \{ userName: username, password: password, database: database \}\s*\}\);\s*const credentials = auth\.data\.result\.credentials;\s*const serverPath = auth\.data\.result\.path === "ThisServer" \? "my\.geotab\.com" : auth\.data\.result\.path;/g,
    ""
);

// 4. vehicle-trips
code = code.replace(
    /const \{ username, database, password \} = integration\.credentials;\s*const auth = await axios\.post\("https:\/\/my\.geotab\.com\/apiv1", \{\s*method: "Authenticate",\s*params: \{ userName: username, password: password, database: database \}\s*\}\);\s*if \(auth\.data\.error\) throw new Error\(auth\.data\.error\.message\);\s*const credentials = auth\.data\.result\.credentials;\s*const serverPath = auth\.data\.result\.path === "ThisServer" \? "my\.geotab\.com" : auth\.data\.result\.path;/g,
    ""
);

// 5. geotab-compliance
code = code.replace(
    /const \{ username, database, password \} = provider\.credentials;\s*const auth = await axios\.post\('https:\/\/my\.geotab\.com\/apiv1', \{ method: 'Authenticate', params: \{ userName: username, password, database \} \}\);\s*const credentials = auth\.data\.result\.credentials;\s*const serverPath = auth\.data\.result\.path === 'ThisServer' \? 'my\.geotab\.com' : auth\.data\.result\.path;/g,
    ""
);

// 6. geotab-incidents
code = code.replace(
    /const \{ username, database, password \} = provider\.credentials;\s*const auth = await axios\.post\('https:\/\/my\.geotab\.com\/apiv1', \{ method: 'Authenticate', params: \{ userName: username, password, database \} \}\);\s*const credentials = auth\.data\.result\.credentials;\s*const serverPath = auth\.data\.result\.path === 'ThisServer' \? 'my\.geotab\.com' : auth\.data\.result\.path;/g,
    ""
);

// 7. geotab-risk-report
code = code.replace(
    /const \{ username, database, password \} = provider\.credentials;\s*const auth = await axios\.post\('https:\/\/my\.geotab\.com\/apiv1', \{ method: 'Authenticate', params: \{ userName: username, password, database \} \}\);\s*const credentials = auth\.data\.result\.credentials;\s*const serverPath = auth\.data\.result\.path === 'ThisServer' \? 'my\.geotab\.com' : auth\.data\.result\.path;/g,
    ""
);

// 8. geotab-overview
code = code.replace(
    /const \{ username, database, password \} = provider\.credentials;\s*const auth = await axios\.post\('https:\/\/my\.geotab\.com\/apiv1', \{ method: 'Authenticate', params: \{ userName: username, password, database \} \}\);\s*const credentials = auth\.data\.result\.credentials;\s*const serverPath = auth\.data\.result\.path === 'ThisServer' \? 'my\.geotab\.com' : auth\.data\.result\.path;/g,
    ""
);

// 9. geotab-speed-profile
code = code.replace(
    /const \{ username, database, password \} = provider\.credentials;\s*const auth = await axios\.post\('https:\/\/my\.geotab\.com\/apiv1', \{ method: 'Authenticate', params: \{ userName: username, password, database \} \}\);\s*const credentials = auth\.data\.result\.credentials;\s*const serverPath = auth\.data\.result\.path === 'ThisServer' \? 'my\.geotab\.com' : auth\.data\.result\.path;/g,
    ""
);

// We need to inject the credentials param specifically for the api call wrapper:
// Instead of replacing all axios.post(\`https://\${serverPath}\/apiv1\`), we do it specifically to inject the right credentials object (integration.credentials, provider.credentials, or creds)

// First, for sync-geotab
code = code.replace(
    /const devices = await axios\.post\(`https:\/\/\$\{serverPath\}\/apiv1`, /g,
    "const devices = await callGeotabApi(organizationId, creds, "
);
code = code.replace(
    /const driversResponse = await axios\.post\(`https:\/\/\$\{serverPath\}\/apiv1`, /g,
    "const driversResponse = await callGeotabApi(organizationId, creds, "
);

// Generic replacement for everything else:
// If the route has `provider.credentials`, we inject it. If it has `integration.credentials`, we inject it.
// The regex finds the context of the variable.
code = code.replace(/await axios\.post\(`https:\/\/\$\{serverPath\}\/apiv1`, /g, "await callGeotabApi(organizationId, (typeof provider !== 'undefined' ? provider.credentials : integration.credentials), ");

// There might be places where we need to replace `credentials` in the payload params.
// \`callGeotabApi\` handles it automatically, we can leave \`credentials\` or \`credentials: credentials\` in the payload, but since they are undefined, it might throw "credentials is not defined".
// So we must remove \`, credentials\` and \`, credentials: credentials\` from the objects!
code = code.replace(/,\s*credentials\s*}/g, " }");
code = code.replace(/,\s*credentials: credentials\s*}/g, " }");

fs.writeFileSync('server.js', code);
console.log("Refactoring complete!");
