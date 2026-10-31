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
      .eq("name", "geotab")
      .single();

    if (!provider) {
      return new Response(JSON.stringify({ error: "Geotab provider not found" }), {
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
      return new Response(JSON.stringify({ error: "Geotab credentials not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test") {
      const result = await testGeotabConnection(credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "sync-vehicles") {
      const result = await syncGeotabVehicles(supabase, provider.id, credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "sync-drivers") {
      const result = await syncGeotabDrivers(supabase, provider.id, credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "sync-locations") {
      const result = await syncGeotabLocations(supabase, provider.id, credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in Geotab sync:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function testGeotabConnection(credentials: any): Promise<{ success: boolean; message: string }> {
  try {
    const authResult = await authenticateGeotab(credentials);
    if (authResult.success) {
      return { success: true, message: "Successfully connected to Geotab API" };
    }
    return { success: false, message: authResult.error || "Authentication failed" };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// Edge Function Update for Authentication
async function authenticateGeotab(credentials: any) {
  const server = credentials.server || "my.geotab.com";
  const response = await fetch(`https://${server}/apiv1`, {
    method: "POST",
    body: JSON.stringify({
      method: "Authenticate",
      params: {
        userName: credentials.username,
        password: credentials.password, // Frontend se password araha hai
        database: credentials.database_name,
      },
    })
  });
  const data = await response.json();
  // Geotab gives a new 'path' if the database is on a different server
  return { 
    success: !!data.result, 
    sessionId: data.result?.credentials?.sessionId,
    path: data.result?.path !== "ThisServer" ? data.result?.path : server 
  };
}

async function syncGeotabVehicles(supabase: any, providerId: string, credentials: any) {
  const logId = await createSyncLog(supabase, providerId, "vehicles");

  try {
    const authResult = await authenticateGeotab(credentials);
    if (!authResult.success) {
      await updateSyncLog(supabase, logId, "failed", 0, 0, 0, authResult.error);
      return { success: false, message: authResult.error };
    }

    const server = credentials.configuration?.server || "my.geotab.com";
    const apiUrl = `https://${server}/apiv1`;

    const devicesResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "Get",
        params: {
          typeName: "Device",
          credentials: {
            database: credentials.database_name,
            sessionId: authResult.sessionId,
          },
        },
      }),
    });

    const devicesData = await devicesResponse.json();

    if (!devicesData.result) {
      await updateSyncLog(supabase, logId, "failed", 0, 0, 0, "Failed to retrieve devices");
      return { success: false, message: "Failed to retrieve devices from Geotab" };
    }

    let successCount = 0;
    let failCount = 0;

    for (const device of devicesData.result) {
      try {
        const { data: existingMapping } = await supabase
          .from("integration_mappings")
          .select("internal_id")
          .eq("provider_id", providerId)
          .eq("entity_type", "vehicle")
          .eq("external_id", device.id)
          .maybeSingle();

        if (existingMapping) {
          await supabase
            .from("vehicles")
            .update({
              vehicle_number: device.name,
              vin: device.serialNumber || device.vehicleIdentificationNumber,
              status: device.activeFrom && !device.activeTo ? "active" : "inactive",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingMapping.internal_id);
        } else {
          const { data: newVehicle } = await supabase
            .from("vehicles")
            .insert({
              vehicle_number: device.name,
              vin: device.serialNumber || device.vehicleIdentificationNumber,
              make: device.deviceType || "Unknown",
              model: device.deviceType || "Unknown",
              year: new Date().getFullYear(),
              status: device.activeFrom && !device.activeTo ? "active" : "inactive",
            })
            .select()
            .single();

          if (newVehicle) {
            await supabase.from("integration_mappings").insert({
              provider_id: providerId,
              entity_type: "vehicle",
              internal_id: newVehicle.id,
              external_id: device.id,
              metadata: { deviceType: device.deviceType },
            });
          }
        }
        successCount++;
      } catch (error) {
        console.error(`Failed to sync vehicle ${device.id}:`, error);
        failCount++;
      }
    }

    await updateSyncLog(supabase, logId, failCount === 0 ? "success" : "partial", devicesData.result.length, successCount, failCount);
    return { success: true, synced: successCount, failed: failCount };
  } catch (error) {
    await updateSyncLog(supabase, logId, "failed", 0, 0, 0, error.message);
    return { success: false, message: error.message };
  }
}

async function syncGeotabDrivers(supabase: any, providerId: string, credentials: any) {
  const logId = await createSyncLog(supabase, providerId, "drivers");

  try {
    const authResult = await authenticateGeotab(credentials);
    if (!authResult.success) {
      await updateSyncLog(supabase, logId, "failed", 0, 0, 0, authResult.error);
      return { success: false, message: authResult.error };
    }

    const server = credentials.configuration?.server || "my.geotab.com";
    const apiUrl = `https://${server}/apiv1`;

    const driversResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "Get",
        params: {
          typeName: "User",
          credentials: {
            database: credentials.database_name,
            sessionId: authResult.sessionId,
          },
        },
      }),
    });

    const driversData = await driversResponse.json();

    if (!driversData.result) {
      await updateSyncLog(supabase, logId, "failed", 0, 0, 0, "Failed to retrieve drivers");
      return { success: false, message: "Failed to retrieve drivers from Geotab" };
    }

    let successCount = 0;
    let failCount = 0;

    for (const user of driversData.result.filter((u: any) => u.isDriver)) {
      try {
        const nameParts = user.name.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const { data: existingMapping } = await supabase
          .from("integration_mappings")
          .select("internal_id")
          .eq("provider_id", providerId)
          .eq("entity_type", "driver")
          .eq("external_id", user.id)
          .maybeSingle();

        if (existingMapping) {
          await supabase
            .from("drivers")
            .update({
              first_name: firstName,
              last_name: lastName,
              email: user.email || null,
              phone: user.phone || null,
              status: user.isDriver && user.activeFrom && !user.activeTo ? "active" : "inactive",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingMapping.internal_id);
        } else {
          const { data: newDriver } = await supabase
            .from("drivers")
            .insert({
              first_name: firstName,
              last_name: lastName,
              email: user.email || null,
              phone: user.phone || null,
              license_number: user.employeeNo || "N/A",
              status: user.isDriver && user.activeFrom && !user.activeTo ? "active" : "inactive",
            })
            .select()
            .single();

          if (newDriver) {
            await supabase.from("integration_mappings").insert({
              provider_id: providerId,
              entity_type: "driver",
              internal_id: newDriver.id,
              external_id: user.id,
              metadata: { employeeNo: user.employeeNo },
            });
          }
        }
        successCount++;
      } catch (error) {
        console.error(`Failed to sync driver ${user.id}:`, error);
        failCount++;
      }
    }

    await updateSyncLog(supabase, logId, failCount === 0 ? "success" : "partial", driversData.result.filter((u: any) => u.isDriver).length, successCount, failCount);
    return { success: true, synced: successCount, failed: failCount };
  } catch (error) {
    await updateSyncLog(supabase, logId, "failed", 0, 0, 0, error.message);
    return { success: false, message: error.message };
  }
}

async function syncGeotabLocations(supabase: any, providerId: string, credentials: any) {
  const logId = await createSyncLog(supabase, providerId, "locations");

  try {
    const authResult = await authenticateGeotab(credentials);
    if (!authResult.success) {
      await updateSyncLog(supabase, logId, "failed", 0, 0, 0, authResult.error);
      return { success: false, message: authResult.error };
    }

    const server = credentials.configuration?.server || "my.geotab.com";
    const apiUrl = `https://${server}/apiv1`;

    const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const locationsResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "Get",
        params: {
          typeName: "LogRecord",
          credentials: {
            database: credentials.database_name,
            sessionId: authResult.sessionId,
          },
          search: {
            fromDate: fromDate.toISOString(),
          },
        },
      }),
    });

    const locationsData = await locationsResponse.json();

    if (!locationsData.result) {
      await updateSyncLog(supabase, logId, "failed", 0, 0, 0, "Failed to retrieve locations");
      return { success: false, message: "Failed to retrieve locations from Geotab" };
    }

    let successCount = 0;
    let failCount = 0;

    for (const record of locationsData.result) {
      try {
        const { data: mapping } = await supabase
          .from("integration_mappings")
          .select("internal_id")
          .eq("provider_id", providerId)
          .eq("entity_type", "vehicle")
          .eq("external_id", record.device.id)
          .maybeSingle();

        if (mapping && record.latitude && record.longitude) {
          await supabase.from("vehicle_locations").insert({
            vehicle_id: mapping.internal_id,
            latitude: record.latitude,
            longitude: record.longitude,
            speed: record.speed || 0,
            heading: record.bearing || 0,
            timestamp: record.dateTime,
          });
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to sync location:`, error);
        failCount++;
      }
    }

    await updateSyncLog(supabase, logId, failCount === 0 ? "success" : "partial", locationsData.result.length, successCount, failCount);
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
