-- Migration 0012: Driver Role Adjustments

-- 1. Relax constraints on user_profiles role to include driver, safety_manager, hr, dispatcher
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('user', 'admin', 'super_admin', 'fleet_manager', 'driver', 'safety_manager', 'hr', 'dispatcher'));

-- 2. Relax NOT NULL constraints on drivers table since drivers are created before CDL is provided
ALTER TABLE drivers ALTER COLUMN license_number DROP NOT NULL;
ALTER TABLE drivers ALTER COLUMN license_expiry DROP NOT NULL;
