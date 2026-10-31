import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import sharp from 'sharp';

const token = 'REPLACE_WITH_SUPABASE_KEY';

async function generateDummyImage() {
    const svg = `
    <svg width="400" height="200">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50" y="50" font-family="Arial" font-size="24" fill="black">Gas Station</text>
      <text x="50" y="100" font-family="Arial" font-size="24" fill="black">Gallons: 10.5</text>
      <text x="50" y="140" font-family="Arial" font-size="24" fill="black">Total: $42.00</text>
    </svg>`;
    const buffer = await sharp(Buffer.from(svg)).jpeg().toBuffer();
    fs.writeFileSync('fuel_receipt.jpg', buffer);
}

async function verify() {
  console.log("=== b. GET /api/vehicle-health ===");
  const listRes = await fetch('http://localhost:5000/api/vehicle-health', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const listData = await listRes.json();
  console.log(`Total Vehicles: ${listData.length}`);
  const target = listData.find((v) => v.vehicle_number === 'GA9Z2M2M4T22');
  console.log("Scored Vehicle (GA9Z2M2M4T22):");
  console.log(JSON.stringify(target, null, 2));

  console.log("\n=== c. Fuel Extraction Test ===");
  await generateDummyImage();
  const form = new FormData();
  form.append('receipt', fs.createReadStream('fuel_receipt.jpg'));

  const extRes = await fetch('http://localhost:5000/api/fuel/extract', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...form.getHeaders()
    },
    body: form
  });

  const extData = await extRes.json();
  console.log(JSON.stringify(extData, null, 2));
}

verify();
