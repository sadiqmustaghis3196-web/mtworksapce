import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "sync";

    const { data: provider } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("name", "custom")
      .single();

    if (!provider) {
      return new Response(JSON.stringify({ error: "Custom provider not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let credentials = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.credentials) {
          credentials = body.credentials;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    if (!credentials) {
      const { data: dbCredentials } = await supabase
        .from("integration_credentials")
        .select("*")
        .eq("provider_id", provider.id)
        .maybeSingle();
      
      credentials = dbCredentials;
    }

    if (!credentials) {
      return new Response(JSON.stringify({ error: "Custom telematics credentials not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test") {
      const result = await testCustomConnection(credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "sync-vehicles") {
      const result = await syncCustomVehicles(supabase, provider.id, credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "sync-drivers") {
      const result = await syncCustomDrivers(supabase, provider.id, credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "sync-locations") {
      const result = await syncCustomLocations(supabase, provider.id, credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in custom fleet sync:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function testCustomConnection(credentials: any): Promise<{ success: boolean; message: string }> {
  try {
    const apiEndpoint = credentials.configuration?.apiEndpoint;
    if (!apiEndpoint) {
      return { success: false, message: "API endpoint not configured" };
    }

    const headers: any = {
      "Accept": "application/json",
    };

    if (credentials.api_key) {
      headers["Authorization"] = `Bearer ${credentials.api_key}`;
    }

    const response = await fetch(`${apiEndpoint}/health`, {
      method: "GET",
      headers,
    });

    if (response.ok) {
      return { success: true, message: "Successfully connected to custom telematics API" };
    }

    return { success: false, message: `Connection failed: ${response.statusText}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function makeCustomApiRequest(credentials: any, endpoint: string) {
  const apiEndpoint = credentials.configuration?.apiEndpoint;
  if (!apiEndpoint) {
    throw new Error("API endpoint not configured");
  }

  const headers: any = {
    "Accept": "application/json",
  };

  if (credentials.api_key) {
    headers["Authorization"] = `Bearer ${credentials.api_key}`;
  }

  const response = await fetch(`${apiEndpoint}${endpoint}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return await response.json();
  } else if (contentType?.includes("application/xml") || contentType?.includes("text/xml")) {
    const text = await response.text();
    return parseXMLToJSON(text);
  }

  return await response.json();
}

function parseXMLToJSON(xml: string): any {
  const vehicleRegex = /<vehicle>(.*?)<\/vehicle>/gs;
  const fieldRegex = /<(\w+)>(.*?)<\/\1>/g;

  const vehicles = [];
  let vehicleMatch;

  while ((vehicleMatch = vehicleRegex.exec(xml)) !== null) {
    const vehicleData: any = {};
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(vehicleMatch[1])) !== null) {
      vehicleData[fieldMatch[1]] = fieldMatch[2];
    }

    vehicles.push(vehicleData);
  }

  return { vehicles };
}

async function syncCustomVehicles(supabase: any, providerId: string, credentials: any) {
  const logId = await createSyncLog(supabase, providerId, "vehicles");

  try {
    const data = await makeCustomApiRequest(credentials, "/vehicles");
    const vehicles = data.vehicles || data.data || data;

    if (!Array.isArray(vehicles)) {
      await updateSyncLog(supabase, logId, "failed", 0, 0, 0, "Invalid response format");
      return { success: false, message: "Invalid response format - expected array of vehicles" };
    }

    let successCount = 0;
    let failCount = 0;

    for (const vehicle of vehicles) {
      try {
        const vehicleId = vehicle.id || vehicle.vehicleId || vehicle.vehicle_id;
        if (!vehicleId) {
          failCount++;
          continue;
        }

        const { data: existingMapping } = await supabase
          .from("integration_mappings")
          .select("internal_id")
          .eq("provider_id", providerId)
          .eq("entity_type", "vehicle")
          .eq("external_id", vehicleId.toString())
          .maybeSingle();

        const vehicleData = {
          vehicle_number: vehicle.name || vehicle.number || vehicle.vehicleNumber || vehicleId.toString(),
          vin: vehicle.vin || vehicle.VIN || null,
          make: vehicle.make || vehicle.manufacturer || "Unknown",
          model: vehicle.model || "Unknown",
          year: vehicle.year || vehicle.modelYear || new Date().getFullYear(),
          license_plate: vehicle.licensePlate || vehicle.license_plate || vehicle.plate || null,
          status: (vehicle.status === "active" || vehicle.status === "1" || vehicle.active === true) ? "active" : "inactive",
          updated_at: new Date().toISOString(),
        };

        if (existingMapping) {
          await supabase
            .from("vehicles")
            .update(vehicleData)
            .eq("id", existingMapping.internal_id);
        } else {
          const { data: newVehicle } = await supabase
            .from("vehicles")
            .insert(vehicleData)
            .select()
            .single();

          if (newVehicle) {
            await supabase.from("integration_mappings").insert({
              provider_id: providerId,
              entity_type: "vehicle",
              internal_id: newVehicle.id,
              external_id: vehicleId.toString(),
              metadata: { source: "custom_telematics" },
            });
          }
        }
        successCount++;
      } catch (error) {
        console.error(`Failed to sync vehicle:`, error);
        failCount++;
      }
    }

    await updateSyncLog(supabase, logId, failCount === 0 ? "success" : "partial", vehicles.length, successCount, failCount);
    return { success: true, synced: successCount, failed: failCount };
  } catch (error) {
    await updateSyncLog(supabase, logId, "failed", 0, 0, 0, error.message);
    return { success: false, message: error.message };
  }
}

async function syncCustomDrivers(supabase: any, providerId: string, credentials: any) {
  const logId = await createSyncLog(supabase, providerId, "drivers");

  try {
    const data = await makeCustomApiRequest(credentials, "/drivers");
    const drivers = data.drivers || data.data || data;

    if (!Array.isArray(drivers)) {
      await updateSyncLog(supabase, logId, "failed", 0, 0, 0, "Invalid response format");
      return { success: false, message: "Invalid response format - expected array of drivers" };
    }

    let successCount = 0;
    let failCount = 0;

    for (const driver of drivers) {
      try {
        const driverId = driver.id || driver.driverId || driver.driver_id;
        if (!driverId) {
          failCount++;
          continue;
        }

        const { data: existingMapping } = await supabase
          .from("integration_mappings")
          .select("internal_id")
          .eq("provider_id", providerId)
          .eq("entity_type", "driver")
          .eq("external_id", driverId.toString())
          .maybeSingle();

        const fullName = driver.name || driver.fullName || driver.full_name || "";
        const nameParts = fullName.split(" ");
        const firstName = driver.firstName || driver.first_name || nameParts[0] || "";
        const lastName = driver.lastName || driver.last_name || nameParts.slice(1).join(" ") || "";

        const driverData = {
          first_name: firstName,
          last_name: lastName,
          email: driver.email || null,
          phone: driver.phone || driver.phoneNumber || driver.phone_number || null,
          license_number: driver.licenseNumber || driver.license_number || driver.license || "N/A",
          license_state: driver.licenseState || driver.license_state || null,
          status: (driver.status === "active" || driver.status === "1" || driver.active === true) ? "active" : "inactive",
          updated_at: new Date().toISOString(),
        };

        if (existingMapping) {
          await supabase
            .from("drivers")
            .update(driverData)
            .eq("id", existingMapping.internal_id);
        } else {
          const { data: newDriver } = await supabase
            .from("drivers")
            .insert(driverData)
            .select()
            .single();

          if (newDriver) {
            await supabase.from("integration_mappings").insert({
              provider_id: providerId,
              entity_type: "driver",
              internal_id: newDriver.id,
              external_id: driverId.toString(),
              metadata: { source: "custom_telematics" },
            });
          }
        }
        successCount++;
      } catch (error) {
        console.error(`Failed to sync driver:`, error);
        failCount++;
      }
    }

    await updateSyncLog(supabase, logId, failCount === 0 ? "success" : "partial", drivers.length, successCount, failCount);
    return { success: true, synced: successCount, failed: failCount };
  } catch (error) {
    await updateSyncLog(supabase, logId, "failed", 0, 0, 0, error.message);
    return { success: false, message: error.message };
  }
}

async function syncCustomLocations(supabase: any, providerId: string, credentials: any) {
  const logId = await createSyncLog(supabase, providerId, "locations");

  try {
    const data = await makeCustomApiRequest(credentials, "/locations");
    const locations = data.locations || data.data || data;

    if (!Array.isArray(locations)) {
      await updateSyncLog(supabase, logId, "failed", 0, 0, 0, "Invalid response format");
      return { success: false, message: "Invalid response format - expected array of locations" };
    }

    let successCount = 0;
    let failCount = 0;

    for (const location of locations) {
      try {
        const vehicleId = location.vehicleId || location.vehicle_id || location.id;
        if (!vehicleId) {
          failCount++;
          continue;
        }

        const { data: mapping } = await supabase
          .from("integration_mappings")
          .select("internal_id")
          .eq("provider_id", providerId)
          .eq("entity_type", "vehicle")
          .eq("external_id", vehicleId.toString())
          .maybeSingle();

        const lat = location.latitude || location.lat || location.location?.lat;
        const lng = location.longitude || location.lng || location.lon || location.location?.lng;

        if (mapping && lat && lng) {
          await supabase.from("vehicle_locations").insert({
            vehicle_id: mapping.internal_id,
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
            speed: parseFloat(location.speed || 0),
            heading: parseFloat(location.heading || location.bearing || 0),
            timestamp: location.timestamp || location.time || new Date().toISOString(),
          });

          await supabase
            .from("vehicles")
            .update({
              current_location: `${lat},${lng}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", mapping.internal_id);

          successCount++;
        }
      } catch (error) {
        console.error(`Failed to sync location:`, error);
        failCount++;
      }
    }

    await updateSyncLog(supabase, logId, failCount === 0 ? "success" : "partial", locations.length, successCount, failCount);
    return { success: true, synced: successCount, failed: failCount };
  } catch (error) {
    await updateSyncLog(supabase, logId, "failed", 0, 0, 0, error.message);
    return { success: false, message: error.message };
  }
}

async function createSyncLog(supabase: any, providerId: string, syncType: string): Promise<string> {
  const { data } = await supabase
    .from("integration_sync_logs")
    .insert({
      provider_id: providerId,
      sync_type: syncType,
      status: "running",
      records_processed: 0,
      records_success: 0,
      records_failed: 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  return data.id;
}

async function updateSyncLog(
  supabase: any,
  logId: string,
  status: string,
  processed: number,
  success: number,
  failed: number,
  errorMessage?: string
) {
  await supabase
    .from("integration_sync_logs")
    .update({
      status,
      records_processed: processed,
      records_success: success,
      records_failed: failed,
      error_message: errorMessage || null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", logId);
}
