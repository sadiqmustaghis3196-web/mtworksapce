/**
 * MT Nexus Global ERP — Persistent Audit Logger Utility
 * Records all critical administrative, security, and task mutations into PostgreSQL.
 */

const prisma = require('../db/prisma');

async function logAudit(txOrPrisma, { userId, userRole, action, detail, ipAddress }) {
  const db = txOrPrisma || prisma;
  try {
    return await db.auditLog.create({
      data: {
        userId: userId || null,
        userRole: userRole || 'System',
        action,
        detail,
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('[AUDIT LOG ERROR] Failed to record audit log:', err.message);
    throw err; // Never report an audited mutation as successful without its audit record.
  }
}

module.exports = {
  logAudit,
};
