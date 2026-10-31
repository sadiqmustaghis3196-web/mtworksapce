/**
 * MT Nexus Global ERP — System Health & Diagnostics Endpoint
 */

const express = require('express');
const prisma = require('../db/prisma');

const router = express.Router();

router.get('/health', async (req, res, next) => {
  const startTime = Date.now();
  try {
    // Ping PostgreSQL
    const dbCheck = await prisma.$queryRaw`SELECT 1 as alive`;
    const latencyMs = Date.now() - startTime;

    // Fetch counts to verify database state
    const [tasksCount, employeesCount, projectsCount] = await Promise.all([
      prisma.task.count(),
      prisma.employee.count(),
      prisma.project.count(),
    ]);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'MT Nexus Global ERP API',
      version: '1.0.0-PROD',
      environment: process.env.NODE_ENV || 'development',
      database: {
        engine: 'PostgreSQL 16 (Relational)',
        status: dbCheck && dbCheck[0].alive === 1 ? 'connected' : 'degraded',
        latencyMs: `${latencyMs}ms`,
        records: {
          tasks: tasksCount,
          employees: employeesCount,
          projects: projectsCount,
        },
      },
      system: {
        uptimeSec: Math.floor(process.uptime()),
        memoryUsageMb: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
        nodeVersion: process.version,
      },
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        error: err.message,
      },
    });
  }
});

module.exports = router;
