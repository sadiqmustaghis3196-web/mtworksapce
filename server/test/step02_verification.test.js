/**
 * MT Nexus Global ERP — STEP 02 Verification & Security Test Suite
 * Fully automated verification of:
 * - Super Admin login
 * - Admin login
 * - Employee login
 * - Invalid password rejection
 * - Inactive account rejection
 * - Session persistence with HttpOnly cookie (GET /api/auth/me)
 * - Logout and server-side session revocation
 * - Unauthorized route rejection (RBAC enforcement)
 * - CSRF defense enforcement
 * - Credential protection and vault exclusion
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://127.0.0.1:5000';

function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const reqHeaders = {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:8000',
      ...headers,
    };

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch (e) {
            data = raw;
          }

          // Extract Set-Cookie header if present
          const setCookie = res.headers['set-cookie'];
          let cookieHeader = null;
          if (setCookie) {
            cookieHeader = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
          }

          resolve({
            status: res.statusCode,
            headers: res.headers,
            cookie: cookieHeader,
            data,
          });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function extractSessionCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/nexus_session=([^;]+)/);
  return match ? `nexus_session=${match[1]}` : null;
}

async function runStep02Verification() {
  console.log('===========================================================');
  console.log('🧪 MT NEXUS GLOBAL — STEP 02 AUTOMATED VERIFICATION SUITE');
  console.log('===========================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.data.status === 'healthy', 'Backend service and PostgreSQL database are healthy');

    // Load credentials safely from secure private vault
    const vaultPath = path.join(__dirname, '../../.secrets/AUTH_CREDENTIALS_REFERENCE_VAULT.md');
    let credentials = {};
    if (fs.existsSync(vaultPath)) {
      const content = fs.readFileSync(vaultPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes('| `') && line.includes('@mtnexus.com')) {
          const parts = line.split('|').map(p => p.trim());
          if (parts.length >= 6) {
            const emailMatch = parts[4].match(/`([^`]+)`/);
            const passMatch = parts[5].match(/`([^`]+)`/);
            if (emailMatch && passMatch) {
              credentials[emailMatch[1]] = passMatch[1];
            }
          }
        }
      }
    }

    const superAdminEmail = 'hamza@mtnexus.com';
    const adminEmail = 'admin@mtnexus.com';
    const employeeEmail = 'ali@mtnexus.com';

    const superAdminPass = credentials[superAdminEmail] || 'HamzaSuper@2026!';
    const adminPass = credentials[adminEmail] || 'AdminNexus@2026!';
    const employeePass = credentials[employeeEmail] || 'AliDev@2026!';

    // TEST 1: Super Admin Login
    console.log('\n[Test 1] Super Admin Login Verification');
    const saLogin = await request('POST', '/api/auth/login', {
      email: superAdminEmail,
      password: superAdminPass,
    });
    assert(saLogin.status === 200, 'Super Admin login returned HTTP 200');
    assert(saLogin.data.success === true, 'Super Admin login returned success: true');
    assert(saLogin.data.user.isSuperAdmin === true, 'Super Admin flag isSuperAdmin === true');
    assert(saLogin.data.user.role === 'Super Admin' || saLogin.data.user.roles.includes('Super Admin'), 'Super Admin role verified');
    assert(Boolean(saLogin.cookie && saLogin.cookie.includes('nexus_session')), 'HttpOnly session cookie issued on login');

    const saCookie = extractSessionCookie(saLogin.cookie);

    // TEST 2: Admin Login
    console.log('\n[Test 2] Admin Login Verification');
    const admLogin = await request('POST', '/api/auth/login', {
      email: adminEmail,
      password: adminPass,
    });
    assert(admLogin.status === 200, 'Admin login returned HTTP 200');
    assert(admLogin.data.success === true, 'Admin login returned success: true');
    assert(admLogin.data.user.isSuperAdmin === false, 'Admin is not super admin (RBAC tier enforced)');
    assert(admLogin.data.user.name === 'System Administrator', 'Admin profile displays System Administrator');

    // TEST 3: Employee Login
    console.log('\n[Test 3] Employee Login Verification');
    const empLogin = await request('POST', '/api/auth/login', {
      email: employeeEmail,
      password: employeePass,
    });
    assert(empLogin.status === 200, 'Employee login returned HTTP 200');
    assert(empLogin.data.success === true, 'Employee login returned success: true');
    assert(empLogin.data.user.name === 'Ali', 'Employee profile displays individual name "Ali"');
    assert(empLogin.data.user.role === 'Developer', 'Employee role verified as Developer');

    const empCookie = extractSessionCookie(empLogin.cookie);

    // TEST 4: Invalid Password Rejection
    console.log('\n[Test 4] Invalid Password Rejection');
    const badLogin = await request('POST', '/api/auth/login', {
      email: superAdminEmail,
      password: 'DefectiveWrongPassword!999',
    });
    assert(badLogin.status === 401, 'Invalid password rejected with HTTP 401');
    assert(badLogin.data.error === 'InvalidCredentials', 'Descriptive error code "InvalidCredentials" returned');

    // TEST 5: Inactive Account Rejection
    console.log('\n[Test 5] Inactive Account Rejection');
    const inactiveEmail = `inactive_test_${Date.now()}@mtnexus.com`;
    const hashedPass = await bcrypt.hash('TempInactive@2026!', 10);
    const org = await prisma.organization.findFirst();
    const inactiveUser = await prisma.user.create({
      data: {
        organizationId: org ? org.id : undefined,
        email: inactiveEmail,
        passwordHash: hashedPass,
        isActive: false,
      },
    });

    const inactiveLogin = await request('POST', '/api/auth/login', {
      email: inactiveEmail,
      password: 'TempInactive@2026!',
    });
    assert(inactiveLogin.status === 403, 'Inactive account login rejected with HTTP 403');
    assert(inactiveLogin.data.error === 'AccountDeactivated', 'Descriptive error code "AccountDeactivated" returned');

    // Clean up inactive test user
    await prisma.user.delete({ where: { id: inactiveUser.id } });

    // TEST 6: Session Persistence (GET /api/auth/me)
    console.log('\n[Test 6] Session Persistence via HttpOnly Cookie (GET /api/auth/me)');
    const meRes = await request('GET', '/api/auth/me', null, {
      'Cookie': saCookie,
    });
    assert(meRes.status === 200, 'GET /api/auth/me returned HTTP 200 with valid session cookie');
    assert(meRes.data.user.email === superAdminEmail, 'Session verified identity matches Super Admin email');
    assert(meRes.data.user.isSuperAdmin === true, 'Session verified Super Admin privileges intact');

    // TEST 7: Logout and Server-Side Session Revocation
    console.log('\n[Test 7] Logout and Server-Side Session Revocation');
    const logoutRes = await request('POST', '/api/auth/logout', {}, {
      'Cookie': saCookie,
    });
    assert(logoutRes.status === 200, 'POST /api/auth/logout returned HTTP 200');
    assert(logoutRes.cookie && logoutRes.cookie.includes('nexus_session=;'), 'Session cookie cleared in browser response');

    // Verify server-side revocation: attempt to reuse the previous cookie/token
    const postLogoutMe = await request('GET', '/api/auth/me', null, {
      'Cookie': saCookie,
    });
    assert(postLogoutMe.status === 401, 'Reused session cookie correctly rejected with HTTP 401 after logout');
    assert(postLogoutMe.data.error === 'SessionRevoked', 'Error explicitly identifies server-side session revocation ("SessionRevoked")');

    // TEST 8: Unauthorized Route Rejection (RBAC Enforcement)
    console.log('\n[Test 8] Unauthorized Route Rejection');
    const unauthRes = await request('PATCH', `/api/users/${inactiveUser.id}`, { isActive: false }, {
      'Cookie': empCookie,
    });
    assert(unauthRes.status === 403, 'Employee modification of user roles/status rejected with HTTP 403 Forbidden');

    // TEST 9: CSRF Defense Verification
    console.log('\n[Test 9] CSRF Protection Verification');
    const evilCsrf = await request('POST', '/api/auth/logout', {}, {
      'Cookie': empCookie,
      'Origin': 'http://malicious-attacker-site.com',
    });
    assert(evilCsrf.status === 403, 'Cross-site state-changing request from untrusted origin rejected with HTTP 403');
    assert(evilCsrf.data.error === 'CorsForbidden' || evilCsrf.data.error === 'CsrfForbidden', 'Error code identifies cross-origin rejection ("CorsForbidden" or "CsrfForbidden")');

    // TEST 10: Credentials Reference Protection
    console.log('\n[Test 10] Credential File Exposure Prevention');
    const refPath = path.join(__dirname, '../../docs/AUTH_CREDENTIALS_REFERENCE.md');
    const refContent = fs.readFileSync(refPath, 'utf8');
    assert(!refContent.includes('HamzaSuper@2026!'), 'Plaintext Super Admin password successfully redacted from public documentation');
    assert(!refContent.includes('AdminNexus@2026!'), 'Plaintext Admin password successfully redacted from public documentation');
    assert(refContent.includes('[HASHED & PROTECTED]'), 'Document displays [HASHED & PROTECTED] status indicators');

    const gitignorePath = path.join(__dirname, '../../.gitignore');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    assert(gitignoreContent.includes('.secrets/'), '.secrets/ directory excluded from git tracking in .gitignore');
    assert(gitignoreContent.includes('docs/AUTH_CREDENTIALS_REFERENCE.md'), 'docs/AUTH_CREDENTIALS_REFERENCE.md excluded from git tracking in .gitignore');

    console.log('\n===========================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected error in test execution:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runStep02Verification();
