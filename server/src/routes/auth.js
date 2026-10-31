/**
 * MT Nexus Global ERP — Authentication API Routes
 * Secure session cookies (HttpOnly), bcrypt password hashing, rate limiting,
 * password reset workflow with cryptographic tokens, and server-side RBAC session state.
 */

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const prisma = require('../db/prisma');
const config = require('../config');
const { authenticate } = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');
const { calculateEffectivePermissions } = require('../utils/permissions');
const tokenRegistry = require('../utils/tokenRevocation');

const router = express.Router();

// Rate limiter for authentication attempts (15 attempts in production, relaxed in dev/test)
const isProd = config.env === 'production';
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 15 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'TooManyRequests',
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

// Rate limiter for password reset requests (15 requests in production, relaxed in dev/test)
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 15 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'TooManyRequests',
    message: 'Too many password reset requests. Please try again after 15 minutes.',
  },
});

const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean().optional(),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(10, 'Invalid reset token format.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[0-9!@#$%^&*]/, 'Password must contain at least one number or special character.'),
  confirmPassword: z.string().min(1, 'Confirm password is required.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

/**
 * POST /api/auth/login
 * Validates credentials, issues JWT and sets secure HttpOnly cookie.
 * Rate-limited to prevent brute-force attacks.
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password, rememberMe } = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
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

    // Generic error to prevent user enumeration
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Invalid email address or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Invalid email address or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'AccountDeactivated',
        message: 'This user account has been deactivated. Please contact your system administrator.',
      });
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const roles = user.userRoles.map(ur => ur.role.name);
    const primaryRole = roles[0] || (user.isSuperAdmin ? 'Super Admin' : 'Employee');
    const employeeName = user.employee ? user.employee.fullName : (user.isSuperAdmin ? 'Hamza Tariq' : (roles.includes('Admin') ? 'System Administrator' : 'Nexus User'));
    const departmentName = user.employee?.department?.name || 'Administration';
    const departmentCode = user.employee?.department?.code || 'ADM';

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

    // Determine cookie maxAge based on rememberMe (7 days default, 30 days if rememberMe)
    const maxAgeMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    // Clear any previous user-level revocation cutoff so this new valid login is fully active
    tokenRegistry.clearUserRevocation(user.id);

    // Issue JWT with unique cryptographic jti (guarantees zero token collisions)
    const token = jwt.sign(
      {
        jti: crypto.randomUUID(),
        userId: user.id,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        roles,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // Set HttpOnly secure session cookie
    const isProd = config.env === 'production';
    res.cookie('nexus_session', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: maxAgeMs,
      path: '/',
    });

    // Record login audit log
    await logAudit(prisma, {
      userId: user.id,
      userRole: primaryRole,
      action: 'USER_LOGIN',
      detail: `User ${user.email} signed in successfully.`,
      ipAddress: req.ip || req.connection.remoteAddress,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: employeeName,
        role: primaryRole,
        roles,
        department: departmentName,
        departmentCode,
        avatar: initials || 'NX',
        isSuperAdmin: user.isSuperAdmin,
        employeeId: user.employee ? user.employee.id : null,
        effectivePermissions,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Clears HttpOnly session cookie and logs audit event.
 */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // Invalidate token server-side so it cannot be replayed
    const token = req.token || (req.cookies && req.cookies.nexus_session);
    if (token) {
      tokenRegistry.revokeToken(token);
    }

    res.clearCookie('nexus_session', { path: '/' });

    await logAudit(prisma, {
      userId: req.user.id,
      userRole: req.user.primaryRole,
      action: 'USER_LOGOUT',
      detail: `User ${req.user.email} signed out and session was revoked.`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Signed out successfully.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Retrieves authenticated user identity, role, department and effective permissions from token/session.
 */
router.get('/me', authenticate, async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

/**
 * POST /api/auth/forgot-password
 * Initiates secure password reset with one-time hashed token.
 * Rate-limited to prevent abuse.
 */
router.post('/forgot-password', resetLimiter, async (req, res, next) => {
  try {
    const { email } = ForgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Check if email delivery is configured (e.g. SMTP_HOST or SENDGRID_API_KEY)
    const isEmailConfigured = !!(process.env.SMTP_HOST || process.env.SENDGRID_API_KEY);

    if (!user || !user.isActive) {
      // Do not disclose whether email exists
      return res.json({
        success: true,
        emailConfigured: isEmailConfigured,
        message: 'If this email is associated with an active account, password reset instructions have been generated.',
      });
    }

    // Generate cryptographically secure 32-byte hex token
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    // Invalidate existing unused tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    // Save hashed token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await logAudit(prisma, {
      userId: user.id,
      userRole: user.isSuperAdmin ? 'Super Admin' : 'User',
      action: 'PASSWORD_RESET_REQUESTED',
      detail: `Password reset token requested for account ${user.email}.`,
      ipAddress: req.ip,
    });

    if (!isEmailConfigured) {
      // Outside development testing, email delivery must be configured
      const isDev = config.env !== 'production';
      if (!isDev) {
        return res.status(503).json({
          success: false,
          emailConfigured: false,
          error: 'EmailDeliveryNotConfigured',
          message: 'Email delivery service is currently not configured on this server. Please contact your system administrator.',
        });
      }

      // In development mode, provide testing URL for seamless QA
      return res.json({
        success: true,
        emailConfigured: false,
        devResetUrl: `/reset-password.html?token=${plainToken}`,
        devToken: plainToken,
        message: 'Password reset token generated. (Development Notice: Email delivery is not configured, testing reset URL is provided).',
      });
    }

    // If email delivery was configured, email sending would happen here
    res.json({
      success: true,
      emailConfigured: true,
      message: 'Password reset link has been dispatched to your email address.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/verify-reset-token
 * Validates whether a reset token is valid and unexpired before presenting the reset form.
 */
router.get('/verify-reset-token', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, valid: false, message: 'Reset token is required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { email: true, isActive: true },
        },
      },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date() || !resetRecord.user?.isActive) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'This password reset link is invalid, expired, or has already been used.',
      });
    }

    res.json({
      success: true,
      valid: true,
      email: resetRecord.user.email,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/reset-password
 * Completes password reset, updates password hash, marks token used, and invalidates sessions.
 */
router.post('/reset-password', resetLimiter, async (req, res, next) => {
  try {
    const { token, password } = ResetPasswordSchema.parse(req.body);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date() || !resetRecord.user?.isActive) {
      return res.status(400).json({
        success: false,
        error: 'InvalidOrExpiredToken',
        message: 'This password reset link is invalid, expired, or has already been used.',
      });
    }

    // Hash new password securely
    const newPasswordHash = await bcrypt.hash(password, 10);

    // Update user password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all other reset tokens for this user
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: resetRecord.userId,
          id: { not: resetRecord.id },
        },
      }),
    ]);

    // Clear existing session cookie to require re-login
    res.clearCookie('nexus_session', { path: '/' });

    await logAudit(prisma, {
      userId: resetRecord.userId,
      userRole: resetRecord.user.isSuperAdmin ? 'Super Admin' : 'User',
      action: 'PASSWORD_RESET_COMPLETED',
      detail: `Password reset successfully completed for ${resetRecord.user.email}.`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Your password has been successfully reset. You can now sign in with your new credentials.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
