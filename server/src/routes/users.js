const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../db/prisma");
const { authenticate } = require("../middleware/auth");
const { logAudit } = require("../utils/auditLogger");
const { mailConfigured, sendResetEmail } = require("../services/resetEmail");
const router = express.Router();
router.use(authenticate);
const permit = (p) => (req, res, next) =>
  req.user.isSuperAdmin || req.user.permissions.includes(p)
    ? next()
    : res.status(403).json({ message: "Permission denied." });
const select = {
  id: true,
  email: true,
  isActive: true,
  isSuperAdmin: true,
  lastLoginAt: true,
  userRoles: { include: { role: true } },
  employee: {
    select: { id: true, fullName: true, departmentId: true, jobTitle: true },
  },
};
router.get("/", permit("users.read"), async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await prisma.user.findMany({
        where: { organizationId: req.user.organizationId },
        select,
        orderBy: { createdAt: "desc" },
      }),
    });
  } catch (e) {
    next(e);
  }
});
const schema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  fullName: z.string().trim().min(2).max(120),
  departmentId: z.string(),
  role: z.string(),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
  isSuperAdmin: z.boolean().default(false),
});
async function allowedRole(tx, name, user) {
  const role = await tx.role.findUnique({
    where: { name },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) {
    const e = new Error("Role not found.");
    e.status = 400;
    throw e;
  }
  if (
    !user.isSuperAdmin &&
    (name.toUpperCase().replaceAll(" ", "_") === "SUPER_ADMIN" ||
      role.permissions.some(
        (p) =>
          !user.permissions.includes(
            `${p.permission.module}.${p.permission.action}`,
          ),
      ))
  ) {
    const e = new Error("You cannot grant permissions beyond your own.");
    e.status = 403;
    throw e;
  }
  return role;
}
router.post("/", permit("users.create"), async (req, res, next) => {
  try {
    const f = schema.parse(req.body);
    if (f.isSuperAdmin && !req.user.isSuperAdmin)
      return res
        .status(403)
        .json({ message: "Super Admin permission required." });
    const passwordHash = await bcrypt.hash(f.password, 12);
    const data = await prisma.$transaction(async (tx) => {
      const role = await allowedRole(tx, f.role, req.user);
      const department = await tx.department.findFirst({
        where: { id: f.departmentId, organizationId: req.user.organizationId },
      });
      if (!department) {
        const e = new Error("Department not found.");
        e.status = 400;
        throw e;
      }
      const code = `EMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const created = await tx.user.create({
        data: {
          email: f.email,
          passwordHash,
          organizationId: req.user.organizationId,
          isSuperAdmin: f.isSuperAdmin,
          userRoles: { create: { roleId: role.id } },
          employee: {
            create: {
              id: code,
              employeeCode: code,
              fullName: f.fullName,
              email: f.email,
              jobTitle: f.role,
              departmentId: f.departmentId,
              organizationId: req.user.organizationId,
              salaryMonthly: "0",
              skills: [],
            },
          },
        },
        select,
      });
      await logAudit(tx, {
        userId: req.user.id,
        userRole: req.user.primaryRole,
        action: "USER_CREATED",
        detail: `Created internal account ${created.id}.`,
      });
      return created;
    });
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
});
router.use("/:id", async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      select,
    });
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.isSuperAdmin && !req.user.isSuperAdmin)
      return res.status(403).json({ message: "Protected account." });
    req.targetUser = user;
    next();
  } catch (e) {
    next(e);
  }
});
router.patch("/:id", permit("users.update"), async (req, res, next) => {
  try {
    const f = z
      .object({
        fullName: z.string().trim().min(2).max(120).optional(),
        role: z.string().optional(),
        departmentId: z.string().optional(),
        isActive: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    if (req.targetUser.id === req.user.id && f.isActive === false)
      return res
        .status(400)
        .json({ message: "You cannot deactivate your own account." });
    const data = await prisma.$transaction(async (tx) => {
      if (f.role) {
        const role = await allowedRole(tx, f.role, req.user);
        await tx.userRole.deleteMany({ where: { userId: req.targetUser.id } });
        await tx.userRole.create({
          data: { userId: req.targetUser.id, roleId: role.id },
        });
      }
      if (
        f.departmentId &&
        !(await tx.department.count({
          where: {
            id: f.departmentId,
            organizationId: req.user.organizationId,
          },
        }))
      ) {
        const e = new Error("Department not found.");
        e.status = 400;
        throw e;
      }
      if (req.targetUser.employee && (f.fullName || f.departmentId))
        await tx.employee.update({
          where: { id: req.targetUser.employee.id },
          data: { fullName: f.fullName, departmentId: f.departmentId },
        });
      const changed = await tx.user.update({
        where: { id: req.targetUser.id },
        data: { isActive: f.isActive },
        select,
      });
      if (f.role || f.isActive === false)
        await tx.session.deleteMany({ where: { userId: req.targetUser.id } });
      await logAudit(tx, {
        userId: req.user.id,
        userRole: req.user.primaryRole,
        action: "USER_UPDATED",
        detail: `Updated account ${req.targetUser.id}.`,
      });
      return changed;
    });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});
router.post(
  "/:id/reset-password",
  permit("users.update"),
  async (req, res, next) => {
    try {
      if (!mailConfigured())
        return res
          .status(503)
          .json({
            message: "Password reset email delivery is not configured.",
          });
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const record = await prisma.passwordResetToken.create({
        data: {
          userId: req.targetUser.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      try {
        await sendResetEmail(req.targetUser.email, token);
      } catch (e) {
        await prisma.passwordResetToken.deleteMany({
          where: { id: record.id },
        });
        return res
          .status(503)
          .json({ message: "Reset email could not be delivered." });
      }
      await logAudit(prisma, {
        userId: req.user.id,
        userRole: req.user.primaryRole,
        action: "ADMIN_RESET_REQUESTED",
        detail: `Requested reset for ${req.targetUser.id}.`,
      });
      res.json({ success: true, message: "Reset instructions sent." });
    } catch (e) {
      next(e);
    }
  },
);
module.exports = router;
