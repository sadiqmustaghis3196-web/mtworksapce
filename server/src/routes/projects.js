/**
 * MT Nexus Global ERP — Projects API Router
 */

const express = require("express");
const prisma = require("../db/prisma");

const { authenticate } = require("../middleware/auth");
const router = express.Router();
router.use(authenticate);
router.use((req, res, next) =>
  req.user.isSuperAdmin || req.user.permissions.includes("projects.read")
    ? next()
    : res.status(403).json({ message: "Project permission required." }),
);

router.get("/", async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        organizationId: req.user.organizationId,
        ...(!req.user.isSuperAdmin
          ? {
              members: {
                some: { employeeId: req.user.employeeId || "__none__" },
              },
            }
          : {}),
      },
      orderBy: { id: "asc" },
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
