const fs = require('fs');
const path = 'c:/Users/Window 10/Downloads/transpopitlot_web/trans_Front/src/api/maintenance.ts';
let code = fs.readFileSync(path, 'utf8');

const sIdx = code.indexOf('export async function getMaintenanceRecords(vehicleId?: string): Promise<MaintenanceRecord[]> {');
const eIdx = code.indexOf('export async function uploadMaintenanceReceipt(recordId: string, file: File): Promise<string> {');

if (sIdx > -1 && eIdx > -1) {
  const toReplace = code.slice(sIdx, eIdx);
  const replacement = `export async function getMaintenanceRecords(vehicleId?: string): Promise<MaintenanceRecord[]> {
  const { data: session } = await supabase.auth.getSession();
  const url = new URL(\`\${API_BASE_URL}/api/admin/maintenance\`);
  if (vehicleId) url.searchParams.append('vehicleId', vehicleId);
  
  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": \`Bearer \${session.session?.access_token}\`
    }
  });
  const json = await response.json();
  if (!json.success) throw new Error(json.error);
  return json.data || [];
}

export async function getUpcomingMaintenance(): Promise<MaintenanceRecord[]> {
  const { data: session } = await supabase.auth.getSession();
  const url = new URL(\`\${API_BASE_URL}/api/admin/maintenance\`);
  url.searchParams.append('upcoming', 'true');
  
  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": \`Bearer \${session.session?.access_token}\`
    }
  });
  const json = await response.json();
  if (!json.success) throw new Error(json.error);
  return json.data || [];
}

`;
  fs.writeFileSync(path, code.replace(toReplace, replacement));
  console.log('Success replacing GET functions');
} else {
  console.log('Indices not found:', sIdx, eIdx);
}
