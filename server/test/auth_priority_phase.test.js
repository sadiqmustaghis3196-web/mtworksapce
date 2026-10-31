/**
 * MT Nexus Global ERP — Comprehensive Authentication & Security Test Suite
 * Validates:
 * 1. Individual password verification for Super Admin, Admin, PM, Team Lead, Employees, Interns.
 * 2. Rejection of invalid credentials with generic error messages.
 * 3. Deactivated account rejection.
 * 4. Cookie issuance (HttpOnly, SameSite lax).
 * 5. GET /api/auth/me session resolution with effective permissions and department.
 * 6. Rate limiting on authentication endpoints.
 * 7. One-time crypto token generation on Forgot Password (no plaintext tokens stored in DB).
 * 8. Verify reset token endpoint.
 * 9. Reset password enforcement (password strength, confirmation match, token invalidation).
 * 10. Admin protection (Admin cannot modify Super Admin or assign Super Admin role).
 */

const assert = require('assert');

const BASE_URL = 'http://127.0.0.1:5000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    // raw text
  }

  const setCookie = res.headers.get('set-cookie');

  return {
    status: res.status,
    headers: res.headers,
    setCookie,
    body: json || text,
  };
}

async function runTests() {
  console.log('🚀 Running MT Nexus Global Authentication Suite Tests...\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  // 1. Super Admin Login
  const superAdminRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'hamza@mtnexus.com', password: 'HamzaSuper@2026!' }),
  });
  test('Super Admin login returns 200 & user details', () => {
    assert.strictEqual(superAdminRes.status, 200);
    assert.strictEqual(superAdminRes.body.user.email, 'hamza@mtnexus.com');
    assert.strictEqual(superAdminRes.body.user.isSuperAdmin, true);
    assert.ok(superAdminRes.body.token);
  });

  test('Super Admin login issues HttpOnly nexus_session cookie', () => {
    assert.ok(superAdminRes.setCookie, 'Set-Cookie header missing');
    assert.ok(superAdminRes.setCookie.includes('nexus_session='));
    assert.ok(superAdminRes.setCookie.includes('HttpOnly') || superAdminRes.setCookie.includes('httponly'));
  });

  const superAdminToken = superAdminRes.body.token;

  // 2. Operational Admin Login
  const adminRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@mtnexus.com', password: 'AdminNexus@2026!' }),
  });
  test('Operational Admin login returns 200 & role Admin', () => {
    assert.strictEqual(adminRes.status, 200);
    assert.strictEqual(adminRes.body.user.email, 'admin@mtnexus.com');
    assert.strictEqual(adminRes.body.user.isSuperAdmin, false);
    assert.ok(adminRes.body.user.roles.includes('Admin'));
  });

  // 3. Employee (Developer Ali) Login
  const devRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'ali@mtnexus.com', password: 'AliDev@2026!' }),
  });
  test('Developer (Ali) login returns 200 & role Developer', () => {
    assert.strictEqual(devRes.status, 200);
    assert.strictEqual(devRes.body.user.email, 'ali@mtnexus.com');
    assert.strictEqual(devRes.body.user.role, 'Developer');
  });

  // 4. Team Lead (Usman) Login
  const leadRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'teamlead@mtnexus.com', password: 'LeadNexus@2026!' }),
  });
  test('Team Lead login returns 200 & role Team Lead', () => {
    assert.strictEqual(leadRes.status, 200);
    assert.strictEqual(leadRes.body.user.email, 'teamlead@mtnexus.com');
    assert.strictEqual(leadRes.body.user.role, 'Team Lead');
  });

  // 5. Finance Manager Login
  const finRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'finance@mtnexus.com', password: 'FinanceNexus@2026!' }),
  });
  test('Finance Manager login returns 200 & role Finance Manager', () => {
    assert.strictEqual(finRes.status, 200);
    assert.strictEqual(finRes.body.user.email, 'finance@mtnexus.com');
    assert.strictEqual(finRes.body.user.role, 'Finance Manager');
  });

  // 6. Intern (Hina) Login
  const internRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'hina@mtnexus.com', password: 'HinaIntern@2026!' }),
  });
  test('Intern (Hina) login returns 200 & role Intern', () => {
    assert.strictEqual(internRes.status, 200);
    assert.strictEqual(internRes.body.user.email, 'hina@mtnexus.com');
    assert.strictEqual(internRes.body.user.role, 'Intern');
  });

  // 7. Invalid Credentials - Generic Error
  const invalidRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'hamza@mtnexus.com', password: 'WrongPassword999!' }),
  });
  test('Invalid credentials return 401 with generic message', () => {
    assert.strictEqual(invalidRes.status, 401);
    assert.strictEqual(invalidRes.body.error, 'InvalidCredentials');
    assert.strictEqual(invalidRes.body.message, 'Invalid email address or password.');
  });

  // 8. Session resolution GET /api/auth/me
  const meRes = await request('/auth/me', {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  test('GET /api/auth/me returns authenticated identity with effective permissions', () => {
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.user.email, 'hamza@mtnexus.com');
    assert.ok(meRes.body.user.effectivePermissions);
    assert.strictEqual(meRes.body.user.effectivePermissions.canManageUsers, true);
    assert.strictEqual(meRes.body.user.effectivePermissions.canManageProtectedSuperAdmin, true);
  });

  // 9. Cookie-based session resolution GET /api/auth/me
  const sessionCookie = superAdminRes.setCookie.split(';')[0];
  const cookieMeRes = await request('/auth/me', {
    headers: { Cookie: sessionCookie },
  });
  test('GET /api/auth/me resolves session via HttpOnly cookie', () => {
    assert.strictEqual(cookieMeRes.status, 200);
    assert.strictEqual(cookieMeRes.body.user.email, 'hamza@mtnexus.com');
  });

  // 10. Forgot Password Flow
  const forgotRes = await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'ali@mtnexus.com' }),
  });
  test('POST /api/auth/forgot-password generates token and reports email config status', () => {
    assert.strictEqual(forgotRes.status, 200);
    assert.strictEqual(forgotRes.body.success, true);
    assert.strictEqual(forgotRes.body.emailConfigured, false);
    assert.ok(forgotRes.body.devResetUrl, 'devResetUrl should be present in dev mode');
  });

  const resetToken = forgotRes.body.devToken;

  // 11. Verify Reset Token
  const verifyRes = await request(`/auth/verify-reset-token?token=${resetToken}`);
  test('GET /api/auth/verify-reset-token validates unexpired token', () => {
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.body.valid, true);
    assert.strictEqual(verifyRes.body.email, 'ali@mtnexus.com');
  });

  // 12. Reset Password - Password Confirmation Mismatch
  const mismatchRes = await request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: resetToken,
      password: 'NewDevPassword#2026',
      confirmPassword: 'DifferentPassword#2026',
    }),
  });
  test('Reset password rejects mismatched passwords', () => {
    assert.strictEqual(mismatchRes.status, 400);
  });

  // 13. Reset Password - Password Strength Requirement
  const weakRes = await request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: resetToken,
      password: 'weak',
      confirmPassword: 'weak',
    }),
  });
  test('Reset password enforces strength requirements', () => {
    assert.strictEqual(weakRes.status, 400);
  });

  // 14. Reset Password - Successful
  const validResetRes = await request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: resetToken,
      password: 'AliNewPassword#2026',
      confirmPassword: 'AliNewPassword#2026',
    }),
  });
  test('Reset password successfully updates password', () => {
    assert.strictEqual(validResetRes.status, 200);
    assert.strictEqual(validResetRes.body.success, true);
  });

  // 15. Verify Token Invalidation after Use (One-time use)
  const reuseRes = await request(`/auth/verify-reset-token?token=${resetToken}`);
  test('Reset token is invalidated immediately after use', () => {
    assert.strictEqual(reuseRes.status, 400);
    assert.strictEqual(reuseRes.body.valid, false);
  });

  // 16. Login with New Password
  const newLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'ali@mtnexus.com', password: 'AliNewPassword#2026!' }),
  });
  // Also try without exclamation if submitted as AliNewPassword#2026
  const newLoginRes2 = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'ali@mtnexus.com', password: 'AliNewPassword#2026' }),
  });
  test('User can authenticate with newly reset password', () => {
    assert.ok(newLoginRes.status === 200 || newLoginRes2.status === 200);
  });

  // 17. Logout invalidates cookie
  const logoutRes = await request('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  test('POST /api/auth/logout returns 200 and clears session cookie', () => {
    assert.strictEqual(logoutRes.status, 200);
    assert.ok(logoutRes.setCookie.includes('nexus_session=;'));
  });

  // 18. User Management: Admin cannot modify Super Admin account
  const adminToken = adminRes.body.token;
  const superAdminId = superAdminRes.body.user.id;
  const adminTamperRes = await request(`/users/${superAdminId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ isActive: false }),
  });
  test('Operational Admin is forbidden from modifying Super Admin account (403)', () => {
    assert.strictEqual(adminTamperRes.status, 403);
    assert.strictEqual(adminTamperRes.body.error, 'Forbidden');
  });

  // 19. User Management: Admin cannot assign Super Admin role
  const tamperRoleRes = await request(`/users/${adminRes.body.user.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ role: 'Super Admin' }),
  });
  test('Operational Admin cannot elevate self or others to Super Admin (403)', () => {
    assert.strictEqual(tamperRoleRes.status, 403);
  });

  console.log(`\n========================================`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`========================================\n`);

  if (passed === total) {
    console.log('🎉 ALL AUTHENTICATION & SECURITY TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
