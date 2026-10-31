import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const REQUEST_TIMEOUT = 30000;

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly threshold = 5;
  private readonly resetTimeout = 60000;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN. Service temporarily unavailable.');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }
}

const circuitBreaker = new CircuitBreaker();

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;
  let delay = INITIAL_RETRY_DELAY;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await circuitBreaker.execute(() =>
        fetch(url, {
          ...options,
          signal: controller.signal,
        })
      );

      clearTimeout(timeoutId);

      if (response.ok || response.status === 404) {
        return response;
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        delay = retryAfter ? parseInt(retryAfter) * 1000 : delay * 2;
      } else if (response.status >= 500) {
        delay = delay * 2;
      } else {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new Error('Request timeout');
      }

      if (attempt === retries) {
        throw lastError;
      }
    }

    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 30000);
    }
  }

  throw lastError || new Error('Request failed after retries');
}

async function logAudit(
  supabase: any,
  action: string,
  success: boolean,
  details: Record<string, any>,
  errorMessage?: string
) {
  try {
    await supabase.from('security_audit_logs').insert({
      action: `samsara.${action}`,
      success,
      details,
      error_message: errorMessage,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "sync";

    const { data: provider } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("name", "samsara")
      .single();

    if (!provider) {
      return new Response(JSON.stringify({ error: "Samsara provider not found" }), {
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
      return new Response(JSON.stringify({ error: "Samsara credentials not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test") {
      const result = await testSamsaraConnection(credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "sync-vehicles") {
      const result = await syncSamsaraVehicles(supabase, provider.id, credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "sync-drivers") {
      const result = await syncSamsaraDrivers(supabase, provider.id, credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "sync-locations") {
      const result = await syncSamsaraLocations(supabase, provider.id, credentials);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in Samsara sync:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function testSamsaraConnection(credentials: any): Promise<{ success: boolean; message: string; circuitBreakerState?: string }> {
  try {
    const apiUrl = credentials.configuration?.apiUrl || "https://api.samsara.com";

    const response = await fetchWithRetry(`${apiUrl}/fleet/vehicles`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${credentials.api_key}`,
        "Accept": "application/json",
      },
    });

    if (response.ok) {
      return {
        success: true,
        message: "Successfully connected to Samsara API",
        circuitBreakerState: circuitBreaker.getState(),
      };
    }

    const errorData = await response.json();
    return {
      success: false,
      message: errorData.message || "Authentication failed",
      circuitBreakerState: circuitBreaker.getState(),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      circuitBreakerState: circuitBreaker.getState(),
    };
  }
}

async function syncSamsaraVehicles(supabase: any, providerId: string, credentials: any) {
  const logId = await createSyncLog(supabase, providerId, "vehicles");

  try {
    const apiUrl = credentials.configuration?.apiUrl || "https://api.samsara.com";

    const response = await fetchWithRetry(`${apiUrl}/fleet/vehicles?limit=512`, {
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
    const vehicles = vehiclesData.data || [];

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
              vehicle_number: vehicle.name,
              vin: vehicle.vin || null,
              make: vehicle.make || "Unknown",
              model: vehicle.model || "Unknown",
              year: vehicle.year || new Date().getFullYear(),
              license_plate: vehicle.licensePlate || null,
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingMapping.internal_id);
        } else {
          const { data: newVehicle } = await supabase
            .from("vehicles")
            .insert({
              vehicle_number: vehicle.name,
              vin: vehicle.vin || null,
              make: vehicle.make || "Unknown",
              model: vehicle.model || "Unknown",
              year: vehicle.year || new Date().getFullYear(),
              license_plate: vehicle.licensePlate || null,
              status: "active",
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
                assetTag: vehicle.assetTag,
                externalIds: vehicle.externalIds,
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

async function syncSamsaraDrivers(supabase: any, providerId: string, credentials: any) {
  const logId = await createSyncLog(supabase, providerId, "drivers");

  try {
    const apiUrl = credentials.configuration?.apiUrl || "https://api.samsara.com";

    const response = await fetchWithRetry(`${apiUrl}/fleet/drivers?limit=512`, {
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
    const drivers = driversData.data || [];

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

        const nameParts = driver.name.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        if (existingMapping) {
          await supabase
            .from("drivers")
            .update({
              first_name: firstName,
              last_name: lastName,
              email: driver.email || null,
              phone: driver.phone || null,
              license_number: driver.licenseNumber || "N/A",
              license_state: driver.licenseState || null,
              status: driver.isDeactivated ? "inactive" : "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingMapping.internal_id);
        } else {
          const { data: newDriver } = await supabase
            .from("drivers")
            .insert({
              first_name: firstName,
              last_name: lastName,
              email: driver.email || null,
              phone: driver.phone || null,
              license_number: driver.licenseNumber || "N/A",
              license_state: driver.licenseState || null,
              status: driver.isDeactivated ? "inactive" : "active",
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
                username: driver.username,
                externalIds: driver.externalIds,
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

async function syncSamsaraLocations(supabase: any, providerId: string, credentials: any) {
  const logId = await createSyncLog(supabase, providerId, "locations");

  try {
    const apiUrl = credentials.configuration?.apiUrl || "https://api.samsara.com";

    const response = await fetchWithRetry(`${apiUrl}/fleet/vehicles/locations?limit=512`, {
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
    const locations = locationsData.data || [];

    let successCount = 0;
    let failCount = 0;

    for (const location of locations) {
      try {
        const { data: mapping } = await supabase
          .from("integration_mappings")
          .select("internal_id")
          .eq("provider_id", providerId)
          .eq("entity_type", "vehicle")
          .eq("external_id", location.id)
          .maybeSingle();

        if (mapping && location.gps) {
          await supabase.from("vehicle_locations").insert({
            vehicle_id: mapping.internal_id,
            latitude: location.gps.latitude,
            longitude: location.gps.longitude,
            speed: location.gps.speedMilesPerHour || 0,
            heading: location.gps.headingDegrees || 0,
            timestamp: location.time || new Date().toISOString(),
          });

          await supabase
            .from("vehicles")
            .update({
              current_location: `${location.gps.latitude},${location.gps.longitude}`,
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
