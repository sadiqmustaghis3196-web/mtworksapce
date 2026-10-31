const { Client } = require('pg');
require('dotenv').config();

const urlObj = new URL(process.env.VITE_SUPABASE_URL);
const host = `db.${urlObj.hostname}`;
// In local Supabase setups or specific configurations, maybe the JWT is accepted?
// But let's just see if this works!
const connStr = `postgresql://USER:PASSWORD@localhost:5432/DATABASE`;

async function run() {
  const client = new Client({ connectionString: connStr });
  try {
    await client.connect();
    console.log("Connected successfully!");
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'safety_incident_reports';
    `);
    console.log(res.rows);
    await client.end();
  } catch (e) {
    console.log("Connection failed:", e.message);
  }
}
run();
