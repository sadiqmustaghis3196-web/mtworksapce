/**
 * MT Nexus Global ERP — Server-Side Authentication & RBAC Middleware
 * Enforces cryptographic JWT validation, HttpOnly cookie sessions,
 * granular role hierarchies, and protected Super Admin security boundaries.
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../db/prisma');
const tokenRegistry = require('../utils/tokenRevocation');

const { calculateEffectivePermissions } = require('../utils/permissions');

async function authenticate(req, res, next) {
  let token = null;

  // 1. Check Bearer Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Fallback to HttpOnly session cookie
  if (!token && req.cookies && req.cookies.nexus_session) {
    token = req.cookies.nexus_session;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Access denied. Valid authentication token or session cookie required.',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    // Check server-side revocation registry
    if (tokenRegistry.isRevoked(token, decoded.userId, decoded.iat)) {
      return res.status(401).json({
        success: false,
        error: 'SessionRevoked',
        message: 'Your authentication session has been logged out and revoked. Please sign in again.',
      });
    }

    req.token = token;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        userRoles: {
          include: {
            role: true,
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
        error: 'Unauthorized',
        message: 'User account is deactivated or no longer exists.',
      });
    }

    const roles = user.userRoles.map(ur => ur.role.name);
    const primaryRole = roles[0] || (user.isSuperAdmin ? 'Super Admin' : 'Employee');
    const employeeName = user.employee ? user.employee.fullName : (user.isSuperAdmin ? 'Hamza Tariq' : (roles.includes('Admin') ? 'System Administrator' : 'Nexus User'));
    const departmentName = user.employee?.department?.name || 'Administration';
    const departmentCode = user.employee?.department?.code || 'ADM';

    // Generate avatar initials (e.g. "HT" for Hamza Tariq)
    const initials = employeeName
      .split(' ')
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const effectivePermissions = calculateEffectivePermissions({
      roles,
      isSuperAdmin: user.isSuperAdmin,
    });

    req.user = {
      id: user.id,
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
      avatar: initials || 'NX',
      effectivePermissions,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'InvalidToken',
      message: 'Authentication session is expired, invalid, or malformed.',
    });
  }
}

/**
 * Super Admin strict guard
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Access restricted exclusively to Super Admin.',
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
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (
    req.user.isSuperAdmin ||
    req.user.roles.includes('Admin') ||
    req.user.roles.includes('Administrator') ||
    req.user.roles.includes('Owner / CEO') ||
    req.user.roles.includes('Operations Manager')
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Forbidden',
    message: 'Access restricted to Administrator or Super Admin leadership.',
  });
}

/**
 * Project Management Guard (Super Admin, Admin, PM, Operations Manager)
 */
function requireProjectManagerOrHigher(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (
    req.user.isSuperAdmin ||
    req.user.roles.includes('Admin') ||
    req.user.roles.includes('Administrator') ||
    req.user.roles.includes('Owner / CEO') ||
    req.user.roles.includes('Operations Manager') ||
    req.user.roles.includes('Project Manager')
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Forbidden',
    message: 'Access restricted to Project Managers or Executive Leadership.',
  });
}

/**
 * Fine-grained task authorization:
 * - Super Admin & Admins: Full management over any task
 * - Project Manager: Management over tasks
 * - Assigned Employees / Interns: Can only edit tasks assigned to them
 */
async function canModifyTask(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  // Leadership has unrestricted authority
  if (
    req.user.isSuperAdmin ||
    req.user.roles.includes('Admin') ||
    req.user.roles.includes('Administrator') ||
    req.user.roles.includes('Owner / CEO') ||
    req.user.roles.includes('Operations Manager') ||
    req.user.roles.includes('Project Manager')
  ) {
    return next();
  }

  const taskId = parseInt(req.params.id, 10);
  if (isNaN(taskId)) {
    return res.status(400).json({ success: false, error: 'Invalid task ID' });
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: true,
      },
    });

    if (!task || task.deletedAt) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Check if current user is an assigned member on this task
    const isAssigned = req.user.employeeId && task.assignees.some(a => a.employeeId === req.user.employeeId);
    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not assigned to this task. Modification denied.',
      });
    }

    req.targetTask = task;
    next();
  } catch (err) {
    next(err);
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
        error: 'Forbidden',
        message: 'Security Constraint: Protected Super Admin accounts cannot be modified or deleted by operational Admins.',
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
  // Read-only methods are exempt
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Programmatic Bearer token calls are exempt from browser ambient cookie CSRF
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // Verify origin or referer for cookie-authenticated browser requests
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) {
    // If neither origin nor referer is sent, require custom client header
    if (req.headers['x-requested-with'] || req.headers['x-csrf-token'] || req.headers['content-type']?.includes('application/json')) {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: 'CsrfRejected',
      message: 'Cross-site request validation failed.',
    });
  }

  const allowedOrigins = [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
  ];

  const originMatch = allowedOrigins.some(ao => origin.startsWith(ao));
  if (!originMatch && !origin.startsWith('http://localhost:') && !origin.startsWith('http://127.0.0.1:')) {
    return res.status(403).json({
      success: false,
      error: 'CsrfForbidden',
      message: 'Cross-origin state modification blocked.',
    });
  }

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
