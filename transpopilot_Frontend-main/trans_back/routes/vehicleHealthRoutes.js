import express from 'express';
import { attachSupabaseUser, requireRole } from '../services/rbac.js';
import { supabase } from '../config/supabase.js';
import rateLimit from 'express-rate-limit';
import { getVehicleHealthRecommendation } from '../services/ai/geminiService.js';

const router = express.Router();

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many AI requests, please try again later.' }
});

router.use(attachSupabaseUser);
// We allow super_admin, admin, fleet_manager, and dispatcher (read-only)
router.use(requireRole('super_admin', 'admin', 'fleet_manager', 'dispatcher'));

// Restrict non-GET requests to prevent dispatchers from mutating
router.use((req, res, next) => {
  if (req.method !== 'GET' && req.user.role === 'dispatcher') {
    return res.status(403).json({ error: 'Dispatchers have read-only access to vehicle health.' });
  }
  next();
});

// Get health scores for all vehicles in the caller's organization
router.get('/', aiRateLimiter, async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, vehicle_number, vin, provider, vehicle_health_scores(*)')
      .eq('organization_id', orgId);

    console.log("Returned vehicles data length:", data?.length);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch vehicle health scores.' });
    }

    const rows = data.map(vehicle => {
      let score = vehicle.vehicle_health_scores || {};
      if (Array.isArray(score)) {
        score = score[0] || {};
      }
      return {
        ...score,
        id: score.id || vehicle.id,
        vehicle_id: vehicle.id,
        vehicle_name: vehicle.vehicle_number,
        vehicle_vin: vehicle.vin,
        provider: vehicle.provider,
        // Override with nulls if score doesn't exist
        overall_score: score.overall_score ?? null,
        engine_score: score.engine_score ?? null,
        cooling_score: score.cooling_score ?? null,
        pm_score: score.pm_score ?? null,
        dpf_score: score.dpf_score ?? null,
        transmission_score: score.transmission_score ?? null,
        battery_score: score.battery_score ?? null,
        has_critical_fault: score.has_critical_fault ?? false,
        has_warning_fault: score.has_warning_fault ?? false,
        ai_recommendation: score.ai_recommendation ?? null,
        estimated_repair_cost: score.estimated_repair_cost ?? null
      };
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching vehicle health.' });
  }
});

// Get health score for a specific vehicle (also org-scoped)
router.get('/:vehicleId', aiRateLimiter, async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { vehicleId } = req.params;

    if (!orgId) {
       return res.status(403).json({ error: 'User does not belong to an organization.' });
    }

    const { data, error } = await supabase
      .from('vehicle_health_scores')
      .select('*, vehicles(vehicle_number, vin)')
      .eq('organization_id', orgId)
      .eq('vehicle_id', vehicleId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch vehicle health score.' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Vehicle health score not found or access denied.' });
    }

    const vehicleData = Array.isArray(data.vehicles) ? (data.vehicles[0] || {}) : (data.vehicles || {});
    const row = {
      ...data,
      vehicle_name: vehicleData.vehicle_number,
      vehicle_vin: vehicleData.vin
    };

    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching vehicle health score.' });
  }
});

// Generate on-demand AI recommendation
router.post('/:vehicleId/recommendation', aiRateLimiter, async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { vehicleId } = req.params;

    if (!orgId) return res.status(403).json({ error: 'User does not belong to an organization.' });

    // Fetch current scores
    const { data: scores, error } = await supabase
      .from('vehicle_health_scores')
      .select('*')
      .eq('organization_id', orgId)
      .eq('vehicle_id', vehicleId)
      .maybeSingle();

    if (error || !scores) {
      return res.status(404).json({ error: 'Vehicle health data not found.' });
    }

    // Generate recommendation
    const recommendationPayload = `Scores (100 is perfect/healthy, 0 is critical failure, null means no data): Engine(${scores.engine_score}), Cooling(${scores.cooling_score}), PM(${scores.pm_score}), DPF(${scores.dpf_score}), Transmission(${scores.transmission_score}), Battery(${scores.battery_score}). Vetoes: Critical(${scores.has_critical_fault}), Warning(${scores.has_warning_fault}).`;
    const aiRecommendation = await getVehicleHealthRecommendation(recommendationPayload, orgId);

    if (aiRecommendation) {
      // Update DB
      await supabase
        .from('vehicle_health_scores')
        .update({ ai_recommendation: aiRecommendation })
        .eq('id', scores.id);
    }

    res.json({ ai_recommendation: aiRecommendation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating recommendation.' });
  }
});

export default router;
