// Operator/build command only. There is deliberately no public setup endpoint.
require("dotenv").config();
async function main() {
  const optional = process.argv.includes("--if-needed");
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (optional && !email && !password) {
    console.log(
      "Initial admin provisioning skipped: no provisioning variables configured.",
    );
    return;
  }
  const { PrismaClient } = require("@prisma/client");
  const { provisionAdmin } = require("../src/services/provisionAdmin");
  const prisma = new PrismaClient();
  try {
    const result = await provisionAdmin(prisma, { email, password });
    console.log(
      result.created
        ? "Initial Super Admin created. Remove INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD from deployment settings."
        : "An initial Super Admin already exists. No accounts or passwords changed.",
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  const safeMessages = {
    INVALID_PROVISIONING_INPUT: error.message,
    PROVISIONING_EMAIL_EXISTS: error.message,
    P2021:
      "Database tables are missing. Apply the reviewed schema migration before provisioning.",
    P2022:
      "Database schema is out of date. Apply the reviewed migrations before provisioning.",
    P1000:
      "Database authentication failed. Check DATABASE_URL securely in deployment settings.",
    P1001:
      "Database is unreachable. Check the hosted DATABASE_URL and database network access.",
  };
  console.error(
    safeMessages[error.code] ||
      "Admin provisioning failed. Check database connectivity, schema and provisioning settings. No credential values were logged.",
  );
  process.exitCode = 1;
});
