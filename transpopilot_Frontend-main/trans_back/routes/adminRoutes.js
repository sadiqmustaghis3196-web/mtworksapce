import express from "express";
import { supabase } from "../config/supabase.js";
import { attachSupabaseUser, requireRole } from "../services/rbac.js";
import { aggregateDriverBehavior } from "../services/aggregateDriverBehavior.js";
const router = express.Router();
// supabase uses the existing config which correctly chains:
// SUPABASE_SERVICE_ROLE_KEY → SUPABASE_SERVICE_KEY → SUPABASE_KEY → VITE_SUPABASE_ANON_KEY

// ═══════════════════════════════════════════════════════════════
// Middleware: All admin routes require auth
// ═══════════════════════════════════════════════════════════════
router.use(attachSupabaseUser);

import crypto from "crypto";
import { sendDriverInvitationEmail } from "../services/emailService.js";

// ═══════════════════════════════════════════════════════════════
// GET /admin/users — List all users in admin's organization
// ═══════════════════════════════════════════════════════════════
router.get(
  "/admin/users",
  requireRole("admin", "super_admin", "fleet_manager"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      if (!adminOrgId) {
        return res.status(400).json({
          success: false,
          error: "Admin does not belong to an organization.",
        });
      }


      // Fetch all user_profiles in this organization
      const { data: users, error: usersError } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, organization_id, created_at, updated_at, last_login_at, invitation_id")
        .eq("organization_id", adminOrgId)
        .order("created_at", { ascending: false });

      if (usersError) {
        console.error("Failed to fetch users:", usersError);
        return res.status(500).json({ success: false, error: usersError.message });
      }

      // Fetch all drivers in this organization to determine driver status
      const { data: drivers, error: driversError } = await supabase
        .from("drivers")
        .select("id, user_id, status, onboarding_status, employee_type, created_at")
        .eq("organization_id", adminOrgId);

      if (driversError) {
        console.error("Failed to fetch drivers:", driversError);
      }

      // Fetch all driver_invitations for this org to determine invitation status
      const { data: invitations, error: invError } = await supabase
        .from("driver_invitations")
        .select("id, email, role, first_name, last_name, status, expires_at, created_at, updated_at")
        .eq("organization_id", adminOrgId);

      if (invError) {
        console.error("Failed to fetch invitations:", invError);
      }

      const driversMap = {};
      (drivers || []).forEach((d) => {
        if (d.user_id) driversMap[d.user_id] = d;
      });

      const invitationsMap = {};
      (invitations || []).forEach((inv) => {
        invitationsMap[inv.id] = inv;
      });

      // Enrich user data
      const enrichedUsers = (users || []).map((u) => {
        const driver = driversMap[u.id] || null;
        const invitation = u.invitation_id ? invitationsMap[u.invitation_id] : null;

        return {
          ...u,
          driver_status: driver
            ? driver.status
            : u.role === "driver"
            ? "pending"
            : null,
          driver_id: driver?.id || null,
          driver_onboarding_status: driver?.onboarding_status || null,
          driver_employee_type: driver?.employee_type || null,
          driver_created_at: driver?.created_at || null,
          invitation_status: invitation?.status || null,
          invitation_id: invitation?.id || null,
          invitation_created_at: invitation?.created_at || null,
        };
      });

      // Also append pending invitations that don't have a user profile yet (e.g. newly invited Fleet Managers)
      // We know they don't have a user profile if their email isn't in the users list
      const userEmails = new Set((users || []).map(u => (u.email || '').toLowerCase().trim()));
      const pendingNonDriverInvites = (invitations || [])
        .filter(inv => inv.role !== 'driver' && inv.status === 'PENDING' && !userEmails.has((inv.email || '').toLowerCase().trim()))
        .map(inv => ({
          id: inv.id, // using invitation id as row id, it's safe for UI
          email: inv.email,
          full_name: `${inv.first_name || ''} ${inv.last_name || ''}`.trim() || inv.email,
          role: inv.role || 'user',
          organization_id: adminOrgId,
          created_at: inv.created_at,
          updated_at: inv.updated_at,
          last_login_at: null,
          invitation_status: inv.status,
          invitation_id: inv.id,
          invitation_created_at: inv.created_at,
          is_pure_invite: true // flag to help UI know it's not a real user yet
        }));

      return res.json({ success: true, data: [...enrichedUsers, ...pendingNonDriverInvites] });
    } catch (error) {
      console.error("GET /admin/users error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// GET /admin/integrations/status — Get integration status
// ═══════════════════════════════════════════════════════════════
router.get(
  "/admin/integrations/status",
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      if (!adminOrgId) {
         return res.json({ success: true, data: [] });
      }

      const { data, error } = await supabase
        .from('fleet_integrations')
        .select('provider_id, status, last_sync_at')
        .eq('organization_id', adminOrgId);

      if (error) throw error;
      return res.json({ success: true, data: data || [] });
    } catch (error) {
      console.error("GET /admin/integrations/status error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// GET /admin/dashboard/stats
// ═══════════════════════════════════════════════════════════════
router.get("/admin/dashboard/stats", async (req, res) => {
  try {
    const adminOrgId = req.user.organization_id;
    if (!adminOrgId) return res.json({ success: true, data: null });

    const [vehiclesResponse, driversResponse, avgSafetyResponse] = await Promise.all([
      supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('organization_id', adminOrgId).eq('status', 'active'),
      supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('organization_id', adminOrgId).eq('status', 'active'),
      supabase.from('drivers').select('safety_score').eq('organization_id', adminOrgId).eq('status', 'active')
    ]);

    const avgSafety = avgSafetyResponse.data?.reduce((acc, d) => acc + (d.safety_score || 0), 0) || 0;
    const safetyScore = avgSafetyResponse.data?.length ? avgSafety / avgSafetyResponse.data.length : 0;

    res.json({
      success: true,
      data: {
        fleetEfficiency: 94.2,
        fuelSavings: 12847,
        safetyScore,
        activeDrivers: driversResponse.count || 0,
        activeVehicles: vehiclesResponse.count || 0,
        onTimeRate: 98.7
      }
    });
  } catch (error) {
    console.error("GET /admin/dashboard/stats error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /admin/dashboard/alerts
// ═══════════════════════════════════════════════════════════════
router.get("/admin/dashboard/alerts", async (req, res) => {
  try {
    const adminOrgId = req.user.organization_id;
    if (!adminOrgId) return res.json({ success: true, data: [] });

    const { data: complianceItems } = await supabase
      .from('driver_documents')
      .select('id, document_type, status, uploaded_at, drivers(first_name, last_name)')
      .eq('organization_id', adminOrgId)
      .in('status', ['rejected', 'expired', 'missing'])
      .limit(4);

    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: rawIncidents } = await supabase
      .from('safety_incident_reports')
      .select('*, vehicles(vehicle_number), drivers(first_name, last_name)')
      .eq('organization_id', adminOrgId)
      .eq('resolved', false)
      .gte('created_at', twoDaysAgo)
      .order('created_at', { ascending: false })
      .limit(100); // fetch more to allow deduplication

    // Deduplicate incidents
    const incidents = [];
    const seenIncidents = new Set();
    
    (rawIncidents || []).forEach(inc => {
       if (inc.provider_event_id) {
          const key = `${inc.organization_id}_${inc.provider}_${inc.provider_event_id}`;
          if (seenIncidents.has(key)) return;
          seenIncidents.add(key);
          incidents.push(inc);
       } else {
          // Conservative fallback for legacy rows (truncate to minute to catch millisecond sync differences)
          const legacyTime = inc.created_at ? inc.created_at.substring(0, 16) : '';
          const legacyKey = `${inc.organization_id}_${inc.vehicle_id}_${inc.description}_${legacyTime}`;
          if (seenIncidents.has(legacyKey)) return;
          seenIncidents.add(legacyKey);
          incidents.push(inc);
       }
    });
    
    // limit final output to 5
    const finalIncidents = incidents.slice(0, 5);

    // Format times explicitly in America/Chicago for the US client, showing time zone
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    const alerts = [];
    complianceItems?.forEach((item) => {
      const entityName = `Driver ${item.drivers?.first_name || 'Unknown'} ${item.drivers?.last_name || ''}`.trim();
      alerts.push({
        id: item.id,
        type: 'error',
        message: `${(item.document_type || 'Document').replace(/_/g, ' ')} ${item.status} - ${entityName}`,
        time: timeFormatter.format(new Date(item.uploaded_at || Date.now())),
        priority: 'high',
      });
    });

    finalIncidents?.forEach((incident) => {
      const vehicleNum = incident.vehicles?.vehicle_number || 'Unknown Vehicle';
      const driverName = incident.drivers ? `${incident.drivers.first_name} ${incident.drivers.last_name}` : 'Driver Unverified';
      
      // Clean up the incident name
      let incidentName = incident.description || incident.type || 'Unclassified Event';
      if (incidentName.startsWith('Geotab Exception: ')) {
          incidentName = incidentName.replace('Geotab Exception: ', '');
      }

      alerts.push({
        id: incident.id,
        type: incident.severity === 'high' || incident.severity === 'critical' ? 'error' : 'info',
        message: `${incidentName}\nVehicle: ${vehicleNum}\nDriver: ${driverName}\nSource: ${incident.provider === 'samsara' ? 'Samsara' : 'Geotab'}`,
        time: timeFormatter.format(new Date(incident.created_at)),
        priority: incident.severity || 'medium',
        
        // Debug fields for validation
        provider_event_id: incident.provider_event_id,
        provider: incident.provider,
        description: incident.description,
        vehicle: vehicleNum,
        driver_id: incident.driver_id,
        raw_created_at: incident.created_at,
        db_row_id: incident.id
      });
    });

    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error("GET /admin/dashboard/alerts error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /admin/drivers — List all drivers in admin's organization
// ═══════════════════════════════════════════════════════════════
router.get(
  "/admin/drivers",
  requireRole("admin", "super_admin", "fleet_manager", "dispatcher"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      if (!adminOrgId) {
        return res.status(400).json({
          success: false,
          error: "Admin does not belong to an organization.",
        });
      }

      const { data: drivers, error: driversError } = await supabase
        .from("drivers")
        .select("*")
        .eq("organization_id", adminOrgId)
        .order("created_at", { ascending: false });

      if (driversError) {
        console.error("Failed to fetch drivers:", driversError);
        return res.status(500).json({ success: false, error: driversError.message });
      }

      return res.json({ success: true, data: drivers || [] });
    } catch (error) {
      console.error("GET /admin/drivers error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /admin/drivers/:id/activate — Final Safety Approval
// ═══════════════════════════════════════════════════════════════
router.post(
  "/admin/drivers/:id/activate",
  requireRole("admin", "super_admin", "fleet_manager"),
  async (req, res) => {
    try {
      const driverId = req.params.id;
      const orgId = req.user.organization_id;

      // 1. Verify driver belongs to this org
      const { data: driverRow, error: driverErr } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', driverId)
        .eq('organization_id', orgId)
        .single();
        
      if (driverErr || !driverRow) {
        return res.status(404).json({ success: false, error: "Driver not found" });
      }

      // 2. Mark progress as approved
      const { error: progErr } = await supabase
        .from('driver_onboarding_progress')
        .update({ overall_status: 'approved' })
        .eq('driver_id', driverId);

      if (progErr) throw progErr;

      // 3. Update driver status to active
      const { error: updateErr } = await supabase
        .from('drivers')
        .update({ status: 'active' })
        .eq('id', driverId);

      if (updateErr) throw updateErr;

      return res.json({ success: true, message: "Driver has been successfully activated." });
    } catch (error) {
      console.error("Activate driver error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /admin/users/:userId/make-driver — Promote user to driver
// ═══════════════════════════════════════════════════════════════
router.post(
  "/admin/users/:userId/make-driver",
  requireRole("admin", "super_admin", "fleet_manager"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      const adminId = req.user.id;
      const targetUserId = req.params.userId;

      if (!adminOrgId) {
        return res.status(400).json({
          success: false,
          error: "Admin does not belong to an organization.",
        });
      }

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          error: "Target user ID is required.",
        });
      }


      // 1. Fetch target user profile
      const { data: targetUser, error: userError } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, organization_id")
        .eq("id", targetUserId)
        .maybeSingle();

      if (userError) {
        console.error("Fetch target user error:", userError);
        return res.status(500).json({ success: false, error: userError.message });
      }

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: "User not found.",
        });
      }

      // 2. Validate same organization
      if (targetUser.organization_id !== adminOrgId) {
        return res.status(403).json({
          success: false,
          error: "Access denied. User does not belong to your organization.",
        });
      }

      // 3. Check if user is a protected super_admin
      if (targetUser.role === "super_admin") {
        return res.status(403).json({
          success: false,
          error: "Cannot promote a super admin to driver.",
        });
      }

      // 4. Check if a driver record already exists for this user in this org
      const { data: existingDriver, error: driverCheckError } = await supabase
        .from("drivers")
        .select("id, status, onboarding_status")
        .eq("user_id", targetUserId)
        .eq("organization_id", adminOrgId)
        .maybeSingle();

      if (driverCheckError) {
        console.error("Driver check error:", driverCheckError);
        return res.status(500).json({ success: false, error: driverCheckError.message });
      }

      if (existingDriver) {
        // Driver already exists — update role if needed but don't duplicate
        if (targetUser.role !== "driver") {
          await supabase
            .from("user_profiles")
            .update({ role: "driver" })
            .eq("id", targetUserId);
        }

        return res.status(409).json({
          success: false,
          error: "User is already a driver.",
          data: { driver_id: existingDriver.id, status: existingDriver.status },
        });
      }

      // 5. Parse name from full_name
      const fullName = targetUser.full_name || targetUser.email.split("@")[0];
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "Unknown";
      const lastName = nameParts.slice(1).join(" ") || "";

      // 6. Check if there's an invitation with employee_type info
      const { data: invitation } = await supabase
        .from("driver_invitations")
        .select("employee_type, first_name, last_name")
        .eq("email", (targetUser.email || "").toLowerCase().trim())
        .eq("organization_id", adminOrgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const driverFirstName = invitation?.first_name || firstName;
      const driverLastName = invitation?.last_name || lastName;
      const employeeType = invitation?.employee_type || "employee";

      // 7. Create driver record
      const { data: newDriver, error: insertError } = await supabase
        .from("drivers")
        .insert({
          user_id: targetUserId,
          organization_id: adminOrgId,
          email: (targetUser.email || "").toLowerCase().trim(),
          first_name: driverFirstName,
          last_name: driverLastName,
          employee_type: employeeType,
          status: "training",
          onboarding_status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Driver insert error:", insertError);
        return res.status(500).json({ success: false, error: insertError.message });
      }

      // 8. Update user_profiles.role = 'driver'
      const { error: roleUpdateError } = await supabase
        .from("user_profiles")
        .update({ role: "driver" })
        .eq("id", targetUserId);

      if (roleUpdateError) {
        console.error("Role update error:", roleUpdateError);
        // Rollback driver creation if user profile role update fails
        await supabase.from("drivers").delete().eq("id", newDriver.id);
        return res.status(500).json({ success: false, error: "Failed to update user profile role to driver." });
      }

      // 9. Create onboarding record (check for existing first)
      const { data: existingOnboarding } = await supabase
        .from("driver_onboarding_progress")
        .select("id")
        .eq("driver_id", newDriver.id)
        .eq("organization_id", adminOrgId)
        .maybeSingle();

      if (!existingOnboarding) {
        const { error: onbError } = await supabase
          .from("driver_onboarding_progress")
          .insert({
            organization_id: adminOrgId,
            driver_id: newDriver.id,
            overall_status: "in_progress",
            background_check_status: "pending",
            drug_screen_status: "pending",
            mvr_check_status: "pending",
          });

        if (onbError) {
          console.error("Onboarding insert error (non-fatal):", onbError);
        }
      }

      // 10. Create audit log matching audit_logs schema (resource_type + resource_id + action)
      try {
        await supabase.from("audit_logs").insert({
          organization_id: adminOrgId,
          actor_id: adminId,
          resource_type: "driver",
          resource_id: newDriver.id,
          action: "DRIVER_CREATED_BY_ADMIN",
          metadata: {
            target_user_id: targetUserId,
            promoted_by: adminId,
            driver_email: targetUser.email,
            source: "admin_user_management",
          },
        });
      } catch (auditErr) {
        console.warn("Audit log insert error (non-fatal):", auditErr);
      }

      return res.json({
        success: true,
        data: {
          driver: newDriver,
          message: "User has been successfully promoted to driver.",
        },
      });
    } catch (error) {
      console.error("POST /admin/users/:userId/make-driver error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// PATCH /admin/users/:userId/role — SuperAdmin update user role
// ═══════════════════════════════════════════════════════════════
router.patch(
  "/admin/users/:userId/role",
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      const { role, full_name, organization_id, new_organization_name } = req.body;

      if (!targetUserId || !role) {
        return res.status(400).json({ success: false, error: "Target user ID and role are required." });
      }

      // Check organization requirement
      if (role === 'admin' || role === 'super_admin') {
        if (!organization_id && !new_organization_name) {
          return res.status(400).json({
            success: false,
            error: `An organization is required when assigning the ${role} role.`,
          });
        }
      }

      let finalOrgId = organization_id || null;

      // Create new organization if requested
      if ((role === 'admin' || role === 'super_admin') && new_organization_name) {
        const slug = new_organization_name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
        const { data: newOrg, error: orgError } = await supabase
          .from('organizations')
          .insert({
            name: new_organization_name,
            slug,
            subscription_tier: 'starter',
            subscription_status: 'active'
          })
          .select('id')
          .single();

        if (orgError) {
          console.error("Create organization error:", orgError);
          return res.status(500).json({ success: false, error: "Failed to create new organization." });
        }
        finalOrgId = newOrg.id;
      }

      // If user role, remove org_id (based on current app logic where users don't have orgs)
      if (role === 'user') {
        finalOrgId = null;
      }

      // Update user_profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from('user_profiles')
        .update({
          role,
          full_name,
          organization_id: finalOrgId
        })
        .eq('id', targetUserId)
        .select()
        .single();

      if (updateError) {
        console.error("Update profile error:", updateError);
        return res.status(500).json({ success: false, error: "Failed to update user profile." });
      }

      return res.json({ success: true, data: updatedProfile });

    } catch (error) {
      console.error("PATCH /admin/users/:userId/role error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /admin/drivers/:driverId/activate — Activate a driver
// ═══════════════════════════════════════════════════════════════
router.post(
  "/admin/drivers/:driverId/activate",
  requireRole("admin", "super_admin", "fleet_manager"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      const adminId = req.user.id;
      const driverId = req.params.driverId;

      if (!adminOrgId) {
        return res.status(400).json({ success: false, error: "Admin has no organization." });
      }

      const supabase = getServiceClient();

      // Verify driver exists and belongs to same org
      const { data: driver, error: fetchErr } = await supabase
        .from("drivers")
        .select("id, organization_id, status, user_id")
        .eq("id", driverId)
        .maybeSingle();

      if (fetchErr || !driver) {
        return res.status(404).json({ success: false, error: "Driver not found." });
      }

      if (driver.organization_id !== adminOrgId) {
        return res.status(403).json({ success: false, error: "Access denied." });
      }

      const { data: updated, error: updateErr } = await supabase
        .from("drivers")
        .update({ status: "active" })
        .eq("id", driverId)
        .select()
        .single();

      if (updateErr) {
        return res.status(500).json({ success: false, error: updateErr.message });
      }

      await supabase.from("audit_logs").insert({
        organization_id: adminOrgId,
        actor_id: adminId,
        action: "DRIVER_ACTIVATED",
        resource_id: driverId,
        metadata: { previous_status: driver.status, source: "admin_driver_management" },
      });

      return res.json({ success: true, data: updated });
    } catch (error) {
      console.error("POST /admin/drivers/:driverId/activate error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /admin/drivers/:driverId/deactivate — Deactivate a driver
// ═══════════════════════════════════════════════════════════════
router.post(
  "/admin/drivers/:driverId/deactivate",
  requireRole("admin", "super_admin", "fleet_manager"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      const adminId = req.user.id;
      const driverId = req.params.driverId;

      if (!adminOrgId) {
        return res.status(400).json({ success: false, error: "Admin has no organization." });
      }

      const supabase = getServiceClient();

      const { data: driver, error: fetchErr } = await supabase
        .from("drivers")
        .select("id, organization_id, status, user_id")
        .eq("id", driverId)
        .maybeSingle();

      if (fetchErr || !driver) {
        return res.status(404).json({ success: false, error: "Driver not found." });
      }

      if (driver.organization_id !== adminOrgId) {
        return res.status(403).json({ success: false, error: "Access denied." });
      }

      const { data: updated, error: updateErr } = await supabase
        .from("drivers")
        .update({ status: "inactive" })
        .eq("id", driverId)
        .select()
        .single();

      if (updateErr) {
        return res.status(500).json({ success: false, error: updateErr.message });
      }

      await supabase.from("audit_logs").insert({
        organization_id: adminOrgId,
        actor_id: adminId,
        action: "DRIVER_DEACTIVATED",
        resource_id: driverId,
        metadata: { previous_status: driver.status, source: "admin_driver_management" },
      });

      return res.json({ success: true, data: updated });
    } catch (error) {
      console.error("POST /admin/drivers/:driverId/deactivate error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /admin/drivers/:driverId/assign-vehicle — Assign vehicle
// ═══════════════════════════════════════════════════════════════
router.post(
  "/admin/drivers/:driverId/assign-vehicle",
  requireRole("admin", "super_admin", "fleet_manager"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      const adminId = req.user.id;
      const driverId = req.params.driverId;
      const { vehicle_id } = req.body;

      if (!adminOrgId) {
        return res.status(400).json({ success: false, error: "Admin has no organization." });
      }

      if (!vehicle_id) {
        return res.status(400).json({ success: false, error: "vehicle_id is required." });
      }


      // Verify driver belongs to same org
      const { data: driver, error: driverErr } = await supabase
        .from("drivers")
        .select("id, organization_id, user_id")
        .eq("id", driverId)
        .maybeSingle();

      if (driverErr || !driver) {
        return res.status(404).json({ success: false, error: "Driver not found." });
      }

      if (driver.organization_id !== adminOrgId) {
        return res.status(403).json({ success: false, error: "Access denied." });
      }

      // Verify vehicle belongs to same org
      const { data: vehicle, error: vehicleErr } = await supabase
        .from("vehicles")
        .select("id, organization_id, driver_id, vehicle_number")
        .eq("id", vehicle_id)
        .maybeSingle();

      if (vehicleErr || !vehicle) {
        return res.status(404).json({ success: false, error: "Vehicle not found." });
      }

      if (vehicle.organization_id !== adminOrgId) {
        return res.status(403).json({ success: false, error: "Vehicle does not belong to your organization." });
      }

      // Check if vehicle is already assigned to another driver
      if (vehicle.driver_id && vehicle.driver_id !== driverId) {
        // Find who it's assigned to
        const { data: otherDriver } = await supabase
          .from("drivers")
          .select("first_name, last_name, email")
          .eq("id", vehicle.driver_id)
          .maybeSingle();

        const assignedTo = otherDriver
          ? `${otherDriver.first_name} ${otherDriver.last_name} (${otherDriver.email})`
          : vehicle.driver_id;

        return res.status(409).json({
          success: false,
          error: `Vehicle ${vehicle.vehicle_number} is currently assigned to ${assignedTo}. Unassign it first.`,
          data: { current_driver_id: vehicle.driver_id },
        });
      }

      // Unassign any previous vehicle from this driver
      const { data: prevVehicles } = await supabase
        .from("vehicles")
        .select("id, vehicle_number")
        .eq("driver_id", driverId)
        .neq("id", vehicle_id);

      if (prevVehicles && prevVehicles.length > 0) {
        for (const pv of prevVehicles) {
          await supabase
            .from("vehicles")
            .update({ driver_id: null })
            .eq("id", pv.id);

          await supabase.from("audit_logs").insert({
            organization_id: adminOrgId,
            actor_id: adminId,
            action: "DRIVER_VEHICLE_UNASSIGNED",
            resource_id: driverId,
            metadata: {
              vehicle_id: pv.id,
              vehicle_number: pv.vehicle_number,
              reason: "reassignment",
              source: "admin_driver_management",
            },
          });
        }
      }

      // Assign the vehicle
      const { data: updatedVehicle, error: assignErr } = await supabase
        .from("vehicles")
        .update({ driver_id: driverId })
        .eq("id", vehicle_id)
        .select()
        .single();

      if (assignErr) {
        return res.status(500).json({ success: false, error: assignErr.message });
      }

      await supabase.from("audit_logs").insert({
        organization_id: adminOrgId,
        actor_id: adminId,
        action: "DRIVER_VEHICLE_ASSIGNED",
        resource_id: driverId,
        metadata: {
          vehicle_id: vehicle_id,
          vehicle_number: vehicle.vehicle_number,
          driver_id: driverId,
          source: "admin_driver_management",
        },
      });

      return res.json({ success: true, data: updatedVehicle });
    } catch (error) {
      console.error("POST /admin/drivers/:driverId/assign-vehicle error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /admin/drivers/:driverId/unassign-vehicle — Unassign vehicle
// ═══════════════════════════════════════════════════════════════
router.post(
  "/admin/drivers/:driverId/unassign-vehicle",
  requireRole("admin", "super_admin", "fleet_manager"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      const adminId = req.user.id;
      const driverId = req.params.driverId;

      if (!adminOrgId) {
        return res.status(400).json({ success: false, error: "Admin has no organization." });
      }


      // Verify driver belongs to same org
      const { data: driver, error: driverErr } = await supabase
        .from("drivers")
        .select("id, organization_id")
        .eq("id", driverId)
        .maybeSingle();

      if (driverErr || !driver) {
        return res.status(404).json({ success: false, error: "Driver not found." });
      }

      if (driver.organization_id !== adminOrgId) {
        return res.status(403).json({ success: false, error: "Access denied." });
      }

      // Find assigned vehicles
      const { data: assignedVehicles } = await supabase
        .from("vehicles")
        .select("id, vehicle_number")
        .eq("driver_id", driverId)
        .eq("organization_id", adminOrgId);

      if (!assignedVehicles || assignedVehicles.length === 0) {
        return res.status(404).json({ success: false, error: "No vehicle assigned to this driver." });
      }

      // Unassign all vehicles for this driver
      for (const v of assignedVehicles) {
        await supabase
          .from("vehicles")
          .update({ driver_id: null })
          .eq("id", v.id);

        await supabase.from("audit_logs").insert({
          organization_id: adminOrgId,
          actor_id: adminId,
          action: "DRIVER_VEHICLE_UNASSIGNED",
          resource_id: driverId,
          metadata: {
            vehicle_id: v.id,
            vehicle_number: v.vehicle_number,
            source: "admin_driver_management",
          },
        });
      }

      return res.json({
        success: true,
        data: { message: "Vehicle(s) unassigned successfully." },
      });
    } catch (error) {
      console.error("POST /admin/drivers/:driverId/unassign-vehicle error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /admin/invite-driver — Send driver invitation (Admin only)
// ═══════════════════════════════════════════════════════════════
router.post(
  "/admin/invite-driver",
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      const adminId = req.user.id;
      const { email, first_name, last_name, employee_type = "employee", role = "driver" } = req.body;

      if (!adminOrgId) {
        return res.status(400).json({ success: false, error: "Admin has no organization." });
      }

      if (!email) {
        return res.status(400).json({ success: false, error: "Email is required." });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // 1. Check if user already exists in user_profiles
      const { data: existingUser } = await supabase
        .from("user_profiles")
        .select("id, email, organization_id, role")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingUser) {
        if (existingUser.organization_id === adminOrgId) {
          return res.status(400).json({
            success: false,
            error: "This user is already a member of your organization.",
          });
        } else {
          return res.status(400).json({
            success: false,
            error: "This email is registered under another organization.",
          });
        }
      }

      // 2. Check if a pending invitation already exists for this org
      const { data: existingInvite } = await supabase
        .from("driver_invitations")
        .select("id, status")
        .eq("organization_id", adminOrgId)
        .eq("email", normalizedEmail)
        .eq("status", "PENDING")
        .maybeSingle();

      if (existingInvite) {
        return res.status(400).json({
          success: false,
          error: "A pending invitation already exists for this email.",
        });
      }

      // 3. Generate token & expiration
      const crypto = await import("crypto");
      const token = crypto.default.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const parsedFirstName = first_name || normalizedEmail.split("@")[0];
      const parsedLastName = last_name || "Driver";

      // 4. Insert into driver_invitations
      const { data: inviteRecord, error: insertError } = await supabase
        .from("driver_invitations")
        .insert({
          organization_id: adminOrgId,
          email: normalizedEmail,
          first_name: parsedFirstName,
          last_name: parsedLastName,
          employee_type: employee_type,
          token: token,
          status: "PENDING",
          expires_at: expiresAt.toISOString(),
          created_by: adminId,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Invite driver insert error:", insertError);
        return res.status(500).json({ success: false, error: insertError.message });
      }

      // 5. Audit log
      try {
        await supabase.from("audit_logs").insert({
          organization_id: adminOrgId,
          actor_id: adminId,
          resource_type: "driver_invitation",
          resource_id: inviteRecord.id,
          action: "DRIVER_INVITATION_CREATED",
          metadata: { email: normalizedEmail, role, employee_type, invited_by: adminId },
        });
      } catch (auditErr) {
        console.warn("Audit log insert error (non-fatal):", auditErr);
      }

      // 6. Send invitation email using existing emailService
      try {
        const { sendDriverInvitationEmail } = await import("../services/emailService.js");
        await sendDriverInvitationEmail(inviteRecord);
        return res.json({
          success: true,
          emailSent: true,
          data: inviteRecord,
          message: `Invitation successfully sent to ${normalizedEmail}.`,
        });
      } catch (emailErr) {
        console.warn("Invitation email delivery failed (non-fatal):", emailErr.message);
        return res.json({
          success: true,
          emailSent: false,
          warning: "Invitation created, but email delivery failed. Use Copy Link.",
          data: inviteRecord,
        });
      }
    } catch (error) {
      console.error("POST /admin/invite-driver error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// GET /admin/drivers/compliance-overview — Driver compliance summary
// ═══════════════════════════════════════════════════════════════
router.get(
  "/admin/drivers/compliance-overview",
  requireRole("admin", "super_admin", "fleet_manager", "dispatcher"),
  async (req, res) => {
    try {
      const orgId = req.user.organization_id;
      if (!orgId) return res.status(400).json({ success: false, error: "No organization_id." });

      const { data: drivers, error } = await supabase
        .from('drivers')
        .select(`
          id,
          first_name,
          last_name,
          employee_type,
          status,
          onboarding:driver_onboarding_progress (
            cdl_status,
            medical_status,
            clearinghouse_status,
            background_check_status,
            drug_screen_status,
            mvr_check_status,
            employment_docs_status,
            overall_status
          ),
          vehicle:vehicles (
            id,
            vehicle_number
          )
        `)
        .eq('organization_id', orgId);

      if (error) throw error;
      return res.json({ success: true, data: drivers || [] });
    } catch (err) {
      console.error("GET /admin/drivers/compliance-overview error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// GET /admin/drivers/:driverId/onboarding — Driver onboarding detail
// ═══════════════════════════════════════════════════════════════
router.get(
  "/admin/drivers/:driverId/onboarding",
  requireRole("admin", "super_admin", "fleet_manager", "safety_manager", "hr"),
  async (req, res) => {
    try {
      const orgId = req.user.organization_id;
      if (!orgId) return res.status(403).json({ success: false, code: 'NO_ORGANIZATION', error: "No organization associated with user." });

      const { driverId } = req.params;

      const { data, error } = await supabase
        .from('drivers')
        .select(`
          *,
          onboarding:driver_onboarding_progress(*),
          documents:driver_documents(*),
          vehicle:vehicles(id, vehicle_number, make, model, license_plate)
        `)
        .eq('id', driverId)
        .eq('organization_id', orgId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return res.status(404).json({ success: false, error: "Driver not found" });
        throw error;
      }
      return res.json({ success: true, data });
    } catch (err) {
      console.error("GET /admin/drivers/:driverId/onboarding error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// GET /admin/drivers/:driverId/documents/:documentId/view
// ═══════════════════════════════════════════════════════════════
router.get(
  "/admin/drivers/:driverId/documents/:documentId/view",
  requireRole("admin", "super_admin", "fleet_manager", "safety_manager", "hr"),
  async (req, res) => {
    try {
      const orgId = req.user.organization_id;
      if (!orgId) return res.status(403).json({ success: false, code: 'NO_ORGANIZATION', error: "No organization." });

      const { driverId, documentId } = req.params;

      const { data: doc, error: docErr } = await supabase
        .from('driver_documents')
        .select('id, document_url')
        .eq('id', documentId)
        .eq('driver_id', driverId)
        .eq('organization_id', orgId)
        .single();

      if (docErr || !doc) {
        return res.status(404).json({ success: false, error: "Document not found or unauthorized" });
      }

      if (!doc.document_url) {
        return res.status(400).json({ success: false, error: "Document URL is empty" });
      }

      if (doc.document_url === 'electronic_record_confirmed' || doc.document_url === 'digital_consent') {
        return res.json({ success: true, is_electronic: true, url: null, message: 'Electronic record confirmed' });
      }

      // Handle comma-separated URLs (e.g. CDL front,back) by returning the first image
      const primaryPath = doc.document_url.split(',')[0];

      const { data: signedUrlData, error: signErr } = await supabase.storage
        .from('driver-documents')
        .createSignedUrl(primaryPath, 600); // 10 minutes

      if (signErr || !signedUrlData) {
        throw signErr || new Error("Failed to sign URL");
      }

      return res.json({ success: true, url: signedUrlData.signedUrl });
    } catch (err) {
      console.error("GET /admin/drivers/:driverId/documents/:documentId/view error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);


// ═══════════════════════════════════════════════════════════════
// GET /admin/safety/overview - Get true safety overview from synced data
// ═══════════════════════════════════════════════════════════════
router.get("/admin/safety/overview", requireRole("admin", "super_admin", "fleet_manager", "dispatcher"), async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        if (!orgId) return res.status(400).json({ success: false, error: "No organization associated with user." });

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

        // 1. Incidents This Month
        const { count: incidentsThisMonth, error: err1 } = await supabase
            .from('safety_incident_reports')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .gte('date', thisMonthStart);
            
        // 2. Incidents Last Month (from start of last month to start of this month)
        const { count: incidentsLastMonth, error: err2 } = await supabase
            .from('safety_incident_reports')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .gte('date', lastMonthStart)
            .lt('date', thisMonthStart);

        if (err1 || err2) throw new Error("Failed to fetch incident counts");

        // 3. Top Performers (Join drivers and count incidents)
        const { data: drivers, error: driversErr } = await supabase
            .from('drivers')
            .select('id, first_name, last_name, status')
            .eq('organization_id', orgId)
            .eq('status', 'active');

        const { data: recentIncidents, error: recentErr } = await supabase
            .from('safety_incident_reports')
            .select('driver_id')
            .eq('organization_id', orgId)
            .gte('date', thisMonthStart);

        let topPerformers = [];
        if (drivers && recentIncidents) {
            const incidentCounts = {};
            recentIncidents.forEach(inc => {
                if (inc.driver_id) {
                    incidentCounts[inc.driver_id] = (incidentCounts[inc.driver_id] || 0) + 1;
                }
            });

            // Map drivers to their scores (100 - 2 * incidents)
            const driverScores = drivers.map(d => {
                const incs = incidentCounts[d.id] || 0;
                return {
                    name: `${d.first_name} ${d.last_name}`,
                    score: Math.max(0, 100 - (incs * 2)),
                    streak: '30 days'
                };
            });

            // Sort by score descending
            driverScores.sort((a, b) => b.score - a.score);
            topPerformers = driverScores.slice(0, 3);
        }
        
        // Calculate total miles
        const { data: trips } = await supabase
            .from('vehicle_trips')
            .select('distance')
            .eq('organization_id', orgId)
            .gte('start', thisMonthStart);
            
        let milesDriven = 0;
        if (trips) {
            milesDriven = Math.round(trips.reduce((sum, t) => sum + (t.distance || 0), 0) * 0.621371);
        }

        // To determine if we have ANY safety data at all, we could check total incidents all time
        const { count: totalIncidentsCount } = await supabase
            .from('safety_incident_reports')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId);

        let safetyScore = null;
        if (totalIncidentsCount > 0 || milesDriven > 0) {
            safetyScore = Math.max(0, 100 - ((incidentsThisMonth || 0) * 2));
        }

        return res.json({
            success: true,
            data: {
                safetyScore: safetyScore,
                incidentsThisMonth: incidentsThisMonth || 0,
                incidentsLastMonth: incidentsLastMonth || 0,
                milesDriven: milesDriven,
                violationsCount: incidentsThisMonth || 0,
                topPerformers: topPerformers
            }
        });

    } catch (error) {
        console.error("Overview error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// GET /admin/safety/risk-management - Get risk per vehicle
// ═══════════════════════════════════════════════════════════════
router.get("/admin/safety/risk-management", requireRole("admin", "super_admin", "fleet_manager", "dispatcher"), async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        if (!orgId) return res.status(400).json({ success: false, error: "No organization." });
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Fetch all vehicles
        const { data: vehicles } = await supabase
            .from('vehicles')
            .select('id, vehicle_number')
            .eq('organization_id', orgId);
            
        if (!vehicles) return res.json({ success: true, data: [] });
        
        // Fetch all recent incidents (pagination to bypass 1000 limit)
        let allIncidents = [];
        let from = 0;
        let step = 999;
        while (true) {
            const { data: incidents } = await supabase
                .from('safety_incident_reports')
                .select('vehicle_id, type, description, date')
                .eq('organization_id', orgId)
                .gte('date', thirtyDaysAgo.toISOString())
                .range(from, from + step);
            
            if (!incidents || incidents.length === 0) break;
            allIncidents = allIncidents.concat(incidents);
            if (incidents.length <= step) break;
            from += step + 1;
        }
        
        // Fetch all recent trips to sum up distance
        let allTrips = [];
        from = 0;
        while (true) {
            const { data: trips } = await supabase
                .from('vehicle_trips')
                .select('vehicle_id, distance, start_time')
                .eq('organization_id', orgId)
                .gte('start_time', thirtyDaysAgo.toISOString())
                .range(from, from + step);
                
            if (!trips || trips.length === 0) break;
            allTrips = allTrips.concat(trips);
            if (trips.length <= step) break;
            from += step + 1;
        }
            
        const riskMap = {};
        vehicles.forEach(v => {
            riskMap[v.id] = {
                id: v.id,
                vehicleName: v.vehicle_number || 'Unknown Vehicle',
                provider: 'geotab', // Real data is primarily synced from geotab right now
                distance: 0,
                idlingTime: '0h 0m',
                idlingOver5Mins: 0,
                afterHoursTrips: 0,
                _idleSecs: 0
            };
        });
        
        // Process distance and trips
        allTrips.forEach(t => {
            if (t.vehicle_id && riskMap[t.vehicle_id]) {
                const r = riskMap[t.vehicle_id];
                r.distance += (t.distance || 0);
                
                if (t.start_time) {
                    const tripDate = new Date(t.start_time);
                    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false });
                    const hourStr = formatter.format(tripDate);
                    let hour = parseInt(hourStr, 10);
                    if (hour === 24) hour = 0;
                    
                    if (hour < 6 || hour >= 19) {
                        r.afterHoursTrips += 1;
                    }
                }
            }
        });
        
        // Process incidents
        allIncidents.forEach(inc => {
            if (inc.vehicle_id && riskMap[inc.vehicle_id]) {
                const r = riskMap[inc.vehicle_id];
                if (inc.description && inc.description.toLowerCase().includes('idling')) {
                    // Extract idling duration from description if possible, or assume 5 mins
                    let durationSec = 300; 
                    const match = inc.description?.match(/duration:\s*(\d+)/i);
                    if (match) durationSec = parseInt(match[1], 10);
                    
                    r._idleSecs += durationSec;
                    if (durationSec >= 300) r.idlingOver5Mins += 1;
                }
            }
        });
        
        // Format strings
        Object.values(riskMap).forEach(r => {
            // Convert distance km to miles and format
            const miles = Math.round(r.distance * 0.621371);
            r.distance = miles.toLocaleString() + ' mi';
            
            const hrs = Math.floor(r._idleSecs / 3600);
            const mins = Math.floor((r._idleSecs % 3600) / 60);
            r.idlingTime = `${hrs}h ${mins}m`;
            delete r._idleSecs;
        });

        return res.json({ success: true, data: Object.values(riskMap) });
    } catch (error) {
        console.error("Risk error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// POST /admin/vehicles - Create a vehicle manually
// ==========================================
router.post('/admin/vehicles', requireRole("admin", "super_admin", "fleet_manager"), async (req, res) => {
    try {
        const adminOrgId = req.user.organization_id;
        if (!adminOrgId) return res.status(403).json({ success: false, error: 'Unauthorized' });

        const payload = req.body;
        
        // Ensure VIN is provided, or generate a dummy one to satisfy NOT NULL + UNIQUE constraint
        if (!payload.vin || payload.vin.trim() === '') {
            payload.vin = `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }
        
        const formattedInput = {
            ...payload,
            organization_id: adminOrgId,
            year: Number(payload.year || new Date().getFullYear()),
            status: payload.status || 'active',
            current_mileage: Number(payload.current_mileage || 0),
            fuel_capacity: Number(payload.fuel_capacity || 0)
        };

        const { data, error } = await supabase
            .from('vehicles')
            .insert([formattedInput])
            .select()
            .single();

        if (error) {
            console.error('POST /admin/vehicles error:', error);
            // Handle unique constraint on vehicle_number specifically
            if (error.code === '23505' && (error.message.includes('vehicles_organization_id_vehicle_number_key') || error.message.includes('vehicle_number'))) {
                return res.status(409).json({ success: false, error: 'A vehicle with this number already exists.' });
            }
            if (error.code === '23505' && (error.message.includes('vehicles_organization_id_vin_key') || error.message.includes('vin'))) {
                return res.status(409).json({ success: false, error: 'A vehicle with this VIN already exists.' });
            }
            throw error;
        }

        return res.json({ success: true, data });
    } catch (error) {
        console.error("POST /admin/vehicles exception:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// GET /admin/vehicles - List all vehicles
// ==========================================
router.get('/admin/vehicles', requireRole("admin", "super_admin", "fleet_manager", "dispatcher", "user"), async (req, res) => {
    try {
        const adminOrgId = req.user.organization_id;
        if (!adminOrgId) return res.status(403).json({ success: false, error: 'Unauthorized' });

        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .eq('organization_id', adminOrgId)
            .limit(1000)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error("GET /admin/vehicles exception:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// POST /admin/maintenance - Create maintenance record
// ==========================================
router.post('/admin/maintenance', requireRole("admin", "super_admin", "fleet_manager"), async (req, res) => {
    try {
        const adminOrgId = req.user.organization_id;
        if (!adminOrgId) return res.status(403).json({ success: false, error: 'Unauthorized: No organization' });

        const input = req.body;

        // Verify vehicle belongs to the same org
        if (input.vehicle_id) {
            const { data: vehicle, error: vehicleErr } = await supabase
                .from('vehicles')
                .select('organization_id')
                .eq('id', input.vehicle_id)
                .single();
            
            if (vehicleErr || !vehicle) {
                return res.status(404).json({ success: false, error: 'Vehicle not found' });
            }
            if (vehicle.organization_id !== adminOrgId) {
                return res.status(403).json({ success: false, error: 'Cross-organization access denied for this vehicle' });
            }
        }

        const formattedInput = {
            ...input,
            organization_id: adminOrgId,
        };

        const { data, error } = await supabase
            .from('maintenance_records')
            .insert([formattedInput])
            .select()
            .single();

        if (error) {
            console.error("Supabase insert error:", error);
            return res.status(400).json({ success: false, error: error.message });
        }

        return res.json({ success: true, data });
    } catch (error) {
        console.error("POST /admin/maintenance exception:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// GET /admin/maintenance - List maintenance records
// ==========================================
router.get('/admin/maintenance', requireRole("admin", "super_admin", "fleet_manager", "driver", "dispatcher"), async (req, res) => {
    try {
        const adminOrgId = req.user.organization_id;
        if (!adminOrgId) return res.status(403).json({ success: false, error: 'Unauthorized: No organization' });

        const { upcoming, vehicleId } = req.query;
        
        let query = supabase
            .from('maintenance_records')
            .select('*, vehicles(vehicle_number, make, model)')
            .eq('organization_id', adminOrgId);

        if (upcoming === 'true') {
            query = query
                .in('status', ['scheduled', 'in_progress', 'completed'])
                .order('service_date', { ascending: false })
                .limit(10);
        } else {
            query = query.order('service_date', { ascending: false });
            if (vehicleId) {
                query = query.eq('vehicle_id', vehicleId);
            }
        }

        const { data, error } = await query;
        if (error) throw error;
        
        return res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error("GET /admin/maintenance exception:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// POST /admin/users/invite — Invite Team Member
// ═══════════════════════════════════════════════════════════════
router.post(
  "/admin/users/invite",
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      const adminId = req.user.id;
      if (!adminOrgId) {
        console.log("POST /admin/users/invite 400: No organization");
        return res.status(400).json({ success: false, error: "No organization." });
      }

      const { email, role } = req.body;
      if (!email || !role) {
        console.log("POST /admin/users/invite 400: Missing email or role. Body:", req.body);
        return res.status(400).json({ success: false, error: "Email and role are required." });
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.log("POST /admin/users/invite 400: Invalid email:", email);
        return res.status(400).json({ success: false, error: "Please enter a valid email address." });
      }
      if (role !== 'fleet_manager' && role !== 'dispatcher') {
        console.log("POST /admin/users/invite 400: Invalid role:", role);
        return res.status(400).json({ success: false, error: "Only fleet_manager and dispatcher can be invited via this endpoint." });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists in user_profiles
      const { data: existingUser } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingUser) {
        console.log("POST /admin/users/invite 400: User already exists", existingUser);
        return res.status(400).json({ success: false, error: "An account already exists for this email." });
      }

      // Check if pending invite already exists
      const { data: existingInvite } = await supabase
        .from('driver_invitations')
        .select('*')
        .eq('organization_id', adminOrgId)
        .eq('email', normalizedEmail)
        .eq('status', 'PENDING')
        .maybeSingle();

      if (existingInvite) {
        return res.status(400).json({ success: false, error: "An invitation is already pending for this email." });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + 7);

      const { data: inviteRecord, error: insertError } = await supabase
        .from('driver_invitations')
        .insert({
          organization_id: adminOrgId,
          email: normalizedEmail,
          role,
          token,
          status: 'PENDING',
          expires_at: expires_at.toISOString(),
          created_by: adminId,
          first_name: "Team",
          last_name: "Member",
          employee_type: "employee" // Defaults for compatibility
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { error: auditError } = await supabase.from('audit_logs').insert({
        organization_id: adminOrgId,
        actor_id: adminId,
        action: 'TEAM_MEMBER_INVITED',
        resource_type: 'driver_invitations',
        resource_id: inviteRecord.id,
        metadata: { email: normalizedEmail, role }
      });
      if (auditError) console.error("Audit log failed for TEAM_MEMBER_INVITED on resource", inviteRecord.id, ":", auditError.message);

      try {
        await sendDriverInvitationEmail(inviteRecord);
        return res.json({ success: true, emailSent: true, data: inviteRecord });
      } catch (emailError) {
        console.warn("Invitation email delivery failed (non-fatal):", emailError.message);
        return res.json({ 
          success: true, 
          emailSent: false,
          warning: "Invitation created, but email delivery failed. Use Copy Link.",
          data: inviteRecord 
        });
      }
    } catch (error) {
      console.error("Invite Team Member Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// GET /admin/users/invite/:id/token — Get Pending Invitation Token
// ═══════════════════════════════════════════════════════════════
router.get(
  "/admin/users/invite/:id/token",
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      if (!adminOrgId) return res.status(400).json({ success: false, error: "No organization." });

      const inviteId = req.params.id;
      const { data: invite, error } = await supabase
        .from('driver_invitations')
        .select('token, status, organization_id')
        .eq('id', inviteId)
        .maybeSingle();

      if (error || !invite) return res.status(404).json({ success: false, error: "Invitation not found." });
      if (invite.organization_id !== adminOrgId) return res.status(403).json({ success: false, error: "Access denied." });
      if (invite.status !== 'PENDING') return res.status(400).json({ success: false, error: "Invitation is not pending." });

      return res.json({ success: true, data: { token: invite.token } });
    } catch (error) {
      console.error("Get Invite Token Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /admin/users/invitations/:invitationId/resend — Resend Invitation Email
// ═══════════════════════════════════════════════════════════════
const handleResendUserInvitation = async (req, res) => {
  try {
    const adminOrgId = req.user.organization_id;
    const adminId = req.user.id;
    if (!adminOrgId) {
      return res.status(400).json({ success: false, error: "Admin does not belong to an organization." });
    }

    const { invitationId } = req.params;
    if (!invitationId) {
      return res.status(400).json({ success: false, error: "Invitation ID is required." });
    }

    // 1. Fetch canonical invitation record by ID alone
    const { data: invite, error: fetchError } = await supabase
      .from('driver_invitations')
      .select('*')
      .eq('id', invitationId)
      .maybeSingle();

    if (fetchError || !invite) {
      return res.status(404).json({ success: false, error: "Invitation not found." });
    }

    // 2. Organization boundary validation
    if (invite.organization_id !== adminOrgId) {
      return res.status(403).json({ success: false, error: "Access denied: Invitation belongs to another organization." });
    }

    // 3. Status validation
    if (invite.status !== 'PENDING') {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot resend invitation: Status is ${invite.status}.` 
      });
    }

    // 4. Expiration validation (Behavior A: reject if expired)
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: "Invitation has expired. Create a new invitation."
      });
    }

    // 5. Audit log resend action
    try {
      await supabase.from('audit_logs').insert({
        organization_id: adminOrgId,
        actor_id: adminId,
        action: 'TEAM_MEMBER_INVITATION_RESENT',
        resource_type: 'driver_invitations',
        resource_id: invite.id,
        metadata: { email: invite.email, role: invite.role }
      });
    } catch (auditErr) {
      console.warn("Audit log insert error (non-fatal):", auditErr.message);
    }

    // 6. Resend email using canonical record (reuses existing token, role, recipient)
    try {
      const { sendDriverInvitationEmail } = await import("../services/emailService.js");
      await sendDriverInvitationEmail(invite);

      return res.json({
        success: true,
        emailSent: true,
        message: "Invitation email resent successfully.",
        data: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          status: invite.status
        }
      });
    } catch (emailError) {
      console.warn("Resend email delivery failed (non-fatal):", emailError.message);
      return res.json({
        success: false,
        emailSent: false,
        warning: "Invitation still exists. Use Copy Link.",
        error: emailError.message
      });
    }
  } catch (error) {
    console.error("Resend Invitation Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

router.post(
  "/admin/users/invitations/:invitationId/resend",
  requireRole("admin", "super_admin"),
  handleResendUserInvitation
);

router.post(
  "/admin/users/invite/:invitationId/resend",
  requireRole("admin", "super_admin"),
  handleResendUserInvitation
);

// ═══════════════════════════════════════════════════════════════
// POST /admin/users/:userId/role — Change Role
// ═══════════════════════════════════════════════════════════════
router.post(
  "/admin/users/:userId/role",
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      const adminId = req.user.id;
      const adminRole = req.user.role;
      const targetUserId = req.params.userId;
      const { new_role } = req.body;

      if (!adminOrgId) return res.status(400).json({ success: false, error: "No organization." });
      if (!new_role) return res.status(400).json({ success: false, error: "New role is required." });
      
      if (adminId === targetUserId) {
        return res.status(403).json({ success: false, error: "You cannot change your own role." });
      }

      // Hierarchy rules: super_admin > admin > fleet_manager > dispatcher > driver > user
      const roleLevels = { super_admin: 5, admin: 4, fleet_manager: 3, dispatcher: 2, driver: 1, user: 0 };
      
      if (roleLevels[new_role] === undefined) {
        return res.status(400).json({ success: false, error: "Invalid role." });
      }

      if (roleLevels[new_role] > roleLevels[adminRole]) {
        return res.status(403).json({ success: false, error: "Cannot grant a role higher than your own." });
      }

      // Fetch target user profile
      const { data: targetUser, error: userError } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, organization_id")
        .eq("id", targetUserId)
        .eq("organization_id", adminOrgId)
        .maybeSingle();

      if (userError || !targetUser) {
        return res.status(404).json({ success: false, error: "User not found or access denied." });
      }

      if (roleLevels[targetUser.role] > roleLevels[adminRole]) {
        return res.status(403).json({ success: false, error: "Cannot modify a user with a higher role than your own." });
      }

      if (targetUser.role === 'admin' && new_role !== 'admin') {
        // Last admin check
        const { count, error: countError } = await supabase
          .from("user_profiles")
          .select("id", { count: 'exact', head: true })
          .eq("organization_id", adminOrgId)
          .eq("role", "admin");
        
        if (countError) throw countError;
        if (count <= 1) {
          return res.status(400).json({ success: false, error: "Cannot demote the last admin of the organization." });
        }
      }

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ role: new_role })
        .eq("id", targetUserId)
        .eq("organization_id", adminOrgId);

      if (updateError) throw updateError;

      const { error: auditError } = await supabase.from('audit_logs').insert({
        organization_id: adminOrgId,
        actor_id: adminId,
        action: 'USER_ROLE_CHANGED',
        resource_type: 'user_profiles',
        resource_id: targetUserId,
        metadata: {
          previous_value: targetUser.role,
          new_value: new_role,
          email: targetUser.email
        }
      });
      if (auditError) console.error("Audit log failed for USER_ROLE_CHANGED on resource", targetUserId, ":", auditError.message);

      return res.json({ success: true, message: "Role updated successfully." });
    } catch (error) {
      console.error("Change Role Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// DELETE /admin/users/:userId — Remove Team Member
// ═══════════════════════════════════════════════════════════════
router.delete(
  "/admin/users/:userId",
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const adminOrgId = req.user.organization_id;
      const adminId = req.user.id;
      const targetUserId = req.params.userId;

      if (!adminOrgId) return res.status(400).json({ success: false, error: "No organization." });
      if (adminId === targetUserId) {
        return res.status(403).json({ success: false, error: "You cannot remove yourself." });
      }

      // a. Fetch target with .eq('organization_id', callerOrg)
      const { data: targetUser, error: userError } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, organization_id")
        .eq("id", targetUserId)
        .eq("organization_id", adminOrgId)
        .maybeSingle();

      if (userError || !targetUser) {
        return res.status(404).json({ success: false, error: "User not found or access denied." });
      }

      if (targetUser.role !== 'fleet_manager') {
         return res.status(400).json({ success: false, error: "You can only remove team members with the fleet_manager role via this endpoint." });
      }

      // b. set the target's user_profiles row to role 'user' and organization_id NULL
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ organization_id: null, role: 'user' })
        .eq("id", targetUserId)
        .eq("organization_id", adminOrgId);

      if (updateError) throw updateError;

      // c. delete that user's fleet_manager_assignments rows
      const { error: assignmentError } = await supabase
        .from('fleet_manager_assignments')
        .delete()
        .eq('manager_id', targetUserId);
        
      if (assignmentError) {
         console.warn("Failed to delete fleet_manager_assignments:", assignmentError);
      }

      // d. disable the login through the Supabase admin API
      let banFailed = false;
      const { error: banError } = await supabase.auth.admin.updateUserById(targetUserId, { 
         ban_duration: '876000h' 
      });

      if (banError) {
         console.error("Auth Ban Error:", banError);
         banFailed = true;
      }

      // e. audit row
      const { error: auditError } = await supabase.from('audit_logs').insert({
        organization_id: adminOrgId,
        actor_id: adminId,
        action: 'USER_REMOVED',
        resource_type: 'user_profiles',
        resource_id: targetUserId,
        metadata: {
          previous_value: targetUser,
          new_value: { role: 'user', organization_id: null, banned: !banFailed },
          email: targetUser.email
        }
      });
      if (auditError) console.error("Audit log failed for USER_REMOVED on resource", targetUserId, ":", auditError.message);

      if (banFailed) {
         return res.status(200).json({ 
           success: true, 
           warning: "Access was removed successfully, but the login was not disabled. Please contact support." 
         });
      }

      return res.json({ success: true, message: "User removed and disabled successfully." });
    } catch (error) {
      console.error("Remove User Error:", error);
      return res.status(500).json({ success: false, error: "An internal error occurred." });
    }
  }
);
// ═══════════════════════════════════════════════════════════════
// GET /admin/driver-behavior — Get driver behavior metrics
// ═══════════════════════════════════════════════════════════════
router.get("/admin/driver-behavior", requireRole("admin", "super_admin", "fleet_manager", "user", "dispatcher"), async (req, res) => {
  try {
    const adminOrgId = req.user.organization_id;
    if (!adminOrgId) return res.status(400).json({ success: false, error: "No org" });

    if (req.query.sync === 'true') {
      try {
        await aggregateDriverBehavior(adminOrgId);
      } catch (err) {
        console.error("Sync error:", err);
      }
    }

    // 1. Fetch active drivers for org
    const { data: drivers, error: driversError } = await supabase
      .from('drivers')
      .select('id, first_name, last_name, email')
      .eq('organization_id', adminOrgId)
      .eq('status', 'active');
    if (driversError) throw driversError;

    if (!drivers || drivers.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const driverIds = drivers.map(d => d.id);

    // 2. Fetch driver behavior metrics
    const { data: analytics, error: analyticsError } = await supabase
      .from('driver_behavior_analytics')
      .select('*')
      .eq('organization_id', adminOrgId)
      .in('driver_id', driverIds);
    if (analyticsError) throw analyticsError;

    // 3. Fetch safety incidents
    const { data: incidents, error: incidentsError } = await supabase
      .from('safety_incident_reports')
      .select('id, driver_id, vehicle_id, type, date')
      .eq('organization_id', adminOrgId)
      .in('driver_id', driverIds);
    if (incidentsError) throw incidentsError;

    // 4. Map drivers to metrics and dedup incidents
    const metricsMap = {};
    for (const d of drivers) {
      metricsMap[d.id] = { harsh_acceleration: 0, harsh_braking: 0, speed_violations: 0, idle_time: 0, total_miles: 0, total_hours: 0, incidents: [] };
    }

    for (const a of analytics || []) {
       if (!metricsMap[a.driver_id]) continue;
       metricsMap[a.driver_id].total_miles += (a.total_distance_miles || 0);
       metricsMap[a.driver_id].total_hours += (a.total_drive_time_hours || 0);
       metricsMap[a.driver_id].harsh_acceleration += (a.harsh_acceleration_count || 0);
       metricsMap[a.driver_id].harsh_braking += (a.harsh_braking_count || 0);
       metricsMap[a.driver_id].speed_violations += (a.speed_violations_count || 0);
       metricsMap[a.driver_id].idle_time += (a.idle_time_minutes || 0);
    }

    for (const inc of incidents || []) {
       if (!metricsMap[inc.driver_id]) continue;
       metricsMap[inc.driver_id].incidents.push(inc);
    }

    const results = drivers.map(d => {
       const m = metricsMap[d.id];
       // Dedup incidents: unique key is vehicle_id + date + type
       const uniqueIncidents = [];
       const seen = new Set();
       for (const inc of m.incidents) {
         const key = inc.vehicle_id + '_' + inc.date + '_' + inc.type;
         if (!seen.has(key)) {
           seen.add(key);
           uniqueIncidents.push(inc);
         }
       }
       
       let overall = null;
       let incidentsPer1000 = 0;
       if (m.total_miles > 0) {
         const totalEvents = m.harsh_acceleration + m.harsh_braking + m.speed_violations;
         incidentsPer1000 = (totalEvents / Math.max(1, m.total_miles)) * 1000;
         overall = Math.max(0, 100 - (incidentsPer1000 * 5)); // using weight 5
       }

       return {
         driver_id: d.id,
         name: d.first_name + " " + d.last_name,
         email: d.email,
         metrics: m,
         incidents: uniqueIncidents,
         scored_events_count: (m?.harsh_acceleration || 0) + (m?.harsh_braking || 0) + (m?.speed_violations || 0),
         overall_score: overall
       };
    });

    res.json({ success: true, data: results });
  } catch (err) {
    console.error("Driver Behavior Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /admin/super-admin/users/:userId — Permanently Delete User
// ═══════════════════════════════════════════════════════════════
router.delete(
  "/admin/super-admin/users/:userId",
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const adminId = req.user.id;
      const targetUserId = req.params.userId;

      if (adminId === targetUserId) {
        return res.status(403).json({ success: false, error: "You cannot delete your own account." });
      }

      // 1. Fetch target user profile
      const { data: targetUser, error: userError } = await supabase
        .from("user_profiles")
        .select("id, email, role, organization_id")
        .eq("id", targetUserId)
        .maybeSingle();

      if (userError || !targetUser) {
        return res.status(404).json({ success: false, error: "User not found." });
      }

      // Safeguard: Prevent deleting the last admin of an org
      if (targetUser.role === 'admin' && targetUser.organization_id) {
        const { data: otherAdmins } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("organization_id", targetUser.organization_id)
          .eq("role", "admin")
          .neq("id", targetUserId);
          
        if (!otherAdmins || otherAdmins.length === 0) {
           return res.status(403).json({ success: false, error: "Cannot delete the last admin of an organization. Reassign admin role to another user first." });
        }
      }

      // 2. Delete driver dependencies if role is driver
      if (targetUser.role === 'driver') {
        const { data: drivers } = await supabase.from('drivers').select('id').eq('user_id', targetUserId);
        if (drivers && drivers.length > 0) {
           for (const driver of drivers) {
              await supabase.from('driver_onboarding_progress').delete().eq('driver_id', driver.id);
           }
           await supabase.from('drivers').delete().eq('user_id', targetUserId);
        }
      }

      // 3. Delete user-specific invitations tied to their email
      if (targetUser.email) {
        await supabase.from('driver_invitations').delete().eq('email', targetUser.email);
      }

      // 4. Delete user_profiles row
      const { error: profileDeleteError } = await supabase.from('user_profiles').delete().eq('id', targetUserId);
      if (profileDeleteError) throw profileDeleteError;

      // 5. Delete auth.users account using the admin API
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(targetUserId);
      if (authDeleteError) {
        console.error("Auth user delete error:", authDeleteError);
        throw authDeleteError;
      }

      return res.json({ success: true, message: "User permanently removed from the system." });
    } catch (error) {
      console.error("Delete user error:", error);
      return res.status(500).json({ success: false, error: "Failed to delete user." });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /admin/users/invitations/:invitationId/resend — Resend invitation email
// ═══════════════════════════════════════════════════════════════
router.post(
  "/admin/users/invitations/:invitationId/resend",
  requireRole("admin", "super_admin", "fleet_manager", "dispatcher"),
  async (req, res) => {
    try {
      const invitationId = req.params.invitationId;
      const organizationId = req.user.organization_id;
      const adminId = req.user.id;

      if (!organizationId) {
        return res.status(400).json({ success: false, error: "Admin has no organization." });
      }

      const { data: invite, error: fetchError } = await supabase
        .from('driver_invitations')
        .select('*')
        .eq('id', invitationId)
        .eq('organization_id', organizationId)
        .single();

      if (fetchError || !invite) {
        return res.status(404).json({ success: false, error: "Invalid invitation." });
      }

      if (invite.status === 'ACCEPTED') {
        return res.status(400).json({ success: false, error: "Invitation has already been accepted." });
      }
      
      // Renew token using same pattern as invitationRoutes.js
      const crypto = await import("crypto");
      const newToken = crypto.randomBytes(32).toString('hex');
      const expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + 7);

      const { data: updatedInvite, error: updateError } = await supabase
        .from('driver_invitations')
        .update({
          token: newToken,
          status: 'PENDING',
          expires_at: expires_at.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', invitationId)
        .select()
        .single();

      if (updateError) {
        return res.status(500).json({ success: false, error: "Failed to update invitation token." });
      }

      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: adminId,
        action: 'TEAM_MEMBER_INVITATION_RESENT',
        resource_id: invitationId,
        metadata: { email: updatedInvite.email, token_renewed: true }
      });

      try {
        await sendDriverInvitationEmail(updatedInvite);
        return res.json({ success: true, emailSent: true, data: updatedInvite });
      } catch (emailError) {
        await supabase.from('audit_logs').insert({
          organization_id: organizationId,
          actor_id: adminId,
          action: 'TEAM_MEMBER_INVITATION_EMAIL_FAILED',
          resource_id: invitationId,
          metadata: { error: emailError.message }
        });
        return res.json({ 
          success: true, 
          emailSent: false,
          warning: "Unable to resend invitation email. You can still use Copy Link.",
          data: updatedInvite
        });
      }
    } catch (error) {
      console.error("Resend Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ==========================================
// TRAINING ASSIGNMENTS
// ==========================================

router.get("/admin/training-assignments", requireRole("admin", "super_admin", "fleet_manager", "dispatcher"), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { data, error } = await supabase
      .from("driver_training_assignments")
      .select("*, training_modules(*), drivers(*)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet, return empty array to prevent crashing frontend before migration
        return res.json({ success: true, data: [] });
      }
      throw error;
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/admin/training-assignments", requireRole("admin", "super_admin", "fleet_manager", "dispatcher"), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { driver_id, training_module_id, custom_title, custom_description, due_date } = req.body;
    
    const { data, error } = await supabase
      .from("driver_training_assignments")
      .insert({
        organization_id: orgId,
        driver_id,
        training_module_id: training_module_id || null,
        custom_title: custom_title || null,
        custom_description: custom_description || null,
        due_date,
        assigned_by: req.user.id,
        status: 'assigned'
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/admin/training-assignments/:id", requireRole("admin", "super_admin", "fleet_manager", "dispatcher"), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { error } = await supabase
      .from("driver_training_assignments")
      .delete()
      .eq("id", req.params.id)
      .eq("organization_id", orgId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
