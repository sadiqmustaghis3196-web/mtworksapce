import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module mein __dirname nahi hota, isliye yeh workaround zaroori hai
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output file ka naam
const outputFile = 'full_project_code.txt';

// Kin folders ko ignore karna hai
const ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.vscode'];

// Kin file types ko read karna hai
const includeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.json', '.env'];

// Files jinko ignore karna hai
const ignoreFiles = ['package-lock.json', 'yarn.lock', 'generate_code.js', outputFile, 'pnpm-lock.yaml'];

function getAllFiles(dirPath, arrayOfFiles) {
  let files = [];
  try {
    files = fs.readdirSync(dirPath);
  } catch (err) {
    console.warn(`Folder access nahi ho raha: ${dirPath}`);
    return arrayOfFiles || [];
  }

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    
    try {
      if (fs.statSync(fullPath).isDirectory()) {
        if (!ignoreDirs.includes(file)) {
          arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        }
      } else {
        const ext = path.extname(file);
        if (includeExtensions.includes(ext) && !ignoreFiles.includes(file)) {
          arrayOfFiles.push(fullPath);
        }
      }
    } catch (err) {
      // Koi file access error ho toh ignore karein
    }
  });

  return arrayOfFiles;
}

const projectRoot = __dirname; // Current folder
console.log('Project scan kar raha hoon...');

try {
  const allFiles = getAllFiles(projectRoot);
  let content = "PROJECT CODE SUMMARY\n====================\n\n";

  allFiles.forEach(file => {
    // Relative path nikalo taaki samajhne me asani ho
    const relativePath = path.relative(projectRoot, file);
    
    content += `\n\n--- FILE START: ${relativePath} ---\n`;
    try {
      content += fs.readFileSync(file, 'utf8');
    } catch (err) {
      content += `[Error reading file: ${err.message}]`;
    }
    content += `\n--- FILE END: ${relativePath} ---\n`;
  });

  fs.writeFileSync(outputFile, content);
  console.log(`\nSuccess! Sara code is file me save ho gaya hai: ${outputFile}`);
  console.log(`Ab aap '${outputFile}' ko AI chat me upload kar sakte hain.`);
  
} catch (err) {
  console.error('Error aagaya:', err);
}