import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// In-memory cache to prevent duplicate AI generations
// Key: organization_id_hash, Value: Brief JSON
const cache = new Map();
// Key: organization_id_hash, Value: Promise<Brief JSON>
const inFlight = new Map();

export async function getMorningBrief(orgId) {
  try {
    // 1. Gather Vehicles and Readiness
    const { data: vehicles } = await supabase.from('vehicles').select('id, status').eq('organization_id', orgId);
    const totalVehicles = vehicles?.length || 0;
    const activeVehicles = vehicles?.filter(v => v.status === 'active').length || 0;

    // 2. Gather Health & Maintenance
    const { data: health } = await supabase.from('vehicle_health_scores')
      .select('vehicle_id, overall_score, has_critical_fault, ai_recommendation, vehicles(vehicle_number)')
      .eq('organization_id', orgId);
      
    const criticalFaults = health?.filter(h => h.has_critical_fault).map(h => {
      const vData = Array.isArray(h.vehicles) ? (h.vehicles[0] || {}) : (h.vehicles || {});
      return {
        vehicle: vData.vehicle_number || 'Unknown',
        score: h.overall_score,
        recommendation: h.ai_recommendation || null // Reusing existing AI recommendation!
      };
    }) || [];

    // 3. Driver Safety Trends (Last 7 days vs previous 7 days)
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(today.getDate() - 14);

    const { data: safetyData } = await supabase.from('driver_behavior_analytics')
      .select('driver_id, harsh_braking_count, harsh_acceleration_count, idle_time_minutes, recorded_date')
      .eq('organization_id', orgId)
      .gte('recorded_date', fourteenDaysAgo.toISOString().split('T')[0]);
      
    let recentBraking = 0, pastBraking = 0, recentAccel = 0, pastAccel = 0;
    let idleMinutes = 0;
    const idleMap = {};
    
    if (safetyData) {
      safetyData.forEach(s => {
        const recDate = new Date(s.recorded_date);
        if (recDate >= sevenDaysAgo) {
          recentBraking += s.harsh_braking_count || 0;
          recentAccel += s.harsh_acceleration_count || 0;
          idleMinutes += s.idle_time_minutes || 0;
          if (s.idle_time_minutes) {
             idleMap[s.driver_id] = (idleMap[s.driver_id] || 0) + s.idle_time_minutes;
          }
        } else {
          pastBraking += s.harsh_braking_count || 0;
          pastAccel += s.harsh_acceleration_count || 0;
        }
      });
    }

    const sortedIdle = Object.entries(idleMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const topIdleVehicles = sortedIdle.map(([dId, mins]) => ({ driverId: dId, idleMinutes: mins }));

    // Threshold: >= 20% increase AND minimum event volume of 5
    let brakingChange = 0;
    if (pastBraking >= 5) {
        brakingChange = Math.round(((recentBraking - pastBraking) / pastBraking) * 100);
    } else if (pastBraking === 0 && recentBraking >= 5) {
        brakingChange = 100;
    }
    
    let accelChange = 0;
    if (pastAccel >= 5) {
        accelChange = Math.round(((recentAccel - pastAccel) / pastAccel) * 100);
    }

    // 4. Cost formula deterministically
    // Idle threshold > 30 minutes. Estimate $4.00 per gallon and 0.5 gallons per hour of idle.
    const idleFuelGallons = (idleMinutes / 60) * 0.5;
    const estimatedAvoidableCost = Math.round(idleFuelGallons * 4.00); 

    // 5. Fleet Readiness Formula
    // readiness = (total - criticalBlockers) / total
    let readiness = 100;
    if (totalVehicles > 0) {
      const criticalCount = criticalFaults.length;
      readiness = Math.round(((totalVehicles - criticalCount) / totalVehicles) * 100);
    } else {
      readiness = 0;
    }
    
    const fallback = {
      headline: `Good morning. Your fleet is ${readiness}% ready for operation.`,
      summary: [
        `${totalVehicles} total vehicles, ${activeVehicles} active.`,
        `${criticalFaults.length} vehicles need attention before dispatch.`,
        `Estimated avoidable cost is $${estimatedAvoidableCost}.`
      ],
      topActions: criticalFaults.slice(0, 3).map((f, i) => ({
        priority: i + 1,
        type: 'maintenance',
        title: `Check Vehicle ${f.vehicle}`,
        reason: f.recommendation || 'Critical fault detected',
        vehicleId: f.vehicle
      })),
      estimatedAvoidableCost,
      confidence: "fallback",
      generatedAt: new Date().toISOString()
    };

    function getFallback(rowJson) {
      if (rowJson && typeof rowJson === 'object' && rowJson.headline) {
          return rowJson;
      }
      return fallback;
    }

    if (inFlight.has(orgId)) {
       console.log("[Intelligence] Joining existing in-flight generation for org:", orgId);
       return inFlight.get(orgId);
    }

    const generationPromise = (async () => {
      // 1. Fetch current brief row
      let { data: row, error: fetchError } = await supabase
        .from('fleet_ai_briefs')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (!row) {
        // Ensure row exists
        const { error: insertError } = await supabase
          .from('fleet_ai_briefs')
          .insert({ organization_id: orgId });
        // Ignore 23505 unique violation
        
        const res = await supabase
          .from('fleet_ai_briefs')
          .select('*')
          .eq('organization_id', orgId)
          .maybeSingle();
        row = res.data;
      }

      if (!row) {
         console.warn("[Intelligence] Failed to initialize DB row. Returning fallback.");
         return fallback;
      }

      let briefJsonObj = null;
      try {
        if (row.brief_json) {
          briefJsonObj = typeof row.brief_json === 'string' ? JSON.parse(row.brief_json) : row.brief_json;
        }
      } catch (e) {}

      const now = new Date();
      const generatedAt = row.generated_at ? new Date(row.generated_at) : null;
      const failedAt = row.failed_at ? new Date(row.failed_at) : null;
      const startedAt = row.generation_started_at ? new Date(row.generation_started_at) : null;

      // 1. TRUE 24-HOUR CHECK
      if (row.status === 'completed' && generatedAt && (now.getTime() - generatedAt.getTime() < 24 * 60 * 60 * 1000)) {
          console.log("[Intelligence] Valid 24h cache found. No Gemini call.");
          return briefJsonObj;
      }

      // 2. FAILURE RETRY COOLDOWN
      if (row.status === 'failed' && failedAt && (now.getTime() - failedAt.getTime() < 5 * 60 * 1000)) {
          console.log("[Intelligence] In failure cooldown. No Gemini call.");
          return getFallback(briefJsonObj);
      }

      // 3. ATOMIC LOCK ACQUISITION
      // Note: We use updated_at as an optimistic concurrency token
      const { data: lockAcquired, error: lockError } = await supabase
        .from('fleet_ai_briefs')
        .update({
          status: 'generating',
          generation_started_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('organization_id', orgId)
        .eq('updated_at', row.updated_at)
        .select()
        .maybeSingle();

      if (lockError || !lockAcquired) {
          console.log("[Intelligence] Failed to acquire lock (another process is generating). No Gemini call.");
          return getFallback(briefJsonObj);
      }

      console.log("[Intelligence] Lock acquired. Generating via Gemini...");

      const inputJSON = {
        fleetReadiness: readiness,
        totalVehicles,
        activeVehicles,
        maintenanceRisks: criticalFaults.slice(0, 3),
        safetyTrends: {
          brakingChangePct: brakingChange > 20 ? brakingChange : 0,
          accelChangePct: accelChange > 20 ? accelChange : 0
        },
        idleCount: topIdleVehicles.length,
        estimatedAvoidableCost
      };

      if (!process.env.GEMINI_API_KEY) {
         console.warn("GEMINI_API_KEY is missing. Failing generation.");
         await supabase.from('fleet_ai_briefs').update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            generation_started_at: null,
            error_code: 'NO_API_KEY',
            updated_at: new Date().toISOString()
         }).eq('organization_id', orgId);
         return getFallback(briefJsonObj);
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const primaryModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
      const fallbackModel = "gemini-3.1-flash-lite";
      const generationConfig = { temperature: 0, maxOutputTokens: 384 };
      
      const prompt = `You are a fleet manager AI. Convert this JSON into a morning brief JSON. 
Do not invent vehicles, drivers, monetary savings, mileage, or percentages. 
If evidence is insufficient, omit the claim. 
Input JSON: ${JSON.stringify(inputJSON)}
Output strictly JSON matching this structure:
{
  "headline": "Good morning. Your fleet is 91% ready for operation.",
  "summary": ["string bullet points max 6"],
  "topActions": [{"priority":1, "type":"maintenance/safety/idle", "title":"", "reason":"", "vehicleId":""}],
  "estimatedAvoidableCost": 1240,
  "confidence": "high"
}`;

      let result;
      let usedModel = primaryModel;
      let finalError = null;

      try {
        const model = genAI.getGenerativeModel({ model: primaryModel, generationConfig });
        result = await model.generateContent(prompt);
      } catch (primaryError) {
        if (primaryError.status === 503 || primaryError.status === 429) {
          await new Promise(res => setTimeout(res, 500));
          try {
            const model = genAI.getGenerativeModel({ model: primaryModel, generationConfig });
            result = await model.generateContent(prompt);
          } catch (retryError) {
             try {
               usedModel = fallbackModel;
               const fbModel = genAI.getGenerativeModel({ model: fallbackModel, generationConfig });
               result = await fbModel.generateContent(prompt);
             } catch (fbError) {
               finalError = fbError;
             }
          }
        } else {
          finalError = primaryError;
        }
      }

      if (finalError) {
         console.error("[Intelligence] Gemini call failed:", finalError.message);
         await supabase.from('fleet_ai_briefs').update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            generation_started_at: null,
            error_code: 'API_ERROR',
            updated_at: new Date().toISOString()
         }).eq('organization_id', orgId);
         return getFallback(briefJsonObj);
      }

      const usage = result.response.usageMetadata;
      console.log(`[Gemini Usage] Intelligence Brief | Tokens: Prompt ${usage?.promptTokenCount} + Output ${usage?.candidatesTokenCount} = ${usage?.totalTokenCount}`);

      let text = result.response.text();
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      let newBriefJson;
      try {
        newBriefJson = JSON.parse(text);
        
        // STRICT OUTPUT VALIDATION
        if (!newBriefJson.headline || typeof newBriefJson.headline !== 'string') throw new Error("Invalid headline");
        if (!Array.isArray(newBriefJson.summary)) throw new Error("Invalid summary");
        if (!Array.isArray(newBriefJson.topActions)) throw new Error("Invalid topActions");
        
        newBriefJson.summary = newBriefJson.summary.slice(0, 6);
        newBriefJson.topActions = newBriefJson.topActions.slice(0, 5);
        newBriefJson.generatedAt = new Date().toISOString();
        
      } catch (parseError) {
         console.error("[Intelligence] JSON Validation failed:", parseError.message);
         await supabase.from('fleet_ai_briefs').update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            generation_started_at: null,
            error_code: 'INVALID_JSON',
            updated_at: new Date().toISOString()
         }).eq('organization_id', orgId);
         return getFallback(briefJsonObj);
      }

      // SUCCESS FLOW
      await supabase.from('fleet_ai_briefs').update({
        status: 'completed',
        brief_json: newBriefJson,
        generated_at: newBriefJson.generatedAt,
        generation_completed_at: new Date().toISOString(),
        generation_started_at: null,
        failed_at: null,
        error_code: null,
        model: usedModel,
        input_tokens: usage?.promptTokenCount || 0,
        output_tokens: usage?.candidatesTokenCount || 0,
        total_tokens: usage?.totalTokenCount || 0,
        updated_at: new Date().toISOString()
      }).eq('organization_id', orgId);
      
      return newBriefJson;
    })();
    
    inFlight.set(orgId, generationPromise);
    try {
      const result = await generationPromise;
      return result;
    } finally {
      inFlight.delete(orgId);
    }
  } catch (error) {
    console.error("Error in getMorningBrief:", error);
    return {
      headline: `Good morning. Your fleet intelligence is currently loading.`,
      summary: [`Our systems are gathering your latest metrics.`],
      topActions: [],
      estimatedAvoidableCost: 0,
      confidence: "error",
      generatedAt: new Date().toISOString()
    };
  }
}
