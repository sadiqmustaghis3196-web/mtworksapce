/**
 * MT Nexus Global ERP — Server-Side Authentication & RBAC Middleware
 * Enforces opaque HttpOnly cookie sessions,
 * database-backed sessions and protected Super Admin boundaries.
 */

const crypto = require("crypto");
const config = require("../config");
const prisma = require("../db/prisma");

const { calculateEffectivePermissions } = require("../utils/permissions");

async function authenticate(req, res, next) {
  let token = null;

  // 1. Check Bearer Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // 2. Fallback to HttpOnly session cookie
  if (!token && req.cookies && req.cookies.nexus_session) {
    token = req.cookies.nexus_session;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message:
        "Access denied. Valid authentication token or session cookie required.",
    });
  }

  try {
    const session = await prisma.session.findUnique({
      where: {
        tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      },
    });
    if (!session || session.expiresAt <= new Date())
      return res
        .status(401)
        .json({ message: "Your session has expired. Please sign in again." });
    req.token = token;
    req.sessionId = session.id;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
        employee: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "User account is deactivated or no longer exists.",
      });
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const primaryRole =
      roles[0] || (user.isSuperAdmin ? "Super Admin" : "Employee");
    const employeeName = user.employee
      ? user.employee.fullName
      : user.isSuperAdmin
        ? user.email
        : roles.includes("Admin")
          ? "System Administrator"
          : "Nexus User";
    const departmentName = user.employee?.department?.name || "Administration";
    const departmentCode = user.employee?.department?.code || "ADM";

    // Generate avatar initials (e.g. "HT" for Hamza Tariq)
    const initials = employeeName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    const effectivePermissions = calculateEffectivePermissions({
      roles,
      permissions: user.userRoles.flatMap((ur) =>
        ur.role.permissions.map(
          (p) => `${p.permission.module}.${p.permission.action}`,
        ),
      ),
      isSuperAdmin: user.isSuperAdmin,
    });

    req.user = {
      id: user.id,
      organizationId: user.organizationId,
      departmentId: user.employee?.departmentId,
      email: user.email,
      name: employeeName,
      isSuperAdmin: user.isSuperAdmin,
      roles,
      role: primaryRole,
      primaryRole,
      department: departmentName,
      departmentCode,
      employeeId: user.employee ? user.employee.id : null,
      employeeName,
      avatar: initials || "NX",
      effectivePermissions,
      permissions: effectivePermissions.permissions,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin strict guard
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (!req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message: "Access restricted exclusively to Super Admin.",
    });
  }

  next();
}

/**
 * Super Admin & Operational Admin Guard
 * Allowed: Super Admin, Admin, Administrator, Owner / CEO
 */
function requireAdminOrSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (
    req.user.isSuperAdmin ||
    req.user.effectivePermissions.canManageUsers ||
    req.user.roles.includes("Admin") ||
    req.user.roles.includes("Administrator") ||
    req.user.roles.includes("Owner / CEO") ||
    req.user.roles.includes("Operations Manager")
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: "Forbidden",
    message: "Access restricted to Administrator or Super Admin leadership.",
  });
}

/**
 * Project Management Guard (Super Admin, Admin, PM, Operations Manager)
 */
function requireProjectManagerOrHigher(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Sign in required." });
  if (req.user.isSuperAdmin || req.user.permissions.includes("tasks.create"))
    return next();
  return res
    .status(403)
    .json({ message: "Task creation permission required." });
}

/**
 * Fine-grained task authorization:
 * - Super Admin & Admins: Full management over any task
 * - Project Manager: Management over tasks
 * - Assigned Employees / Interns: Can only edit tasks assigned to them
 */
async function canModifyTask(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id))
      return res.status(400).json({ message: "Invalid task ID." });
    const { taskScope } = require("../services/taskScope");
    const task = await prisma.task.findFirst({
      where: { id, deletedAt: null, ...taskScope(req.user) },
    });
    if (!task) return res.status(404).json({ message: "Task not found." });
    const assigned = await prisma.taskAssignee.count({
      where: { taskId: id, employeeId: req.user.employeeId || "__none__" },
    });
    if (!req.user.effectivePermissions.canManageTasks && !assigned)
      return res.status(403).json({
        message: "Task assignment or management permission required.",
      });
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Protect Super Admin accounts from unauthorized Admin modifications
 */
async function protectSuperAdminAccount(req, res, next) {
  const targetUserId = req.params.userId || req.params.id;
  if (!targetUserId) return next();

  try {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (target && target.isSuperAdmin && !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message:
          "Security Constraint: Protected Super Admin accounts cannot be modified or deleted by operational Admins.",
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * CSRF Protection for state-changing requests
 */
function verifyCsrf(req, res, next) {
  const { validateCsrf } = require("../validators/csrf");
  const allowed = (
    process.env.APP_ORIGINS ||
    "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5000,http://127.0.0.1:5000"
  ).split(",");
  if (
    !validateCsrf(
      {
        method: req.method,
        origin: req.headers.origin,
        fetchSite: req.headers["sec-fetch-site"],
        requestedWith: req.headers["x-requested-with"],
      },
      allowed,
    )
  )
    return res
      .status(403)
      .json({ message: "Cross-site request validation failed." });
  next();
}

module.exports = {
  authenticate,
  verifyCsrf,
  requireSuperAdmin,
  requireAdminOrSuperAdmin,
  requireProjectManagerOrHigher,
  canModifyTask,
  protectSuperAdminAccount,
};
