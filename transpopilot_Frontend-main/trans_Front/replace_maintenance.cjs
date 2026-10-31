const fs = require('fs');
const path = 'c:/Users/Window 10/Downloads/transpopitlot_web/trans_Front/src/api/maintenance.ts';
let code = fs.readFileSync(path, 'utf8');

const sIdx = code.indexOf('export async function createMaintenanceRecord(input: CreateMaintenanceInput): Promise<MaintenanceRecord> {');
const eIdx = code.indexOf('export async function getMaintenanceRecords(vehicleId?: string): Promise<MaintenanceRecord[]> {');

if (sIdx > -1 && eIdx > -1) {
  const toReplace = code.slice(sIdx, eIdx);
  const replacement = `export async function createMaintenanceRecord(input: CreateMaintenanceInput): Promise<MaintenanceRecord> {
  const { data: session } = await supabase.auth.getSession();
  const response = await fetch(\`\${API_BASE_URL}/api/admin/maintenance\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${session.session?.access_token}\`
    },
    body: JSON.stringify(input)
  });

  const json = await response.json();
  if (!response.ok || !json.success) {
    console.error("Backend returned error:", json.error || response.statusText);
    throw new Error(json.error || "Failed to create maintenance record");
  }
  
  return json.data;
}

`;
  fs.writeFileSync(path, code.replace(toReplace, replacement));
  console.log('Success');
} else {
  console.log('Indices not found:', sIdx, eIdx);
}
