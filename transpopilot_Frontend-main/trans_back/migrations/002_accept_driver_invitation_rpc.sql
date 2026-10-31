-- 002_accept_driver_invitation_rpc.sql
-- This function atomically accepts a driver invitation, creates the driver record, links the user profile, and updates invitation status.

CREATE OR REPLACE FUNCTION public.accept_driver_invitation(token TEXT, auth_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    inv RECORD;
    usr RECORD;
    driver_id UUID;
    onboarding_id UUID;
    result JSONB;
BEGIN
    -- Fetch invitation
    SELECT * INTO inv FROM driver_invitations
    WHERE token = token AND status = 'PENDING'
    LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or non-pending invitation';
    END IF;

    -- Ensure invitation not expired
    IF inv.expires_at < now() THEN
        RAISE EXCEPTION 'Invitation has expired';
    END IF;

    -- Verify auth user matches invitation email
    SELECT * INTO usr FROM user_profiles WHERE id = auth_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;
    IF lower(usr.email) <> lower(inv.email) THEN
        RAISE EXCEPTION 'Authenticated user email does not match invitation email';
    END IF;

    -- Update user profile: role driver and organization link
    UPDATE user_profiles
    SET role = 'driver', organization_id = inv.organization_id
    WHERE id = auth_user_id;

    -- Insert driver record
    INSERT INTO drivers (user_id, organization_id, email, first_name, last_name, employee_type, status, onboarding_status)
    VALUES (auth_user_id, inv.organization_id, inv.email, inv.first_name, inv.last_name, COALESCE(inv.employee_type, 'employee'), 'training', 'pending')
    RETURNING id INTO driver_id;

    -- Insert onboarding progress
    INSERT INTO driver_onboarding_progress (organization_id, driver_id, status)
    VALUES (inv.organization_id, driver_id, 'PENDING')
    RETURNING id INTO onboarding_id;

    -- Mark invitation accepted
    UPDATE driver_invitations
    SET status = 'ACCEPTED'
    WHERE id = inv.id;

    -- Audit log (basic)
    INSERT INTO audit_logs (organization_id, actor_id, action, resource_id, metadata)
    VALUES (inv.organization_id, auth_user_id, 'DRIVER_INVITATION_ACCEPTED', inv.id, jsonb_build_object('driver_id', driver_id));

    result := jsonb_build_object(
        'driverId', driver_id,
        'onboardingId', onboarding_id
    );
    RETURN result;
END;
$$;

-- Grant execute to anon role (adjust as needed)
GRANT EXECUTE ON FUNCTION public.accept_driver_invitation(TEXT, UUID) TO anon;
