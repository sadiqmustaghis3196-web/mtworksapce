/**
 * MT Nexus Global ERP — Client Operations & Retainer Contracts API Router
 */

const express = require("express");
const prisma = require("../db/prisma");

const { authenticate, requireSuperAdmin } = require("../middleware/auth");
const router = express.Router();
// Legacy endpoints remain administrator-only until per-record scope is implemented.
router.use(authenticate, requireSuperAdmin);

router.get("/contracts", async (req, res, next) => {
  try {
    const contracts = await prisma.contract.findMany({
      where: { client: { organizationId: req.user.organizationId } },
      include: {
        client: true,
        deliverables: true,
        kpis: true,
        dailyWorks: {
          orderBy: { date: "desc" },
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
