import { supabase } from './config/supabase.js';

async function cleanup() {
  const targetEmail = 'kahasufyan@gmail.com';
  console.log(`Starting cleanup for ${targetEmail}...`);

  // 1. Find and delete auth.users
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  const authUser = users?.find(u => u.email === targetEmail);
  console.log(`auth.users found:`, authUser ? authUser.id : 'None');
  
  // Find driver profiles
  const { data: drivers } = await supabase.from('drivers').select('*').eq('email', targetEmail);
  console.log(`drivers found:`, drivers?.length || 0);

  const driverIds = drivers?.map(d => d.id) || [];

  if (driverIds.length > 0) {
    // Check documents
    const { data: docs } = await supabase.from('driver_documents').select('*').in('driver_id', driverIds);
    console.log(`driver_documents found:`, docs?.length || 0);
    if (docs?.length > 0) {
      await supabase.from('driver_documents').delete().in('driver_id', driverIds);
      console.log('Deleted driver_documents.');
    }

    // Check onboarding progress
    const { data: prog } = await supabase.from('driver_onboarding_progress').select('*').in('driver_id', driverIds);
    console.log(`driver_onboarding_progress found:`, prog?.length || 0);
    if (prog?.length > 0) {
      await supabase.from('driver_onboarding_progress').delete().in('driver_id', driverIds);
      console.log('Deleted driver_onboarding_progress.');
    }

    // Delete drivers
    await supabase.from('drivers').delete().eq('email', targetEmail);
    console.log('Deleted drivers.');
  }

  // Check user profiles
  const { data: profiles } = await supabase.from('user_profiles').select('*').eq('email', targetEmail);
  console.log(`user_profiles found:`, profiles?.length || 0);
  if (profiles?.length > 0) {
    await supabase.from('user_profiles').delete().eq('email', targetEmail);
    console.log('Deleted user_profiles.');
  }

  // Delete auth user
  if (authUser) {
    const { error: delAuthErr } = await supabase.auth.admin.deleteUser(authUser.id);
    console.log('Deleted auth user:', delAuthErr || 'Success');
  }

  // Check invitations
  const { data: invites } = await supabase.from('driver_invitations').select('*').eq('email', targetEmail);
  console.log(`driver_invitations found:`, invites?.length || 0);
  if (invites?.length > 0) {
    await supabase.from('driver_invitations').delete().eq('email', targetEmail);
    console.log('Deleted driver_invitations.');
  }

  // Check audit logs
  const { data: logs } = await supabase.from('audit_logs').select('*').ilike('metadata::text', `%kahasufyan%`);
  console.log(`audit_logs found:`, logs?.length || 0);
  if (logs?.length > 0) {
    await supabase.from('audit_logs').delete().ilike('metadata::text', `%kahasufyan%`);
    console.log('Deleted audit_logs.');
  }

  console.log("Cleanup complete.");
}

cleanup();
