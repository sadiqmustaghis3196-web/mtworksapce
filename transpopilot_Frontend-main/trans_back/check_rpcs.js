import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = `https://zmgxveuiyqmajxtyskwo.supabase.co/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  const paths = Object.keys(json.paths || {});
  const rpcs = paths.filter(p => p.startsWith('/rpc/'));
  console.log("RPCs available:", rpcs);
}
run();
