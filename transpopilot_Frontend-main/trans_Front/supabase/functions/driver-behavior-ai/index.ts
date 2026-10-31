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

    if (action === "analyze") {
      const driverId = url.searchParams.get("driver_id");
      if (driverId) {
        const result = await analyzeDriverBehavior(supabase, driverId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const result = await analyzeAllDrivers(supabase);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (action === "simulate") {
      const result = await simulateBehaviorData(supabase);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "generate-coaching") {
      const driverId = url.searchParams.get("driver_id");
      if (!driverId) {
        return new Response(JSON.stringify({ error: "driver_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await generateCoachingPlan(supabase, driverId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in driver behavior AI:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function analyzeDriverBehavior(supabase: any, driverId: string) {
  const { data: driver } = await supabase
    .from("drivers")
    .select("*")
    .eq("id", driverId)
    .maybeSingle();

  if (!driver) {
    return { success: false, message: "Driver not found" };
  }

  const metrics = await getDriverMetrics(supabase, driverId);
  const incidents = await getDriverIncidents(supabase, driverId);
  const scores = calculateBehaviorScores(metrics, incidents);
  const recommendations = generateRecommendations(scores, metrics, incidents);
  const trend = await calculateTrend(supabase, driverId);

  return {
    success: true,
    driver_id: driverId,
    driver_name: `${driver.first_name} ${driver.last_name}`,
    email: driver.email,
    behavior_score: scores.overall,
    safety_rating: scores.safety,
    fuel_efficiency_rating: scores.fuel_efficiency,
    component_scores: {
      acceleration: scores.acceleration,
      braking: scores.braking,
      speed_compliance: scores.speed_compliance,
      idle_time: scores.idle_time,
    },
    metrics,
    incidents_count: incidents.length,
    risk_level: getRiskLevel(scores.overall, incidents.length),
    recommendations,
    improvement_trend: trend,
    coaching_priority: getCoachingPriority(scores, incidents),
  };
}

async function analyzeAllDrivers(supabase: any) {
  const { data: drivers } = await supabase
    .from("drivers")
    .select("*")
    .eq("status", "active")
    .order("last_name");

  if (!drivers || drivers.length === 0) {
    return { success: true, message: "No active drivers found", analyses: [] };
  }

  const analyses = [];
  for (const driver of drivers) {
    const analysis = await analyzeDriverBehavior(supabase, driver.id);
    analyses.push(analysis);
  }

  const summary = {
    total_drivers: drivers.length,
    excellent_count: analyses.filter((a) => a.behavior_score >= 90).length,
    good_count: analyses.filter((a) => a.behavior_score >= 75 && a.behavior_score < 90).length,
    fair_count: analyses.filter((a) => a.behavior_score >= 60 && a.behavior_score < 75).length,
    poor_count: analyses.filter((a) => a.behavior_score < 60).length,
    avg_behavior_score: Math.round(
      analyses.reduce((sum, a) => sum + a.behavior_score, 0) / analyses.length
    ),
    high_risk_drivers: analyses.filter((a) => a.risk_level === "high").length,
    needs_coaching: analyses.filter((a) => a.coaching_priority === "high").length,
  };

  return {
    success: true,
    summary,
    analyses,
  };
}

async function simulateBehaviorData(supabase: any) {
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id")
    .eq("status", "active");

  if (!drivers || drivers.length === 0) {
    return { success: true, message: "No active drivers to simulate", inserted: 0 };
  }

  const behaviorData = drivers.map((driver) => ({
    driver_id: driver.id,
    harsh_acceleration_count: Math.floor(Math.random() * 10),
    harsh_braking_count: Math.floor(Math.random() * 8),
    speed_violations_count: Math.floor(Math.random() * 5),
    idle_time_minutes: Math.floor(Math.random() * 120) + 30,
    total_distance_miles: Math.floor(Math.random() * 200) + 100,
    total_drive_time_hours: Math.floor(Math.random() * 10) + 4,
    recorded_date: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("driver_behavior_analytics")
    .insert(behaviorData);

  if (error) {
    return { success: false, message: error.message };
  }

  return {
    success: true,
    message: "Behavior data simulated successfully",
    inserted: behaviorData.length,
  };
}

async function generateCoachingPlan(supabase: any, driverId: string) {
  const analysis = await analyzeDriverBehavior(supabase, driverId);

  if (!analysis.success) {
    return analysis;
  }

  const plan = {
    driver_id: driverId,
    driver_name: analysis.driver_name,
    coaching_sessions: [],
    focus_areas: [],
    timeline: "4 weeks",
    expected_improvement: "15-20%",
  };

  if (analysis.component_scores.acceleration < 75) {
    plan.coaching_sessions.push({
      session: 1,
      topic: "Smooth Acceleration Techniques",
      duration: "30 minutes",
      methods: ["Video training", "Simulator practice"],
    });
    plan.focus_areas.push("acceleration");
  }

  if (analysis.component_scores.braking < 75) {
    plan.coaching_sessions.push({
      session: 2,
      topic: "Anticipatory Braking & Safe Following Distance",
      duration: "45 minutes",
      methods: ["Classroom training", "On-road coaching"],
    });
    plan.focus_areas.push("braking");
  }

  if (analysis.component_scores.speed_compliance < 80) {
    plan.coaching_sessions.push({
      session: 3,
      topic: "Speed Management & Compliance",
      duration: "30 minutes",
      methods: ["Policy review", "Best practices discussion"],
    });
    plan.focus_areas.push("speed");
  }

  if (analysis.component_scores.idle_time < 80) {
    plan.coaching_sessions.push({
      session: 4,
      topic: "Fuel Efficiency & Idle Reduction",
      duration: "30 minutes",
      methods: ["Data analysis", "Goal setting"],
    });
    plan.focus_areas.push("idle_time");
  }

  if (analysis.incidents_count > 2) {
    plan.coaching_sessions.push({
      session: 5,
      topic: "Defensive Driving & Risk Mitigation",
      duration: "60 minutes",
      methods: ["Interactive workshop", "Incident review"],
    });
    plan.focus_areas.push("safety");
  }

  if (plan.coaching_sessions.length === 0) {
    return {
      success: true,
      message: "Driver performing well - no immediate coaching needed",
      driver_id: driverId,
      recommendation: "Continue monitoring and provide positive reinforcement",
    };
  }

  return {
    success: true,
    ...plan,
  };
}

async function getDriverMetrics(supabase: any, driverId: string) {
  const { data } = await supabase
    .from("driver_behavior_analytics")
    .select("*")
    .eq("driver_id", driverId)
    .order("recorded_date", { ascending: false })
    .limit(30);

  if (!data || data.length === 0) {
    return {
      harsh_acceleration: 0,
      harsh_braking: 0,
      speed_violations: 0,
      idle_time: 0,
      total_miles: 0,
      total_hours: 0,
    };
  }

  let hasRealIdleTime = false;
  
  const result = data.reduce(
    (acc, record) => {
      if (record.idle_time_minutes !== null) hasRealIdleTime = true;
      return {
        harsh_acceleration: acc.harsh_acceleration + (record.harsh_acceleration_count || 0),
        harsh_braking: acc.harsh_braking + (record.harsh_braking_count || 0),
        speed_violations: acc.speed_violations + (record.speed_violations_count || 0),
        idle_time: acc.idle_time + (record.idle_time_minutes || 0),
        total_miles: acc.total_miles + (record.total_distance_miles || 0),
        total_hours: acc.total_hours + (record.total_drive_time_hours || 0),
      };
    },
    {
      harsh_acceleration: 0,
      harsh_braking: 0,
      speed_violations: 0,
      idle_time: 0,
      total_miles: 0,
      total_hours: 0,
    }
  );
  
  if (!hasRealIdleTime) {
      result.idle_time = null;
  }
  
  return result;
}

async function getDriverIncidents(supabase: any, driverId: string) {
  const { data } = await supabase
    .from("safety_incidents")
    .select("*")
    .eq("driver_id", driverId)
    .order("incident_date", { ascending: false });

  return data || [];
}

function calculateBehaviorScores(metrics: any, incidents: any[]) {
  const milesPerIncident = metrics.total_miles > 0
    ? metrics.total_miles / Math.max(incidents.length, 1)
    : 10000;

  const safetyScore = Math.min((milesPerIncident / 100), 100);

  const accelerationScore = Math.max(
    100 - (metrics.harsh_acceleration / Math.max(metrics.total_miles / 100, 1)) * 10,
    40
  );

  const brakingScore = Math.max(
    100 - (metrics.harsh_braking / Math.max(metrics.total_miles / 100, 1)) * 10,
    40
  );

  const speedScore = Math.max(
    100 - (metrics.speed_violations / Math.max(metrics.total_miles / 100, 1)) * 15,
    40
  );

  let idleScore = 100;
  if (metrics.idle_time !== null) {
      idleScore = Math.max(
        100 - (metrics.idle_time / Math.max(metrics.total_hours, 1)) * 2,
        40
      );
  } else {
      idleScore = null;
  }

  // If idleScore is null, we average the others
  let fuelEfficiency = 100;
  if (idleScore !== null) {
      fuelEfficiency = Math.round((accelerationScore + brakingScore + idleScore) / 3);
  } else {
      fuelEfficiency = Math.round((accelerationScore + brakingScore) / 2);
  }
  
  let sum = accelerationScore + brakingScore + speedScore + safetyScore;
  let count = 4;
  if (idleScore !== null) {
      sum += idleScore;
      count++;
  }
  const overall = Math.round(sum / count);

  return {
    overall: Math.min(overall, 100),
    safety: Math.min(Math.round(safetyScore), 100),
    fuel_efficiency: Math.min(fuelEfficiency, 100),
    acceleration: Math.min(Math.round(accelerationScore), 100),
    braking: Math.min(Math.round(brakingScore), 100),
    speed_compliance: Math.min(Math.round(speedScore), 100),
    idle_time: idleScore === null ? null : Math.min(Math.round(idleScore), 100),
  };
}

function generateRecommendations(scores: any, metrics: any, incidents: any[]): string[] {
  const recommendations: string[] = [];

  if (scores.overall >= 90) {
    recommendations.push("Excellent performance - maintain current standards");
    recommendations.push("Consider for recognition program");
    return recommendations;
  }

  if (incidents.length > 3) {
    recommendations.push("URGENT: Schedule immediate safety training");
    recommendations.push("Review company driving policies with manager");
  }

  if (scores.acceleration < 75) {
    recommendations.push("Focus on smoother acceleration patterns to improve fuel efficiency");
  }

  if (scores.braking < 75) {
    recommendations.push("Practice anticipatory braking to reduce harsh braking incidents");
  }

  if (scores.speed_compliance < 80) {
    recommendations.push("Improve speed limit compliance - consider cruise control usage");
  }

  if (scores.idle_time < 80) {
    recommendations.push("Reduce idle time - aim for 10% or less of total drive time");
  }

  if (scores.safety < 75) {
    recommendations.push("Schedule defensive driving refresher course");
  }

  if (recommendations.length === 0) {
    recommendations.push("Good overall performance");
    recommendations.push("Continue monitoring key metrics");
  }

  return recommendations;
}

function getRiskLevel(score: number, incidentCount: number): string {
  if (score < 65 || incidentCount > 4) return "high";
  if (score < 80 || incidentCount > 2) return "medium";
  return "low";
}

function getCoachingPriority(scores: any, incidents: any[]): string {
  if (scores.overall < 65 || incidents.length > 3) return "high";
  if (scores.overall < 80 || incidents.length > 1) return "medium";
  return "low";
}

async function calculateTrend(supabase: any, driverId: string): Promise<string> {
  const { data } = await supabase
    .from("driver_behavior_analytics")
    .select("*")
    .eq("driver_id", driverId)
    .order("recorded_date", { ascending: false })
    .limit(10);

  if (!data || data.length < 5) {
    return "stable";
  }

  const recent = data.slice(0, 5);
  const older = data.slice(5, 10);

  const recentAvg = recent.reduce((sum, r) =>
    sum + (r.harsh_acceleration_count || 0) + (r.harsh_braking_count || 0) + (r.speed_violations_count || 0), 0
  ) / recent.length;

  const olderAvg = older.reduce((sum, r) =>
    sum + (r.harsh_acceleration_count || 0) + (r.harsh_braking_count || 0) + (r.speed_violations_count || 0), 0
  ) / older.length;

  if (recentAvg < olderAvg * 0.8) return "improving";
  if (recentAvg > olderAvg * 1.2) return "declining";
  return "stable";
}