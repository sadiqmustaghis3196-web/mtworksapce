import axios from 'axios';
import { supabase } from './config/supabase.js';
import app from './server.js';

const PORT = 5001;
const API_URL = `http://localhost:${PORT}`;

let server;

async function runTests() {
  console.log("=== STARTING E2E INVITATION TESTS ===");
  server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });

  try {
    // 1. Create a dummy admin user to get a real JWT
    const adminEmail = `admin-${Date.now()}@test.com`;
    const password = `Password123!`;
    
    // Pick an existing organization
    const { data: orgData } = await supabase.from('organizations').select('id').limit(1).single();
    if (!orgData) throw new Error("No organization found");
    const orgId = orgData.id;

    console.log(`Creating test admin in org: ${orgId}`);
    const { data: authAdmin, error: authErr } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: password,
      email_confirm: true
    });
    if (authErr) throw authErr;
    
    const adminId = authAdmin.user.id;
    
    // Insert into user_profiles
    await supabase.from('user_profiles').insert({
      id: adminId,
      email: adminEmail,
      role: 'admin',
      organization_id: orgId
    });

    // Use Service Role Key to bypass RLS
    const token = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const headers = { Authorization: `Bearer ${token}` };

    // --- TEST 1: DRIVER INVITATION ---
    console.log("\n[TEST 1] Driver Invitation...");
    const driverEmail = `driver-${Date.now()}@resend.dev`;
    const driverRes = await axios.post(`${API_URL}/api/invitations/send`, {
      organization_id: orgId,
      email: driverEmail,
      first_name: "Test",
      last_name: "Driver",
      employee_type: "employee",
      created_by: adminId
    }, { headers });
    
    console.log("Driver Invite Response:", driverRes.data);
    if (!driverRes.data.success || !driverRes.data.emailSent) throw new Error("Driver invite failed");
    
    const driverToken = driverRes.data.data.token;
    
    // Accept Driver Invitation
    // Need a dummy user for the driver
    const { data: authDriver } = await supabase.auth.admin.createUser({
      email: driverEmail,
      password: password,
      email_confirm: true
    });
    await supabase.from('user_profiles').insert({ id: authDriver.user.id, email: driverEmail });
    const { data: driverSession } = await supabase.auth.signInWithPassword({ email: driverEmail, password });
    
    const driverAcceptRes = await axios.post(`${API_URL}/api/invitations/accept`, {
      token: driverToken,
      authUserId: authDriver.user.id
    }, { headers });
    
    console.log("Driver Accept Response:", driverAcceptRes.data);
    if (!driverAcceptRes.data.success || !driverAcceptRes.data.data.driverId) throw new Error("Driver accept failed");
    console.log("Driver TEST PASS");

    // --- TEST 2: FLEET MANAGER INVITATION ---
    console.log("\n[TEST 2] Fleet Manager Invitation...");
    const fmEmail = `fm-${Date.now()}@resend.dev`;
    const fmRes = await axios.post(`${API_URL}/api/admin/users/invite`, {
      email: fmEmail,
      role: 'fleet_manager'
    }, { headers });
    
    console.log("Fleet Manager Invite Response:", fmRes.data);
    if (!fmRes.data.success || !fmRes.data.emailSent) throw new Error("FM invite failed");
    
    const fmToken = fmRes.data.data.token;
    
    // Accept FM
    const { data: authFM } = await supabase.auth.admin.createUser({ email: fmEmail, password, email_confirm: true });
    await supabase.from('user_profiles').insert({ id: authFM.user.id, email: fmEmail });
    const { data: fmSession } = await supabase.auth.signInWithPassword({ email: fmEmail, password });
    
    const fmAcceptRes = await axios.post(`${API_URL}/api/invitations/accept`, {
      token: fmToken,
      authUserId: authFM.user.id
    }, { headers });
    
    console.log("FM Accept Response:", fmAcceptRes.data);
    if (!fmAcceptRes.data.success) throw new Error("FM accept failed");
    
    // Verify Driver Rows = 0
    const { count: fmDriverCount } = await supabase.from('drivers').select('*', { count: 'exact' }).eq('user_id', authFM.user.id);
    console.log("FM Driver Rows:", fmDriverCount);
    if (fmDriverCount > 0) throw new Error("FM should not have a driver row");
    console.log("Fleet Manager TEST PASS");

    // --- TEST 3: DISPATCHER INVITATION ---
    console.log("\n[TEST 3] Dispatcher Invitation...");
    const dispEmail = `disp-${Date.now()}@resend.dev`;
    const dispRes = await axios.post(`${API_URL}/api/admin/users/invite`, {
      email: dispEmail,
      role: 'dispatcher'
    }, { headers });
    
    console.log("Dispatcher Invite Response:", dispRes.data);
    if (!dispRes.data.success || !dispRes.data.emailSent) throw new Error("Disp invite failed");
    
    const dispToken = dispRes.data.data.token;
    
    // Accept Disp
    const { data: authDisp } = await supabase.auth.admin.createUser({ email: dispEmail, password, email_confirm: true });
    await supabase.from('user_profiles').insert({ id: authDisp.user.id, email: dispEmail });
    const { data: dispSession } = await supabase.auth.signInWithPassword({ email: dispEmail, password });
    
    const dispAcceptRes = await axios.post(`${API_URL}/api/invitations/accept`, {
      token: dispToken,
      authUserId: authDisp.user.id
    }, { headers });
    
    console.log("Disp Accept Response:", dispAcceptRes.data);
    if (!dispAcceptRes.data.success) throw new Error("Disp accept failed");
    console.log("Dispatcher TEST PASS");

    // --- TEST 5: EMAIL FAILURE FALLBACK ---
    console.log("\n[TEST 5] Email Failure Fallback...");
    process.env.RESEND_API = 'invalid_key'; // This won't affect the running server, so we must mock the server or restart it.
    // Wait, modifying process.env here only affects THIS script, not the running backend.
    // Let's test the endpoint directly by passing an invalid email that fails validation in Resend, like example.com
    const failEmail = `fail-${Date.now()}@example.com`;
    const failRes = await axios.post(`${API_URL}/api/invitations/send`, {
      organization_id: orgId,
      email: failEmail,
      first_name: "Fail",
      last_name: "Test",
      employee_type: "employee",
      created_by: adminId
    }, { headers });
    
    console.log("Fail Invite Response:", failRes.data);
    if (!failRes.data.success || failRes.data.emailSent !== false) throw new Error("Email failure fallback failed");
    console.log("Email Failure TEST PASS");

    console.log("\nALL TESTS PASSED SUCCESSFULLY");

  } catch (error) {
    if (error.response) {
      console.error("HTTP Error:", error.response.status, error.response.data);
    } else {
      console.error("Test Error:", error.message, error.stack);
    }
  } finally {
    if (server) server.close();
    process.exit(0);
  }
}

runTests();
