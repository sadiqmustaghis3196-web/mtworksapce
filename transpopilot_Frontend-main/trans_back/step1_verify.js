import { supabase } from './config/supabase.js';

async function verifyState() {
  const email = 'kahasufyan@gmail.com';
  
  // 1. user_profiles
  const { data: profiles, error: err1 } = await supabase.rpc('exec_sql', {
    query: `select id, email, role, organization_id, invitation_id, created_at from public.user_profiles where email = '${email}';`
  });
  
  if (err1) {
    // exec_sql might not exist, use direct queries
    const { data: p } = await supabase.from('user_profiles').select('id, email, role, organization_id, invitation_id, created_at').eq('email', email);
    console.log("user_profiles:", p);
  } else {
    console.log("user_profiles:", profiles);
  }
  
  // 2. driver_invitations
  const { data: invites } = await supabase.from('driver_invitations').select('id, email, status, organization_id, created_at, updated_at').eq('email', email).order('created_at', { ascending: false });
  console.log("driver_invitations:", invites);
  
  // 3. auth.users
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const user = usersData?.users?.find(u => u.email === email);
  console.log("auth.users:", user ? { id: user.id, email: user.email, created_at: user.created_at } : null);
}

verifyState();
