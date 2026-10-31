require('dotenv').config();
const axios = require('axios');

const organizationId = 'b9594e53-2f2c-4978-8f2b-14ab76eba573';
const endpoints = [
  '/api/geotab-overview',
  '/api/geotab-compliance',
  '/api/geotab-incidents',
  '/api/geotab-risk-report',
  '/api/geotab-speed-profile'
];

async function runTests() {
  console.log('Testing Safety & Compliance endpoints...');
  
  for (const endpoint of endpoints) {
    console.log(`\nCalling ${endpoint}...`);
    const start = Date.now();
    try {
      await axios.post(`http://localhost:5000${endpoint}`, { organizationId });
      console.log(`✅ Success in ${Date.now() - start}ms`);
    } catch (err) {
      console.error(`❌ Error in ${Date.now() - start}ms:`, err.message);
    }
  }
}

runTests();
