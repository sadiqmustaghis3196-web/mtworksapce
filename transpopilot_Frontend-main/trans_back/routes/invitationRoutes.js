import express from "express";
import crypto from "crypto";
import { supabase, SUPABASE_URL, SUPABASE_KEY } from "../config/supabase.js";
import { createClient } from "@supabase/supabase-js";
import { sendDriverInvitationEmail } from "../services/emailService.js";

const getScopedClient = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return supabase;
  
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: authHeader } }
  });
};

const router = express.Router();

router.post("/invitations/send", async (req, res) => {
  try {
    const { organization_id, email, first_name, last_name, employee_type, created_by } = req.body;

    if (!organization_id || !email || !first_name || !last_name || !employee_type || !created_by) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userClient = getScopedClient(req);

    // Check if invitation already exists and is pending
    const { data: existingInvite, error: existingError } = await userClient
      .from('driver_invitations')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('email', normalizedEmail)
      .eq('status', 'PENDING')
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingInvite) {
      return res.status(400).json({ success: false, error: "A pending invitation already exists for this email." });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 7);

    // Create DB record
    const { data: inviteRecord, error: insertError } = await userClient
      .from('driver_invitations')
      .insert({
        organization_id,
        email: normalizedEmail,
        first_name,
        last_name,
        employee_type,
        token,
        status: 'PENDING',
        expires_at: expires_at.toISOString(),
        created_by
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Audit Log Creation
    await userClient.from('audit_logs').insert({
      organization_id,
      actor_id: created_by,
      action: 'DRIVER_INVITATION_CREATED',
      resource_id: inviteRecord.id,
      metadata: { email: normalizedEmail, employee_type }
    });

    // Send Real Email
    try {
      await sendDriverInvitationEmail(inviteRecord);
      
      await userClient.from('audit_logs').insert({
        organization_id,
        actor_id: created_by,
        action: 'DRIVER_INVITATION_EMAIL_SENT',
        resource_id: inviteRecord.id,
        metadata: { email: normalizedEmail }
      });

      return res.json({ success: true, emailSent: true, data: inviteRecord });
    } catch (emailError) {
      await userClient.from('audit_logs').insert({
        organization_id,
        actor_id: created_by,
        action: 'DRIVER_INVITATION_EMAIL_FAILED',
        resource_id: inviteRecord.id,
        metadata: { error: emailError.message }
      });

      return res.json({ 
        success: true, 
        emailSent: false,
        warning: "Invitation created, but email delivery failed. Use Copy Link.",
        data: inviteRecord
      });
    }

  } catch (error) {
    console.error("Invitation Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/invitations/resend", async (req, res) => {
  try {
    const { invitation_id, organization_id, actor_id } = req.body;
    
    if (!invitation_id || !organization_id || !actor_id) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const userClient = getScopedClient(req);

    const { data: invite, error: fetchError } = await userClient
      .from('driver_invitations')
      .select('*')
      .eq('id', invitation_id)
      .eq('organization_id', organization_id)
      .single();

    if (fetchError || !invite) {
      return res.status(404).json({ success: false, error: "Invalid invitation." });
    }

    if (invite.status === 'ACCEPTED') {
      return res.status(400).json({ success: false, error: "Invitation has already been accepted." });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 7);

    const { data: updatedInvite, error: updateError } = await userClient
      .from('driver_invitations')
      .update({
        token,
        status: 'PENDING',
        expires_at: expires_at.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', invitation_id)
      .select()
      .single();

    if (updateError) throw updateError;

    await userClient.from('audit_logs').insert({
      organization_id,
      actor_id,
      action: 'DRIVER_INVITATION_RESENT',
      resource_id: invitation_id,
      metadata: { email: updatedInvite.email }
    });

    try {
      await sendDriverInvitationEmail(updatedInvite);
      return res.json({ success: true, emailSent: true, data: updatedInvite });
    } catch (emailError) {
       await userClient.from('audit_logs').insert({
        organization_id,
        actor_id,
        action: 'DRIVER_INVITATION_EMAIL_FAILED',
        resource_id: invitation_id,
        metadata: { error: emailError.message }
      });
      return res.json({ 
        success: true, 
        emailSent: false,
        warning: "Invitation updated, but email delivery failed. Use Copy Link.",
        data: updatedInvite
      });
    }

  } catch (error) {
    console.error("Resend Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/invitations/validate", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: "Token is required." });

    const { data: invite, error } = await supabase
      .from('driver_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !invite) {
      return res.status(400).json({ success: false, error: "Invalid invitation." });
    }

    if (invite.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: "Invitation has already been used." });
    }
    
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: "Invitation has expired." });
    }

    return res.status(200).json({ success: true, data: invite });
  } catch (error) {
    console.error("Validate Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/invitations/accept", async (req, res) => {
  try {
    const { token, authUserId } = req.body;
    if (!token || !authUserId) {
      return res.status(400).json({ success: false, error: "Token and authUserId are required." });
    }

    const userClient = getScopedClient(req);

    // 1. Fetch invitation
    const { data: inv, error: invError } = await userClient
      .from('driver_invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (invError || !inv) {
      return res.status(400).json({ success: false, error: "Invalid invitation." });
    }

    if (new Date(inv.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: "Invitation has expired." });
    }

    // 2. Fetch user profile
    const { data: usr, error: usrError } = await userClient
      .from('user_profiles')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle();

    if (usrError || !usr) {
      return res.status(400).json({ success: false, error: "User profile not found." });
    }

    if (inv.status === 'ACCEPTED' && usr.organization_id === inv.organization_id) {
       // Trigger already processed this!
       const { data: existingDriver } = await userClient.from('drivers').select('id').eq('user_id', authUserId).maybeSingle();
       return res.json({ success: true, data: { driverId: existingDriver?.id } });
    }

    if (inv.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: "Invalid or non-pending invitation." });
    }

    if ((usr.email || '').toLowerCase() !== (inv.email || '').toLowerCase()) {
      return res.status(400).json({ success: false, error: "Authenticated user email does not match invitation email." });
    }

    // Determine the actual role to assign based on the invitation
    const assignedRole = (inv.role === 'fleet_manager' || inv.role === 'dispatcher') ? inv.role : 'driver';

    // 3. Update user profile (role, org link, invitation_id)
    const { error: updateProfileError } = await userClient
      .from('user_profiles')
      .update({
        role: assignedRole,
        organization_id: inv.organization_id,
        invitation_id: inv.id
      })
      .eq('id', authUserId);

    if (updateProfileError) {
      console.error('Update Profile Error:', updateProfileError);
      return res.status(500).json({ success: false, error: updateProfileError.message });
    }

    let driverId = null;
    let onboardingId = null;

    if (assignedRole === 'driver') {
      // 4. Insert driver record
      const { data: driver, error: driverError } = await userClient
        .from('drivers')
        .insert({
          user_id: authUserId,
          organization_id: inv.organization_id,
          email: inv.email,
          first_name: inv.first_name,
          last_name: inv.last_name,
          employee_type: inv.employee_type || 'employee',
          status: 'training',
          onboarding_status: 'pending'
        })
        .select()
        .single();

      if (driverError) {
        console.error('Driver Insert Error:', driverError);
        return res.status(500).json({ success: false, error: driverError.message });
      }
      
      driverId = driver.id;

      // 5. Insert onboarding progress
      const { data: onboarding, error: onboardingError } = await userClient
        .from('driver_onboarding_progress')
        .insert({
          organization_id: inv.organization_id,
          driver_id: driver.id,
          overall_status: 'in_progress',
          background_check_status: 'pending',
          drug_screen_status: 'pending',
          mvr_check_status: 'pending'
        })
        .select()
        .single();

      if (onboardingError) {
        console.error('Onboarding Insert Error:', onboardingError);
      }
      onboardingId = onboarding?.id;
    }

    // 6. Mark invitation accepted
    const { error: invUpdateError } = await userClient
      .from('driver_invitations')
      .update({ status: 'ACCEPTED' })
      .eq('id', inv.id);

    if (invUpdateError) {
      console.error('Invitation Update Error:', invUpdateError);
    }

    // 7. Audit log
    await userClient.from('audit_logs').insert({
      organization_id: inv.organization_id,
      actor_id: authUserId,
      action: assignedRole === 'driver' ? 'DRIVER_INVITATION_ACCEPTED' : 'TEAM_MEMBER_INVITATION_ACCEPTED',
      resource_id: inv.id,
      metadata: driverId ? { driver_id: driverId, role: assignedRole } : { role: assignedRole }
    });

    return res.json({ success: true, data: { driverId, onboardingId } });

  } catch (error) {
    console.error("Accept Invitation Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
