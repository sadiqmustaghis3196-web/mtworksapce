import { supabase } from './config/supabase.js';

async function updateTrigger() {
  const sql = `
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invitation_record RECORD;
  assigned_org_id uuid;
  assigned_role text;
  assigned_invitation_id uuid;
  org_name text;
BEGIN
  assigned_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
  assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');

  -- 1. Check for pending invitation matching email (case-insensitive)
  SELECT id, organization_id, role INTO invitation_record 
  FROM public.driver_invitations 
  WHERE LOWER(email) = LOWER(NEW.email) AND status = 'PENDING'
  LIMIT 1;

  IF FOUND THEN
    assigned_org_id := invitation_record.organization_id;
    
    -- If role is fleet_manager or dispatcher, keep it; otherwise fallback to driver
    IF invitation_record.role = 'fleet_manager' OR invitation_record.role = 'dispatcher' THEN
      assigned_role := invitation_record.role;
    ELSE
      assigned_role := 'driver';
    END IF;

    assigned_invitation_id := invitation_record.id;
    
    -- Mark invitation as accepted
    UPDATE public.driver_invitations SET status = 'ACCEPTED', updated_at = now() WHERE id = invitation_record.id;
  END IF;

  -- 2. If no invitation and no org passed, create one if they are signing up as 'user' or 'admin'? 
  -- Actually, let's just create an organization if assigned_org_id is null
  IF assigned_org_id IS NULL THEN
    org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', split_part(NEW.email, '@', 1) || '''s Organization');
    INSERT INTO organizations (name, slug, subscription_tier, subscription_status)
    VALUES (
      org_name, 
      LOWER(REGEXP_REPLACE(org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || floor(random() * 10000)::text,
      'starter',
      'active'
    ) RETURNING id INTO assigned_org_id;
    assigned_role := 'admin';
  END IF;

  INSERT INTO public.user_profiles (id, organization_id, role, full_name, email, invitation_id)
  VALUES (
    NEW.id,
    assigned_org_id,
    assigned_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    assigned_invitation_id
  );
  
  -- If they are a driver from an invitation, we should create their drivers and driver_onboarding_progress records
  IF FOUND AND assigned_role = 'driver' THEN
    INSERT INTO public.drivers (user_id, organization_id, email, first_name, last_name, employee_type, status, onboarding_status)
    SELECT NEW.id, assigned_org_id, email, first_name, last_name, employee_type, 'training', 'pending'
    FROM public.driver_invitations WHERE id = assigned_invitation_id;
    
    INSERT INTO public.driver_onboarding_progress (organization_id, driver_id, overall_status, background_check_status, drug_screen_status, mvr_check_status)
    SELECT assigned_org_id, id, 'in_progress', 'pending', 'pending', 'pending'
    FROM public.drivers WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

  const { error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
     // fallback if exec_sql doesn't exist
     console.log("No exec_sql RPC, I need to use psql or standard method.");
  }
}

updateTrigger();
