-- 0008_rls_policies.sql
-- Enable Row Level Security and configure policies for all tables

-- Enable RLS for all tables
DO $$ 
DECLARE 
  t text;
BEGIN 
  FOR t IN 
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- 1. Organizations
CREATE POLICY "Users can view their organization" ON organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Admins can update their organization" ON organizations
  FOR UPDATE TO authenticated
  USING (id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 2. User Profiles
CREATE POLICY "Users can view profiles in their org" ON user_profiles
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()) OR id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Helper function to check if a user is an admin of an org
CREATE OR REPLACE FUNCTION is_org_admin(check_org_id uuid) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin') AND (organization_id = check_org_id OR role = 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. General Policy Template for organization-scoped tables
-- This block dynamically applies policies to all tables containing 'organization_id'
DO $$ 
DECLARE 
  t text;
BEGIN 
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND column_name = 'organization_id' 
      AND table_name NOT IN ('organizations', 'user_profiles')
  LOOP
    -- SELECT policy
    EXECUTE format('
      CREATE POLICY "View %I in same org" ON public.%I
      FOR SELECT TO authenticated
      USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = ''super_admin''));
    ', t, t);

    -- INSERT policy
    EXECUTE format('
      CREATE POLICY "Insert %I in same org" ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = ''super_admin''));
    ', t, t);

    -- UPDATE policy
    EXECUTE format('
      CREATE POLICY "Update %I in same org" ON public.%I
      FOR UPDATE TO authenticated
      USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = ''super_admin''));
    ', t, t);

    -- DELETE policy
    EXECUTE format('
      CREATE POLICY "Delete %I in same org admin" ON public.%I
      FOR DELETE TO authenticated
      USING (is_org_admin(organization_id));
    ', t, t);
  END LOOP;
END $$;

-- 4. Tables without organization_id but with vehicle_id or driver_id
-- e.g. vehicle_locations, driver_locations, gps_tracking, route_waypoints, route_analytics
CREATE POLICY "View vehicle_locations" ON vehicle_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert vehicle_locations" ON vehicle_locations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "View driver_locations" ON driver_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert driver_locations" ON driver_locations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "View gps_tracking" ON gps_tracking FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert gps_tracking" ON gps_tracking FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "View route_waypoints" ON route_waypoints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert/Update route_waypoints" ON route_waypoints FOR ALL TO authenticated USING (true) WITH CHECK(true);

CREATE POLICY "View route_analytics" ON route_analytics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert route_analytics" ON route_analytics FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Open policy for system health/AI/logs for authenticated users for now
CREATE POLICY "System health read" ON system_health_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "System health insert" ON system_health_checks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "System alerts read" ON system_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "System alerts all" ON system_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Note: In a production system, these should be tightened further, but this faithfully reconstructs
-- the permissive nature of the original schema that relied heavily on application-level filtering.
