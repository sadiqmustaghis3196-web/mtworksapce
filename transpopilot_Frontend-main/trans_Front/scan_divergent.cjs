const fs = require('fs');
const path = require('path');

const patchedFiles = [
  'VehiclesManagement.tsx',
  'DriversManagement.tsx',
  'DriverBehaviorAI.tsx',
  'VehicleHealthAI.tsx',
  'DriverTracking.tsx',
  'DriverOnboardingManagement.tsx',
  'DriverSelfOnboarding.tsx',
  'DriverDashboard.tsx',
  'DriverTraining.tsx',
  'DriverInvitationManagement.tsx',
  'DriverDetailsModal.tsx',
  'Dashboard.tsx', // Covered earlier
  'LandingPage.tsx', // Source of truth
  'DashboardStats.tsx', // Assuming already matches dashboard
  'DashboardCharts.tsx',
  'DashboardMap.tsx',
  'Navigation.tsx',
  'Layout.tsx'
];

function scanDir(dir) {
  let results = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(scanDir(fullPath));
    } else if (file.endsWith('.tsx') && !patchedFiles.includes(file)) {
      results.push({ name: file, path: fullPath });
    }
  }
  return results;
}

const componentsDir = path.join(__dirname, 'src', 'components');
const pagesDir = path.join(__dirname, 'src', 'pages');

let allFiles = [];
if (fs.existsSync(componentsDir)) allFiles = allFiles.concat(scanDir(componentsDir));
if (fs.existsSync(pagesDir)) allFiles = allFiles.concat(scanDir(pagesDir));

const divergentFiles = [];

for (const fileObj of allFiles) {
  const content = fs.readFileSync(fileObj.path, 'utf8');
  
  const hasLightLegacy = /bg-white|bg-gray-50|border-gray-200|text-gray-900/g.test(content);
  const hasDarkLegacy = /bg-\[\#05070f\]|bg-slate-900(?!\/|\]|-)|border-white\/5|bg-slate-800/g.test(content);
  
  if (hasLightLegacy || hasDarkLegacy) {
    let classes = [];
    if (content.includes('bg-white')) classes.push('bg-white');
    if (content.includes('bg-gray-50')) classes.push('bg-gray-50');
    if (content.includes('bg-[#05070f]')) classes.push('bg-[#05070f]');
    if (content.includes('bg-slate-900')) classes.push('bg-slate-900');
    if (content.includes('border-gray-200')) classes.push('border-gray-200');
    if (content.includes('border-white/5')) classes.push('border-white/5');
    if (content.includes('text-gray-900')) classes.push('text-gray-900');
    
    divergentFiles.push({
      name: fileObj.name,
      theme: hasLightLegacy ? 'Light Theme (Legacy)' : 'Dark Theme (Mismatched)',
      classes: classes
    });
  }
}

console.log(JSON.stringify(divergentFiles, null, 2));
