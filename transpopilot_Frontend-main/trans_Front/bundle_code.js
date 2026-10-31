const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const outputFileName = 'full_project_code.txt';

// Jin folders ko ignore karna hai (taaki junk file na bane)
const ignoredDirs = [
  'node_modules', 
  '.git', 
  'dist', 
  'build', 
  '.next', 
  'coverage',
  '.vscode'
];

// Jin files ko include karna hai
const includedExtensions = [
  '.js', 
  '.jsx', 
  '.ts', 
  '.tsx', 
  '.css', 
  '.json',
  '.sql' 
];

// Specific files to ignore
const ignoredFiles = [
  'package-lock.json', 
  'yarn.lock', 
  'bundle_code.js', 
  outputFileName
];

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      if (!ignoredDirs.includes(file)) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      // Check extension and ignored files
      if (
        includedExtensions.includes(path.extname(file)) && 
        !ignoredFiles.includes(file)
      ) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

function combineFiles() {
  const projectRoot = __dirname; // Current directory
  console.log('Scanning files in:', projectRoot);
  
  try {
    const allFiles = getAllFiles(projectRoot);
    let fullContent = '';

    console.log(`Found ${allFiles.length} files. Combining...`);

    allFiles.forEach(filePath => {
      const relativePath = path.relative(projectRoot, filePath);
      const content = fs.readFileSync(filePath, 'utf8');

      // Add a separator and filename header
      fullContent += `\n\n` + 
        `// =======================================================\n` +
        `// FILE START: ${relativePath}\n` +
        `// =======================================================\n\n`;
      
      fullContent += content;
    });

    fs.writeFileSync(outputFileName, fullContent);
    console.log(`\n✅ Success! All code saved to: ${outputFileName}`);
    console.log(`📁 Total size: ${(fullContent.length / 1024).toFixed(2)} KB`);
    
  } catch (error) {
    console.error('Error combining files:', error);
  }
}

combineFiles();