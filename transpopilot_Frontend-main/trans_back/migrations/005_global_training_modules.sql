-- Allow training modules to be global (organization_id = NULL)
ALTER TABLE public.training_modules
ALTER COLUMN organization_id DROP NOT NULL;

-- Update existing starter modules to be global (if they belong to the test org or any org)
-- This ensures they are available to everyone
UPDATE public.training_modules
SET organization_id = NULL
WHERE title IN (
    'Speed Management & Compliance',
    'Defensive Driving',
    'Hard Braking Prevention',
    'Safe Following Distance',
    'Seat Belt Compliance',
    'Safe Cornering & Load Stability',
    'Distracted Driving Prevention',
    'Fuel Efficient Driving',
    'Hours of Service & Fatigue Awareness',
    'Pre-Trip Safety Inspection',
    'Advanced Driver Training'
);
