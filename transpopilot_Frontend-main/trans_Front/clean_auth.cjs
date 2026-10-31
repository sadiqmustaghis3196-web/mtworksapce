const fs = require('fs');

function cleanAuthContext(filePath) {
  let file = fs.readFileSync(filePath, 'utf8');

  // Remove demo data imports
  file = file.replace(/import \{ DEMO_USER, DEMO_ORGANIZATION, enableDemoMode, disableDemoMode \} from '\.\.\/lib\/demoData';\n/g, "");

  // Fix unauthenticated state: remove guest mode fallbacks
  // "enableDemoMode();" block
  file = file.replace(/enableDemoMode\(\);\s*\n\s*setIsGuestMode\(true\);\s*\n\s*setProfile\(\{[\s\S]*?\}\);/g, "setIsGuestMode(true);\n          setProfile(null);");

  // "disableDemoMode()" block
  file = file.replace(/disableDemoMode\(\);/g, "");

  // "seedDemoData" block
  file = file.replace(/const seedDemoData = async \(\) => \{[\s\S]*?^  \};/m, "const seedDemoData = async () => {};");
  
  // Also remove it from sign up
  file = file.replace(/onProgress\?\.\('Setting up demo data\.\.\.'\);\s*\n\s*try \{[\s\S]*?catch \(demoError\) \{[\s\S]*?\}\n/g, "");

  fs.writeFileSync(filePath, file);
}

cleanAuthContext('src/contexts/AuthContext.tsx');
