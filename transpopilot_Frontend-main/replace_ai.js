const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'trans_Front', 'src', 'components');
const files = fs.readdirSync(directoryPath).filter(f => f.endsWith('.tsx'));

const replacements = [
  { regex: /TranspoPilot\s+AI/g, replacement: 'TranspoPilot' },
  { regex: /TranspoPilot\s*<span[^>]*>AI<\/span>/g, replacement: 'TranspoPilot' },
  { regex: /Vehicle Health AI/g, replacement: 'Vehicle Health' },
  { regex: /Driver Behavior AI/g, replacement: 'Driver Behavior' },
  { regex: /AI-powered/gi, replacement: 'Advanced' },
  { regex: /AI-driven/gi, replacement: 'Advanced' },
  { regex: /AI Routing/g, replacement: 'Smart Routing' },
  { regex: /AI Recommended/g, replacement: 'Recommended' },
  { regex: /AI Diagnostics/g, replacement: 'Diagnostics' },
  { regex: /AI Calculated/g, replacement: 'Calculated' },
  { regex: /Run AI Sim/g, replacement: 'Run Sim' },
  { regex: /Stop AI/g, replacement: 'Stop Sim' },
  { regex: /AI Detected/g, replacement: 'Detected' },
  { regex: /AI Insights/g, replacement: 'Insights' },
  { regex: /AI model training/g, replacement: 'model training' },
  { regex: /AI pathing/g, replacement: 'smart pathing' },
  { regex: /Enterprise-grade AI/g, replacement: 'Enterprise-grade analytics' },
  { regex: /AI Monitoring/g, replacement: 'Monitoring' },
  { regex: /AI automatically/g, replacement: 'System automatically' }
];

let totalChanges = 0;

files.forEach(file => {
  const filePath = path.join(directoryPath, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  replacements.forEach(({ regex, replacement }) => {
    content = content.replace(regex, replacement);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalChanges++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Total files modified: ${totalChanges}`);
