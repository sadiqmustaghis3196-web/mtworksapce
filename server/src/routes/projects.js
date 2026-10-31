/**
 * MT Nexus Global ERP — Projects API Router
 */

const express = require('express');
const prisma = require('../db/prisma');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { id: 'asc' },
      include: {
        client: true,
        tasks: {
          select: { id: true, stage: true, priority: true },
        },
      },
    });

    res.json({ success: true, count: projects.length, data: projects });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
