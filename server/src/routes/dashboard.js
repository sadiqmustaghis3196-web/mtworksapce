const express = require("express");
const prisma = require("../db/prisma");
const { authenticate } = require("../middleware/auth");
const { taskScope } = require("../services/taskScope");
const router = express.Router();
router.use(authenticate);
router.use((req, res, next) =>
  req.user.isSuperAdmin || req.user.permissions.includes("dashboard.read")
    ? next()
    : res.status(403).json({ message: "Dashboard permission required." }),
);
router.get("/overview", async (req, res, next) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { deletedAt: null, ...taskScope(req.user) },
      select: {
        id: true,
        title: true,
        stage: true,
        dueDate: true,
        priority: true,
      },
    });
    const projects = await prisma.project.count({
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
    });
    res.json({
      success: true,
      data: {
        projects,
        tasks: tasks.length,
        inProgress: tasks.filter((t) => t.stage === 2).length,
        review: tasks.filter((t) => t.stage === 3).length,
        completed: tasks.filter((t) => t.stage === 4).length,
        deadlines: tasks
          .filter((t) => t.dueDate && t.stage !== 4)
          .sort((a, b) => a.dueDate - b.dueDate)
          .slice(0, 8),
      },
    });
  } catch (e) {
    next(e);
  }
});
module.exports = router;
