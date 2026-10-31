-- 0007_functions_triggers.sql
-- Create RPC functions and triggers

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, organization_id, role, full_name, email)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'organization_id')::uuid,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: email column added to user_profiles implicitly here. We should ensure we don't break if email isn't there, or we can just alter it.
-- Let's alter user_profiles to add email if it wasn't there in 0001
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email text;

-- Trigger to auto-create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- Function to calculate uptime percentage
CREATE OR REPLACE FUNCTION calculate_uptime_percentage(days integer)
RETURNS numeric AS $$
DECLARE
  uptime_percentage numeric;
BEGIN
  -- Simplified logic: in a real scenario, this would query system_health_checks
  -- For now, return a high baseline or calculate from health logs
  SELECT 
    COALESCE(
      (COUNT(*) FILTER (WHERE status = 'healthy')::numeric / NULLIF(COUNT(*), 0)) * 100, 
      99.99
    ) INTO uptime_percentage
  FROM system_health_checks
  WHERE recorded_at >= now() - (days || ' days')::interval;
  
  RETURN ROUND(uptime_percentage, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to create an organization for a user
CREATE OR REPLACE FUNCTION create_organization_for_user(target_user_id uuid)
RETURNS uuid AS $$
DECLARE
  new_org_id uuid;
  user_email text;
  org_name text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = target_user_id;
  org_name := COALESCE(split_part(user_email, '@', 1) || '''s Organization', 'New Organization');

  INSERT INTO organizations (name, slug, subscription_tier, subscription_status)
  VALUES (
    org_name, 
    LOWER(REGEXP_REPLACE(org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || floor(random() * 10000)::text,
    'starter',
    'active'
  ) RETURNING id INTO new_org_id;

  UPDATE user_profiles 
  SET organization_id = new_org_id, role = 'admin' 
  WHERE id = target_user_id;

  RETURN new_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to seed user demo data
CREATE OR REPLACE FUNCTION seed_user_demo_data(target_user_id uuid)
RETURNS void AS $$
DECLARE
  org_id uuid;
  driver_id_1 uuid;
  vehicle_id_1 uuid;
BEGIN
  SELECT organization_id INTO org_id FROM user_profiles WHERE id = target_user_id;
  
  IF org_id IS NULL THEN
    RETURN;
  END IF;

  -- Create a demo driver
  INSERT INTO drivers (organization_id, first_name, last_name, email, license_number, license_expiry)
  VALUES (org_id, 'Demo', 'Driver', 'driver@demo.com', 'DEMO-123', CURRENT_DATE + interval '1 year')
  RETURNING id INTO driver_id_1;

  -- Create a demo vehicle
  INSERT INTO vehicles (organization_id, vehicle_number, make, model, year, vin, status, current_location)
  VALUES (
    org_id, 'V-100', 'Ford', 'Transit', 2023, 'DEMOVIN123456789', 'active', 
    '{"lat": 37.7749, "lng": -122.4194}'::jsonb
  )
  RETURNING id INTO vehicle_id_1;

  -- Update vehicle with driver
  UPDATE vehicles SET driver_id = driver_id_1 WHERE id = vehicle_id_1;

  -- Create some demo locations
  INSERT INTO vehicle_locations (vehicle_id, latitude, longitude, speed)
  VALUES (vehicle_id_1, 37.7749, -122.4194, 45);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to promote user to super admin
CREATE OR REPLACE FUNCTION promote_to_super_admin(target_email text)
RETURNS boolean AS $$
DECLARE
  target_id uuid;
BEGIN
  SELECT id INTO target_id FROM auth.users WHERE email = target_email;
  
  IF target_id IS NOT NULL THEN
    UPDATE user_profiles SET role = 'super_admin' WHERE id = target_id;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
