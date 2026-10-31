import { supabase } from './config/supabase.js';

const targetEmails = [
  "sufyan265631@gmail.com",
  "kahasufyan@gmail.com",
  "muhammad.64173@iqra.edu.pk",
  "info.mustaghistech@gmail.com",
  "afzalkhaplu3196@gmail.com",
  "afzalsumo3196@gmail.com",
  "dscleveland98@gmail.com"
];

async function inspectAndClean() {
  console.log("=== INSPECTING ACCOUNTS ===");
  const results = {};
  
  for (const email of targetEmails) {
    results[email] = {
      email,
      auth: null,
      profile: null,
      invites: 0,
      driver: null,
      onboarding: null,
      status: 'PENDING',
      reason: ''
    };
    
    // Check auth.users (via admin API)
    const { data: users, error: authError } = await supabase.auth.admin.listUsers();
    let authUser = null;
    if (users && users.users) {
      authUser = users.users.find(u => u.email === email);
      if (authUser) {
        results[email].auth = authUser.id;
      }
    }
    
    // Check user_profiles
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('email', email).maybeSingle();
    if (profile) {
      results[email].profile = profile;
    }
    
    // Check driver_invitations
    const { data: invites } = await supabase.from('driver_invitations').select('id').eq('email', email);
    if (invites) {
      results[email].invites = invites.length;
    }
    
    // Check drivers
    const { data: driverRow } = await supabase.from('drivers').select('*').eq('email', email).maybeSingle();
    let driverProfile = null;
    if (results[email].auth) {
      const { data: dp } = await supabase.from('drivers').select('*').eq('user_id', results[email].auth).maybeSingle();
      driverProfile = dp;
    }
    const driver = driverRow || driverProfile;
    
    if (driver) {
      results[email].driver = driver;
      
      // Check onboarding
      const { data: ob } = await supabase.from('driver_onboarding_progress').select('id').eq('driver_id', driver.id);
      if (ob && ob.length > 0) {
        results[email].onboarding = ob.length;
      } else {
        results[email].onboarding = 0;
      }
    } else {
      results[email].onboarding = 0;
    }
    
    // Safety check - is this a super admin or only admin?
    if (profile && (profile.role === 'super_admin' || profile.role === 'admin')) {
      if (profile.role === 'super_admin') {
         results[email].status = 'PROTECTED';
         results[email].reason = 'Is a super_admin';
         continue;
      }
      
      // Check if they are the ONLY admin for their org
      const { data: otherAdmins } = await supabase.from('user_profiles')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .in('role', ['admin', 'super_admin'])
        .neq('id', profile.id);
        
      if (!otherAdmins || otherAdmins.length === 0) {
        results[email].status = 'PROTECTED';
        results[email].reason = 'Only admin for organization';
        continue;
      }
    }
  }
  
  // Do safety checks on all results first
  for (const email of targetEmails) {
    if (results[email].status === 'PROTECTED') {
      console.log(`Skipping protected account: ${email} - ${results[email].reason}`);
    } else {
      results[email].status = 'CLEAN'; // meaning it has no records remaining
      if (results[email].auth || results[email].profile || results[email].driver || results[email].invites > 0 || results[email].onboarding > 0) {
         results[email].status = 'RECORDS_EXIST';
      }
    }
  }

  console.log("=== FINAL STATUS ===");
  console.log(JSON.stringify(results, null, 2));
}

inspectAndClean();
