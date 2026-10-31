import axios from 'axios';

async function testAll() {
  const ORG_ID = '387cf3be-c0fe-43af-9abe-93dc55fd9be3';
  const BASE_URL = 'http://localhost:5000/api';

  console.log("=== Phase 4 & 5: Testing Endpoints ===");

  try {
    console.log("1. /api/sync-geotab");
    // We already know Geotab Sync works from test_save_sync_fix, but let's test fuel
    console.log("2. /api/sync-fuel");
    const fuelRes = await axios.post(`${BASE_URL}/sync-fuel`, {
      organizationId: ORG_ID,
      historyDays: 7
    });
    console.log("Fuel Sync Result:", fuelRes.data.success);
    console.log("Inserted count:", fuelRes.data.count);
    
    console.log("3. /api/sync-safety");
    const safetyRes = await axios.post(`${BASE_URL}/sync-safety`, {
      organizationId: ORG_ID,
      startDate: new Date(Date.now() - 7 * 86400000).toISOString(),
      endDate: new Date().toISOString()
    });
    console.log("Safety Sync Result:", safetyRes.data.success, safetyRes.data.synced);
    console.log("Providers:", safetyRes.data.providers);

    console.log("4. /api/vehicle-trips");
    const tripsRes = await axios.post(`${BASE_URL}/vehicle-trips`, {
      organizationId: ORG_ID,
      provider: "geotab",
      vehicleId: "Demo-04",
      timeframe: "Last 7 Days"
    });
    console.log("Trips for Demo-04:", tripsRes.data.success, "Count:", tripsRes.data.data?.length);

  } catch (error) {
    console.error("Test failed:", error.response?.data || error.message);
  }
}

testAll();
