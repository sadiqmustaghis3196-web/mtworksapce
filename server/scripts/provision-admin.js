// Explicit operator command; never creates a public registration endpoint.
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();
async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (
    !email ||
    !password ||
    password.length < 12 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  )
    throw new Error(
      "Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD securely (12+ characters with uppercase, lowercase and number). Values are never logged.",
    );
  if (await prisma.user.count({ where: { isSuperAdmin: true } }))
    throw new Error("A Super Admin already exists. Provisioning refused.");
  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.upsert({
      where: { code: "MT-NEXUS-HQ" },
      update: {},
      create: { code: "MT-NEXUS-HQ", name: "MT Nexus Global" },
    });
    const role = await tx.role.upsert({
      where: { name: "SUPER_ADMIN" },
      update: {},
      create: { name: "SUPER_ADMIN", tier: "EXECUTIVE" },
    });
    await tx.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        isSuperAdmin: true,
        organizationId: org.id,
        userRoles: { create: { roleId: role.id } },
      },
    });
  });
  console.log("Super Admin provisioned. No credentials were written to disk.");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
