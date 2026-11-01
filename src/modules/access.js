import { permissionNames, modules, collectionPath } from "./catalog.js";
export const adminUser = (u) =>
  !!u &&
  (u.isSuperAdmin || u.primaryRole === "ADMIN" || u.primaryRole === "Admin");
export const can = (u, p) =>
  !!u &&
  (adminUser(u) ||
    u.permissions?.includes(p) ||
    u.permissions?.includes(p.split(".")[0] + ".manage"));
export const entityModule = (entity) =>
  Object.entries(modules).find(([, m]) =>
    m.tabs.some((t) => t[0] === entity),
  )?.[0] || entity;
export const moduleKey = (m) =>
  ({
    projects: "projects",
    admin: "users",
    internships: "internships",
    crm: "crm",
    support: "tickets",
    creative: "creative",
    hiring: "hiring",
    clients: "clients",
    employees: "employees",
    attendance: "attendance",
    finance: "finance",
    departments: "departments",
  })[m] || m;
export function moduleAllowed(u, m, action = "read") {
  return (
    can(u, `${moduleKey(m)}.${action}`) ||
    (m === "projects" && can(u, "tasks." + action))
  );
}
export function roleLevel(r) {
  return (
    r?.level ||
    (["SUPER_ADMIN", "ADMIN", "INTERN"].includes(r?.name) ? r.name : "EMPLOYEE")
  );
}
export function hydrateAccess(data) {
  const roles = data.records.roles;
  if (!roles.some((r) => r.id === "role-admin"))
    roles.push({
      id: "role-admin",
      name: "ADMIN",
      level: "ADMIN",
      description: "Manage daily operations and employee accounts",
      permissions: [...permissionNames],
    });
  if (!data.accessVersion) {
    const basic = [
      "tasks.read",
      "tasks.update",
      "tasks.submit_review",
      "employees.read",
      "attendance.read",
      "crm.read",
      "crm.create",
    ];
    const employee = roles.find((r) => r.id === "role-employee");
    if (employee)
      employee.permissions = [...new Set([...employee.permissions, ...basic])];
    if (!roles.some((r) => r.id === "role-intern"))
      roles.push({
        id: "role-intern",
        name: "INTERN",
        level: "INTERN",
        description: "Own tasks, profile, attendance and learning",
        permissions: [...basic, "internships.read"],
      });
    data.accessVersion = 1;
  }
  const root = roles.find((r) => r.id === "role-super");
  if (root) {
    root.level = "SUPER_ADMIN";
    root.permissions = [...new Set([...root.permissions, ...permissionNames])];
  }
  return data;
}
export function accountUser(data, id) {
  const a = data.records.users.find(
    (a) => a.id === id && a.status === "Active",
  );
  if (!a) return null;
  const r = data.records.roles.find((r) => r.id === a.roleId);
  if (!r) return null;
  const level = roleLevel(r),
    permissions = r.permissions || [];
  const shell = {
    projects: "boards",
    clients: "clientops",
    hiring: "hiring",
    employees: "people",
    attendance: "attendance",
    internships: "interns",
    finance: "finance",
    creative: "creative",
    crm: "sales",
    support: "support",
    departments: "depts",
    admin: "access",
  };
  const user = {
    ...a,
    primaryRole: level,
    role: r.name,
    isSuperAdmin: level === "SUPER_ADMIN",
    permissions,
    employeeId: a.employeeId,
    avatar: a.name
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2),
  };
  user.effectivePermissions = {
    allowedModules: [
      "dash",
      ...Object.keys(shell)
        .filter(
          (m) => moduleAllowed(user, m) || (m === "admin" && adminUser(user)),
        )
        .map((m) => shell[m]),
    ],
    canManageTasks: can(user, "tasks.approve"),
    canCreateTasks: can(user, "tasks.create"),
    canManageUsers: can(user, "users.create"),
  };
  return user;
}
export function requireAccess(user, permission) {
  if (!can(user, permission)) {
    const error = new Error(
      "Your role does not allow this action. Ask your administrator to update permissions.",
    );
    error.status = 403;
    throw error;
  }
}
export function protectAccountChange(data, user, entity, id, body, method) {
  if (method === "GET" || !["users", "roles"].includes(entity)) return;
  const current = data.records[entity].find((r) => r.id === id);
  if (entity === "roles") {
    if (!user.isSuperAdmin)
      throw new Error("Only Super Admin can manage role permissions.");
    if (
      current?.id === "role-super" &&
      (method === "DELETE" ||
        (body.name && body.name !== "SUPER_ADMIN") ||
        (body.level && body.level !== "SUPER_ADMIN"))
    )
      throw new Error("The Super Admin role must remain available.");
  } else {
    if (
      id === user.id &&
      (method === "DELETE" ||
        (body.roleId && body.roleId !== current.roleId) ||
        body.status === "Inactive")
    )
      throw new Error("You cannot remove your own access.");
    const target = data.records.roles.find(
      (r) => r.id === (body.roleId || current?.roleId),
    );
    if (
      !["SUPER_ADMIN", "ADMIN"].includes(roleLevel(target)) &&
      !(body.employeeId || current?.employeeId)
    )
      throw new Error("Link employee accounts to an employee profile first.");
    const old = data.records.roles.find((r) => r.id === current?.roleId);
    if (
      !user.isSuperAdmin &&
      [target, old].some((r) => ["SUPER_ADMIN", "ADMIN"].includes(roleLevel(r)))
    )
      throw new Error(
        "Only Super Admin can create or change administrator accounts.",
      );
  }
}
export function ownTask(user, task) {
  return (
    adminUser(user) ||
    task?.assignees?.some((a) => a.employee?.id === user.employeeId)
  );
}
export function ownData(data, user) {
  if (adminUser(user)) return data;
  const copy = structuredClone(data),
    id = user.employeeId;
  copy.archivedTasks = [];
  copy.referencePeople = data.records.employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    jobTitle: e.jobTitle,
    departmentId: e.departmentId,
  }));
  copy.tasks = can(user, "tasks.read")
    ? copy.tasks.filter((t) => ownTask(user, t) || can(user, "tasks.assign"))
    : [];
  if (!can(user, "projects.update")) {
    const projects = new Set(copy.tasks.map((t) => t.projectId));
    copy.projects = copy.projects.filter((p) => projects.has(p.id));
  }
  for (const [entity, rows] of Object.entries(copy.records)) {
    const m = entityModule(entity);
    if (m === "admin" && !can(user, "roles.manage")) {
      copy.records[entity] =
        entity === "roles"
          ? rows.filter((r) => r.id === user.roleId)
          : entity === "users"
            ? rows.filter((r) => r.id === user.id)
            : entity === "settings"
              ? rows
              : [];
      continue;
    }
    if (
      ["attendance", "leaves", "documents", "enrollments", "payroll"].includes(
        entity,
      ) &&
      !["manage", "update", "create", "delete"].some((action) =>
        moduleAllowed(user, m, action),
      )
    )
      copy.records[entity] = rows.filter((r) => r.employeeId === id);
    if (
      entity === "employees" &&
      !["manage", "update", "create", "delete"].some((a) =>
        can(user, "employees." + a),
      )
    )
      copy.records[entity] = rows.filter((r) => r.id === id);
    if (entity === "leads" && !can(user, "crm.manage"))
      copy.records[entity] = rows.filter((r) => r.ownerId === id);
    if (
      !moduleAllowed(user, m) &&
      !moduleAllowed(user, m, "create") &&
      !["employees", "departments", "notifications", "settings"].includes(
        entity,
      )
    )
      copy.records[entity] = [];
    if (entity === "departments" && !can(user, "departments.read"))
      copy.records[entity] = rows.filter(
        (r) =>
          r.id ===
          data.records.employees.find((e) => e.id === id)?.departmentId,
      );
    if (m === "finance" && !moduleAllowed(user, "finance"))
      copy.records[entity] = [];
  }
  return copy;
}
