/**
 * MT Nexus Global ERP — User Administration & RBAC Router
 * Implements strict security barrier: Admins cannot modify Super Admin accounts
 * or grant Super Admin privileges. Safe account provisioning and role assignments.
 */

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../db/prisma');
const {
  authenticate,
  requireAdminOrSuperAdmin,
  protectSuperAdminAccount,
} = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');

const router = express.Router();

router.use(authenticate);
router.use(requireAdminOrSuperAdmin);

const CreateUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.string().min(2),
  departmentId: z.string().min(2),
  password: z.string().min(8).optional(),
  isSuperAdmin: z.boolean().optional(),
});

const UpdateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.string().min(2).optional(),
  departmentId: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/users — List user accounts
 */
router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        isActive: true,
        isSuperAdmin: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          include: { role: true },
        },
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            departmentId: true,
            department: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/users — Create new user account & employee profile
 * Security guard: Only Super Admin can create another Super Admin account.
 */
router.post('/', async (req, res, next) => {
  try {
    const data = CreateUserSchema.parse(req.body);

    // Guard: Admin cannot create Super Admin
    if (data.isSuperAdmin && !req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only Super Admin can grant Super Admin privileges.',
      });
    }

    // Check existing email
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'A user with this email address already exists.',
      });
    }

    // Role check
    const roleRecord = await prisma.role.findUnique({ where: { name: data.role } });
    if (!roleRecord) {
      return res.status(400).json({
        success: false,
        error: 'InvalidRole',
        message: `Role "${data.role}" does not exist in the system.`,
      });
    }

    // Department check
    const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!dept) {
      return res.status(400).json({
        success: false,
        error: 'InvalidDepartment',
        message: 'Specified department does not exist.',
      });
    }

    // Safe account provisioning: generate secure random initial password if not supplied
    const initialPlainPassword = data.password || `Nexus#${crypto.randomBytes(4).toString('hex')}!`;
    const passwordHash = await bcrypt.hash(initialPlainPassword, 10);

    // Get organization
    const org = await prisma.organization.findFirst();

    // Create user in transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: data.email,
          passwordHash,
          isSuperAdmin: !!data.isSuperAdmin,
          isActive: true,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: roleRecord.id,
        },
      });

      const empCount = await tx.employee.count();
      const empCode = `EMP-${100 + empCount + 1}`;

      const emp = await tx.employee.create({
        data: {
          id: empCode,
          employeeCode: empCode,
          organizationId: org.id,
          userId: user.id,
          departmentId: dept.id,
          fullName: data.fullName,
          jobTitle: data.role,
          email: data.email,
          workMode: 'ONSITE',
          status: 'ACTIVE',
        },
        include: {
          department: true,
        },
      });

      return {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        isSuperAdmin: user.isSuperAdmin,
        role: roleRecord.name,
        employee: {
          id: emp.id,
          fullName: emp.fullName,
          jobTitle: emp.jobTitle,
          department: dept.name,
        },
      };
    });

    await logAudit(prisma, {
      userId: req.user.id,
      userRole: req.user.primaryRole,
      action: 'USER_CREATED',
      detail: `Created user account ${newUser.email} (${newUser.role})`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: newUser,
      message: 'User account created successfully.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/users/:id — Modify user account
 * Security guard: Protects Super Admin from Admin modifications
 */
router.patch('/:id', protectSuperAdminAccount, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, role, departmentId, isActive } = UpdateUserSchema.parse(req.body);

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { employee: true, userRoles: { include: { role: true } } },
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'NotFound', message: 'User not found.' });
    }

    // If changing role
    if (role) {
      if (role === 'Super Admin' && !req.user.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Only Super Admin can assign the Super Admin role.',
        });
      }

      const roleRecord = await prisma.role.findUnique({ where: { name: role } });
      if (roleRecord) {
        await prisma.userRole.deleteMany({ where: { userId: id } });
        await prisma.userRole.create({
          data: { userId: id, roleId: roleRecord.id },
        });
      }
    }

    // Update user active status
    const updateUserData = {};
    if (typeof isActive === 'boolean') {
      updateUserData.isActive = isActive;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateUserData,
      select: { id: true, email: true, isActive: true, isSuperAdmin: true },
    });

    // Update linked employee profile
    if (targetUser.employee && (fullName || departmentId || role)) {
      await prisma.employee.update({
        where: { id: targetUser.employee.id },
        data: {
          fullName: fullName || undefined,
          departmentId: departmentId || undefined,
          jobTitle: role || undefined,
        },
      });
    }

    await logAudit(prisma, {
      userId: req.user.id,
      userRole: req.user.primaryRole,
      action: 'USER_UPDATE',
      detail: `Modified user ${updatedUser.email} (Active: ${updatedUser.isActive})`,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: updatedUser, message: 'User updated successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/users/:id/reset-password — Initiate password reset for user
 * Security guard: Protects Super Admin from Admin reset
 */
router.post('/:id/reset-password', protectSuperAdminAccount, async (req, res, next) => {
  try {
    const { id } = req.params;
    const targetUser = await prisma.user.findUnique({ where: { id } });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'NotFound', message: 'User not found.' });
    }

    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.deleteMany({
      where: { userId: targetUser.id, usedAt: null },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: targetUser.id,
        tokenHash,
        expiresAt,
      },
    });

    await logAudit(prisma, {
      userId: req.user.id,
      userRole: req.user.primaryRole,
      action: 'ADMIN_INITIATED_PASSWORD_RESET',
      detail: `Password reset initiated for user ${targetUser.email} by ${req.user.email}`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Password reset link generated for ${targetUser.email}.`,
      devResetUrl: `/reset-password.html?token=${plainToken}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/users/:id — Deactivate user account
 * Security guard: Protects Super Admin from deletion
 */
router.delete('/:id', protectSuperAdminAccount, async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    await logAudit(prisma, {
      userId: req.user.id,
      userRole: req.user.primaryRole,
      action: 'USER_DEACTIVATE',
      detail: `Deactivated user ${user.email}`,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `User ${user.email} deactivated.` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
