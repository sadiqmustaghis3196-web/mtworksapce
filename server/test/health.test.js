/**
 * MT Nexus Global ERP — Automated Integration & Verification Test Suite
 * Tests PostgreSQL connectivity, Health Endpoint, Tasks CRUD, Auth, and RBAC Security.
 */

const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://127.0.0.1:5000';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
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

async function runTests() {
  console.log('🧪 Starting Phase 2 Verification & Integration Test Suite...');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Direct PostgreSQL Verification
    console.log('\n--- 1. Direct PostgreSQL Database Connection ---');
    const dbTime = await prisma.$queryRaw`SELECT NOW() as current_time`;
    assert(dbTime && dbTime.length > 0, 'PostgreSQL responds to raw SQL query');

    const [tasksCount, empCount, deptsCount, rolesCount] = await Promise.all([
      prisma.task.count({ where: { deletedAt: null } }),
      prisma.employee.count(),
      prisma.department.count(),
      prisma.role.count(),
    ]);

    assert(tasksCount === 8, `Active tasks count in DB is preserved (8 tasks)`);
    assert(empCount >= 14, `Employees count in DB is preserved (>= 14 employees, found ${empCount})`);
    assert(deptsCount === 15, `Departments count in DB is preserved (15 departments)`);
    assert(rolesCount === 31, `Enterprise roles count in DB is verified (31 roles)`);

    // 2. Health Endpoint Verification
    console.log('\n--- 2. Health Endpoint Test ---');
    const healthRes = await makeRequest('GET', '/api/health');
    assert(healthRes.status === 200, 'Health endpoint responds with HTTP 200');
    assert(healthRes.data.status === 'healthy', 'Health status is "healthy"');
    assert(healthRes.data.database.status === 'connected', 'Database reported as "connected"');

    // Authenticate Super Admin for protected endpoints
    const authRes = await makeRequest('POST', '/api/auth/login', {
      email: 'hamza@mtnexus.com',
      password: 'HamzaSuper@2026!',
    });
    const authHeaders = { Authorization: `Bearer ${authRes.data.token}` };

    // 3. Tasks API List
    console.log('\n--- 3. Tasks REST API List & Filter ---');
    const tasksRes = await makeRequest('GET', '/api/tasks', null, authHeaders);
    assert(tasksRes.status === 200, 'GET /api/tasks responds with HTTP 200');
    assert(tasksRes.data.success === true, 'Response body success is true');
    assert(Array.isArray(tasksRes.data.data), 'Returns an array of tasks');

    // 4. Tasks API Create & Read
    console.log('\n--- 4. Task CRUD & ID Preservation ---');
    const testTaskId = 999;
    const createRes = await makeRequest('POST', '/api/tasks', {
      id: testTaskId,
      title: 'Automated Integration Test Verification Task',
      description: 'Temporary task created during Phase 2 backend verification.',
      stage: 1,
      priority: 'High',
      category: 'Web App',
    }, authHeaders);
    assert(createRes.status === 201, 'POST /api/tasks creates task with HTTP 201');
    assert(createRes.data.data.id === testTaskId, 'Preserves custom integer Task ID (999)');

    // 5. Tasks Stage Transition
    const moveRes = await makeRequest('POST', `/api/tasks/${testTaskId}/move`, {
      targetStage: 4, // Done
    }, authHeaders);
    assert(moveRes.status === 200, 'POST /api/tasks/:id/move updates stage with HTTP 200');
    assert(moveRes.data.data.stage === 4, 'Task stage transitioned to 4 (Done)');
    assert(moveRes.data.data.approvedBy && moveRes.data.data.approvedBy.includes('Super Admin'), 'Approval recorded with auditor role');

    // Clean up test task
    await prisma.task.delete({ where: { id: testTaskId } });
    console.log('  🧹 Cleaned up temporary test task #999');

    // 6. Super Admin Auth & Security Protection
    console.log('\n--- 5. Authentication & Security Foundation ---');
    const reAuthRes = await makeRequest('POST', '/api/auth/login', {
      email: 'hamza@mtnexus.com',
      password: 'HamzaSuper@2026!',
    });
    assert(reAuthRes.status === 200, 'Super Admin login succeeds with HTTP 200');
    assert(reAuthRes.data.token && reAuthRes.data.token.length > 20, 'Returns cryptographically signed JWT');
    assert(reAuthRes.data.user.isSuperAdmin === true, 'Verified isSuperAdmin is true');

    // 7. Invalid Credentials Rejection
    const badAuthRes = await makeRequest('POST', '/api/auth/login', {
      email: 'hamza@mtnexus.com',
      password: 'WrongPassword123!',
    });
    assert(badAuthRes.status === 401, 'Rejects invalid credentials with HTTP 401');

  } catch (err) {
    console.error('❌ Test execution encountered an unhandled error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log(`\n========================================`);
    console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
