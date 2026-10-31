import express from "express";
import { supabase } from "../config/supabase.js";
import { attachSupabaseUser, requireRole } from "../services/rbac.js";

const router = express.Router();

router.use(attachSupabaseUser);

// GET /api/training-modules
// Admin gets all modules for org. Driver gets all active modules for org.
router.get("/api/training-modules", async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    if (!orgId) return res.status(400).json({ success: false, error: "Missing organization." });

    let query = supabase.from('training_modules').select('*').or(`organization_id.eq.${orgId},organization_id.is.null`);
    
    // If it's a driver, we want to fetch their specific assignments
    if (req.user.role === 'driver') {
      const { data: driverRow } = await supabase.from('drivers').select('id').eq('user_id', req.user.id).single();
      
      const { data: assignments, error: assignErr } = await supabase
        .from('driver_training_assignments')
        .select('*, training_modules(*)')
        .eq('driver_id', driverRow.id);
        
      if (assignErr) {
        if (assignErr.code === '42P01') return res.json({ success: true, data: [] }); // DB not migrated
        throw assignErr;
      }

      // Format them to match what frontend expects
      const modulesWithAssignment = assignments.map(a => {
        const m = a.training_modules || {};
        return { 
          ...m, 
          id: m.id || a.id,
          title: m.title || a.custom_title || 'Custom Training',
          description: m.description || a.custom_description || '',
          assignment_id: a.id,
          assigned_at: a.assigned_at,
          due_date: a.due_date,
          status: a.status,
          reason: a.reason,
          video_url: m.content?.video_url,
          quiz_data: m.content?.quiz_data,
          required_for_onboarding: m.required,
          completion: a.status === 'completed' ? { status: 'passed', date: a.completed_at } : null
        };
      });

      return res.json({ success: true, data: modulesWithAssignment });
    }

    // Admin view
    const { data, error } = await query;
    if (error) throw error;
    
    const mappedData = data.map(m => ({
      ...m,
      video_url: m.content?.video_url,
      quiz_data: m.content?.quiz_data,
      required_for_onboarding: m.required
    }));

    return res.json({ success: true, data: mappedData });
  } catch (error) {
    console.error("Fetch Training Modules Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/training-modules (Admin only)
router.post("/api/training-modules", requireRole("admin", "super_admin", "fleet_manager"), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { title, description, video_url, quiz_data, required_for_onboarding } = req.body;

    const { data, error } = await supabase.from('training_modules').insert({
      organization_id: orgId,
      title,
      description,
      required: required_for_onboarding,
      type: 'safety',
      content: { video_url, quiz_data }
    }).select().single();

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/driver/training-modules/:id/complete (Driver only)
router.post("/api/driver/training-modules/:id/complete", requireRole("driver"), async (req, res) => {
  try {
    const moduleId = req.params.id;
    const { score, signature } = req.body;
    const driverId = req.user.id;
    const orgId = req.user.organization_id;

    if (!signature) {
      return res.status(400).json({ success: false, error: "Signature is required to complete training." });
    }

    const { data: driverRow } = await supabase.from('drivers').select('id').eq('user_id', driverId).single();

    // Verify module exists
    const { data: moduleInfo, error: modErr } = await supabase
      .from('training_modules')
      .select('*')
      .eq('id', moduleId)
      .eq('organization_id', orgId)
      .single();
    if (modErr) throw modErr;

    // Insert completion
    const { error: compErr } = await supabase.from('driver_training_completions').insert({
      driver_id: driverRow.id,
      module_id: moduleId,
      status: score >= (moduleInfo.quiz_data?.passing_score || 80) ? 'passed' : 'failed',
      score: score,
      signature_base64: signature,
      completed_at: new Date().toISOString()
    });

    if (compErr) throw compErr;

    return res.json({ success: true, message: "Training completed successfully." });
  } catch (error) {
    console.error("Training Completion Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
