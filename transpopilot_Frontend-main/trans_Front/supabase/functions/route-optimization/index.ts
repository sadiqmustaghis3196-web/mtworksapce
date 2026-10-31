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
    const action = url.searchParams.get("action") || "optimize";

    if (action === "optimize") {
      const body = await req.json();
      const waypoints = body.waypoints;

      if (!waypoints || waypoints.length < 2) {
        return new Response(JSON.stringify({ error: "At least 2 waypoints required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = optimizeRouteOrder(waypoints);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "generate-sample") {
      const result = await generateSampleRoutes(supabase);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in route optimization:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface Waypoint {
  lat: number;
  lng: number;
  name: string;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function optimizeRouteOrder(waypoints: Waypoint[]) {
  if (waypoints.length <= 2) {
    return {
      optimizedWaypoints: waypoints.map((wp, idx) => ({ ...wp, sequence: idx + 1 })),
      totalDistance: waypoints.length === 2
        ? calculateDistance(waypoints[0].lat, waypoints[0].lng, waypoints[1].lat, waypoints[1].lng)
        : 0,
      estimatedDuration: 0,
      optimizationScore: 100,
      fuelSavings: 0,
      timeSavings: 0,
    };
  }

  const start = waypoints[0];
  const end = waypoints[waypoints.length - 1];
  const middle = waypoints.slice(1, waypoints.length - 1);

  const optimizedMiddle = nearestNeighborOptimization(start, end, middle);
  const optimized = [start, ...optimizedMiddle, end];

  let totalDistance = 0;
  for (let i = 0; i < optimized.length - 1; i++) {
    totalDistance += calculateDistance(
      optimized[i].lat,
      optimized[i].lng,
      optimized[i + 1].lat,
      optimized[i + 1].lng
    );
  }

  let baselineDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    baselineDistance += calculateDistance(
      waypoints[i].lat,
      waypoints[i].lng,
      waypoints[i + 1].lat,
      waypoints[i + 1].lng
    );
  }

  const improvement = ((baselineDistance - totalDistance) / baselineDistance) * 100;
  const optimizationScore = Math.max(70, Math.min(95, 70 + improvement));

  const averageSpeed = 45;
  const estimatedDuration = (totalDistance / averageSpeed) * 60;
  const baselineDuration = (baselineDistance / averageSpeed) * 60;
  const timeSavings = Math.max(0, baselineDuration - estimatedDuration);

  const avgMPG = 7.0; // Analytics metric baseline
  const costPerGallon = 0; // Requires integration
  const fuelSavings = 0;

  return {
    optimizedWaypoints: optimized.map((wp, idx) => ({
      ...wp,
      sequence: idx + 1,
    })),
    totalDistance: Math.round(totalDistance * 100) / 100,
    baselineDistance: Math.round(baselineDistance * 100) / 100,
    estimatedDuration: Math.round(estimatedDuration),
    optimizationScore: Math.round(optimizationScore * 100) / 100,
    fuelSavings: Math.round(fuelSavings * 100) / 100,
    timeSavings: Math.round(timeSavings),
    distanceSaved: Math.round((baselineDistance - totalDistance) * 100) / 100,
  };
}

function nearestNeighborOptimization(
  start: Waypoint,
  end: Waypoint,
  waypoints: Waypoint[]
): Waypoint[] {
  if (waypoints.length === 0) return [];
  if (waypoints.length === 1) return waypoints;

  const optimized: Waypoint[] = [];
  const remaining = [...waypoints];
  let current = start;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = calculateDistance(
      current.lat,
      current.lng,
      remaining[0].lat,
      remaining[0].lng
    );

    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistance(
        current.lat,
        current.lng,
        remaining[i].lat,
        remaining[i].lng
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const nearest = remaining.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    current = nearest;
  }

  return optimized;
}

async function generateSampleRoutes(supabase: any) {
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id")
    .eq("status", "active")
    .limit(3);

  const { data: drivers } = await supabase
    .from("drivers")
    .select("id")
    .eq("status", "active")
    .limit(3);

  if (!vehicles || vehicles.length === 0) {
    return { success: false, message: "No active vehicles found" };
  }

  const sampleRoutes = [
    {
      name: "Downtown Delivery Route",
      waypoints: [
        { name: "Warehouse", lat: 40.7128, lng: -74.0060 },
        { name: "Store A", lat: 40.7589, lng: -73.9851 },
        { name: "Store B", lat: 40.7614, lng: -73.9776 },
        { name: "Store C", lat: 40.7489, lng: -73.9680 },
        { name: "Return to Warehouse", lat: 40.7128, lng: -74.0060 },
      ],
    },
    {
      name: "Cross-City Express",
      waypoints: [
        { name: "Distribution Center", lat: 34.0522, lng: -118.2437 },
        { name: "Client Site 1", lat: 34.0689, lng: -118.4452 },
        { name: "Client Site 2", lat: 33.9806, lng: -118.4517 },
        { name: "Return", lat: 34.0522, lng: -118.2437 },
      ],
    },
    {
      name: "Regional Logistics Run",
      waypoints: [
        { name: "Hub", lat: 41.8781, lng: -87.6298 },
        { name: "Stop 1", lat: 41.9742, lng: -87.9073 },
        { name: "Stop 2", lat: 42.0451, lng: -87.6877 },
        { name: "Stop 3", lat: 41.9802, lng: -87.6847 },
        { name: "Stop 4", lat: 41.9395, lng: -87.6507 },
        { name: "Back to Hub", lat: 41.8781, lng: -87.6298 },
      ],
    },
  ];

  const created = [];

  for (let i = 0; i < sampleRoutes.length && i < vehicles.length; i++) {
    const routeTemplate = sampleRoutes[i];
    const optimization = optimizeRouteOrder(routeTemplate.waypoints);

    const { data: route, error: routeError } = await supabase
      .from("routes")
      .insert({
        route_name: routeTemplate.name,
        origin: routeTemplate.waypoints[0].name,
        destination: routeTemplate.waypoints[routeTemplate.waypoints.length - 1].name,
        distance_miles: optimization.totalDistance,
        estimated_duration_hours: optimization.estimatedDuration / 60,
        optimized: true,
        fuel_savings_estimate: optimization.fuelSavings,
        status: "planned",
        vehicle_id: vehicles[i].id,
        driver_id: drivers && drivers[i] ? drivers[i].id : null,
      })
      .select()
      .single();

    if (routeError) {
      console.error("Error creating route:", routeError);
      continue;
    }

    for (const wp of optimization.optimizedWaypoints) {
      await supabase.from("route_waypoints").insert({
        route_id: route.id,
        sequence_number: wp.sequence,
        name: wp.name,
        address: `${wp.lat}, ${wp.lng}`,
        latitude: wp.lat,
        longitude: wp.lng,
        status: "pending",
      });
    }

    await supabase.from("route_analytics").insert([
      {
        route_id: route.id,
        metric_type: "distance_optimization",
        baseline_value: optimization.baselineDistance,
        optimized_value: optimization.totalDistance,
        improvement_percentage: ((optimization.baselineDistance - optimization.totalDistance) / optimization.baselineDistance) * 100,
      },
      {
        route_id: route.id,
        metric_type: "time_savings",
        baseline_value: 0,
        optimized_value: optimization.timeSavings,
        improvement_percentage: optimization.timeSavings,
      },
      {
        route_id: route.id,
        metric_type: "fuel_efficiency",
        baseline_value: 0,
        optimized_value: optimization.fuelSavings,
        improvement_percentage: 10,
      },
    ]);

    created.push(route);
  }

  return {
    success: true,
    message: `Created ${created.length} sample routes`,
    routes: created,
  };
}