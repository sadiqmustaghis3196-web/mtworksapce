import { test } from "node:test";
import assert from "node:assert/strict";
import { initialPreviewData } from "../src/preview/data.js";
import { hydrateWorkspace } from "../src/modules/store.js";
import {
  hydrateDailyWork,
  dailyDashboard,
  recordDailyUpdate,
  planDailyTask,
  scopeFor,
  saveReminderPreferences,
  syncDailyReminders,
  dateInKarachi,
} from "../src/modules/dailyWork.js";
const day = "2026-11-01",
  now = "2026-11-01T14:00:00Z",
  fresh = () => hydrateDailyWork(hydrateWorkspace(initialPreviewData()));
const view = (role = "SUPER_ADMIN", profileId = "preview-hamza") => ({
  role,
  profileId,
  date: day,
  asOf: day,
  now,
});
const log = (extra = {}) => ({
  taskId: 426,
  employeeId: "preview-ali",
  date: day,
  summary: "Completed responsive states and mobile checks",
  minutes: 45,
  progress: 80,
  phase: "testing",
  blocker: "",
  nextStep: "Run accessibility checks",
  ...extra,
});
test("admin sees all eligible work while employee and intern views contain only assignments", () => {
  const d = fresh(),
    admin = dailyDashboard(d, view()),
    employee = dailyDashboard(d, view("EMPLOYEE", "preview-ali"));
  assert.equal(admin.summary.employees, 4);
  assert.ok(admin.tasks.length > employee.tasks.length);
  assert.ok(
    employee.tasks.every((t) =>
      t.assignees.some((a) => a.employee.id === "preview-ali"),
    ),
  );
  assert.equal(employee.canReview, false);
  assert.equal(
    dailyDashboard(d, view("INTERN", "preview-ali")).canReview,
    false,
  );
  assert.equal(dailyDashboard(d, view("FINANCE_MANAGER")).canReview, false);
});
test("department and project-manager perspectives follow team/project membership", () => {
  const d = fresh(),
    dept = scopeFor(d, view("DEPARTMENT_MANAGER"));
  assert.ok(dept.people.every((p) => p.departmentId === "dept-dev"));
  const pm = scopeFor(d, view("PROJECT_MANAGER"));
  assert.ok(pm.tasks.some((t) => t.projectId === "preview-brand"));
  assert.ok(pm.people.some((p) => p.id === "preview-kiran"));
});
test("sample done tasks and existing progress are not reported as today’s work", () => {
  const d = fresh(),
    result = dailyDashboard(d, view());
  assert.equal(result.summary.completed, 0);
  assert.equal(result.summary.updatedCount, 0);
  assert.equal(result.summary.minutes, 0);
  assert.equal(result.entries.length, 0);
});
test("daily progress records the change from the previous overall value, time and reported phase", () => {
  const d = fresh(),
    entry = recordDailyUpdate(d, log(), { asOf: day, now });
  assert.equal(entry.progressBefore, 60);
  assert.equal(entry.progressAfter, 80);
  const result = dailyDashboard(d, view("EMPLOYEE", "preview-ali")),
    task = result.tasks.find((t) => t.id === 426);
  assert.equal(result.summary.minutes, 45);
  assert.equal(task.dayDelta, 20);
  assert.equal(task.reportedProgress, 80);
  assert.equal(task.reportedPhase, "testing");
  assert.equal(result.phaseCounts.testing, 1);
  assert.equal(result.summary.updatedCount, 1);
});
test("unassigned employees, future dates and unapproved 100% progress are rejected", () => {
  for (const invalid of [
    log({ employeeId: "preview-sara" }),
    log({ date: "2026-11-02" }),
    log({ progress: 100 }),
    log({ minutes: 721 }),
    log({ phase: "done" }),
  ])
    assert.throws(() =>
      recordDailyUpdate(fresh(), invalid, { asOf: day, now }),
    );
});
test("blocked work and cleared blockers update the team report without losing earlier entries", () => {
  const d = fresh();
  recordDailyUpdate(d, log({ blocker: "Waiting for client credentials" }), {
    asOf: day,
    now,
  });
  assert.equal(dailyDashboard(d, view()).summary.blocked, 1);
  recordDailyUpdate(d, log({ progress: 85, minutes: 15, blocker: "" }), {
    asOf: day,
    now: "2026-11-01T15:00:00Z",
  });
  const result = dailyDashboard(d, view());
  assert.equal(result.summary.blocked, 0);
  assert.equal(result.summary.minutes, 60);
  assert.equal(result.tasks.find((t) => t.id === 426).dayDelta, 25);
  assert.equal(result.entries.length, 2);
});
test("daily goals are unique per task/person/day and require assigned unfinished work", () => {
  const d = fresh(),
    body = {
      taskId: 426,
      employeeId: "preview-ali",
      date: day,
      targetProgress: 80,
      goal: "Finish responsive states",
    };
  planDailyTask(d, body, { asOf: day, now });
  planDailyTask(d, { ...body, targetProgress: 85 }, { asOf: day, now });
  assert.equal(d.dailyWork.plans.length, 1);
  assert.equal(d.dailyWork.plans[0].baselineProgress, 60);
  assert.throws(() =>
    planDailyTask(
      d,
      { ...body, employeeId: "preview-sara" },
      { asOf: day, now },
    ),
  );
  recordDailyUpdate(d, log({ progress: 85 }), { asOf: day, now });
  assert.equal(
    dailyDashboard(d, view("EMPLOYEE", "preview-ali")).summary.goalsMet,
    1,
  );
});
test("historical daily progress remains its recorded snapshot after later task changes", () => {
  const d = fresh();
  recordDailyUpdate(d, log(), { asOf: day, now });
  d.tasks.find((t) => t.id === 426).progress = 95;
  const history = dailyDashboard(d, {
    ...view("EMPLOYEE", "preview-ali"),
    asOf: "2026-11-02",
  });
  assert.equal(history.isToday, false);
  assert.equal(history.tasks.find((t) => t.id === 426).reportedProgress, 80);
  assert.equal(
    history.tasks.find((t) => t.id === 426).reportedPhase,
    "testing",
  );
  assert.equal(history.summary.minutes, 45);
});
test("approval counts as done today only when its transition was recorded on that work date", () => {
  const d = fresh(),
    task = d.tasks.find((t) => t.id === 423);
  task.stage = 4;
  task.activities.push({ toStage: 4, fromStage: 3, createdAt: now });
  const result = dailyDashboard(d, view());
  assert.equal(result.summary.completed, 1);
  assert.equal(result.phaseCounts.done, 1);
});
test("reminders use the employee scope, honor preferences and deduplicate refreshes", () => {
  const d = fresh();
  saveReminderPreferences(d, "preview-ali", { dailyDigest: false });
  const options = view("EMPLOYEE", "preview-ali");
  assert.ok(syncDailyReminders(d, options) > 0);
  assert.equal(syncDailyReminders(d, options), 0);
  const reminders = d.records.notifications.filter(
    (n) => n.reminderDate === day,
  );
  assert.ok(reminders.every((n) => n.employeeId === "preview-ali"));
  assert.ok(
    reminders.every((n) =>
      scopeFor(d, options).tasks.some((t) => t.id === n.taskId),
    ),
  );
  const off = fresh();
  saveReminderPreferences(off, "preview-ali", { enabled: false });
  assert.equal(syncDailyReminders(off, options), 0);
});
test("timezone boundaries and unscheduled tasks do not create false due-today alerts", () => {
  assert.equal(dateInKarachi("2026-10-31T22:00:00Z"), day);
  assert.equal(dateInKarachi(undefined), "");
  assert.equal(dateInKarachi(null), "");
  const d = fresh();
  d.tasks.forEach((t) => {
    t.dueDate = null;
    t.stage = 2;
  });
  saveReminderPreferences(d, "preview-ali", {
    dailyDigest: false,
    review: false,
  });
  assert.equal(syncDailyReminders(d, view("EMPLOYEE", "preview-ali")), 0);
});
test("reminder time validation and past/future work-date validation are explicit", () => {
  const d = fresh();
  assert.throws(() =>
    saveReminderPreferences(d, "preview-ali", { digestTime: "25:10" }),
  );
  assert.throws(() => dailyDashboard(d, { ...view(), date: "2026-02-31" }));
  assert.equal(syncDailyReminders(d, { ...view(), date: "2026-10-31" }), 0);
});
test("a completed task reopened the same day is not still counted as done", () => {
  const d = fresh(),
    task = d.tasks.find((t) => t.id === 423);
  task.stage = 2;
  task.activities = [
    { toStage: 2, fromStage: 4, createdAt: "2026-11-01T15:00:00Z" },
    { toStage: 4, fromStage: 3, createdAt: now },
  ];
  assert.equal(dailyDashboard(d, view()).summary.completed, 0);
});
test("historical reports retain an employee’s logged work after reassignment", () => {
  const d = fresh();
  recordDailyUpdate(d, log(), { asOf: day, now });
  d.tasks.find((t) => t.id === 426).assignees = [
    {
      id: "new-assignment",
      employee: d.records.employees.find((e) => e.id === "preview-sara"),
    },
  ];
  const report = dailyDashboard(d, {
    ...view("EMPLOYEE", "preview-ali"),
    asOf: "2026-11-02",
  });
  assert.equal(report.tasks.find((t) => t.id === 426).reportedProgress, 80);
  assert.ok(report.people[0].taskCount >= report.people[0].updatedTasks);
});

test("assigned upcoming cards enter the current pipeline without inventing daily activity", () => {
  const data = fresh();
  data.tasks.push({
    id: 9999,
    title: "New assigned brief",
    stage: 0,
    progress: 0,
    assignees: [
      {
        id: "new-assignment",
        employee: { id: "preview-ali", fullName: "Ali Raza" },
      },
    ],
    activities: [],
  });
  const report = dailyDashboard(data, view("EMPLOYEE", "preview-ali"));
  const task = report.tasks.find((t) => t.id === 9999);
  assert.ok(task);
  assert.equal(task.reportedPhase, "planning");
  assert.equal(task.dayEntries.length, 0);
  assert.equal(task.dayMinutes, 0);
  assert.equal(task.dayDelta, 0);
  assert.ok(
    !dailyDashboard(data, {
      ...view("EMPLOYEE", "preview-ali"),
      date: "2026-11-02",
    }).tasks.some((t) => t.id === 9999),
  );
});
