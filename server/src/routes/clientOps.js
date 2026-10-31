/**
 * MT Nexus Global ERP — Client Operations & Retainer Contracts API Router
 */

const express = require('express');
const prisma = require('../db/prisma');

const router = express.Router();

router.get('/contracts', async (req, res, next) => {
  try {
    const contracts = await prisma.contract.findMany({
      include: {
        client: true,
        deliverables: true,
        kpis: true,
        dailyWorks: {
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
    });

    res.json({ success: true, count: contracts.length, data: contracts });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
