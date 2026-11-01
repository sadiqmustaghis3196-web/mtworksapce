import { test } from "node:test";
import assert from "node:assert/strict";
import { initialPreviewData } from "../src/preview/data.js";
import { hydrateWorkspace, workspaceRequest } from "../src/modules/store.js";
import {
  hydrateAccess,
  accountUser,
  can,
  ownData,
  protectAccountChange,
} from "../src/modules/access.js";
import {
  correctAttendance,
  attendanceSummary,
} from "../src/modules/peopleOperations.js";
import { financeFlow } from "../src/modules/financeFlow.js";
const fresh = () => hydrateAccess(hydrateWorkspace(initialPreviewData()));
test("Super/Admin access and administrator creation follow the role hierarchy", () => {
  const d = fresh(),
    superuser = accountUser(d, "ui-preview-user");
  assert.ok(can(superuser, "tasks.delete"));
  d.records.users.push({
    id: "admin",
    name: "Ops Admin",
    email: "ops@test",
    employeeId: "preview-sara",
    roleId: "role-admin",
    status: "Active",
  });
  const admin = accountUser(d, "admin");
  assert.ok(can(admin, "employees.delete"));
  assert.throws(() =>
    protectAccountChange(
      d,
      admin,
      "users",
      null,
      { roleId: "role-super" },
      "POST",
    ),
  );
  assert.throws(() =>
    protectAccountChange(
      d,
      admin,
      "roles",
      "role-employee",
      { permissions: ["tasks.delete"] },
      "PATCH",
    ),
  );
  assert.throws(() =>
    protectAccountChange(
      d,
      superuser,
      "users",
      superuser.id,
      { status: "Inactive" },
      "POST",
    ),
  );
  assert.doesNotThrow(() =>
    protectAccountChange(
      d,
      superuser,
      "users",
      null,
      { roleId: "role-admin" },
      "POST",
    ),
  );
});
test("employee permissions stay scoped and role revocation takes effect without editing stored records", () => {
  const d = fresh();
  d.records.users.push({
    id: "ali-account",
    name: "Ali",
    employeeId: "preview-ali",
    roleId: "role-employee",
    status: "Active",
  });
  let user = accountUser(d, "ali-account");
  assert.ok(can(user, "tasks.update"));
  assert.ok(!can(user, "finance.read"));
  const scoped = ownData(d, user);
  assert.equal(scoped.records.employees.length, 1);
  assert.equal(scoped.records.employees[0].id, "preview-ali");
  assert.ok(
    scoped.tasks.every((t) =>
      t.assignees.some((a) => a.employee.id === "preview-ali"),
    ),
  );
  assert.equal(scoped.records.payments.length, 0);
  d.records.roles.find((r) => r.id === "role-employee").permissions = [
    "tasks.read",
    "employees.read",
  ];
  user = accountUser(d, "ali-account");
  assert.ok(!can(user, "tasks.update"));
});
test("attendance corrections use PKT, subtract breaks, retain prior values and reject duplicates/invalid intervals", () => {
  const d = fresh(),
    input = {
      employeeId: "preview-ali",
      date: "2026-11-01",
      checkIn: "2026-11-01T09:00",
      checkOut: "2026-11-01T18:00",
      breakMinutes: 60,
      correctionReason: "Verified against office register",
    };
  const row = correctAttendance(d, null, input, { email: "manager@test" });
  assert.equal(row.minutes, 480);
  assert.match(row.checkIn, /T04:00/);
  correctAttendance(
    d,
    row.id,
    {
      ...input,
      checkOut: "2026-11-01T19:00",
      correctionReason: "Approved overtime verified",
    },
    { email: "manager@test" },
  );
  assert.equal(row.minutes, 540);
  assert.equal(row.corrections.length, 2);
  assert.equal(row.corrections[1].before.minutes, 480);
  assert.equal(attendanceSummary(d, "preview-ali", "2026-11").days, 1);
  assert.throws(() =>
    correctAttendance(d, null, input, { email: "manager@test" }),
  );
  assert.throws(() =>
    correctAttendance(
      d,
      row.id,
      { ...input, checkOut: "2026-11-01T08:00" },
      { email: "manager@test" },
    ),
  );
  assert.equal(row.minutes, 540);
});
test("cash movements contribute only after posting and voiding reverses the recorded total", () => {
  const d = fresh(),
    before = financeFlow(d).outgoing;
  const x = workspaceRequest(d, "/workspace/cashbook", {
    method: "POST",
    body: {
      reference: "PAY-CLIENT-01",
      direction: "Money out",
      account: "Bank",
      counterpartyType: "Client",
      counterparty: "Client A",
      clientId: "client-a",
      amount: "2000.50",
      date: "2026-11-01",
      purpose: "Approved client refund",
    },
  }).data;
  assert.equal(financeFlow(d).outgoing, before);
  workspaceRequest(d, `/workspace/cashbook/${x.id}/actions/post`, {
    method: "POST",
  });
  assert.equal(financeFlow(d).outgoing, before + 200050);
  assert.throws(() =>
    workspaceRequest(d, `/workspace/cashbook/${x.id}`, { method: "DELETE" }),
  );
  workspaceRequest(d, `/workspace/cashbook/${x.id}/actions/void`, {
    method: "POST",
    body: { reason: "Transaction reversed by bank" },
  });
  assert.equal(financeFlow(d).outgoing, before);
});

test("payroll cash flow uses the recorded date rather than inventing the first day of the salary month", () => {
  const d = fresh();
  d.records.payroll.push({
    id: "recorded-payroll",
    employeeId: "preview-ali",
    month: "2026-10",
    gross: "1000.00",
    deductions: "100.00",
    status: "Recorded",
    recordedAt: "2026-11-02T06:00:00Z",
  });
  const november = financeFlow(d, "2026-11");
  assert.ok(
    november.entries.some(
      (e) =>
        e.id === "recorded-payroll" &&
        e.date === "2026-11-02" &&
        e.amount === 90000,
    ),
  );
  assert.ok(
    !financeFlow(d, "2026-10").entries.some((e) => e.id === "recorded-payroll"),
  );
});
