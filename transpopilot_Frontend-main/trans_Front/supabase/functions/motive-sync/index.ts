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
      .eq("name", "motive")
      .single();

    if (!provider) {
      return new Response(JSON.stringify({ error: "Motive provider not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ... (existing provider check)

    let credentials = null;

    // Check if credentials are provided in the request body (for testing)
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.credentials) {
          credentials = body.credentials;
        }
      } catch (e) {
        // Ignore JSON parse errors, fallback to DB
      }
    }

    // If not in body, fetch from DB
    if (!credentials) {
      const { data: dbCredentials } = await supabase
        .from("integration_credentials")
        .select("*")
        .eq("provider_id", provider.id)
        .maybeSingle();
      
      credentials = dbCredentials;
    }

    if (!credentials) {
      return new Response(JSON.stringify({ error: "Motive credentials not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test") {
      const result = await testMotiveConnection(credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "sync-vehicles") {
      const result = await syncMotiveVehicles(supabase, provider.id, credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "sync-drivers") {
      const result = await syncMotiveDrivers(supabase, provider.id, credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "sync-locations") {
      const result = await syncMotiveLocations(supabase, provider.id, credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in Motive sync:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function testMotiveConnection(credentials: any): Promise<{ success: boolean; message: string }> {
  try {
    const apiUrl = credentials.configuration?.apiUrl || "https://api.gomotive.com/v1";

    const response = await fetch(`${apiUrl}/vehicles`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${credentials.api_key}`,
        "Accept": "application/json",
      },
    });

    if (response.ok) {
      return { success: true, message: "Successfully connected to Motive API" };
    }

    const errorData = await response.json();
    return { success: false, message: errorData.message || "Authentication failed" };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function syncMotiveVehicles(supabase: any, providerId: string, credentials: any) {
  const logId = await createSyncLog(supabase, providerId, "vehicles");

  try {
    const apiUrl = credentials.configuration?.apiUrl || "https://api.gomotive.com/v1";

    const response = await fetch(`${apiUrl}/vehicles?per_page=100`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${credentials.api_key}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      await updateSyncLog(supabase, logId, "failed", 0, 0, 0, errorData.message);
      return { success: false, message: errorData.message || "Failed to retrieve vehicles" };
    }

    const vehiclesData = await response.json();
    const vehicles = vehiclesData.vehicles || [];

    let successCount = 0;
    let failCount = 0;

    for (const vehicle of vehicles) {
      try {
        const { data: existingMapping } = await supabase
          .from("integration_mappings")
          .select("internal_id")
          .eq("provider_id", providerId)
          .eq("entity_type", "vehicle")
          .eq("external_id", vehicle.id)
          .maybeSingle();

        if (existingMapping) {
          await supabase
            .from("vehicles")
            .update({
              vehicle_number: vehicle.number || vehicle.name,
              vin: vehicle.vin || null,
              make: vehicle.make || "Unknown",
              model: vehicle.model || "Unknown",
              year: vehicle.year || new Date().getFullYear(),
              license_plate: vehicle.license_plate || null,
              status: vehicle.status === "active" ? "active" : "inactive",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingMapping.internal_id);
        } else {
          const { data: newVehicle } = await supabase
            .from("vehicles")
            .insert({
              vehicle_number: vehicle.number || vehicle.name,
              vin: vehicle.vin || null,
              make: vehicle.make || "Unknown",
              model: vehicle.model || "Unknown",
              year: vehicle.year || new Date().getFullYear(),
              license_plate: vehicle.license_plate || null,
              status: vehicle.status === "active" ? "active" : "inactive",
            })
            .select()
            .single();

          if (newVehicle) {
            await supabase.from("integration_mappings").insert({
              provider_id: providerId,
              entity_type: "vehicle",
              internal_id: newVehicle.id,
              external_id: vehicle.id,
              metadata: {
                vehicleType: vehicle.vehicle_type,
                fuelType: vehicle.fuel_type,
              },
            });
          }
        }
        successCount++;
      } catch (error) {
        console.error(`Failed to sync vehicle ${vehicle.id}:`, error);
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

async function syncMotiveDrivers(supabase: any, providerId: string, credentials: any) {
  const logId = await createSyncLog(supabase, providerId, "drivers");

  try {
    const apiUrl = credentials.configuration?.apiUrl || "https://api.gomotive.com/v1";

    const response = await fetch(`${apiUrl}/drivers?per_page=100`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${credentials.api_key}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      await updateSyncLog(supabase, logId, "failed", 0, 0, 0, errorData.message);
      return { success: false, message: errorData.message || "Failed to retrieve drivers" };
    }

    const driversData = await response.json();
    const drivers = driversData.drivers || [];

    let successCount = 0;
    let failCount = 0;

    for (const driver of drivers) {
      try {
        const { data: existingMapping } = await supabase
          .from("integration_mappings")
          .select("internal_id")
          .eq("provider_id", providerId)
          .eq("entity_type", "driver")
          .eq("external_id", driver.id)
          .maybeSingle();

        if (existingMapping) {
          await supabase
            .from("drivers")
            .update({
              first_name: driver.first_name,
              last_name: driver.last_name,
              email: driver.email || null,
              phone: driver.phone_number || null,
              license_number: driver.license_number || "N/A",
              license_state: driver.license_state || null,
              status: driver.status === "active" ? "active" : "inactive",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingMapping.internal_id);
        } else {
          const { data: newDriver } = await supabase
            .from("drivers")
            .insert({
              first_name: driver.first_name,
              last_name: driver.last_name,
              email: driver.email || null,
              phone: driver.phone_number || null,
              license_number: driver.license_number || "N/A",
              license_state: driver.license_state || null,
              status: driver.status === "active" ? "active" : "inactive",
            })
            .select()
            .single();

          if (newDriver) {
            await supabase.from("integration_mappings").insert({
              provider_id: providerId,
              entity_type: "driver",
              internal_id: newDriver.id,
              external_id: driver.id,
              metadata: {
                driverType: driver.driver_type,
                eldExempt: driver.eld_exempt,
              },
            });
          }
        }
        successCount++;
      } catch (error) {
        console.error(`Failed to sync driver ${driver.id}:`, error);
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

async function syncMotiveLocations(supabase: any, providerId: string, credentials: any) {
  const logId = await createSyncLog(supabase, providerId, "locations");

  try {
    const apiUrl = credentials.configuration?.apiUrl || "https://api.gomotive.com/v1";

    const response = await fetch(`${apiUrl}/vehicles/locations?per_page=100`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${credentials.api_key}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      await updateSyncLog(supabase, logId, "failed", 0, 0, 0, errorData.message);
      return { success: false, message: errorData.message || "Failed to retrieve locations" };
    }

    const locationsData = await response.json();
    const locations = locationsData.vehicle_locations || [];

    let successCount = 0;
    let failCount = 0;

    for (const location of locations) {
      try {
        const { data: mapping } = await supabase
          .from("integration_mappings")
          .select("internal_id")
          .eq("provider_id", providerId)
          .eq("entity_type", "vehicle")
          .eq("external_id", location.vehicle_id)
          .maybeSingle();

        if (mapping && location.lat && location.lon) {
          await supabase.from("vehicle_locations").insert({
            vehicle_id: mapping.internal_id,
            latitude: location.lat,
            longitude: location.lon,
            speed: location.speed || 0,
            heading: location.heading || 0,
            timestamp: location.located_at || new Date().toISOString(),
          });

          await supabase
            .from("vehicles")
            .update({
              current_location: `${location.lat},${location.lon}`,
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
