/**
 * MT Nexus Global ERP — Phase 3 Step 2 Verification Test Suite
 * Comprehensive verification of Authentication, RBAC Hierarchy,
 * Super Admin Account Protection, Task CRUD, Stage Gates, Soft Delete/Restore & Audit Logs.
 */

const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://127.0.0.1:5000';

function request(method, path, body = null, headers = {}) {
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
        let raw = '';
        res.on('data', chunk => (raw += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            parsed = raw;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
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

async function runStep2TestSuite() {
  console.log('================================================================');
  console.log('🧪 MT NEXUS GLOBAL — PHASE 3 STEP 2 VERIFICATION TEST SUITE');
  console.log('================================================================\n');

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
    // -------------------------------------------------------------
    // TEST SUITE 1: UN-AUTHENTICATED REJECTION (SECURITY FIRST)
    // -------------------------------------------------------------
    console.log('--- SUITE 1: Unauthenticated Endpoint Rejection (401) ---');

    const unauthGetTasks = await request('GET', '/api/tasks');
    assert(unauthGetTasks.status === 401, 'GET /api/tasks without auth rejected with HTTP 401');

    const unauthPostTask = await request('POST', '/api/tasks', { title: 'Hack Task' });
    assert(unauthPostTask.status === 401, 'POST /api/tasks without auth rejected with HTTP 401');

    const unauthPatchTask = await request('PATCH', '/api/tasks/101', { title: 'Hack Title' });
    assert(unauthPatchTask.status === 401, 'PATCH /api/tasks/:id without auth rejected with HTTP 401');

    const unauthDeleteTask = await request('DELETE', '/api/tasks/101');
    assert(unauthDeleteTask.status === 401, 'DELETE /api/tasks/:id without auth rejected with HTTP 401');

    const unauthRestoreTask = await request('POST', '/api/tasks/101/restore');
    assert(unauthRestoreTask.status === 401, 'POST /api/tasks/:id/restore without auth rejected with HTTP 401');

    const unauthMoveTask = await request('POST', '/api/tasks/101/move', { targetStage: 4 });
    assert(unauthMoveTask.status === 401, 'POST /api/tasks/:id/move without auth rejected with HTTP 401');

    // -------------------------------------------------------------
    // TEST SUITE 2: AUTHENTICATION & SESSION COOKIES
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: Multi-Role Authentication & Session Tokens ---');

    // 1. Super Admin Login
    const superAdminLogin = await request('POST', '/api/auth/login', {
      email: 'hamza@mtnexus.com',
      password: 'HamzaSuper@2026!',
    });
    assert(superAdminLogin.status === 200, 'Super Admin login succeeds with HTTP 200');
    assert(superAdminLogin.body.user.isSuperAdmin === true, 'Super Admin user flag verified');
    const superAdminToken = superAdminLogin.body.token;
    const cookieHeader = superAdminLogin.headers['set-cookie'];
    assert(cookieHeader && cookieHeader.some(c => c.includes('nexus_session')), 'HttpOnly session cookie emitted');

    // 2. Operational Admin Login
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@mtnexus.com',
      password: 'AdminNexus@2026!',
    });
    assert(adminLogin.status === 200, 'Operational Admin login succeeds with HTTP 200');
    assert(adminLogin.body.user.roles.includes('Admin'), 'Admin role verified');
    assert(adminLogin.body.user.isSuperAdmin === false, 'Operational Admin is NOT Super Admin');
    const adminToken = adminLogin.body.token;

    // 3. Project Manager Login (Zain)
    const pmLogin = await request('POST', '/api/auth/login', {
      email: 'zain@mtnexus.com',
      password: 'ZainPM@2026!',
    });
    assert(pmLogin.status === 200, 'Project Manager login succeeds with HTTP 200');
    const pmToken = pmLogin.body.token;

    // 4. Employee Login (Ali - Developer assigned to Task 103)
    const empLogin = await request('POST', '/api/auth/login', {
      email: 'ali@mtnexus.com',
      password: 'AliDev@2026!',
    });
    assert(empLogin.status === 200, 'Employee login succeeds with HTTP 200');
    const empToken = empLogin.body.token;

    // -------------------------------------------------------------
    // TEST SUITE 3: RBAC AUTHORIZATION & BOUNDARIES
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: RBAC Privilege Enforcement & Account Protection ---');

    // 1. Employee cannot create tasks
    const empCreateTask = await request('POST', '/api/tasks', {
      title: 'Unauthorized Employee Task',
    }, { Authorization: `Bearer ${empToken}` });
    assert(empCreateTask.status === 403, 'Employee attempting to create task receives HTTP 403 Forbidden');

    // 2. Employee cannot delete tasks
    const empDeleteTask = await request('DELETE', '/api/tasks/103', null, {
      Authorization: `Bearer ${empToken}`,
    });
    assert(empDeleteTask.status === 403, 'Employee attempting to delete task receives HTTP 403 Forbidden');

    // 3. Employee cannot edit unassigned tasks (Task 102 belongs to Hina)
    const empEditUnassigned = await request('PATCH', '/api/tasks/102', {
      title: 'Ali hijacking Hina task',
    }, { Authorization: `Bearer ${empToken}` });
    assert(empEditUnassigned.status === 403, 'Employee modifying unassigned task receives HTTP 403 Forbidden');

    // 4. Employee CAN edit their assigned task (Task 103 belongs to Ali)
    const empEditAssigned = await request('PATCH', '/api/tasks/103', {
      estimatedHours: 18,
    }, { Authorization: `Bearer ${empToken}` });
    assert(empEditAssigned.status === 200, 'Employee updating assigned task receives HTTP 200 OK');

    // 5. Employee CANNOT approve tasks to Done stage (Stage 4)
    const empApproveTask = await request('POST', '/api/tasks/103/move', {
      targetStage: 4,
    }, { Authorization: `Bearer ${empToken}` });
    assert(empApproveTask.status === 403, 'Employee moving task to Stage 4 (Done) receives HTTP 403 Forbidden');

    // 6. Super Admin Protection: Operational Admin CANNOT modify or delete Super Admin account
    const superAdminRecord = await prisma.user.findUnique({ where: { email: 'hamza@mtnexus.com' } });
    const adminModifySuperAdmin = await request('PATCH', `/api/users/${superAdminRecord.id}`, {
      isActive: false,
    }, { Authorization: `Bearer ${adminToken}` });
    assert(adminModifySuperAdmin.status === 403, 'Operational Admin attempting to modify Super Admin account rejected with HTTP 403 Forbidden');

    // -------------------------------------------------------------
    // TEST SUITE 4: COMPLETE TASK CRUD & STAGE WORKFLOW
    // -------------------------------------------------------------
    console.log('\n--- SUITE 4: Complete Task Lifecycle, Soft Delete & Restore ---');

    const probeId = 77777;

    // 1. Create Task (by Project Manager)
    const pmCreate = await request('POST', '/api/tasks', {
      id: probeId,
      title: 'Sprint 14 Performance Benchmark',
      description: 'Isolate bottlenecks in database connection pool.',
      category: 'Web App',
      stage: 1, // Today To Do
      priority: 'High',
      estimatedHours: 10,
      tags: ['Benchmark', 'Ops'],
    }, { Authorization: `Bearer ${pmToken}` });
    assert(pmCreate.status === 201, 'PM creates task with HTTP 201 Created');
    assert(pmCreate.body.data.id === probeId, 'Preserves specific numeric ID (77777)');

    // 2. Stage Transition to In Progress (Stage 2)
    const moveToInProgress = await request('POST', `/api/tasks/${probeId}/move`, {
      targetStage: 2,
    }, { Authorization: `Bearer ${pmToken}` });
    assert(moveToInProgress.status === 200, 'Transition to Stage 2 (In Progress) succeeds');
    assert(moveToInProgress.body.data.stage === 2, 'Task stage is 2');

    // 3. Stage Transition to Done (Stage 4) by Super Admin
    const approveDone = await request('POST', `/api/tasks/${probeId}/move`, {
      targetStage: 4,
    }, { Authorization: `Bearer ${superAdminToken}` });
    assert(approveDone.status === 200, 'Super Admin approves task to Stage 4 (Done) with HTTP 200');
    assert(approveDone.body.data.stage === 4, 'Task stage is 4 (Done)');
    assert(approveDone.body.data.approvedBy.includes('Super Admin'), 'Approval stamped with Super Admin identity');

    // 4. Soft Delete by Operational Admin
    const adminSoftDelete = await request('DELETE', `/api/tasks/${probeId}`, null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminSoftDelete.status === 200, 'Operational Admin soft-deletes task with HTTP 200');

    // 5. Verify Soft Delete hides task from active listing
    const listAfterDelete = await request('GET', '/api/tasks', null, {
      Authorization: `Bearer ${superAdminToken}`,
    });
    const foundInList = listAfterDelete.body.data.some(t => t.id === probeId);
    assert(foundInList === false, 'Soft-deleted task is omitted from active GET /api/tasks');

    // Direct fetch returns 404
    const fetchDeleted = await request('GET', `/api/tasks/${probeId}`, null, {
      Authorization: `Bearer ${superAdminToken}`,
    });
    assert(fetchDeleted.status === 404, 'Direct fetch of soft-deleted task returns HTTP 404 Not Found');

    // 6. Restore by Operational Admin
    const adminRestore = await request('POST', `/api/tasks/${probeId}/restore`, null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminRestore.status === 200, 'Operational Admin restores task with HTTP 200 OK');

    // 7. Verify Task is visible again after restore
    const listAfterRestore = await request('GET', '/api/tasks', null, {
      Authorization: `Bearer ${superAdminToken}`,
    });
    const foundAfterRestore = listAfterRestore.body.data.some(t => t.id === probeId);
    assert(foundAfterRestore === true, 'Restored task reappears in GET /api/tasks');

    // Clean up probe 77777
    await prisma.task.delete({ where: { id: probeId } });
    console.log('  🧹 Cleaned up temporary test task #77777');

    // -------------------------------------------------------------
    // TEST SUITE 5: PERSISTENT AUDIT LOGS & BASELINE INTEGRITY
    // -------------------------------------------------------------
    console.log('\n--- SUITE 5: Persistent Audit Logs & Baseline Integrity ---');

    const recentAuditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    assert(recentAuditLogs.length > 0, 'AuditLog table contains recorded audit trail entries');

    const actionsRecorded = recentAuditLogs.map(a => a.action);
    assert(actionsRecorded.includes('TASK_CREATE'), 'AuditLog captured TASK_CREATE event');
    assert(actionsRecorded.includes('TASK_STAGE_CHANGE'), 'AuditLog captured TASK_STAGE_CHANGE event');
    assert(actionsRecorded.includes('TASK_DELETE'), 'AuditLog captured TASK_DELETE event');
    assert(actionsRecorded.includes('TASK_RESTORE'), 'AuditLog captured TASK_RESTORE event');

    // Verify Baseline 8 Tasks (101-108) remain completely untouched
    const baselineTasks = await prisma.task.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });
    assert(baselineTasks.length === 8, 'Exact baseline of 8 active tasks preserved');
    const taskIds = baselineTasks.map(t => t.id);
    assert(JSON.stringify(taskIds) === JSON.stringify([101, 102, 103, 104, 105, 106, 107, 108]), 'Preserved exact task IDs 101 through 108');

  } catch (err) {
    console.error('❌ Test execution error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log('\n================================================================');
    console.log(`📊 PHASE 3 STEP 2 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runStep2TestSuite();
