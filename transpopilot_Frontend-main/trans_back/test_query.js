import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zmgxveuiyqmajxtyskwo.supabase.co';
const supabaseKey = 'REPLACE_WITH_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('*')
    .ilike('full_name', '%test user%');
    
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Test Users:', users);
    
    // Now fetch training modules for the first test user's org
    if (users && users.length > 0) {
      const orgId = users[0].organization_id;
      console.log('Fetching modules for orgId:', orgId);
      
      const { data: modules, error: modError } = await supabase
        .from('training_modules')
        .select('*')
        .or(`organization_id.eq.${orgId},organization_id.is.null`);
        
      if (modError) {
        console.error('Error fetching modules:', modError);
      } else {
        console.log(`Found ${modules.length} modules`);
        console.log('First 3:', modules.slice(0, 3).map(m => m.title));
      }
    }
  }
}
run();
