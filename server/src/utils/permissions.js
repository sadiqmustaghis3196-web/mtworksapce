const MODULE_DEFINITIONS = {
  dash: "Dashboard",
  boards: "Project Boards",
  clientops: "Clients",
  hiring: "Hiring",
  people: "Employees",
  attendance: "Attendance",
  interns: "Internships",
  finance: "Finance",
  creative: "Creative Studio",
  sales: "CRM",
  support: "Support",
  depts: "Departments",
  access: "Administration",
};
const MODULE_PERMISSIONS = {
  dash: ["dashboard.read"],
  boards: ["tasks.read", "projects.read"],
  clientops: ["clients.read"],
  hiring: ["hiring.manage"],
  people: ["employees.read"],
  attendance: ["attendance.read"],
  interns: ["internships.read"],
  finance: ["finance.read"],
  creative: ["creative.read"],
  sales: ["crm.manage"],
  support: ["tickets.manage"],
  depts: ["departments.read"],
  access: ["users.read", "roles.manage"],
};
function calculateEffectivePermissions(user) {
  const permissions = user.permissions || [];
  const has = (p) => user.isSuperAdmin || permissions.includes(p);
  return {
    permissions,
    allowedModules: Object.keys(MODULE_DEFINITIONS).filter(
      (m) => user.isSuperAdmin || MODULE_PERMISSIONS[m].some(has),
    ),
    canManageUsers: has("users.create"),
    canManageProtectedSuperAdmin: !!user.isSuperAdmin,
    canManageRoles: has("roles.manage"),
    canManageFinance: has("finance.manage"),
    canManageHR: has("employees.manage"),
    canManageTasks: has("tasks.approve") || has("tasks.reject"),
    canCreateTasks: has("tasks.create"),
    canDeleteTasks: has("tasks.delete"),
  };
}
module.exports = { MODULE_DEFINITIONS, calculateEffectivePermissions };
