/** Safe reference data only. No user accounts or embedded passwords. */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const worker = [
  "dashboard.read",
  "projects.read",
  "tasks.read",
  "tasks.update",
  "tasks.submit_review",
  "attendance.read",
  "internships.read",
];
const manager = [
  ...worker,
  "projects.create",
  "projects.update",
  "tasks.create",
  "tasks.assign",
  "tasks.approve",
  "tasks.reject",
  "employees.read",
  "departments.read",
];
const definitions = {
  SUPER_ADMIN: { tier: "EXECUTIVE", grants: [] },
  ADMIN: {
    tier: "MANAGEMENT",
    grants: [
      ...manager,
      "users.read",
      "users.create",
      "users.update",
      "users.deactivate",
      "departments.manage",
      "tasks.delete",
    ],
  },
  DEPARTMENT_MANAGER: { tier: "MANAGEMENT", grants: manager },
  PROJECT_MANAGER: { tier: "MANAGEMENT", grants: manager },
  TEAM_LEAD: {
    tier: "TECHNICAL",
    grants: [...worker, "tasks.approve", "tasks.reject", "tasks.assign"],
  },
  EMPLOYEE: { tier: "TECHNICAL", grants: worker },
  INTERN: { tier: "OTHER", grants: worker },
  HR_MANAGER: {
    tier: "HR",
    grants: [
      ...worker,
      "employees.read",
      "employees.manage",
      "hiring.manage",
      "leaves.approve",
      "attendance.manage",
    ],
  },
  FINANCE_MANAGER: {
    tier: "FINANCE",
    grants: [...worker, "finance.read", "finance.manage", "payroll.manage"],
  },
  SALES_MANAGER: {
    tier: "BUSINESS",
    grants: [...worker, "crm.manage", "clients.read"],
  },
  SUPPORT_AGENT: { tier: "OTHER", grants: [...worker, "tickets.manage"] },
  CLIENT_VIEWER: { tier: "OTHER", grants: ["projects.read", "tasks.read"] },
};
async function seed() {
  for (const [name, { tier, grants }] of Object.entries(definitions)) {
    await prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { name },
        update: { tier },
        create: { name, tier },
      });
      for (const grant of grants) {
        const [module, action] = grant.split(".");
        const permission = await tx.permission.upsert({
          where: { module_action: { module, action } },
          update: {},
          create: { module, action },
        });
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
            scope: "OWN",
          },
        });
      }
    });
  }
  console.log(
    "Reference roles and permissions seeded. No accounts or passwords created.",
  );
}
seed()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
