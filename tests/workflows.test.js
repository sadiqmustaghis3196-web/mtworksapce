import { test } from "node:test";
import assert from "node:assert/strict";
import { initialPreviewData } from "../src/preview/data.js";
import {
  hydrateWorkspace,
  mutateRecord,
  performAction,
  checkAttendance,
  rows,
  balance,
  toCents,
  leaveDays,
} from "../src/modules/store.js";
const fresh = () => hydrateWorkspace(initialPreviewData());
const create = (d, k, body) => mutateRecord(d, k, "POST", null, body);
const edit = (d, k, r, body) => mutateRecord(d, k, "PATCH", r.id, body);
const act = (d, k, r, a, body) => performAction(d, k, r.id, a, body);
const file = {
  name: "proof.txt",
  size: 4,
  type: "text/plain",
  data: "data:text/plain;base64,dGVzdA==",
};
test("clients, contacts and projects persist linked records and protect referenced clients", () => {
  const d = fresh();
  const c = create(d, "clients", {
    company: "Test Company",
    contact: "Test Contact",
    email: "contact@example.test",
  });
  const contact = create(d, "contacts", {
    clientId: c.id,
    name: "Jane",
    email: "jane@example.test",
  });
  const p = create(d, "projects", {
    name: "Customer portal",
    clientId: c.id,
    category: "Web App",
    managerId: "preview-hamza",
    memberIds: ["preview-ali"],
  });
  assert.equal(contact.clientId, c.id);
  assert.equal(p.clientId, c.id);
  assert.throws(() => mutateRecord(d, "clients", "DELETE", c.id), /related/);
  edit(d, "clients", c, { phone: "12345" });
  assert.equal(c.phone, "12345");
});
test("hiring pipeline creates one onboarding employee only after an offer", () => {
  const d = fresh(),
    a = rows(d, "applications")[0];
  assert.throws(() => act(d, "applications", a, "hire"), { status: 409 });
  for (const step of ["screen", "interview", "assess", "offer", "hire"])
    act(d, "applications", a, step);
  const employees = rows(d, "employees").filter((e) => e.email === a.email);
  assert.equal(employees.length, 1);
  assert.equal(employees[0].status, "Onboarding");
  assert.equal(a.employeeId, employees[0].id);
  assert.throws(() => act(d, "applications", a, "hire"), { status: 409 });
});
test("interview scheduling conflicts and evaluations are validated", () => {
  const d = fresh(),
    f = {
      title: "Technical interview",
      applicationId: "app-zara",
      interviewerId: "preview-hamza",
      scheduledAt: "2026-11-04T10:00",
    };
  const i = create(d, "interviews", f);
  assert.throws(() => create(d, "interviews", f), /already has/);
  assert.throws(() => act(d, "interviews", i, "complete", {}), /required/);
  act(d, "interviews", i, "complete", {
    feedback: "Strong fundamentals",
    score: 88,
  });
  assert.equal(i.score, 88);
  assert.equal(i.status, "Completed");
});
test("employee onboarding, department assignment and document upload metadata work", () => {
  const d = fresh(),
    e = create(d, "employees", {
      fullName: "New Engineer",
      email: "new@example.test",
      departmentId: "dept-dev",
      jobTitle: "Engineer",
      joiningDate: "2026-11-02",
      workMode: "Remote",
      annualLeave: 14,
    });
  assert.equal(e.status, "Onboarding");
  act(d, "employees", e, "activate");
  create(d, "documents", {
    title: "Contract",
    employeeId: e.id,
    type: "Contract",
    file,
  });
  assert.equal(
    rows(d, "documents").filter((r) => r.employeeId === e.id).length,
    1,
  );
  assert.throws(
    () => edit(d, "employees", e, { managerId: e.id }),
    /own manager/,
  );
});
test("attendance rejects duplicate check-in and repeated check-out", () => {
  const d = fresh();
  const r = checkAttendance(d, "preview-ali", "check-in");
  assert.equal(r.status, "Checked in");
  assert.throws(() => checkAttendance(d, "preview-ali", "check-in"), /already/);
  checkAttendance(d, "preview-ali", "check-out");
  assert.equal(r.status, "Checked out");
  assert.ok(r.minutes >= 0);
  assert.throws(
    () => checkAttendance(d, "preview-ali", "check-out"),
    /No active/,
  );
});
test("leave approvals deduct working days and cancellation restores the balance", () => {
  const d = fresh(),
    r = create(d, "leaves", {
      employeeId: "preview-ali",
      type: "Annual",
      startDate: "2026-11-02",
      endDate: "2026-11-06",
      reason: "Family visit",
    });
  assert.equal(r.days, 5);
  act(d, "leaves", r, "approve");
  assert.equal(balance(d, "preview-ali", "Annual", "2026"), 9);
  act(d, "leaves", r, "cancel");
  assert.equal(balance(d, "preview-ali", "Annual", "2026"), 14);
  assert.equal(leaveDays("2026-11-02", "2026-11-06"), 5);
});
test("overlapping and excessive leave requests cannot be approved", () => {
  const d = fresh();
  create(d, "leaves", {
    employeeId: "preview-ali",
    type: "Annual",
    startDate: "2026-11-02",
    endDate: "2026-11-06",
    reason: "Leave",
  });
  assert.throws(
    () =>
      create(d, "leaves", {
        employeeId: "preview-ali",
        type: "Annual",
        startDate: "2026-11-03",
        endDate: "2026-11-05",
        reason: "Overlap",
      }),
    /overlapping/,
  );
  const long = create(d, "leaves", {
    employeeId: "preview-sara",
    type: "Annual",
    startDate: "2026-11-02",
    endDate: "2026-11-30",
    reason: "Long leave",
  });
  assert.throws(
    () => act(d, "leaves", long, "approve"),
    /enough leave balance/,
  );
});
test("intern completion requires progress and mentor evaluation", () => {
  const d = fresh(),
    r = create(d, "enrollments", {
      name: "Ali training",
      programId: "program-web",
      employeeId: "preview-ali",
      mentorId: "preview-hamza",
      startDate: "2026-11-02",
      progress: 0,
    });
  act(d, "enrollments", r, "start");
  assert.throws(() => act(d, "enrollments", r, "complete"), /progress review/);
  create(d, "evaluations", {
    title: "Final review",
    enrollmentId: r.id,
    reviewerId: "preview-hamza",
    date: "2026-12-01",
    score: 91,
    feedback: "Ready for delivery work",
  });
  edit(d, "enrollments", r, { progress: 100 });
  act(d, "enrollments", r, "complete");
  assert.equal(r.status, "Completed");
});
test("invoice arithmetic stays decimal-safe and payments cannot exceed outstanding balance", () => {
  const d = fresh(),
    i = create(d, "invoices", {
      number: "INV-TEST",
      clientId: "client-a",
      issueDate: "2026-11-01",
      dueDate: "2026-11-15",
    });
  create(d, "invoiceItems", {
    invoiceId: i.id,
    description: "Small unit test item",
    quantity: 3,
    unitPrice: "0.10",
  });
  assert.equal(i.totalCents, 30);
  act(d, "invoices", i, "issue");
  create(d, "payments", {
    reference: "P-1",
    invoiceId: i.id,
    amount: "0.10",
    date: "2026-11-02",
    method: "Cash",
  });
  assert.equal(i.balance, "0.20");
  assert.equal(i.status, "Partially paid");
  assert.throws(
    () =>
      create(d, "payments", {
        reference: "P-2",
        invoiceId: i.id,
        amount: "1.00",
        date: "2026-11-02",
        method: "Cash",
      }),
    /outstanding/,
  );
  create(d, "payments", {
    reference: "P-3",
    invoiceId: i.id,
    amount: "0.20",
    date: "2026-11-02",
    method: "Cash",
  });
  assert.equal(i.status, "Paid");
  assert.equal(i.balance, "0.00");
  assert.equal(toCents("0.10") + toCents("0.20"), 30);
});
test("issued invoice items and recorded payments are immutable", () => {
  const d = fresh(),
    i = rows(d, "invoices")[0],
    item = rows(d, "invoiceItems")[0];
  act(d, "invoices", i, "issue");
  assert.throws(
    () => edit(d, "invoiceItems", item, { unitPrice: "10.00" }),
    /draft/,
  );
  const p = create(d, "payments", {
    reference: "PAID-1",
    invoiceId: i.id,
    amount: "10.00",
    date: "2026-11-02",
    method: "Cash",
  });
  assert.throws(() => mutateRecord(d, "payments", "DELETE", p.id), /read-only/);
});
test("payroll requires approval and rejects duplicate month or excessive deductions", () => {
  const d = fresh(),
    p = create(d, "payroll", {
      employeeId: "preview-ali",
      month: "2026-11",
      gross: "100.00",
      deductions: "20.00",
    });
  assert.equal(p.net, "80.00");
  assert.throws(() => act(d, "payroll", p, "record"), { status: 409 });
  for (const step of ["submit", "approve", "record"])
    act(d, "payroll", p, step);
  assert.equal(p.status, "Recorded");
  assert.throws(
    () =>
      create(d, "payroll", {
        employeeId: "preview-ali",
        month: "2026-11",
        gross: "100.00",
        deductions: "0.00",
      }),
    /already exists/,
  );
  assert.throws(
    () =>
      create(d, "payroll", {
        employeeId: "preview-sara",
        month: "2026-11",
        gross: "10.00",
        deductions: "20.00",
      }),
    /Deductions/,
  );
});
test("creative deliverables, revisions and approval synchronize linked project tasks", () => {
  const d = fresh(),
    r = rows(d, "creativeRequests")[0];
  act(d, "creativeRequests", r, "start");
  const task = d.tasks.find((t) => t.id === r.taskId);
  assert.equal(task.stage, 2);
  assert.throws(() => act(d, "creativeRequests", r, "submit"), /deliverable/);
  create(d, "creativeAssets", {
    title: "Identity draft",
    requestId: r.id,
    file,
  });
  act(d, "creativeRequests", r, "submit");
  assert.equal(task.stage, 3);
  act(d, "creativeRequests", r, "revise", { reason: "Improve contrast" });
  assert.equal(task.stage, 6);
  assert.equal(task.revisions.length, 1);
  assert.equal(task.revisions[0].status, "Requested");
  assert.equal(rows(d, "creativeRevisions").length, 1);
  act(d, "creativeRequests", r, "start");
  act(d, "creativeRequests", r, "submit");
  act(d, "creativeRequests", r, "approve");
  assert.equal(task.stage, 4);
  assert.equal(task.progress, 100);
});
test("won leads convert to exactly one client", () => {
  const d = fresh(),
    lead = rows(d, "leads")[0];
  for (const step of [
    "contact",
    "qualify",
    "propose",
    "negotiate",
    "win",
    "convert",
  ])
    act(d, "leads", lead, step);
  assert.ok(lead.clientId);
  assert.equal(
    rows(d, "clients").filter((c) => c.id === lead.clientId).length,
    1,
  );
  assert.throws(
    () => act(d, "leads", lead, "convert"),
    /already been converted/,
  );
});
test("support assignment, resolution and reopen workflow retains responses", () => {
  const d = fresh(),
    t = rows(d, "tickets")[0];
  act(d, "tickets", t, "assign");
  act(d, "tickets", t, "start");
  create(d, "ticketComments", {
    ticketId: t.id,
    content: "Issue reproduced",
    file,
  });
  assert.throws(() => act(d, "tickets", t, "resolve", {}), /required/);
  act(d, "tickets", t, "resolve", {
    resolution: "Fixed the submission handler",
  });
  act(d, "tickets", t, "close");
  act(d, "tickets", t, "reopen");
  assert.equal(t.status, "In progress");
  assert.equal(rows(d, "ticketComments")[0].ticketId, t.id);
});
test("department lifecycle and hierarchy protect active staff", () => {
  const d = fresh(),
    dept = rows(d, "departments")[0];
  assert.throws(
    () => act(d, "departments", dept, "deactivate"),
    /active department members/,
  );
  const empty = create(d, "departments", { name: "QA", code: "QA" });
  act(d, "departments", empty, "deactivate");
  assert.equal(empty.status, "Inactive");
  assert.throws(
    () => edit(d, "departments", dept, { parentId: dept.id }),
    /cycle/,
  );
});
test("role matrix, preview accounts and audit logs retain configuration", () => {
  const d = fresh(),
    role = create(d, "roles", {
      name: "TEST_LEAD",
      description: "Review workflow",
      permissions: ["tasks.approve", "tasks.reject"],
    });
  assert.equal(role.permissionCount, 2);
  const user = create(d, "users", {
    name: "Team Lead",
    email: "lead@example.test",
    roleId: role.id,
    employeeId: "preview-ali",
  });
  act(d, "users", user, "deactivate");
  assert.equal(user.status, "Inactive");
  assert.throws(
    () => edit(d, "roles", role, { permissions: ["not.a.permission"] }),
    /Invalid/,
  );
  assert.ok(
    rows(d, "auditLogs").some(
      (a) => a.recordId === user.id && a.action === "TRANSITION",
    ),
  );
});
test("marking notifications read does not create new notifications", () => {
  const d = fresh(),
    n = rows(d, "notifications")[0],
    count = rows(d, "notifications").length;
  act(d, "notifications", n, "read");
  assert.equal(n.status, "Read");
  assert.equal(rows(d, "notifications").length, count);
});
