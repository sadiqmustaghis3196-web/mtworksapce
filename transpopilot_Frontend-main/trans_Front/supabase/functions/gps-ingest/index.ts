import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Webhook-Signature",
};

interface VehicleLocationPayload {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  odometer?: number;
  timestamp?: string;
}

interface DriverLocationPayload {
  driver_id: string;
  latitude: number;
  longitude: number;
  status?: 'active' | 'break' | 'off_duty' | 'driving';
  timestamp?: string;
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 1000;

function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const limit = rateLimitMap.get(identifier);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (limit.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((limit.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  limit.count++;
  return { allowed: true };
}

function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    return signature === expectedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
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
      action,
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
  let supabase: any;
  let requestBody: any;
  let rawBody = '';

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const webhookSecret = Deno.env.get("GPS_WEBHOOK_SECRET") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);

    const clientId = req.headers.get("x-client-id") || req.headers.get("x-forwarded-for") || "unknown";
    const rateLimit = checkRateLimit(clientId);

    if (!rateLimit.allowed) {
      await logAudit(supabase, 'gps.ingest.rate_limit', false, {
        client_id: clientId,
      }, 'Rate limit exceeded');

      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfter: rateLimit.retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter),
          },
        }
      );
    }

    if (req.method !== "POST") {
      await logAudit(supabase, 'gps.ingest.invalid_method', false, {
        method: req.method,
      }, 'Invalid HTTP method');

      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      await logAudit(supabase, 'gps.ingest.invalid_content_type', false, {
        content_type: contentType,
      }, 'Invalid Content-Type');

      return new Response(
        JSON.stringify({ error: "Content-Type must be application/json" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    rawBody = await req.text();
    requestBody = JSON.parse(rawBody);

    const webhookSignature = req.headers.get("x-webhook-signature");
    if (webhookSecret && webhookSignature) {
      const isValid = verifyWebhookSignature(rawBody, webhookSignature, webhookSecret);
      if (!isValid) {
        await logAudit(supabase, 'gps.ingest.invalid_signature', false, {
          has_signature: !!webhookSignature,
        }, 'Invalid webhook signature');

        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          {
            status: 401,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "vehicle";

    let result: any;
    const processingTime = Date.now() - startTime;

    if (type === "vehicle") {
      result = await ingestVehicleLocation(supabase, requestBody);
      await logAudit(supabase, 'gps.ingest.vehicle', result.success, {
        vehicle_id: requestBody.vehicle_id,
        processing_time_ms: processingTime,
      }, result.success ? undefined : result.message);

      return new Response(
        JSON.stringify({ ...result, processingTime }),
        {
          status: result.success ? 200 : 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else if (type === "driver") {
      result = await ingestDriverLocation(supabase, requestBody);
      await logAudit(supabase, 'gps.ingest.driver', result.success, {
        driver_id: requestBody.driver_id,
        processing_time_ms: processingTime,
      }, result.success ? undefined : result.message);

      return new Response(
        JSON.stringify({ ...result, processingTime }),
        {
          status: result.success ? 200 : 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else if (type === "batch") {
      result = await ingestBatch(supabase, requestBody);
      await logAudit(supabase, 'gps.ingest.batch', result.success, {
        vehicle_count: requestBody.vehicles?.length || 0,
        driver_count: requestBody.drivers?.length || 0,
        processing_time_ms: processingTime,
      });

      return new Response(
        JSON.stringify({ ...result, processingTime }),
        {
          status: result.success ? 200 : 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    await logAudit(supabase, 'gps.ingest.invalid_type', false, {
      type,
    }, 'Invalid type parameter');

    return new Response(
      JSON.stringify({ error: "Invalid type parameter" }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in GPS ingest:", error);

    if (supabase) {
      await logAudit(supabase, 'gps.ingest.error', false, {
        error_name: error instanceof Error ? error.name : 'Unknown',
      }, error instanceof Error ? error.message : String(error));
    }

    const statusCode = error instanceof Error && error.message.includes('JSON') ? 400 : 500;
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return new Response(
      JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: statusCode,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

async function ingestVehicleLocation(
  supabase: any,
  payload: VehicleLocationPayload
): Promise<{ success: boolean; message: string; data?: any }> {
  if (!payload.vehicle_id || payload.latitude === undefined || payload.longitude === undefined) {
    return {
      success: false,
      message: "Missing required fields: vehicle_id, latitude, longitude",
    };
  }

  if (payload.latitude < -90 || payload.latitude > 90) {
    return { success: false, message: "Invalid latitude: must be between -90 and 90" };
  }

  if (payload.longitude < -180 || payload.longitude > 180) {
    return { success: false, message: "Invalid longitude: must be between -180 and 180" };
  }

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", payload.vehicle_id)
    .maybeSingle();

  if (!vehicle) {
    return { success: false, message: "Vehicle not found" };
  }

  const locationData = {
    vehicle_id: payload.vehicle_id,
    latitude: payload.latitude,
    longitude: payload.longitude,
    speed: payload.speed || 0,
    heading: payload.heading || 0,
    altitude: payload.altitude,
    odometer: payload.odometer,
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("vehicle_locations")
    .insert(locationData)
    .select()
    .single();

  if (error) {
    return { success: false, message: `Database error: ${error.message}` };
  }

  return { success: true, message: "Vehicle location ingested successfully", data };
}

async function ingestDriverLocation(
  supabase: any,
  payload: DriverLocationPayload
): Promise<{ success: boolean; message: string; data?: any }> {
  if (!payload.driver_id || payload.latitude === undefined || payload.longitude === undefined) {
    return {
      success: false,
      message: "Missing required fields: driver_id, latitude, longitude",
    };
  }

  if (payload.latitude < -90 || payload.latitude > 90) {
    return { success: false, message: "Invalid latitude: must be between -90 and 90" };
  }

  if (payload.longitude < -180 || payload.longitude > 180) {
    return { success: false, message: "Invalid longitude: must be between -180 and 180" };
  }

  const { data: driver } = await supabase
    .from("drivers")
    .select("id")
    .eq("id", payload.driver_id)
    .maybeSingle();

  if (!driver) {
    return { success: false, message: "Driver not found" };
  }

  const locationData = {
    driver_id: payload.driver_id,
    latitude: payload.latitude,
    longitude: payload.longitude,
    status: payload.status || "active",
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("driver_locations")
    .insert(locationData)
    .select()
    .single();

  if (error) {
    return { success: false, message: `Database error: ${error.message}` };
  }

  return { success: true, message: "Driver location ingested successfully", data };
}

async function ingestBatch(
  supabase: any,
  payload: { vehicles?: VehicleLocationPayload[]; drivers?: DriverLocationPayload[] }
): Promise<{ success: boolean; message: string; results?: any }> {
  const results = {
    vehicles: { success: 0, failed: 0, errors: [] as string[] },
    drivers: { success: 0, failed: 0, errors: [] as string[] },
  };

  if (payload.vehicles && Array.isArray(payload.vehicles)) {
    for (const vehicleData of payload.vehicles) {
      const result = await ingestVehicleLocation(supabase, vehicleData);
      if (result.success) {
        results.vehicles.success++;
      } else {
        results.vehicles.failed++;
        results.vehicles.errors.push(
          `Vehicle ${vehicleData.vehicle_id}: ${result.message}`
        );
      }
    }
  }

  if (payload.drivers && Array.isArray(payload.drivers)) {
    for (const driverData of payload.drivers) {
      const result = await ingestDriverLocation(supabase, driverData);
      if (result.success) {
        results.drivers.success++;
      } else {
        results.drivers.failed++;
        results.drivers.errors.push(
          `Driver ${driverData.driver_id}: ${result.message}`
        );
      }
    }
  }

  return {
    success: true,
    message: "Batch processing completed",
    results,
  };
}
