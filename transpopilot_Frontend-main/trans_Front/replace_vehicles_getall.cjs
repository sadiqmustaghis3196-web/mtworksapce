const fs = require('fs');
const path = 'c:/Users/Window 10/Downloads/transpopitlot_web/trans_Front/src/api/vehicles.ts';
let code = fs.readFileSync(path, 'utf8');

const sIdx = code.indexOf('async getAll(): Promise<Vehicle[]> {');
let eIdx = code.indexOf('return data || [];\n  },');
if (eIdx === -1) eIdx = code.indexOf('return data || [];\r\n  },');

if (sIdx > -1 && eIdx > -1) {
  const endStr = code.substring(eIdx, eIdx + 20);
  const endMatch = endStr.includes('\r\n') ? 'return data || [];\r\n  },' : 'return data || [];\n  },';
  
  const toReplace = code.slice(sIdx, eIdx + endMatch.length);
  const replacement = `async getAll(): Promise<Vehicle[]> {
    const { data: session } = await supabase.auth.getSession();
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    try {
      const response = await fetch(\`\${API_BASE_URL}/api/admin/vehicles\`, {
        method: "GET",
        headers: {
          "Authorization": \`Bearer \${session.session?.access_token}\`
        }
      });
      const json = await response.json();
      if (json.success) return json.data || [];
      return [];
    } catch (err) {
      console.error("Failed to load vehicles from backend", err);
      return [];
    }
  },`;
  fs.writeFileSync(path, code.replace(toReplace, replacement));
  console.log('Success');
} else {
  console.log('Indices not found:', sIdx, eIdx);
}
