-- Create driver_training_assignments table
CREATE TABLE public.driver_training_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    training_module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    source_event_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.driver_training_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view training assignments in their organization"
    ON public.driver_training_assignments
    FOR SELECT
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE user_profiles.id = auth.uid()));

CREATE POLICY "Admins and Fleet Managers can create training assignments"
    ON public.driver_training_assignments
    FOR INSERT
    WITH CHECK (
        organization_id = (SELECT organization_id FROM public.user_profiles WHERE user_profiles.id = auth.uid())
        AND (SELECT role FROM public.user_profiles WHERE user_profiles.id = auth.uid()) IN ('admin', 'super_admin', 'fleet_manager')
    );

CREATE POLICY "Admins and Fleet Managers can update training assignments"
    ON public.driver_training_assignments
    FOR UPDATE
    USING (
        organization_id = (SELECT organization_id FROM public.user_profiles WHERE user_profiles.id = auth.uid())
        AND (SELECT role FROM public.user_profiles WHERE user_profiles.id = auth.uid()) IN ('admin', 'super_admin', 'fleet_manager')
    );

CREATE POLICY "Admins and Fleet Managers can delete training assignments"
    ON public.driver_training_assignments
    FOR DELETE
    USING (
        organization_id = (SELECT organization_id FROM public.user_profiles WHERE user_profiles.id = auth.uid())
        AND (SELECT role FROM public.user_profiles WHERE user_profiles.id = auth.uid()) IN ('admin', 'super_admin', 'fleet_manager')
    );
