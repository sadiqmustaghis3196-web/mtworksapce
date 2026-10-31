-- 0011_company_onboarding_audit.sql

-- 1. company_verifications
CREATE TABLE IF NOT EXISTS company_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED')),
  legal_name text,
  business_type text,
  tax_id text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewer_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

-- 2. driver_invitations
CREATE TABLE IF NOT EXISTS driver_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  employee_type text NOT NULL DEFAULT 'employee' CHECK (employee_type IN ('employee', 'contractor')),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED')),
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 4. Modifying existing tables safely
DO $$ 
BEGIN
  -- driver_onboarding_progress
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_onboarding_progress' AND column_name = 'cdl_status') THEN
    ALTER TABLE driver_onboarding_progress ADD COLUMN cdl_status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_onboarding_progress' AND column_name = 'medical_status') THEN
    ALTER TABLE driver_onboarding_progress ADD COLUMN medical_status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_onboarding_progress' AND column_name = 'clearinghouse_status') THEN
    ALTER TABLE driver_onboarding_progress ADD COLUMN clearinghouse_status text DEFAULT 'pending';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_onboarding_progress' AND column_name = 'background_status') THEN
    ALTER TABLE driver_onboarding_progress ADD COLUMN background_status text DEFAULT 'pending';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_onboarding_progress' AND column_name = 'employment_docs_status') THEN
    ALTER TABLE driver_onboarding_progress ADD COLUMN employment_docs_status text DEFAULT 'pending';
  END IF;

  -- driver_documents
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'version') THEN
    ALTER TABLE driver_documents ADD COLUMN version integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'rejection_reason') THEN
    ALTER TABLE driver_documents ADD COLUMN rejection_reason text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_documents' AND column_name = 'reviewed_at') THEN
    ALTER TABLE driver_documents ADD COLUMN reviewed_at timestamptz;
  END IF;

  -- drivers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'employee_type') THEN
    ALTER TABLE drivers ADD COLUMN employee_type text DEFAULT 'employee' CHECK (employee_type IN ('employee', 'contractor'));
  END IF;
END $$;

-- Enable RLS
ALTER TABLE company_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Dynamic Policies for the new tables
DO $$ 
DECLARE 
  t text;
BEGIN 
  FOR t IN 
    SELECT unnest(ARRAY['company_verifications', 'driver_invitations', 'audit_logs'])
  LOOP
    -- SELECT policy
    EXECUTE format('
      DROP POLICY IF EXISTS "View %I in same org" ON public.%I;
      CREATE POLICY "View %I in same org" ON public.%I
      FOR SELECT TO authenticated
      USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = ''super_admin''));
    ', t, t, t, t);

    -- INSERT policy
    EXECUTE format('
      DROP POLICY IF EXISTS "Insert %I in same org" ON public.%I;
      CREATE POLICY "Insert %I in same org" ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = ''super_admin''));
    ', t, t, t, t);

    -- UPDATE policy
    EXECUTE format('
      DROP POLICY IF EXISTS "Update %I in same org" ON public.%I;
      CREATE POLICY "Update %I in same org" ON public.%I
      FOR UPDATE TO authenticated
      USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = ''super_admin''));
    ', t, t, t, t);

    -- DELETE policy
    EXECUTE format('
      DROP POLICY IF EXISTS "Delete %I in same org admin" ON public.%I;
      CREATE POLICY "Delete %I in same org admin" ON public.%I
      FOR DELETE TO authenticated
      USING (is_org_admin(organization_id));
    ', t, t, t, t);
  END LOOP;
END $$;
