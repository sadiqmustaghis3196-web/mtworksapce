const { test } = require("node:test");
const assert = require("node:assert/strict");
const { provisionAdmin } = require("../../src/services/provisionAdmin");
function fixture({ existingAdmin = false, existingEmail = false } = {}) {
  const calls = [];
  const tx = {
    $queryRaw: async () => {
      calls.push("lock");
    },
    user: {
      count: async () => {
        calls.push("count");
        return existingAdmin ? 1 : 0;
      },
      findUnique: async () => (existingEmail ? { id: "existing" } : null),
      create: async (args) => {
        calls.push(args.data);
      },
    },
    organization: { upsert: async () => ({ id: "org" }) },
    role: { upsert: async () => ({ id: "role" }) },
  };
  return { prisma: { $transaction: async (run) => run(tx) }, calls };
}
const credentials = {
  email: "Test.Admin@example.test",
  password: "UnitTestOnly!1234",
};
test("first admin creation normalizes email and stores only the password hash", async () => {
  const f = fixture();
  const result = await provisionAdmin(f.prisma, credentials, {
    hashPassword: async () => "$test-hash",
  });
  assert.equal(result.created, true);
  assert.deepEqual(f.calls.slice(0, 2), ["lock", "count"]);
  const record = f.calls[2];
  assert.equal(record.email, "test.admin@example.test");
  assert.equal(record.passwordHash, "$test-hash");
  assert.equal(record.isSuperAdmin, true);
  assert.equal(record.password, undefined);
});
test("redeploy never resets an existing admin or creates another", async () => {
  const f = fixture({ existingAdmin: true });
  assert.equal(
    (
      await provisionAdmin(f.prisma, credentials, {
        hashPassword: () => {
          throw new Error("Must not hash on repeat");
        },
      })
    ).created,
    false,
  );
  assert.deepEqual(f.calls, ["lock", "count"]);
});
test("an existing non-admin email is never promoted or overwritten", async () => {
  const f = fixture({ existingEmail: true });
  await assert.rejects(provisionAdmin(f.prisma, credentials), {
    code: "PROVISIONING_EMAIL_EXISTS",
  });
  assert.deepEqual(f.calls, ["lock", "count"]);
});
test("incomplete or weak credentials fail before touching the database", async () => {
  for (const input of [
    {},
    { email: "not-an-email", password: credentials.password },
    { email: credentials.email, password: "weak" },
  ]) {
    const f = fixture();
    await assert.rejects(provisionAdmin(f.prisma, input), {
      code: "INVALID_PROVISIONING_INPUT",
    });
    assert.deepEqual(f.calls, []);
  }
});
