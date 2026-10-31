import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zmgxveuiyqmajxtyskwo.supabase.co';
const supabaseKey = 'REPLACE_WITH_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

const modules = [
  { title: 'Speed Management & Compliance', description: 'Understanding speed limits, stopping distances, and the impact of speed on severe accidents.', type: 'safety' },
  { title: 'Defensive Driving', description: 'Anticipating road hazards, maintaining space cushions, and scanning techniques.', type: 'safety' },
  { title: 'Hard Braking Prevention', description: 'Smooth deceleration techniques and reading traffic flow ahead.', type: 'safety' },
  { title: 'Safe Following Distance', description: 'The 3-second rule and adjusting following distance for weather conditions.', type: 'safety' },
  { title: 'Seat Belt Compliance', description: 'Company policy and legal requirements regarding mandatory seat belt usage.', type: 'safety' },
  { title: 'Safe Cornering & Load Stability', description: 'Approaching curves safely and understanding the physics of cargo shifts.', type: 'safety' },
  { title: 'Distracted Driving Prevention', description: 'Eliminating phone usage and maintaining focus while driving.', type: 'safety' },
  { title: 'Fuel Efficient Driving', description: 'Techniques to reduce idling, smooth acceleration, and optimizing fuel consumption.', type: 'safety' },
  { title: 'Hours of Service & Fatigue Awareness', description: 'Recognizing signs of fatigue and strictly adhering to HOS regulations.', type: 'safety' },
  { title: 'Pre-Trip Safety Inspection', description: 'How to conduct a thorough pre-trip inspection and log defects correctly.', type: 'safety' }
];

async function run() {
  const recordsToInsert = modules.map(m => ({
    ...m,
    organization_id: null,
    required: false,
    content: {
      video_url: null,
      quiz_data: null
    }
  }));
  
  const { data, error } = await supabase
    .from('training_modules')
    .insert(recordsToInsert)
    .select();
    
  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Inserted global modules successfully:', data.length);
  }
}
run();
