// check_invalid_user_ids.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Find drivers with null user_id
  const { data: nullRows, error: nullErr } = await supabase
    .from('drivers')
    .select('id, user_id')
    .is('user_id', null);
  if (nullErr) console.error('Error fetching null user_id rows', nullErr);
  else console.log('Drivers with NULL user_id:', nullRows);

  // Find drivers with user_id not matching any auth.users
  const { data: allDrivers, error: allErr } = await supabase.from('drivers').select('id, user_id');
  if (allErr) {
    console.error('Error fetching drivers', allErr);
    return;
  }
  const { data: users, error: usersErr } = await supabase.from('auth.users').select('id');
  if (usersErr) {
    console.error('Error fetching auth users', usersErr);
    return;
  }
  const userIds = new Set(users.map(u => u.id));
  const invalid = allDrivers.filter(d => d.user_id && !userIds.has(d.user_id));
  console.log('Drivers with invalid user_id (no matching auth user):', invalid);
}
run();
