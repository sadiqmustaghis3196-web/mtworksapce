import express from "express";
import { supabase } from "../config/supabase.js";
import { attachSupabaseUser, requireRole } from "../services/rbac.js";

const router = express.Router();

router.use(attachSupabaseUser);

// ═══════════════════════════════════════════════════════════════
// GET /driver/me — Get authenticated driver's dashboard data
// ═══════════════════════════════════════════════════════════════
router.get("/driver/me", requireRole("driver"), async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch driver record
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, onboarding_status, status, organization_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (driverError) {
      console.error("Failed to fetch driver:", driverError);
      return res.status(500).json({ success: false, error: driverError.message });
    }

    if (!driver) {
      return res.status(404).json({ success: false, error: "Driver record not found." });
    }

    // Fetch assigned vehicle
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('vehicle_number, make, model, license_plate')
      .eq('driver_id', driver.id)
      .maybeSingle();

    if (vehicleError) {
      console.error("Failed to fetch vehicle:", vehicleError);
    }

    // Fetch onboarding progress
    const { data: onboarding, error: onboardingError } = await supabase
      .from('driver_onboarding_progress')
      .select('overall_status, cdl_status, medical_status, clearinghouse_status, background_check_status, drug_screen_status, mvr_check_status, employment_docs_status, orientation_completed, road_test_completed')
      .eq('driver_id', driver.id)
      .maybeSingle();

    if (onboardingError) {
      console.error("Failed to fetch onboarding progress:", onboardingError);
      return res.status(500).json({ success: false, error: "Failed to fetch onboarding progress: " + onboardingError.message });
    }

    // Fetch driver documents
    const { data: documents } = await supabase
      .from('driver_documents')
      .select('id, document_type, document_url, status, metadata, uploaded_at, review_notes')
      .eq('driver_id', driver.id);
      
    // Fetch driver training completions
    const { data: trainingCompletions } = await supabase
      .from('driver_training_completions')
      .select('id, module_id, status, score, started_at, completed_at')
      .eq('driver_id', driver.id);
      
    // Fetch all required training modules for this org to compute status
    const { data: requiredModules } = await supabase
      .from('training_modules')
      .select('id')
      .eq('organization_id', driver.organization_id)
      .eq('required', true);
      
    let training_status = 'not_started';
    if (requiredModules && requiredModules.length > 0) {
       const completedModuleIds = (trainingCompletions || [])
           .filter(c => c.status === 'completed')
           .map(c => c.module_id);
       
       const missingModules = requiredModules.filter(m => !completedModuleIds.includes(m.id));
       if (missingModules.length === 0) {
           training_status = 'completed';
       } else if (missingModules.length < requiredModules.length) {
           training_status = 'in_progress';
       }
    } else {
       // If no required modules exist, we consider training completed or N/A
       training_status = 'completed';
    }

    if (onboarding) {
        onboarding.training_status = training_status;
    }

    return res.json({
      success: true,
      data: {
        driver,
        vehicle: vehicle || null,
        onboarding: onboarding || null,
        documents: documents || [],
        trainingCompletions: trainingCompletions || []
      }
    });

  } catch (error) {
    console.error("GET /driver/me error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
