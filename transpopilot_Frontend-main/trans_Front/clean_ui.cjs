const fs = require('fs');

function cleanFuelOptimization(filePath) {
  let file = fs.readFileSync(filePath, 'utf8');

  // Remove diagnostic logs for mock data
  file = file.replace(/console\.log\("[^"]*simulated fallback if empty\):",[\s\S]*?\);/g, "");
  file = file.replace(/console\.log\("[^"]*mock appended lists\):",[\s\S]*?\);/g, "");

  // Remove 'Demo - 01' fallback
  file = file.replace(/const dev = item\.device \|\| 'Demo - 01';/g, "const dev = item.device || 'Unknown Vehicle';");
  file = file.replace(/const provider = logs\[0\]\?\.provider \|\| 'geotab';/g, "const provider = logs[0]?.provider || 'Unknown';");

  file = file.replace(/\(item\.device \|\| 'Demo - 01'\)/g, "(item.device || 'Unknown Vehicle')");

  // Remove 19 L default fallback
  file = file.replace(/\(l\.rawGallons \? l\.rawGallons \* 3\.78541 : 19\)/g, "(l.rawGallons ? l.rawGallons * 3.78541 : 0)");
  file = file.replace(/const volA = logsA\.reduce\(\(sum, l\) => sum \+ \(l\.rawGallons \? l\.rawGallons \* 3\.78541 : 19\), 0\);/g, "const volA = logsA.reduce((sum, l) => sum + (l.rawGallons ? l.rawGallons * 3.78541 : 0), 0);");
  file = file.replace(/const volB = logsB\.reduce\(\(sum, l\) => sum \+ \(l\.rawGallons \? l\.rawGallons \* 3\.78541 : 19\), 0\);/g, "const volB = logsB.reduce((sum, l) => sum + (l.rawGallons ? l.rawGallons * 3.78541 : 0), 0);");

  // Remove 7.2 MPG fallback
  file = file.replace(/\(l\.rawMpg \|\| 7\.2\)/g, "(l.rawMpg || 0)");
  file = file.replace(/: 7\.2;/g, ": 0;");

  fs.writeFileSync(filePath, file);
}

cleanFuelOptimization('src/components/FuelOptimization.tsx');
