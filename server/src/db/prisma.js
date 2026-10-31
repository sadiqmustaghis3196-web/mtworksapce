/**
 * MT Nexus Global ERP — Prisma Database Client Singleton
 */

const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  if (!global.__nexusPrisma) {
    global.__nexusPrisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  prisma = global.__nexusPrisma;
}

// Graceful disconnection on termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
