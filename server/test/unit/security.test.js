const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateCsrf } = require("../../src/validators/csrf");
const { taskScope } = require("../../src/services/taskScope");
const trusted = ["http://localhost:8000"];
test("CSRF rejects deceptive prefix origins and cross-site requests", () => {
  for (const origin of [
    "http://localhost:8000.attacker.test",
    "http://localhost:80000",
    "https://evil.test",
  ])
    assert.equal(
      validateCsrf(
        { method: "POST", origin, requestedWith: "XMLHttpRequest" },
        trusted,
      ),
      false,
    );
  assert.equal(
    validateCsrf(
      {
        method: "POST",
        origin: trusted[0],
        fetchSite: "cross-site",
        requestedWith: "XMLHttpRequest",
      },
      trusted,
    ),
    false,
  );
});
test("CSRF requires a non-simple request header", () => {
  assert.equal(
    validateCsrf({ method: "POST", origin: trusted[0] }, trusted),
    false,
  );
  assert.equal(
    validateCsrf(
      { method: "POST", origin: trusted[0], requestedWith: "XMLHttpRequest" },
      trusted,
    ),
    true,
  );
});
test("task scope constrains both organization and membership for employees", () => {
  const scope = taskScope({
    organizationId: "org-a",
    employeeId: "employee-a",
    roles: ["Employee"],
  });
  assert.equal(scope.AND.length, 2);
  assert.equal(scope.AND[0].OR[0].project.organizationId, "org-a");
  assert.equal(scope.AND[1].OR[0].assignees.some.employeeId, "employee-a");
});
test("super admin scope still constrains organization", () => {
  const scope = taskScope({
    organizationId: "org-a",
    isSuperAdmin: true,
    roles: [],
  });
  assert.equal(scope.OR[0].project.organizationId, "org-a");
});
const {
  calculateEffectivePermissions,
} = require("../../src/utils/permissions");
test("role names alone do not grant module permissions", () => {
  const p = calculateEffectivePermissions({
    roles: ["ADMIN"],
    permissions: [],
  });
  assert.deepEqual(p.allowedModules, []);
  assert.equal(p.canManageTasks, false);
});
test("stored permissions distinguish task creation from review", () => {
  const p = calculateEffectivePermissions({
    permissions: ["tasks.read", "tasks.approve"],
  });
  assert.equal(p.canManageTasks, true);
  assert.equal(p.canCreateTasks, false);
  assert.ok(p.allowedModules.includes("boards"));
});
