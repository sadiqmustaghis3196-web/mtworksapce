const fs = require('fs');
let file = fs.readFileSync('src/api/fuel.ts', 'utf8');

// 1. Remove fallback in getFuelStats
file = file.replace(
  /\/\/ Fallback to dynamic realistic telemetry stats[\s\S]*?(const costChange = previous\.cost > 0 \? \(\(current\.cost - previous\.cost\) \/ previous\.cost\) \* 100 : 0;)/,
  `$1`
);
// Fix the replace slightly by just finding the 'if (current.cost === 0)' block and replacing it.
file = file.replace(
  /\/\/ Fallback to dynamic realistic telemetry stats[\s\S]*?previous = {[\s\S]*?costPerGallon: 3\.55\n    };\n  }/,
  `// Fallbacks removed per user request`
);
file = file.replace(/const costChange = previous.cost > 0 \? \(\(current\.cost - previous\.cost\) \/ previous\.cost\) \* 100 : -5\.4;/g, "const costChange = previous.cost > 0 ? ((current.cost - previous.cost) / previous.cost) * 100 : 0;");
file = file.replace(/const mpgChange = previous\.mpg > 0 \? current\.mpg - previous\.mpg : 0\.4;/g, "const mpgChange = previous.mpg > 0 ? current.mpg - previous.mpg : 0;");
file = file.replace(/const efficiencyChange = previousEfficiency > 0 \? efficiency - previousEfficiency : 3\.5;/g, "const efficiencyChange = previousEfficiency > 0 ? efficiency - previousEfficiency : 0;");
file = file.replace(/const co2Reduction = baselineCO2 > 0 \? \(\(baselineCO2 - optimizedCO2\) \/ baselineCO2\) \* 100 : 4\.8;/g, "const co2Reduction = baselineCO2 > 0 ? ((baselineCO2 - optimizedCO2) / baselineCO2) * 100 : 0;");


// 2. Remove mock data in getOptimizedRoutesFuelData
file = file.replace(
  /if \(!routes \|\| routes\.length === 0\) {[\s\S]*?return \[\];\n  }/,
  `if (!routes || routes.length === 0) return [];`
);

// 3. Remove mock data in getFuelTelemetryReport
// The mock data starts at `// Populate multi-device detected fill-up records for ALL Geotab trucks & devices`
// and ends at `return items;`
file = file.replace(
  /\/\/ Populate multi-device detected fill-up records[\s\S]*?return items;/,
  `return items;`
);

// And the catch block fallback
file = file.replace(
  /catch \(error\) {[\s\S]*?console\.error\('Failed to get fuel telemetry report:', error\);[\s\S]*?return fallbackItems;\n  }/,
  `catch (error) {\n    console.error('Failed to get fuel telemetry report:', error);\n    return [];\n  }`
);

// 4. Also remove the isDemoMode check which is returning mocked DEMO_FUEL_RECORDS
file = file.replace(
  /if \(isDemoMode\(\)\) {[\s\S]*?\} as FuelRecord\[\];\n  }/,
  `// Demo mode removed per user request`
);

fs.writeFileSync('src/api/fuel.ts', file);
console.log('fuel.ts mock data removed');
