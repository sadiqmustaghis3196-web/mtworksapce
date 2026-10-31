import { supabase } from './config/supabase.js';


async function sendFinalInvite() {
  const email = 'sufyan265631+drivertest2@gmail.com';
  const adminEmail = 'admin@gmail.com';
  
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
      last_name: 'DriverTwo',
      employee_type: 'contractor'
    })
  });
  const result = await response.json();
  console.log("Invite Response:", result);
}

sendFinalInvite();
