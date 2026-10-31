const fs = require('fs');
const path = 'c:/Users/Window 10/Downloads/transpopitlot_web/trans_Front/src/api/vehicles.ts';
const code = fs.readFileSync(path, 'utf8');

const sIdx = code.indexOf('// Direct Insert Try karein');
let eIdx = code.indexOf('return data;\n  },');
if (eIdx === -1) eIdx = code.indexOf('return data;\r\n  },');

if (sIdx > -1 && eIdx > -1) {
  const endStr = code.substring(eIdx, eIdx + 20);
  const endMatch = endStr.includes('\r\n') ? 'return data;\r\n  },' : 'return data;\n  },';
  
  const toReplace = code.slice(sIdx, eIdx + endMatch.length);
  const replacement = `    console.log("📤 Sending Data:", input);
    const { data: session } = await supabase.auth.getSession();
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    const response = await fetch(\`\${API_BASE_URL}/api/admin/vehicles\`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": \`Bearer \${session.session?.access_token}\` },
      body: JSON.stringify(input)
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      console.error("❌ ASAL ERROR YAHAN HAI:", json.error || response.statusText);
      throw new Error(json.error || "Failed to create vehicle");
    }
    return json.data;
  },`;
  fs.writeFileSync(path, code.replace(toReplace, replacement));
  console.log('Success');
} else {
  console.log('Indices not found:', sIdx, eIdx);
}
