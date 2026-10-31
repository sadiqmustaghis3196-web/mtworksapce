const fs = require('fs');
const code = fs.readFileSync('server.js.bak', 'utf8');
const regex = /app\.(get|post|put|delete)\(['"](\/api\/[^'"]+)['"]/g;
let match;
while ((match = regex.exec(code)) !== null) {
  console.log(match[1].toUpperCase() + ' ' + match[2]);
}
