const bcrypt = require("bcryptjs");
const { z } = require("zod");
const schema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});
async function provisionAdmin(
  prisma,
  credentials,
  { hashPassword = (password) => bcrypt.hash(password, 12) } = {},
) {
  const parsed = schema.safeParse(credentials);
  if (!parsed.success)
    throw Object.assign(
      new Error(
        "Set a valid INITIAL_ADMIN_EMAIL and a 12–128 character INITIAL_ADMIN_PASSWORD with uppercase, lowercase and a number.",
      ),
      { code: "INVALID_PROVISIONING_INPUT" },
    );
  return prisma.$transaction(async (tx) => {
    // Serialize first-admin provisioning across simultaneous builds/operators.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(74312011)::text`;
    if (await tx.user.count({ where: { isSuperAdmin: true } }))
      return { created: false };
    if (await tx.user.findUnique({ where: { email: parsed.data.email } }))
      throw Object.assign(
        new Error(
          "This email already belongs to an account. No account was changed.",
        ),
        { code: "PROVISIONING_EMAIL_EXISTS" },
      );
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
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        isSuperAdmin: true,
        organizationId: org.id,
        userRoles: { create: { roleId: role.id } },
      },
    });
    return { created: true };
  });
}
module.exports = { provisionAdmin };
