const fs = require('fs');

const filesToClean = [
  'src/api/drivers.ts',
  'src/api/routes.ts',
  'src/api/tracking.ts',
  'src/api/vehicles.ts'
];

filesToClean.forEach(filePath => {
  let file = fs.readFileSync(filePath, 'utf8');

  // Remove demo mode imports
  file = file.replace(/import \{.*?isDemoMode.*?\}.*?;\n?/g, "");

  // Remove if (isDemoMode()) { ... } blocks
  file = file.replace(/if\s*\(isDemoMode\(\)\)\s*\{[\s\S]*?\} as [a-zA-Z\[\]]+;\s*\n\s*\}/g, "");
  file = file.replace(/if\s*\(isDemoMode\(\)\)\s*\{[\s\S]*?return DEMO_[\s\S]*?;\s*\n\s*\}/g, "");
  file = file.replace(/if\s*\(isDemoMode\(\)\)\s*\{[\s\S]*?return DEMO_[\s\S]*?\.filter[\s\S]*?;\s*\n\s*\}/g, "");

  fs.writeFileSync(filePath, file);
});
