/**
 * MT Nexus Global ERP — Secure Tasks & Kanban Sprints API Router
 * Enforces server-side authentication, RBAC authorization, Zod validation,
 * Prisma transactions, soft delete/restore, and persistent audit logging.
 */

const express = require('express');
const { z } = require('zod');
const prisma = require('../db/prisma');
const {
  authenticate,
  requireAdminOrSuperAdmin,
  requireProjectManagerOrHigher,
  canModifyTask,
} = require('../middleware/auth');
const { logAudit } = require('../utils/auditLogger');

const router = express.Router();

// All Task APIs require authenticated sessions
router.use(authenticate);

// Validation Schemas
const CreateTaskSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().min(2, 'Task title must be at least 2 characters'),
  description: z.string().optional().default(''),
  category: z.string().default('Web App'),
  stage: z.number().int().min(0).max(5).default(0), // 0: Upcoming, 1: Today To Do, 2: In Progress, 3: Review, 4: Done, 5: Reject
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent', 'Critical']).default('Medium'),
  dueDate: z.string().optional(),
  dueTime: z.string().optional().default('18:00'),
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
  stage: z.number().int().min(0).max(5).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent', 'Critical']).optional(),
  dueDate: z.string().nullable().optional(),
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
  reason: z.string().optional(),
});

/**
 * GET /api/tasks
 * Retrieve active tasks with filtering and search
 */
router.get('/', async (req, res, next) => {
  try {
    const { stage, category, search, priority, includeDeleted } = req.query;

    const where = {};
    if (includeDeleted !== 'true') {
      where.deletedAt = null;
    }

    if (stage !== undefined && stage !== '') {
      where.stage = parseInt(stage, 10);
    }
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { id: 'asc' },
      include: {
        assignees: {
          include: {
            employee: true,
          },
        },
        updates: {
          orderBy: { createdAt: 'desc' },
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
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid task ID format' });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignees: {
          include: { employee: true },
        },
        updates: {
          orderBy: { createdAt: 'desc' },
        },
        checklists: {
          include: { items: true },
        },
        attachments: true,
        project: true,
        department: true,
        dependencies: true,
      },
    });

    if (!task || task.deletedAt) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
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
router.post('/', requireProjectManagerOrHigher, async (req, res, next) => {
  try {
    const parsed = CreateTaskSchema.parse(req.body);

    const task = await prisma.$transaction(async (tx) => {
      let taskId = parsed.id;
      if (!taskId) {
        const maxTask = await tx.task.findFirst({ orderBy: { id: 'desc' } });
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
        action: 'TASK_CREATE',
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
router.patch('/:id', canModifyTask, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = UpdateTaskSchema.parse(req.body);

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
        action: 'TASK_UPDATE',
        detail: `Updated task #${id} (${Object.keys(parsed).join(', ')})`,
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
router.post('/:id/move', canModifyTask, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { targetStage, reason } = MoveTaskSchema.parse(req.body);

    // Stage 4 (Done / Approved) requires Project Manager or higher
    if (targetStage === 4) {
      const canApprove =
        req.user.isSuperAdmin ||
        req.user.roles.includes('Admin') ||
        req.user.roles.includes('Administrator') ||
        req.user.roles.includes('Owner / CEO') ||
        req.user.roles.includes('Operations Manager') ||
        req.user.roles.includes('Project Manager');

      if (!canApprove) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Only Project Managers or Leadership can approve tasks to Done stage.',
        });
      }
    }

    const updateData = { stage: targetStage };

    if (targetStage === 4) {
      updateData.approvedBy = `${req.user.primaryRole} (${req.user.employeeName || req.user.email})`;
      updateData.approvedAt = new Date();
      updateData.rejectedBy = null;
      updateData.rejectedAt = null;
      updateData.rejectReason = null;
    } else if (targetStage === 5) {
      updateData.rejectedBy = `${req.user.primaryRole} (${req.user.employeeName || req.user.email})`;
      updateData.rejectedAt = new Date();
      updateData.rejectReason = reason || 'Deliverable rejected by reviewer.';
    }

    const task = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: updateData,
      });

      await logAudit(tx, {
        userId: req.user.id,
        userRole: req.user.primaryRole,
        action: 'TASK_STAGE_CHANGE',
        detail: `Task #${id} moved to stage ${targetStage} (${['Upcoming','Today To Do','In Progress','Review','Done','Reject'][targetStage]})${targetStage === 5 ? ` Reason: ${reason}` : ''}`,
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
 * DELETE /api/tasks/:id
 * Soft delete (Authorized: Super Admin & Admin only)
 */
router.delete('/:id', requireAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid task ID' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await logAudit(tx, {
        userId: req.user.id,
        userRole: req.user.primaryRole,
        action: 'TASK_DELETE',
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
});

/**
 * POST /api/tasks/:id/restore
 * Restore soft-deleted task (Authorized: Super Admin & Admin only)
 */
router.post('/:id/restore', requireAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid task ID' });
    }

    const task = await prisma.$transaction(async (tx) => {
      const restored = await tx.task.update({
        where: { id },
        data: { deletedAt: null },
      });

      await logAudit(tx, {
        userId: req.user.id,
        userRole: req.user.primaryRole,
        action: 'TASK_RESTORE',
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
});

module.exports = router;
