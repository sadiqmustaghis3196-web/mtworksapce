const { Client } = require('pg');
require('dotenv').config();

const host = process.env.VITE_SUPABASE_URL.replace('https://', 'db.');
const password = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connStr = `postgresql://USER:PASSWORD@localhost:5432/DATABASE`;

const client = new Client({ connectionString: connStr });
async function run() {
  try {
    await client.connect();
    const res = await client.query("SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user'");
    console.log(res.rows[0].prosrc);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
