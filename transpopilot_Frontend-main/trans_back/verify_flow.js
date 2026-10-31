import { supabase } from './config/supabase.js';


async function runTestFlow() {
  const email = 'sufyan265631+drivertest1@gmail.com';
  
  // STEP 1 - Verify clean state
  console.log("=== STEP 1: Verifying clean state ===");
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const authUser = usersData?.users?.find(u => u.email === email);
  console.log("auth.users exists?", !!authUser);
  
  const { data: profiles } = await supabase.from('user_profiles').select('id').eq('email', email);
  console.log("user_profiles exists?", profiles?.length > 0);
  
  const { data: invites } = await supabase.from('driver_invitations').select('id').eq('email', email);
  console.log("driver_invitations exists?", invites?.length > 0);
  
  // STEP 2 - Send real invite via POST /api/admin/invite-driver
  console.log("\n=== STEP 2: Sending real invite ===");
  // We need an admin JWT.
  const adminEmail = 'admin@gmail.com'; // or afzalsumo3196@gmail.com
  await supabase.auth.admin.updateUserById('b6fbfddd-e37e-4e28-9473-ff8c48b8ad1e', { password: 'TempPassword123!' });
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: 'TempPassword123!'
  });
  
  if (signInErr) {
    console.log("Failed admin login:", signInErr.message);
    return;
  }
  const token = signInData.session.access_token;
  
  const response = await fetch('http://localhost:5000/api/admin/invite-driver', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      email: email,
      first_name: 'Test',
      last_name: 'DriverOne',
      employee_type: 'contractor'
    })
  });
  const result = await response.json();
  console.log("Invite Response:", result.success ? "Success" : result.error);
  
  // STEP 3 - Simulate user signup via GoTrue
  console.log("\n=== STEP 3: Simulating User Signup ===");
  const { data: signUpData, error: signUpErr } = await supabase.auth.admin.createUser({
    email: email,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Test DriverOne',
      role: 'driver' // mimicking the frontend passing role='driver'
    }
  });
  
  if (signUpErr) {
     console.log("Signup failed:", signUpErr.message);
     return;
  }
  console.log("Created auth.user:", signUpData.user.id);
  
  // Wait a tiny bit for trigger to settle (should be synchronous, but just in case)
  await new Promise(r => setTimeout(r, 500));
  
  // STEP 4 - Verify the DB state
  console.log("\n=== STEP 4: Verifying Trigger Output ===");
  const { data: p } = await supabase.from('user_profiles').select('id, email, role, organization_id, invitation_id').eq('email', email).single();
  console.log("user_profiles:", p);
  
  const { data: d } = await supabase.from('drivers').select('id, email, organization_id, status').eq('email', email).single();
  console.log("drivers:", d);
  
  if (d) {
     const { data: op } = await supabase.from('driver_onboarding_progress').select('*').eq('driver_id', d.id).single();
     console.log("driver_onboarding_progress:", op ? "Created successfully" : "Missing");
  }
  
  const { data: i } = await supabase.from('driver_invitations').select('status').eq('email', email).single();
  console.log("driver_invitations status:", i?.status);
}

runTestFlow();
