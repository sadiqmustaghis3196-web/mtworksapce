import { supabase } from './config/supabase.js';

const ORG_ID = '1f7849b1-e6d5-4565-a634-6a73499e9835';

async function testInvitationsQuery() {
  // Simulate what getDriverInvitations does — raw supabase query as service role
  const { data, error } = await supabase
    .from('driver_invitations')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false });
  
  console.log('Error:', error);
  console.log('Data count:', data?.length);
  console.log('Sample:', data?.[0]);
}

testInvitationsQuery();
