import { supabase } from './config/supabase.js';

// Self-verification: FLOW 1 (non-invited signup)
// Confirms role='user', organization_id=null, no new org created
async function verifyFlow1() {
  const email = 'flow1test_' + Date.now() + '@example.com';
  console.log('=== FLOW 1 self-verification ===');
  console.log('Test email:', email);

  // Count orgs before
  const { count: orgsBefore } = await supabase
    .from('organizations').select('*', { count: 'exact', head: true });
  console.log('Organizations before signup:', orgsBefore);

  // Simulate signup
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Flow One Test' }
  });

  if (error) {
    console.log('❌ GoTrue error (trigger likely still crashing):', error.message);
    return;
  }
  console.log('✅ Auth user created:', data.user.id);

  await new Promise(r => setTimeout(r, 300));

  // Check profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, email, role, organization_id, invitation_id')
    .eq('id', data.user.id)
    .single();
  console.log('user_profiles row:', profile);

  // Count orgs after — must be same
  const { count: orgsAfter } = await supabase
    .from('organizations').select('*', { count: 'exact', head: true });
  console.log('Organizations after signup:', orgsAfter);
  console.log('New org created?', orgsAfter > orgsBefore ? '❌ YES (BUG)' : '✅ NO (correct)');

  if (profile) {
    const roleOk = profile.role === 'user';
    const orgOk = profile.organization_id === null;
    console.log('role === "user"?', roleOk ? '✅' : '❌ GOT: ' + profile.role);
    console.log('organization_id === null?', orgOk ? '✅' : '❌ GOT: ' + profile.organization_id);
  }

  // Cleanup
  await supabase.auth.admin.deleteUser(data.user.id);
  console.log('Cleanup done.');
}

verifyFlow1();
