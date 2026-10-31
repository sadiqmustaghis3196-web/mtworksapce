const { Client } = require('pg');
const dotenv = require('dotenv'); dotenv.config();
const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://USER:PASSWORD@localhost:5432/DATABASE' });
client.connect().then(() => {
  client.query(`
    CREATE TABLE IF NOT EXISTS public.driver_training_assignments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
        module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
        due_date DATE NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    -- RLS Policies
    ALTER TABLE public.driver_training_assignments ENABLE ROW LEVEL SECURITY;
    
    DO $$ BEGIN
        CREATE POLICY "Users can view training assignments in their org" 
        ON public.driver_training_assignments FOR SELECT 
        USING (organization_id IN (
            SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
        ));
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
        CREATE POLICY "Users can insert training assignments in their org" 
        ON public.driver_training_assignments FOR INSERT 
        WITH CHECK (organization_id IN (
            SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
        ));
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
        CREATE POLICY "Users can update training assignments in their org" 
        ON public.driver_training_assignments FOR UPDATE 
        USING (organization_id IN (
            SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
        ));
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    
    DO $$ BEGIN
        CREATE POLICY "Users can delete training assignments in their org" 
        ON public.driver_training_assignments FOR DELETE 
        USING (organization_id IN (
            SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
        ));
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `).then(() => {
    console.log('Created driver_training_assignments');
    process.exit(0);
  }).catch(console.error);
}).catch(console.error);
