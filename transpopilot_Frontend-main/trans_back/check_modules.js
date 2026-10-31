import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zmgxveuiyqmajxtyskwo.supabase.co';
const supabaseKey = 'REPLACE_WITH_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('training_modules')
    .select('*');
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${data.length} total modules in the database`);
    data.forEach(d => console.log(d.title, '| org:', d.organization_id));
  }
}
run();
