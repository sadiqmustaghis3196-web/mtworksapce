/**
 * MT Nexus Global ERP — Employees & Departments API Router
 */

const express = require("express");
const prisma = require("../db/prisma");

const { authenticate, requireSuperAdmin } = require("../middleware/auth");
const router = express.Router();
// Legacy endpoints remain administrator-only until per-record scope is implemented.
router.use(authenticate, requireSuperAdmin);

/**
 * GET /api/employees — List all employees
 */
router.get("/", async (req, res, next) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: { id: "asc" },
      include: {
        department: true,
        internProfile: true,
      },
    });

    res.json({ success: true, count: employees.length, data: employees });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/employees/:id — Get employee details
 */
router.get("/:id", async (req, res, next) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: {
        department: true,
        internProfile: true,
        assignedTasks: {
          include: { task: true },
        },
      },
    });

    if (!employee) {
      return res
        .status(404)
        .json({ success: false, error: "Employee not found" });
    }

    res.json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/departments — List all 15 departments with member counts
 */
router.get("/meta/departments", async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: { code: "asc" },
      include: {
        employees: {
          select: { id: true, fullName: true, jobTitle: true, colorCode: true },
        },
      },
    });

    res.json({ success: true, count: departments.length, data: departments });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
