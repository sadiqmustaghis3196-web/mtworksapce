import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: ServiceHealth;
    edgeFunctions: ServiceHealth;
    integrations: ServiceHealth;
    aiServices: ServiceHealth;
  };
  metrics: {
    responseTime: number;
    uptime: number;
  };
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
  lastCheck?: string;
}

async function checkDatabaseHealth(supabase: any): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id')
      .limit(1)
      .maybeSingle();

    const latency = Date.now() - start;

    if (error && error.code !== 'PGRST116') {
      return {
        status: 'down',
        latency,
        message: error.message,
        lastCheck: new Date().toISOString(),
      };
    }

    return {
      status: latency > 1000 ? 'degraded' : 'up',
      latency,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkEdgeFunctionsHealth(supabase: any): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const functionsToCheck = [
      'gps-ingest',
      'vehicle-health-ai',
      'driver-behavior-ai',
      'route-optimization',
    ];

    const { data, error } = await supabase
      .from('system_health_metrics')
      .select('service_name, status')
      .in('service_name', functionsToCheck)
      .order('created_at', { ascending: false })
      .limit(functionsToCheck.length);

    const latency = Date.now() - start;

    if (error) {
      return {
        status: 'degraded',
        latency,
        message: 'Unable to verify function health',
        lastCheck: new Date().toISOString(),
      };
    }

    const downFunctions = data?.filter((f: any) => f.status === 'down').length || 0;
    const totalChecked = functionsToCheck.length;

    let status: 'up' | 'down' | 'degraded' = 'up';
    if (downFunctions === totalChecked) {
      status = 'down';
    } else if (downFunctions > 0) {
      status = 'degraded';
    }

    return {
      status,
      latency,
      message: downFunctions > 0 ? `${downFunctions}/${totalChecked} functions degraded` : undefined,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'degraded',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkIntegrationsHealth(supabase: any): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const { data, error } = await supabase
      .from('telematics_integrations')
      .select('status, last_sync_at')
      .in('status', ['active', 'connected']);

    const latency = Date.now() - start;

    if (error) {
      return {
        status: 'degraded',
        latency,
        message: 'Unable to check integrations',
        lastCheck: new Date().toISOString(),
      };
    }

    const activeCount = data?.length || 0;

    return {
      status: activeCount > 0 ? 'up' : 'degraded',
      latency,
      message: `${activeCount} active integrations`,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'degraded',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkAIServicesHealth(supabase: any): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const { data, error } = await supabase
      .from('ai_model_metrics')
      .select('model_type, accuracy')
      .order('created_at', { ascending: false })
      .limit(2);

    const latency = Date.now() - start;

    if (error) {
      return {
        status: 'degraded',
        latency,
        message: 'Unable to verify AI services',
        lastCheck: new Date().toISOString(),
      };
    }

    const hasRecentMetrics = data && data.length > 0;

    return {
      status: hasRecentMetrics ? 'up' : 'degraded',
      latency,
      message: hasRecentMetrics ? 'AI models operational' : 'No recent AI activity',
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'degraded',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString(),
    };
  }
}

async function calculateUptime(supabase: any): Promise<number> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase.rpc('calculate_uptime_percentage', {
      p_service_name: 'system',
      p_start_time: oneDayAgo,
      p_end_time: new Date().toISOString(),
    });

    if (error || !data) {
      return 99.0;
    }

    return parseFloat(data);
  } catch (error) {
    console.error('Error calculating uptime:', error);
    return 99.0;
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

    const [database, edgeFunctions, integrations, aiServices, uptime] = await Promise.all([
      checkDatabaseHealth(supabase),
      checkEdgeFunctionsHealth(supabase),
      checkIntegrationsHealth(supabase),
      checkAIServicesHealth(supabase),
      calculateUptime(supabase),
    ]);

    const responseTime = Date.now() - startTime;

    const allServices = [database, edgeFunctions, integrations, aiServices];
    const downServices = allServices.filter(s => s.status === 'down').length;
    const degradedServices = allServices.filter(s => s.status === 'degraded').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (downServices > 0 || degradedServices > 2) {
      overallStatus = 'unhealthy';
    } else if (degradedServices > 0) {
      overallStatus = 'degraded';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database,
        edgeFunctions,
        integrations,
        aiServices,
      },
      metrics: {
        responseTime,
        uptime,
      },
    };

    await supabase.from('system_health_metrics').insert({
      service_name: 'health-check',
      status: overallStatus === 'healthy' ? 'up' : 'down',
      response_time_ms: responseTime,
      details: result,
      created_at: new Date().toISOString(),
    });

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

    return new Response(
      JSON.stringify(result),
      {
        status: statusCode,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Health check error:", error);

    const errorResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      error: error instanceof Error ? error.message : 'Unknown error',
      metrics: {
        responseTime: Date.now() - startTime,
        uptime: 0,
      },
    };

    return new Response(
      JSON.stringify(errorResult),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
