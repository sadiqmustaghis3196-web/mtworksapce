-- Update driver_training_assignments table for custom training

ALTER TABLE public.driver_training_assignments
ADD COLUMN IF NOT EXISTS custom_title TEXT,
ADD COLUMN IF NOT EXISTS custom_description TEXT;

ALTER TABLE public.driver_training_assignments
ALTER COLUMN training_module_id DROP NOT NULL;

-- Constraint: Must have either module OR custom title
ALTER TABLE public.driver_training_assignments
ADD CONSTRAINT training_type_check
CHECK (
    (training_module_id IS NOT NULL AND custom_title IS NULL)
    OR
    (training_module_id IS NULL AND custom_title IS NOT NULL)
);
