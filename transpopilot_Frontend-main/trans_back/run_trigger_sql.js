import 'dotenv/config';

// Try different Supabase SQL execution endpoints
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = 'zmgxveuiyqmajxtyskwo';

async function tryEndpoint(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      ...headers,
    },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: await res.text() };
}

async function main() {
  // Try Supabase Management API SQL endpoint
  const r1 = await tryEndpoint(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    { query: 'SELECT 1 as test;' }
  );
  console.log('Management API /database/query:', r1.status, r1.body.substring(0, 200));

  // Try pg_meta endpoint  
  const r2 = await tryEndpoint(
    `${SUPABASE_URL}/pg-meta/v1/query`,
    { query: 'SELECT 1 as test;' }
  );
  console.log('pg-meta /query:', r2.status, r2.body.substring(0, 200));
}

main();
