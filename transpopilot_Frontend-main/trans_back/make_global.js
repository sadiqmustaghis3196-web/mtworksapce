import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zmgxveuiyqmajxtyskwo.supabase.co';
const supabaseKey = 'REPLACE_WITH_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const titles = [
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
  ];
  
  const { data, error } = await supabase
    .from('training_modules')
    .update({ organization_id: null })
    .in('title', titles);
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Updated to global successfully!');
  }
}
run();
