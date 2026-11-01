/**
 * MT Nexus Global ERP — Secure Tasks & Kanban Sprints API Router
 * Enforces server-side authentication, RBAC authorization, Zod validation,
 * Prisma transactions, soft delete/restore, and persistent audit logging.
 */

const express = require("express");
const { z } = require("zod");
const prisma = require("../db/prisma");
const {
  authenticate,
  requireAdminOrSuperAdmin,
  requireProjectManagerOrHigher,
  canModifyTask,
} = require("../middleware/auth");
const { logAudit } = require("../utils/auditLogger");

const { taskScope } = require("../services/taskScope");
const { validateTransition } = require("../services/taskWorkflow");
const router = express.Router();

// All Task APIs require authenticated sessions
router.use(authenticate);
router.use((req, res, next) =>
  req.user.isSuperAdmin || req.user.permissions.includes("tasks.read")
    ? next()
    : res.status(403).json({ message: "Task read permission required." }),
);
const requireArchive = (req, res, next) =>
  req.user.isSuperAdmin || req.user.permissions.includes("tasks.delete")
    ? next()
    : res.status(403).json({ message: "Task archive permission required." });
async function requireScopedTask(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id))
      return res.status(400).json({ message: "Invalid task ID." });
    if (
      !(await prisma.task.findFirst({ where: { id, ...taskScope(req.user) } }))
    )
      return res.status(404).json({ message: "Task not found." });
    next();
  } catch (e) {
    next(e);
  }
}

// Validation Schemas
const CreateTaskSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().min(2, "Task title must be at least 2 characters"),
  description: z.string().optional().default(""),
  category: z.string().default("Web App"),
  stage: z.number().int().min(0).max(5).default(0), // 0: Upcoming, 1: Today To Do, 2: In Progress, 3: Review, 4: Done, 5: Reject
  priority: z
    .enum(["Low", "Medium", "High", "Urgent", "Critical"])
    .default("Medium"),
  dueDate: z.string().datetime().optional(),
  dueTime: z.string().optional().default("18:00"),
  estimatedHours: z.number().nonnegative().default(0),
  actualHours: z.number().nonnegative().default(0),
  projectId: z.string().optional(),
  departmentId: z.string().optional(),
  assigneeId: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent", "Critical"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  dueTime: z.string().optional(),
  estimatedHours: z.number().nonnegative().optional(),
  actualHours: z.number().nonnegative().optional(),
  projectId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  voiceAlertsEnabled: z.boolean().optional(),
});

const MoveTaskSchema = z.object({
  targetStage: z.number().int().min(0).max(5),
  reason: z.string().max(2000).optional(),
});

/**
 * GET /api/tasks
 * Retrieve active tasks with filtering and search
 */
router.get("/", async (req, res, next) => {
  try {
    const { stage, category, search, priority, includeDeleted } = req.query;

    const where = { AND: [taskScope(req.user)] };
    if (includeDeleted !== "true") {
      where.deletedAt = null;
    }

    if (stage !== undefined && stage !== "") {
      where.stage = parseInt(stage, 10);
    }
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        assignees: {
          include: {
            employee: { select: { id: true, fullName: true, colorCode: true } },
          },
        },
        updates: {
          orderBy: { createdAt: "desc" },
        },
        checklists: {
          include: {
            items: true,
          },
        },
        attachments: true,
        project: true,
        department: true,
      },
    });

    res.json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tasks/:id
 * Retrieve a single task by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid task ID format" });
    }

    const task = await prisma.task.findFirst({
      where: { id, ...taskScope(req.user) },
      include: {
        assignees: {
          include: {
            employee: { select: { id: true, fullName: true, colorCode: true } },
          },
        },
        updates: {
          orderBy: { createdAt: "desc" },
        },
        checklists: {
          include: { items: true },
        },
        attachments: true,
        project: true,
        department: true,
        activities: { orderBy: { createdAt: "desc" } },
        dependencies: true,
      },
    });

    if (!task || task.deletedAt) {
      return res.status(404).json({
        success: false,
        error: "NotFound",
        message: `Task #${id} not found or was deleted.`,
      });
    }

    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tasks
 * Create task (Authorized: Super Admin, Admin, Project Manager)
 */
router.post("/", requireProjectManagerOrHigher, async (req, res, next) => {
  try {
    const parsed = CreateTaskSchema.parse(req.body);
    if (!parsed.projectId)
      return res.status(400).json({ message: "A project is required." });
    const project = await prisma.project.findFirst({
      where: {
        id: parsed.projectId,
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
    if (!project)
      return res.status(404).json({ message: "Project not found." });
    if (parsed.stage !== 0)
      return res
        .status(400)
        .json({ message: "New tasks must start in Upcoming." });
    if (
      parsed.assigneeId &&
      !(await prisma.projectMember.count({
        where: { projectId: project.id, employeeId: parsed.assigneeId },
      }))
    )
      return res
        .status(400)
        .json({ message: "Assignee must be a project member." });
    if (
      parsed.departmentId &&
      !(await prisma.department.count({
        where: {
          id: parsed.departmentId,
          organizationId: req.user.organizationId,
        },
      }))
    )
      return res.status(400).json({ message: "Invalid department." });

    const task = await prisma.$transaction(async (tx) => {
      let taskId = parsed.id;
      if (!taskId) {
        const maxTask = await tx.task.findFirst({ orderBy: { id: "desc" } });
        taskId = maxTask ? maxTask.id + 1 : 101;
      }

      const created = await tx.task.create({
        data: {
          id: taskId,
          title: parsed.title,
          description: parsed.description,
          category: parsed.category,
          stage: parsed.stage,
          priority: parsed.priority,
          dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
          dueTime: parsed.dueTime,
          estimatedHours: parsed.estimatedHours,
          actualHours: parsed.actualHours,
          projectId: parsed.projectId,
          departmentId: parsed.departmentId,
          tags: parsed.tags,
        },
      });

      if (parsed.assigneeId) {
        await tx.taskAssignee.create({
          data: {
            taskId: created.id,
            employeeId: parsed.assigneeId,
            isOwner: true,
          },
        });
      }

      await logAudit(tx, {
        userId: req.user.id,
        userRole: req.user.primaryRole,
        action: "TASK_CREATE",
        detail: `Created task #${created.id} "${created.title}" [Stage: ${created.stage}, Priority: ${created.priority}]`,
        ipAddress: req.ip,
      });

      return created;
    });

    res.status(201).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/tasks/:id
 * Partial update (Authorized: Leadership OR assigned Employee)
 */
router.patch("/:id", canModifyTask, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if ("projectId" in req.body || "departmentId" in req.body)
      return res.status(400).json({
        message: "Project and department changes require reassignment.",
      });
    if ("stage" in req.body)
      return res
        .status(400)
        .json({ message: "Use the transition endpoint to change stages." });
    if (
      !req.user.isSuperAdmin &&
      !req.user.permissions.includes("tasks.update")
    )
      return res
        .status(403)
        .json({ message: "Task update permission required." });
    const parsed = UpdateTaskSchema.parse(req.body);
    if (parsed.progress === 100)
      return res
        .status(400)
        .json({ message: "Completion is recorded through review approval." });

    const updateData = { ...parsed };
    if (parsed.dueDate !== undefined) {
      updateData.dueDate = parsed.dueDate ? new Date(parsed.dueDate) : null;
    }

    const task = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: updateData,
      });

      await logAudit(tx, {
        userId: req.user.id,
        userRole: req.user.primaryRole,
        action: "TASK_UPDATE",
        detail: `Updated task #${id} (${Object.keys(parsed).join(", ")})`,
        ipAddress: req.ip,
      });

      return updated;
    });

    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tasks/:id/move
 * Stage transition with approval/rejection gates
 */
router.post(
  ["/:id/move", "/:id/transition"],
  canModifyTask,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { targetStage, reason } = MoveTaskSchema.parse(req.body);

      const current = await prisma.task.findUnique({ where: { id } });
      if (!current || current.deletedAt)
        return res.status(404).json({ message: "Task not found." });
      const canReview =
        req.user.isSuperAdmin ||
        req.user.permissions.includes(
          targetStage === 5 ? "tasks.reject" : "tasks.approve",
        );
      if (
        targetStage === 3 &&
        !req.user.isSuperAdmin &&
        !req.user.permissions.includes("tasks.submit_review")
      )
        return res
          .status(403)
          .json({ message: "Review submission permission required." });
      if (
        [1, 2].includes(targetStage) &&
        !req.user.isSuperAdmin &&
        !req.user.permissions.includes("tasks.update")
      )
        return res
          .status(403)
          .json({ message: "Task update permission required." });
      validateTransition({
        from: current.stage,
        to: targetStage,
        canReview,
        reason,
      });

      const updateData = {
        stage: targetStage,
        ...(targetStage === 4 ? { progress: 100 } : {}),
      };

      if (targetStage === 4) {
        updateData.approvedBy = `${req.user.primaryRole} (${req.user.employeeName || req.user.email})`;
        updateData.approvedAt = new Date();
        updateData.rejectedBy = null;
        updateData.rejectedAt = null;
        updateData.rejectReason = null;
      } else if (targetStage === 5) {
        updateData.rejectedBy = `${req.user.primaryRole} (${req.user.employeeName || req.user.email})`;
        updateData.rejectedAt = new Date();
        updateData.rejectReason = reason || "Deliverable rejected by reviewer.";
      }

      const task = await prisma.$transaction(async (tx) => {
        const changed = await tx.task.updateMany({
          where: { id, stage: current.stage, deletedAt: null },
          data: updateData,
        });
        if (changed.count !== 1) {
          const error = new Error("Task changed. Refresh and try again.");
          error.status = 409;
          throw error;
        }
        await tx.taskActivity.create({
          data: {
            taskId: id,
            actorId: req.user.id,
            fromStage: current.stage,
            toStage: targetStage,
            reason,
          },
        });
        const updated = await tx.task.findUnique({ where: { id } });

        await logAudit(tx, {
          userId: req.user.id,
          userRole: req.user.primaryRole,
          action: "TASK_STAGE_CHANGE",
          detail: `Task #${id} moved to stage ${targetStage} (${["Upcoming", "Today To Do", "In Progress", "Review", "Done", "Reject"][targetStage]})${targetStage === 5 ? ` Reason: ${reason}` : ""}`,
          ipAddress: req.ip,
        });

        return updated;
      });

      res.json({ success: true, data: task });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/tasks/:id
 * Soft delete (Authorized: Super Admin & Admin only)
 */
router.delete(
  "/:id",
  requireArchive,
  requireScopedTask,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid task ID" });
      }

      await prisma.$transaction(async (tx) => {
        await tx.task.update({
          where: { id },
          data: { deletedAt: new Date() },
        });

        await logAudit(tx, {
          userId: req.user.id,
          userRole: req.user.primaryRole,
          action: "TASK_DELETE",
          detail: `Soft-deleted task #${id}`,
          ipAddress: req.ip,
        });
      });

      res.json({
        success: true,
        message: `Task #${id} soft-deleted successfully.`,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/tasks/:id/restore
 * Restore soft-deleted task (Authorized: Super Admin & Admin only)
 */
router.post(
  "/:id/restore",
  requireArchive,
  requireScopedTask,
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid task ID" });
      }

      const task = await prisma.$transaction(async (tx) => {
        const restored = await tx.task.update({
          where: { id },
          data: { deletedAt: null },
        });

        await logAudit(tx, {
          userId: req.user.id,
          userRole: req.user.primaryRole,
          action: "TASK_RESTORE",
          detail: `Restored soft-deleted task #${id}`,
          ipAddress: req.ip,
        });

        return restored;
      });

      res.json({
        success: true,
        message: `Task #${id} restored successfully.`,
        data: task,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post("/:id/comments", canModifyTask, async (req, res, next) => {
  try {
    const { content } = z
      .object({ content: z.string().trim().min(1).max(5000) })
      .parse(req.body);
    const data = await prisma.taskUpdate.create({
      data: {
        taskId: Number(req.params.id),
        employeeId: req.user.employeeId,
        authorName: req.user.name,
        content,
      },
    });
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
