const fs = require('fs');

function cleanDashboard(filePath) {
  let file = fs.readFileSync(filePath, 'utf8');

  // Remove demo data imports
  file = file.replace(/import \{ isDemoMode, DEMO_DASHBOARD_STATS, DEMO_DRIVERS, DEMO_VEHICLES \} from '\.\.\/lib\/demoData';\n/g, "");

  // Remove getDashboardStats demo fallback
  file = file.replace(/if \(isDemoMode\(\)\) {[\s\S]*?onTimeRate: 98\.7,\n\s*\};\n\s*}/g, "// Demo data removed");

  // Remove getRecentAlerts demo fallback
  file = file.replace(/if \(isDemoMode\(\)\) {[\s\S]*?\} as Alert\[\];\n\s*}/g, "// Demo data removed");
  
  // Wait, there might be other demo fallbacks. Let me check the regex again
  file = file.replace(/if \(isDemoMode\(\)\) \{[\s\S]*?\n\s*\}/g, "// Demo data removed");

  fs.writeFileSync(filePath, file);
}

cleanDashboard('src/api/dashboard.ts');
