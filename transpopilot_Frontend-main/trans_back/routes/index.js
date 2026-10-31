import express from "express";
import geotabRoutes from "./geotabRoutes.js";
import trackingRoutes from "./trackingRoutes.js";
import safetyRoutes from "./safetyRoutes.js";
import invitationRoutes from "./invitationRoutes.js";
import adminRoutes from "./adminRoutes.js";
import driverRoutes from "./driverRoutes.js";
import onboardingRoutes from "./onboardingRoutes.js";
import trainingRoutes from "./trainingRoutes.js";
import geocodeRoutes from "./geocodeRoutes.js";
import receiptRoutes from "./receiptRoutes.js";
import vehicleHealthRoutes from "./vehicleHealthRoutes.js";
import fleetIntelligenceRoutes from "./fleetIntelligenceRoutes.js";
import operationsRoutes from "./operationsRoutes.js";
import { authenticateGeotab, callGeotabApi } from "../services/geotab/geotabApi.js";
import { getDateRange } from "../utils/helpers.js";

const router = express.Router();

router.use("/api", geotabRoutes);
router.use("/api", trackingRoutes);
router.use("/api", safetyRoutes);
router.use("/api", invitationRoutes);
router.use("/api", adminRoutes);
router.use("/api", driverRoutes);
router.use("/api", onboardingRoutes);
router.use("/", trainingRoutes);
router.use("/api", geocodeRoutes);
router.use("/api", receiptRoutes);
router.use("/api/vehicle-health", vehicleHealthRoutes);
router.use("/api/fleet-intelligence", fleetIntelligenceRoutes);
router.use("/api/operations", operationsRoutes);

import { attachSupabaseUser } from "../services/rbac.js";
import { supabase } from "../config/supabase.js";

router.get("/api/users/me", attachSupabaseUser, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        organization:organizations(
          id,
          name,
          subscription_tier
        )
      `)
      .eq('id', req.user.id)
      .maybeSingle();
      
    if (error) throw error;
    
    let profileData = data;
    
    if (!profileData) {
       // Fallback for drivers that might only exist in the drivers table
       const { data: driverData, error: driverErr } = await supabase
         .from('drivers')
         .select('id, organization_id, first_name, last_name')
         .eq('user_id', req.user.id)
         .maybeSingle();
         
       if (driverData) {
         profileData = {
           id: req.user.id,
           role: 'driver',
           organization_id: driverData.organization_id,
           full_name: `${driverData.first_name} ${driverData.last_name}`.trim(),
           email: req.user.email
         };
       } else {
         return res.json({ success: true, data: null });
       }
    }
    
    // Minimal permissions helper for Fleet Manager vs Admin vs Driver
    const role = profileData.role;
    let allowedAreas = [];
    if (role === 'super_admin' || role === 'admin') {
      allowedAreas = ['all'];
    } else if (role === 'fleet_manager') {
      allowedAreas = [
        'vehicles', 'drivers', 'driver_invitations', 'driver_onboarding',
        'safety_compliance', 'fuel', 'maintenance', 'vehicle_health',
        'live_tracking', 'driver_tracking', 'routes', 'dashboard'
      ];
    } else if (role === 'dispatcher') {
      allowedAreas = [
        'vehicles', 'drivers', 'safety_compliance', 'fuel', 'vehicle_health',
        'live_tracking', 'driver_tracking', 'routes', 'dashboard'
      ];
    } else if (role === 'driver') {
      allowedAreas = ['driver_dashboard', 'my_onboarding', 'my_training'];
    } else {
      allowedAreas = ['user_dashboard'];
    }

    res.json({ success: true, data: { ...profileData, allowedAreas } });
  } catch (error) {
    console.error("GET /api/users/me error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/api/users/me", attachSupabaseUser, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const updates = req.body;
    const allowedUpdates = ["welcome_modal_seen", "onboarding_dismissed", "onboarding_steps"];
    const validUpdates = Object.keys(updates).reduce((acc, key) => {
      if (allowedUpdates.includes(key)) {
        acc[key] = updates[key];
      }
      return acc;
    }, {});

    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ success: false, error: "No valid fields to update" });
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update(validUpdates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error("PATCH /api/users/me error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/geotab-debug", async (req, res) => {
  try {
    const { username, password, database, organizationId } = req.body;

    if (!username || !password || !database || !organizationId) {
      return res.status(400).json({ success: false, error: "Missing credentials or organizationId." });
    }

    const credentials = { username, password, database };
    await authenticateGeotab(credentials);

    const devices = await callGeotabApi(organizationId, credentials, {
      method: "Get",
      params: { typeName: "Device", resultsLimit: 10 }
    });

    const rules = await callGeotabApi(organizationId, credentials, {
      method: "Get",
      params: { typeName: "Rule", resultsLimit: 10 }
    });

    const { from, to } = getDateRange(30);

    const fillUps = await callGeotabApi(organizationId, credentials, {
      method: "Get",
      params: {
        typeName: "FillUp",
        search: { fromDate: from.toISOString(), toDate: to.toISOString() },
        resultsLimit: 5
      }
    });

    const exceptions = await callGeotabApi(organizationId, credentials, {
      method: "Get",
      params: {
        typeName: "ExceptionEvent",
        search: { fromDate: from.toISOString(), toDate: to.toISOString() },
        resultsLimit: 5
      }
    });

    return res.json({
      success: true,
      counts: {
        devices: devices.length,
        rules: rules.length,
        fillUps: fillUps.length,
        exceptions: exceptions.length
      },
      samples: {
        device: devices[0] || null,
        rule: rules[0] || null,
        fillUp: fillUps[0] || null,
        exception: exceptions[0] || null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
