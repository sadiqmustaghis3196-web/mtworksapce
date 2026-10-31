-- Cleanup synthetic / mock fuel_records inserted by previous logic
DELETE FROM fuel_records 
WHERE location = '36.0643, -115.0369' 
   OR (mpg > 37.15 AND mpg < 37.16)
   OR station_name = 'Geotab Telemetry Hub';

-- Cleanup any synthetic vehicles created by demo seeding
DELETE FROM vehicles 
WHERE vehicle_number LIKE 'DEMO-%';

-- Cleanup synthetic drivers
DELETE FROM drivers 
WHERE email LIKE '%@demo.com';

-- Drop the demo data seed function so it doesn't accidentally run again
DROP FUNCTION IF EXISTS seed_user_demo_data(uuid);
