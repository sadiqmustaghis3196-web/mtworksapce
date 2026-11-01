/** Real PostgreSQL integration checks. Use a disposable development DB only. */
require("dotenv").config();
const assert = require("node:assert/strict");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const app = require("../src/app");
const suffix = crypto.randomUUID(),
  password = `Nexus!${crypto.randomBytes(18).toString("hex")}Aa1`;
let server,
  base,
  org,
  otherOrg,
  role,
  project,
  cookie,
  outsiderCookie,
  passed = 0;
async function request(
  path,
  { method = "GET", body, cookie: session = cookie } = {},
) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Origin: "http://localhost:8000",
      ...(session ? { Cookie: session } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers
      .getSetCookie()
      .find((c) => c.startsWith("nexus_session=")),
  };
}
function check(condition, label) {
  assert.ok(condition, label);
  passed++;
  console.log(`PASS ${label}`);
}
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Integration suite refuses production mode.");
  await prisma.$queryRaw`SELECT 1`;
  org = await prisma.organization.create({
    data: { code: `qa-${suffix}`, name: "Rebuild integration QA" },
  });
  otherOrg = await prisma.organization.create({
    data: { code: `outside-${suffix}`, name: "Isolation QA" },
  });
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `qa-${suffix}@example.test`,
      passwordHash,
      isSuperAdmin: true,
    },
  });
  role = await prisma.role.create({
    data: { name: `QA-READER-${suffix}`, tier: "OTHER" },
  });
  const permission = await prisma.permission.upsert({
    where: { module_action: { module: "tasks", action: "read" } },
    update: {},
    create: { module: "tasks", action: "read" },
  });
  await prisma.rolePermission.create({
    data: { roleId: role.id, permissionId: permission.id },
  });
  await prisma.user.create({
    data: {
      organizationId: otherOrg.id,
      email: `outside-${suffix}@example.test`,
      passwordHash,
      userRoles: { create: { roleId: role.id } },
    },
  });
  project = await prisma.project.create({
    data: {
      id: `qa-project-${suffix}`,
      organizationId: org.id,
      name: "Integration project",
      category: "Web App",
    },
  });
  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  let result = await request("/auth/me");
  check(result.status === 401, "anonymous session denied");
  result = await request("/auth/login", {
    method: "POST",
    body: { email: `qa-${suffix}@example.test`, password: "invalid" },
  });
  check(result.status === 401, "invalid password rejected");
  result = await request("/auth/login", {
    method: "POST",
    body: { email: `qa-${suffix}@example.test`, password },
  });
  check(
    result.status === 200 &&
      result.cookie?.includes("HttpOnly") &&
      !result.body.token,
    "login uses HttpOnly opaque session and no JSON bearer token",
  );
  cookie = result.cookie.split(";")[0];
  check(
    (await prisma.session.count({ where: { userId: result.body.user.id } })) ===
      1,
    "session stored in PostgreSQL",
  );
  result = await request("/tasks", {
    method: "POST",
    body: { title: "Real integration task", projectId: project.id },
  });
  check(result.status === 201, "task persisted");
  const id = result.body.data.id;
  result = await request(`/tasks/${id}`, {
    method: "PATCH",
    body: { stage: 4 },
  });
  check(result.status === 400, "PATCH cannot bypass stage gate");
  for (const targetStage of [1, 2, 3, 4]) {
    result = await request(`/tasks/${id}/transition`, {
      method: "POST",
      body: { targetStage },
    });
    check(
      result.status === 200 && result.body.data.stage === targetStage,
      `transition to stage ${targetStage} persists`,
    );
  }
  const record = await prisma.task.findUnique({
    where: { id },
    include: { activities: true },
  });
  check(
    record.stage === 4 &&
      record.progress === 100 &&
      !record.deletedAt &&
      record.activities.length === 4,
    "approval retains task and atomic transition history",
  );
  result = await request("/auth/login", {
    method: "POST",
    cookie: "",
    body: { email: `outside-${suffix}@example.test`, password },
  });
  check(result.status === 200, "second organization user logs in");
  outsiderCookie = result.cookie.split(";")[0];
  result = await request(`/tasks/${id}`, { cookie: outsiderCookie });
  check(result.status === 404, "other organization cannot read task");
  result = await request("/tasks?search=Real", { cookie: outsiderCookie });
  check(
    result.status === 200 && result.body.data.length === 0,
    "search retains organization scope",
  );
  result = await request("/auth/logout", { method: "POST", body: {} });
  check(result.status === 200, "logout succeeds");
  result = await request("/auth/me");
  check(result.status === 401, "revoked cookie cannot be replayed");
  console.log(`${passed} real database checks passed.`);
}
async function cleanup() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (project) {
    await prisma.task.deleteMany({ where: { projectId: project.id } });
    await prisma.project.deleteMany({ where: { id: project.id } });
  }
  for (const o of [org, otherOrg])
    if (o) {
      await prisma.auditLog.deleteMany({
        where: { user: { organizationId: o.id } },
      });
      await prisma.user.deleteMany({ where: { organizationId: o.id } });
      await prisma.organization.deleteMany({ where: { id: o.id } });
    }
  if (role) await prisma.role.deleteMany({ where: { id: role.id } });
  await prisma.$disconnect();
}
main()
  .catch((e) => {
    console.error("Integration checks failed:", e.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
