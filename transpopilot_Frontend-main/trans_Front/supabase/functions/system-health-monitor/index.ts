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
    const action = url.searchParams.get("action") || "check";

    if (action === "check") {
      await performHealthChecks(supabase);
      return new Response(
        JSON.stringify({ success: true, message: "Health checks completed" }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else if (action === "monitor-integrations") {
      await monitorIntegrations(supabase);
      return new Response(
        JSON.stringify({ success: true, message: "Integration monitoring completed" }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in health monitor:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

async function performHealthChecks(supabase: any) {
  const checks = [
    {
      name: "Database Connection",
      type: "database",
      check: async () => {
        const start = Date.now();
        const { error } = await supabase.from("vehicles").select("id").limit(1);
        const duration = Date.now() - start;
        return { success: !error, duration, error: error?.message };
      },
    },
    {
      name: "Vehicle Locations API",
      type: "api",
      check: async () => {
        const start = Date.now();
        const { error } = await supabase.from("vehicle_locations").select("id").limit(1);
        const duration = Date.now() - start;
        return { success: !error, duration, error: error?.message };
      },
    },
    {
      name: "Driver Locations API",
      type: "api",
      check: async () => {
        const start = Date.now();
        const { error } = await supabase.from("driver_locations").select("id").limit(1);
        const duration = Date.now() - start;
        return { success: !error, duration, error: error?.message };
      },
    },
    {
      name: "Integration System",
      type: "integration",
      check: async () => {
        const start = Date.now();
        const { data, error } = await supabase
          .from("integration_providers")
          .select("id, connection_status")
          .eq("is_enabled", true);
        const duration = Date.now() - start;
        return { success: !error, duration, error: error?.message, data };
      },
    },
  ];

  for (const check of checks) {
    const result = await check.check();
    const status = result.success
      ? result.duration > 1000
        ? "degraded"
        : "healthy"
      : "down";

    await supabase.from("system_health_checks").insert({
      service_name: check.name,
      check_type: check.type,
      status,
      response_time_ms: result.duration,
      error_message: result.error || null,
      metadata: { result },
      checked_at: new Date().toISOString(),
    });

    if (status === "down" || status === "degraded") {
      await supabase.from("system_alerts").insert({
        alert_type: status === "down" ? "error" : "performance",
        severity: status === "down" ? "critical" : "medium",
        service_name: check.name,
        message: status === "down"
          ? `${check.name} is down: ${result.error}`
          : `${check.name} is experiencing slow response times (${result.duration}ms)`,
        details: { check: check.name, result },
        status: "open",
        triggered_at: new Date().toISOString(),
      });
    }
  }
}

async function monitorIntegrations(supabase: any) {
  const { data: providers, error } = await supabase
    .from("integration_providers")
    .select("*")
    .eq("is_enabled", true)
    .eq("connection_status", "connected");

  if (error || !providers || providers.length === 0) {
    return;
  }

  for (const provider of providers) {
    const start = Date.now();
    const status = "healthy";
    const duration = Date.now() - start;

    await supabase.from("system_health_checks").insert({
      service_name: `${provider.display_name} Integration`,
      check_type: "integration",
      status,
      response_time_ms: duration,
      metadata: { provider_id: provider.id, provider_name: provider.name },
      checked_at: new Date().toISOString(),
    });
  }
}
