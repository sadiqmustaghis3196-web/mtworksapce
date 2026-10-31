import express from 'express';
import vehicleHealthRoutes from './routes/vehicleHealthRoutes.js';
import receiptRoutes from './routes/receiptRoutes.js';
import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';
import sharp from 'sharp';

const app = express();
app.use(express.json());

// Mock attachSupabaseUser middleware
app.use((req, res, next) => {
    req.user = {
        id: 'dbd030c3-9bdf-49ef-9a1c-5c35903bfc00',
        organization_id: '6aa356e7-4f30-4c5a-9457-9ebbb6dc0f1a', // The real org with 5 vehicles
        role: 'admin'
    };
    next();
});

app.use('/api/vehicle-health', vehicleHealthRoutes);
app.use('/api', receiptRoutes);

const server = app.listen(5003, async () => {
    console.log("Mock server listening on 5003");

    try {
        console.log("\n=== b. GET /api/vehicle-health ===");
        const listRes = await fetch('http://localhost:5003/api/vehicle-health');
        const listData = await listRes.json();
        console.log(`Total Vehicles: ${listData.length}`);
        
        const target = listData.find((v) => v.vehicle_name === 'GA9Z2M2M4T22');
        console.log("\nScored Vehicle (GA9Z2M2M4T22):");
        console.log(JSON.stringify(target, null, 2));

        console.log("\n=== c. Fuel Extraction Test ===");
        
        const svg = `
        <svg width="400" height="200">
          <rect width="100%" height="100%" fill="white"/>
          <text x="50" y="50" font-family="Arial" font-size="24" fill="black">Gas Station</text>
          <text x="50" y="100" font-family="Arial" font-size="24" fill="black">Gallons: 10.5</text>
          <text x="50" y="140" font-family="Arial" font-size="24" fill="black">Total: $42.00</text>
        </svg>`;
        const buffer = await sharp(Buffer.from(svg)).jpeg().toBuffer();
        fs.writeFileSync('fuel_receipt.jpg', buffer);

        const form = new FormData();
        form.append('receipt', fs.createReadStream('fuel_receipt.jpg'));

        const extRes = await fetch('http://localhost:5003/api/fuel/extract', {
            method: 'POST',
            headers: form.getHeaders(),
            body: form
        });

        const extData = await extRes.json();
        console.log("\nExtraction Result:");
        console.log(JSON.stringify(extData, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        server.close();
        process.exit(0);
    }
});
