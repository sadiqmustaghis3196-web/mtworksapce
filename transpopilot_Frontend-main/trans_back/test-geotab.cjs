const axios = require('axios');

async function testLocalApi() {
    try {
        const res = await axios.post('http://localhost:5000/api/vehicle-trips', {
            organizationId: "bd53a21e-0cc5-41fb-9338-cae90835b5c9",
            driverId: "Demo - 17",
            days: 7
        });
        
        console.log("Success:", res.data.success);
        console.log("Data type:", Array.isArray(res.data.data) ? "Array" : typeof res.data.data);
        if (Array.isArray(res.data.data)) {
            console.log("Data length:", res.data.data.length);
            if (res.data.data.length > 0) {
                console.log("First item sample:", JSON.stringify(res.data.data[0]).substring(0, 100));
            }
        } else {
            console.log("Data:", res.data.data);
        }
    } catch (err) {
        console.error("API Error:", err.message);
        if (err.response) {
            console.error(err.response.data);
        }
    }
}

testLocalApi();
