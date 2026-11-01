const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");
const { z } = require("zod");
const prisma = require("../db/prisma");
const { authenticate } = require("../middleware/auth");
const { logAudit } = require("../utils/auditLogger");
const router = express.Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const password = z
  .string()
  .min(12)
  .max(128)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/);
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
router.post("/login", limiter, async (req, res, next) => {
  try {
    const body = z
      .object({
        email: z
          .string()
          .email()
          .transform((v) => v.toLowerCase()),
        password: z.string().min(1).max(128),
        rememberMe: z.boolean().optional(),
      })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Always perform bcrypt work to reduce account enumeration via response timing.
    const fallback =
      "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    const valid = await bcrypt.compare(
      body.password,
      user?.passwordHash || fallback,
    );
    if (!user?.isActive || !valid)
      return res
        .status(401)
        .json({ message: "Invalid email address or password." });
    const token = crypto.randomBytes(32).toString("hex"),
      expiresAt = new Date(Date.now() + (body.rememberMe ? 30 : 1) * 86400000);
    await prisma.$transaction(async (tx) => {
      if (req.cookies.nexus_session)
        await tx.session.deleteMany({
          where: { tokenHash: hash(req.cookies.nexus_session) },
        });
      await tx.session.create({
        data: { userId: user.id, tokenHash: hash(token), expiresAt },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      await logAudit(tx, {
        userId: user.id,
        userRole: "User",
        action: "USER_LOGIN",
        detail: "Signed in.",
        ipAddress: req.ip,
      });
    });
    res.cookie("nexus_session", token, {
      ...cookieOptions,
      ...(body.rememberMe ? { expires: expiresAt } : {}),
    });
    req.cookies.nexus_session = token;
    await authenticate(req, res, (error) =>
      error ? next(error) : res.json({ success: true, user: req.user }),
    );
  } catch (e) {
    next(e);
  }
});
router.get("/me", authenticate, (req, res) =>
  res.json({ success: true, user: req.user }),
);
router.post("/logout", authenticate, async (req, res, next) => {
  try {
    await prisma.session.delete({ where: { id: req.sessionId } });
    res.clearCookie("nexus_session", cookieOptions);
    await logAudit(prisma, {
      userId: req.user.id,
      userRole: req.user.primaryRole,
      action: "USER_LOGOUT",
      detail: "Session revoked.",
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});
router.post("/forgot-password", limiter, async (req, res, next) => {
  try {
    const { email } = z
      .object({
        email: z
          .string()
          .email()
          .transform((v) => v.toLowerCase()),
      })
      .parse(req.body);
    const {
      mailConfigured,
      sendResetEmail,
    } = require("../services/resetEmail");
    if (!mailConfigured())
      return res
        .status(503)
        .json({
          message:
            "Password reset email delivery is not configured. Contact your administrator.",
        });
    const generic = {
      success: true,
      message:
        "If this address belongs to an active account, reset instructions will be emailed.",
    };
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.isActive) {
      const token = crypto.randomBytes(32).toString("hex");
      const record = await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.deleteMany({
          where: { userId: user.id, usedAt: null },
        });
        return tx.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hash(token),
            expiresAt: new Date(Date.now() + 3600000),
          },
        });
      });
      try {
        await sendResetEmail(email, token);
      } catch (error) {
        await prisma.passwordResetToken.deleteMany({
          where: { id: record.id },
        });
        // Do not log tokens, URLs, addresses or transport credentials.
        console.error(
          "Password reset delivery failed; reset token invalidated.",
        );
      }
    }
    return res.json(generic);
  } catch (e) {
    next(e);
  }
});
router.post("/reset-password", limiter, async (req, res, next) => {
  try {
    const body = z
      .object({
        token: z.string().length(64),
        password,
        confirmPassword: z.string(),
      })
      .refine((v) => v.password === v.confirmPassword, {
        message: "Passwords do not match.",
      })
      .parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 12);
    await prisma.$transaction(async (tx) => {
      const r = await tx.passwordResetToken.findUnique({
        where: { tokenHash: hash(body.token) },
        include: { user: true },
      });
      if (!r || r.usedAt || r.expiresAt <= new Date() || !r.user.isActive) {
        const e = new Error("Invalid or expired reset link.");
        e.status = 400;
        throw e;
      }
      const used = await tx.passwordResetToken.updateMany({
        where: { id: r.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (used.count !== 1) {
        const e = new Error("Reset link already used.");
        e.status = 400;
        throw e;
      }
      await tx.user.update({ where: { id: r.userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: r.userId } });
      await tx.passwordResetToken.deleteMany({
        where: { userId: r.userId, id: { not: r.id } },
      });
      await logAudit(tx, {
        userId: r.userId,
        userRole: "User",
        action: "PASSWORD_RESET_COMPLETED",
        detail: "Password reset; all sessions revoked.",
      });
    });
    res.clearCookie("nexus_session", cookieOptions);
    res.json({ success: true, message: "Password updated. Please sign in." });
  } catch (e) {
    next(e);
  }
});
router.patch("/password", authenticate, async (req, res, next) => {
  try {
    const body = z
      .object({ currentPassword: z.string().min(1), password })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!(await bcrypt.compare(body.currentPassword, user.passwordHash)))
      return res
        .status(400)
        .json({ message: "Current password is incorrect." });
    const passwordHash = await bcrypt.hash(body.password, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await logAudit(tx, {
        userId: user.id,
        userRole: req.user.primaryRole,
        action: "PASSWORD_CHANGED",
        detail: "Password changed; all sessions revoked.",
      });
    });
    res.clearCookie("nexus_session", cookieOptions);
    res.json({ success: true, message: "Password changed. Sign in again." });
  } catch (e) {
    next(e);
  }
});
module.exports = router;
