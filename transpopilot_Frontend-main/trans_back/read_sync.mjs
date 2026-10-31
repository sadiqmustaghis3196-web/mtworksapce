import fs from 'fs';
import path from 'path';

const fileContent = fs.readFileSync('test_save_sync_fix.js', 'utf8');
console.log(fileContent);
