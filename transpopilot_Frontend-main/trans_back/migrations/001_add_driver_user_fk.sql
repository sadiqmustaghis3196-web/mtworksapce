-- 001_add_driver_user_fk.sql
-- Add foreign key from drivers.user_id to auth.users.id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'drivers'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.column_name = 'user_id'
  ) THEN
    ALTER TABLE drivers
      ADD COLUMN IF NOT EXISTS user_id uuid,
      ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
  END IF;
END $$;
