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
    const action = url.searchParams.get("action") || "analyze";

    if (action === "simulate") {
      const result = await simulateFuelRecords(supabase);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "analyze") {
      const vehicleId = url.searchParams.get("vehicle_id");
      const result = await analyzeFuelEfficiency(supabase, vehicleId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "recommendations") {
      const result = await generateFuelRecommendations(supabase);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in fuel optimization:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function simulateFuelRecords(supabase: any) {
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, current_mileage")
    .eq("status", "active");

  const { data: drivers } = await supabase
    .from("drivers")
    .select("id")
    .eq("status", "active");

  if (!vehicles || vehicles.length === 0) {
    return { success: false, message: "No active vehicles found", inserted: 0 };
  }

  const fuelRecords = [];
  const now = new Date();

  for (const vehicle of vehicles) {
    const recordsCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < recordsCount; i++) {
      const daysAgo = Math.floor(Math.random() * 7);
      const transactionDate = new Date(now);
      transactionDate.setDate(now.getDate() - daysAgo);

      const gallons = 80 + Math.random() * 100;
      const costPerGallon = 3.30 + Math.random() * 0.40;
      const totalCost = gallons * costPerGallon;

      const distanceTraveled = 400 + Math.random() * 300;
      const mpg = distanceTraveled / gallons;

      const currentMileage = (vehicle.current_mileage || 50000) + Math.floor(Math.random() * 500);

      const stationNames = [
        "Shell Station",
        "BP Truck Stop",
        "Pilot Travel Center",
        "Love's Travel Stop",
        "TA TravelCenters",
        "Flying J",
      ];

      const driver = drivers && drivers.length > 0
        ? drivers[Math.floor(Math.random() * drivers.length)]
        : null;

      fuelRecords.push({
        vehicle_id: vehicle.id,
        driver_id: driver?.id || null,
        gallons: Math.round(gallons * 100) / 100,
        cost_per_gallon: Math.round(costPerGallon * 100) / 100,
        total_cost: Math.round(totalCost * 100) / 100,
        station_name: stationNames[Math.floor(Math.random() * stationNames.length)],
        location: `Highway ${Math.floor(Math.random() * 100)} Exit ${Math.floor(Math.random() * 200)}`,
        odometer_reading: currentMileage,
        mpg: Math.round(mpg * 10) / 10,
        transaction_date: transactionDate.toISOString(),
      });
    }
  }

  const { error } = await supabase
    .from("fuel_records")
    .insert(fuelRecords);

  if (error) {
    return { success: false, message: error.message };
  }

  return {
    success: true,
    message: "Fuel records simulated successfully",
    inserted: fuelRecords.length,
  };
}

async function analyzeFuelEfficiency(supabase: any, vehicleId: string | null) {
  let query = supabase
    .from("fuel_records")
    .select("*, vehicles(vehicle_number, make, model), drivers(first_name, last_name)")
    .order("transaction_date", { ascending: false })
    .limit(100);

  if (vehicleId) {
    query = query.eq("vehicle_id", vehicleId);
  }

  const { data: fuelRecords } = await query;

  if (!fuelRecords || fuelRecords.length === 0) {
    return {
      success: true,
      message: "No fuel records found",
      analysis: {
        totalRecords: 0,
        totalCost: 0,
        totalGallons: 0,
        averageMPG: 0,
        averageCostPerGallon: 0,
      },
    };
  }

  const totalCost = fuelRecords.reduce((sum, r) => sum + (r.total_cost || 0), 0);
  const totalGallons = fuelRecords.reduce((sum, r) => sum + (r.gallons || 0), 0);
  const validMPGs = fuelRecords.filter((r) => r.mpg && r.mpg > 0);
  const averageMPG = validMPGs.length > 0
    ? validMPGs.reduce((sum, r) => sum + r.mpg, 0) / validMPGs.length
    : 0;
  const averageCostPerGallon = totalGallons > 0 ? totalCost / totalGallons : 0;

  const vehicleBreakdown: Record<string, any> = {};
  const driverBreakdown: Record<string, any> = {};

  for (const record of fuelRecords) {
    const vehicleKey = record.vehicle_id;
    if (!vehicleBreakdown[vehicleKey]) {
      vehicleBreakdown[vehicleKey] = {
        vehicle_id: vehicleKey,
        vehicle_number: (record.vehicles as any)?.vehicle_number || "Unknown",
        totalCost: 0,
        totalGallons: 0,
        records: 0,
        mpgs: [],
      };
    }
    vehicleBreakdown[vehicleKey].totalCost += record.total_cost || 0;
    vehicleBreakdown[vehicleKey].totalGallons += record.gallons || 0;
    vehicleBreakdown[vehicleKey].records += 1;
    if (record.mpg && record.mpg > 0) {
      vehicleBreakdown[vehicleKey].mpgs.push(record.mpg);
    }

    if (record.driver_id) {
      const driverKey = record.driver_id;
      if (!driverBreakdown[driverKey]) {
        const driver = record.drivers as any;
        driverBreakdown[driverKey] = {
          driver_id: driverKey,
          driver_name: driver ? `${driver.first_name} ${driver.last_name}` : "Unknown",
          totalCost: 0,
          totalGallons: 0,
          records: 0,
          mpgs: [],
        };
      }
      driverBreakdown[driverKey].totalCost += record.total_cost || 0;
      driverBreakdown[driverKey].totalGallons += record.gallons || 0;
      driverBreakdown[driverKey].records += 1;
      if (record.mpg && record.mpg > 0) {
        driverBreakdown[driverKey].mpgs.push(record.mpg);
      }
    }
  }

  const vehicleAnalysis = Object.values(vehicleBreakdown).map((v: any) => ({
    ...v,
    averageMPG: v.mpgs.length > 0
      ? Math.round((v.mpgs.reduce((sum: number, mpg: number) => sum + mpg, 0) / v.mpgs.length) * 10) / 10
      : 0,
    mpgs: undefined,
  }));

  const driverAnalysis = Object.values(driverBreakdown).map((d: any) => ({
    ...d,
    averageMPG: d.mpgs.length > 0
      ? Math.round((d.mpgs.reduce((sum: number, mpg: number) => sum + mpg, 0) / d.mpgs.length) * 10) / 10
      : 0,
    mpgs: undefined,
  }));

  return {
    success: true,
    analysis: {
      totalRecords: fuelRecords.length,
      totalCost: Math.round(totalCost * 100) / 100,
      totalGallons: Math.round(totalGallons * 100) / 100,
      averageMPG: Math.round(averageMPG * 10) / 10,
      averageCostPerGallon: Math.round(averageCostPerGallon * 100) / 100,
      vehicleAnalysis: vehicleAnalysis.sort((a, b) => b.averageMPG - a.averageMPG),
      driverAnalysis: driverAnalysis.sort((a, b) => b.averageMPG - a.averageMPG),
    },
  };
}

async function generateFuelRecommendations(supabase: any) {
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select(`
      id,
      vehicle_number,
      make,
      model,
      current_mileage
    `)
    .eq("status", "active");

  if (!vehicles || vehicles.length === 0) {
    return { success: true, recommendations: [] };
  }

  const recommendations = [];

  for (const vehicle of vehicles) {
    const { data: fuelRecords } = await supabase
      .from("fuel_records")
      .select("*")
      .eq("vehicle_id", vehicle.id)
      .order("transaction_date", { ascending: false })
      .limit(10);

    if (!fuelRecords || fuelRecords.length < 3) {
      continue;
    }

    const avgMPG = fuelRecords
      .filter((r) => r.mpg && r.mpg > 0)
      .reduce((sum, r) => sum + r.mpg, 0) / fuelRecords.filter((r) => r.mpg && r.mpg > 0).length;

    const avgCost = fuelRecords.reduce((sum, r) => sum + r.total_cost, 0) / fuelRecords.length;

    const baselineMPG = 7.0;
    if (avgMPG < baselineMPG - 0.5) {
      recommendations.push({
        vehicle_id: vehicle.id,
        vehicle_number: vehicle.vehicle_number,
        type: "efficiency_warning",
        priority: "high",
        message: `${vehicle.vehicle_number} is averaging ${avgMPG.toFixed(1)} MPG, below fleet baseline of ${baselineMPG} MPG`,
        action: "Schedule maintenance check and driver coaching",
        potential_savings: Math.round(((baselineMPG - avgMPG) / avgMPG) * avgCost * 12),
      });
    }

    if (fuelRecords.length >= 5) {
      const recentAvg = fuelRecords.slice(0, 3).filter((r) => r.mpg && r.mpg > 0)
        .reduce((sum, r) => sum + r.mpg, 0) / 3;
      const olderAvg = fuelRecords.slice(3, 6).filter((r) => r.mpg && r.mpg > 0)
        .reduce((sum, r) => sum + r.mpg, 0) / 3;

      if (recentAvg < olderAvg * 0.9) {
        recommendations.push({
          vehicle_id: vehicle.id,
          vehicle_number: vehicle.vehicle_number,
          type: "declining_efficiency",
          priority: "medium",
          message: `${vehicle.vehicle_number} fuel efficiency declining - recent: ${recentAvg.toFixed(1)} MPG vs previous: ${olderAvg.toFixed(1)} MPG`,
          action: "Investigate tire pressure, air filter, and driving patterns",
          potential_savings: Math.round(((olderAvg - recentAvg) / recentAvg) * avgCost * 6),
        });
      }
    }

    const highCostRecords = fuelRecords.filter((r) => r.cost_per_gallon > 3.60);
    if (highCostRecords.length > fuelRecords.length * 0.5) {
      recommendations.push({
        vehicle_id: vehicle.id,
        vehicle_number: vehicle.vehicle_number,
        type: "high_fuel_cost",
        priority: "low",
        message: `${vehicle.vehicle_number} frequently refueling at higher-cost stations`,
        action: "Use route planning to identify lower-cost fuel stations",
        potential_savings: Math.round(highCostRecords.length * 100 * 0.10),
      });
    }
  }

  return {
    success: true,
    recommendations_count: recommendations.length,
    recommendations: recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    total_potential_savings: recommendations.reduce((sum, r) => sum + (r.potential_savings || 0), 0),
  };
}