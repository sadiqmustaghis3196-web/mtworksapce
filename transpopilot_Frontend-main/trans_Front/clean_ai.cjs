const fs = require('fs');

function cleanVehicleHealth(filePath) {
  let file = fs.readFileSync(filePath, 'utf8');

  // Remove imports
  file = file.replace(/import \{ isDemoMode, DEMO_VEHICLE_HEALTH \} from '\.\.\/lib\/demoData';/g, "");
  
  // Remove if (isDemoMode()) block
  file = file.replace(/if \(isDemoMode\(\)\) {[\s\S]*?\} as VehicleHealthSummary\[\];\n  }/, "// Demo data removed");

  fs.writeFileSync(filePath, file);
}

function cleanDriverBehavior(filePath) {
  let file = fs.readFileSync(filePath, 'utf8');

  // Remove imports
  file = file.replace(/import \{ DEMO_DRIVER_BEHAVIOR, DEMO_DRIVERS \} from '\.\.\/lib\/demoData';/g, "");
  
  // Remove fallback
  file = file.replace(/if \(error \|\| !drivers \|\| drivers\.length === 0\) {[\s\S]*?return getDemoData\(\);\n  }/, `if (error || !drivers || drivers.length === 0) {\n    return [];\n  }`);
  
  // Remove getDemoData function
  file = file.replace(/function getDemoData\(\) {[\s\S]*?^}/m, "");
  // just in case it doesn't match perfectly
  const demoDataIndex = file.indexOf('function getDemoData() {');
  if (demoDataIndex > -1) {
    file = file.substring(0, demoDataIndex);
  }

  // Also driverBehaviorAI.ts doesn't enforce orgId in `drivers` query. I'll add it.
  if (!file.includes("getUserOrganizationId")) {
    file = "import { getUserOrganizationId } from './organization';\n" + file;
  }
  file = file.replace(/export async function getDriverBehaviorData\(\): Promise<DriverBehaviorSummary\[]> {/g, "export async function getDriverBehaviorData(): Promise<DriverBehaviorSummary[]> {\n  const orgId = await getUserOrganizationId();\n  if (!orgId) return [];");
  file = file.replace(/\.from\('drivers'\)\s*\n\s*\.select\('id, first_name, last_name, vehicle_id, safety_score'\)\s*\n\s*\.eq\('status', 'active'\)/g, ".from('drivers')\n    .select('id, first_name, last_name, vehicle_id, safety_score')\n    .eq('organization_id', orgId)\n    .eq('status', 'active')");

  fs.writeFileSync(filePath, file);
}

cleanVehicleHealth('src/api/vehicleHealthAI.ts');
cleanDriverBehavior('src/api/driverBehaviorAI.ts');
