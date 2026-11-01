import { today, invalid } from "./store.js";
export const dashboardRoles = [
  ["SUPER_ADMIN", "Super Admin"],
  ["ADMIN", "Admin"],
  ["DEPARTMENT_MANAGER", "Department Manager"],
  ["PROJECT_MANAGER", "Project Manager"],
  ["TEAM_LEAD", "Team Lead"],
  ["EMPLOYEE", "Employee"],
  ["INTERN", "Intern"],
  ["HR_MANAGER", "HR Manager"],
  ["FINANCE_MANAGER", "Finance Manager"],
  ["SALES_MANAGER", "Sales Manager"],
  ["SUPPORT_AGENT", "Support Agent"],
];
export const deliveryPhases = [
  {
    id: "planning",
    label: "Plan & assign",
    description: "Daily priorities and ownership",
  },
  {
    id: "development",
    label: "Build / work",
    description: "Implementation in progress",
  },
  { id: "testing", label: "Testing", description: "Reported testing work" },
  {
    id: "quality",
    label: "Quality check",
    description: "Reported quality checks",
  },
  { id: "review", label: "Review", description: "Waiting for approval" },
  { id: "done", label: "Done", description: "Approved work" },
];
export const defaultReminderPreferences = {
  enabled: true,
  dueToday: true,
  overdue: true,
  dueSoon: true,
  review: true,
  dailyDigest: true,
  digestTime: "17:00",
};
export function dateInKarachi(value) {
  if (value === undefined || value === null || value === "") return "";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  return ["year", "month", "day"]
    .map((k) => p.find((v) => v.type === k).value)
    .join("-");
}
export function hydrateDailyWork(data) {
  data.dailyWork ??= {};
  data.dailyWork.entries ??= [];
  data.dailyWork.plans ??= [];
  data.dailyWork.preferences ??= {};
  return data;
}
const assigned = (task, id) =>
  task.assignees?.some((a) => a.employee?.id === id);
const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export function phaseOf(task) {
  if (task.stage === 6) return "revision";
  if (task.stage === 5) return "development";
  return task.stage === 4
    ? "done"
    : task.stage === 3
      ? "review"
      : [0, 1].includes(task.stage)
        ? "planning"
        : ["development", "testing", "quality"].includes(task.workPhase)
          ? task.workPhase
          : "development";
}
export function scopeFor(data, options = {}) {
  const {
    role = "SUPER_ADMIN",
    profileId = "preview-hamza",
    focusId = "all",
  } = options;
  if (!dashboardRoles.some((r) => r[0] === role))
    invalid("Choose a valid dashboard view.");
  const profile = data.records.employees.find((e) => e.id === profileId);
  if (!profile) invalid("Dashboard profile not found.");
  const company = ["SUPER_ADMIN", "ADMIN"].includes(role),
    own = ["EMPLOYEE", "INTERN", "SUPPORT_AGENT"].includes(role),
    historical = options.date && options.date < (options.asOf || today());
  const managed =
    role === "PROJECT_MANAGER"
      ? data.projects.filter(
          (p) => p.managerId === profileId || p.memberIds?.includes(profileId),
        )
      : [];
  let people = data.records.employees.filter(
    (e) => historical || e.status !== "Inactive",
  );
  if (own) people = people.filter((e) => e.id === profileId);
  else if (role === "PROJECT_MANAGER")
    people = people.filter(
      (e) =>
        e.id === profileId ||
        managed.some((p) => p.memberIds?.includes(e.id)) ||
        data.tasks.some(
          (t) => managed.some((p) => p.id === t.projectId) && assigned(t, e.id),
        ),
    );
  else if (!company)
    people = people.filter(
      (e) => e.departmentId === profile.departmentId || e.id === profileId,
    );
  if (focusId !== "all") people = people.filter((e) => e.id === focusId);
  const ids = new Set(people.map((e) => e.id));
  const reported = new Set(
    (data.dailyWork?.entries || [])
      .filter((e) => e.date === options.date && ids.has(e.employeeId))
      .map((e) => e.taskId),
  );
  let tasks = data.tasks.filter(
    (t) =>
      !t.deletedAt &&
      ((company && focusId === "all") ||
        t.assignees?.some((a) => ids.has(a.employee?.id)) ||
        reported.has(t.id)),
  );
  if (role === "PROJECT_MANAGER")
    tasks = tasks.filter(
      (t) => managed.some((p) => p.id === t.projectId) || reported.has(t.id),
    );
  return {
    role,
    profile,
    people,
    tasks,
    isOwn: own,
    canReview: [
      "SUPER_ADMIN",
      "ADMIN",
      "DEPARTMENT_MANAGER",
      "PROJECT_MANAGER",
      "TEAM_LEAD",
    ].includes(role),
    company,
  };
}

function audit(data, entry, title) {
  data.records.auditLogs.unshift({
    id: crypto.randomUUID(),
    entity: "tasks",
    recordId: entry.taskId,
    action: "DAILY_WORK",
    detail: title,
    actor:
      data.currentActor ||
      data.records.employees.find((e) => e.id === entry.employeeId)?.fullName ||
      "Preview member",
    createdAt: entry.createdAt,
  });
}
export function recordDailyUpdate(
  data,
  input,
  { asOf = today(), now = new Date().toISOString() } = {},
) {
  hydrateDailyWork(data);
  const task = data.tasks.find(
      (t) => t.id === Number(input.taskId) && !t.deletedAt,
    ),
    employee = data.records.employees.find((e) => e.id === input.employeeId);
  if (!task || !employee || employee.status === "Inactive")
    invalid("Choose an active employee and task.");
  if (!assigned(task, employee.id))
    invalid("Daily updates must be recorded by an assigned task member.");
  if ((input.date || asOf) !== asOf)
    invalid(
      "Work updates can only be posted for today. Past days remain a read-only history.",
    );
  if (![2, 3].includes(task.stage))
    invalid(
      "Start this task before logging work. Approved work cannot be edited through daily updates.",
    );
  const summary = String(input.summary || "").trim(),
    minutes = Number(input.minutes),
    progress = Number(input.progress),
    phase = input.phase || phaseOf(task),
    blocker = String(input.blocker || "").trim(),
    nextStep = String(input.nextStep || "").trim();
  if (summary.length < 5 || summary.length > 2000)
    invalid("Describe the work in 5–2,000 characters.");
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 720)
    invalid("Time must be a whole number from 0 to 720 minutes.");
  if (
    data.dailyWork.entries
      .filter((e) => e.employeeId === employee.id && e.date === asOf)
      .reduce((s, e) => s + e.minutes, 0) +
      minutes >
    1440
  )
    invalid("A person cannot log more than 24 hours in one day.");
  if (!Number.isInteger(progress) || progress < 0 || progress > 99)
    invalid("Progress must be from 0 to 99. Approval records 100%.");
  if (blocker.length > 1000 || nextStep.length > 1000)
    invalid("Blocker and next-step notes must be under 1,000 characters.");
  if (
    task.stage === 3 &&
    (progress !== Number(task.progress || 0) || phase !== "review")
  )
    invalid(
      "Work under review keeps its submitted progress until a reviewer makes a decision.",
    );
  if (
    task.stage === 2 &&
    !["development", "testing", "quality"].includes(phase)
  )
    invalid(
      "Choose Build / work, Testing or Quality check. Use the task review action to submit for approval.",
    );
  const entry = {
    id: crypto.randomUUID(),
    taskId: task.id,
    employeeId: employee.id,
    date: asOf,
    summary,
    reportedBy: data.currentActor || employee.email || employee.fullName,
    minutes,
    progressBefore: Number(task.progress || 0),
    progressAfter: progress,
    phase,
    stageAtEntry: task.stage,
    blocker,
    nextStep,
    createdAt: now,
  };
  data.dailyWork.entries.push(entry);
  task.progress = progress;
  task.workPhase = phase;
  task.updatedAt = now;
  task.blocker = blocker;
  task.updates ??= [];
  task.updates.unshift({
    id: entry.id,
    authorName: employee.fullName,
    content: `Daily update · ${minutes} min · ${entry.progressBefore}% → ${progress}%\n${summary}${blocker ? `\nBlocker: ${blocker}` : ""}${nextStep ? `\nNext: ${nextStep}` : ""}`,
    createdAt: now,
  });
  audit(
    data,
    entry,
    `#${task.id}: ${employee.fullName} logged ${minutes} min; ${entry.progressBefore}% → ${progress}%.`,
  );
  data.records.notifications.unshift({
    id: `daily-update-${entry.id}`,
    title: "Daily work update",
    message: `${employee.fullName} · #${task.id}: ${summary}`,
    status: "Unread",
    employeeId: employee.id,
    taskId: task.id,
    createdAt: now,
  });
  return entry;
}
export function planDailyTask(
  data,
  input,
  { asOf = today(), now = new Date().toISOString() } = {},
) {
  hydrateDailyWork(data);
  const date = input.date || asOf,
    task = data.tasks.find(
      (t) => t.id === Number(input.taskId) && !t.deletedAt,
    ),
    employee = data.records.employees.find((e) => e.id === input.employeeId),
    target = Number(input.targetProgress),
    goal = String(input.goal || "").trim();
  if (!validDate(date) || date < asOf)
    invalid("Daily plans can be created for today or a future date.");
  if (!task || task.stage === 4 || !employee || !assigned(task, employee.id))
    invalid("Choose unfinished work assigned to the selected employee.");
  if (
    !Number.isInteger(target) ||
    target < Number(task.progress || 0) ||
    target > 100
  )
    invalid(
      "The daily target must be between current progress and 100. Approval is still required for completion.",
    );
  if (goal.length < 3 || goal.length > 1000)
    invalid("Enter a clear daily goal in 3–1,000 characters.");
  const existing = data.dailyWork.plans.find(
    (p) =>
      p.date === date && p.taskId === task.id && p.employeeId === employee.id,
  );
  const plan = {
    ...existing,
    id: existing?.id || crypto.randomUUID(),
    date,
    taskId: task.id,
    employeeId: employee.id,
    targetProgress: target,
    goal,
    baselineProgress: existing?.baselineProgress ?? Number(task.progress || 0),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (existing) Object.assign(existing, plan);
  else data.dailyWork.plans.push(plan);
  audit(
    data,
    { ...plan, createdAt: now },
    `Daily goal for #${task.id}: ${goal}`,
  );
  return plan;
}
export function saveReminderPreferences(data, profileId, input) {
  hydrateDailyWork(data);
  if (!data.records.employees.some((e) => e.id === profileId))
    invalid("Dashboard profile not found.");
  const current = {
      ...defaultReminderPreferences,
      ...data.dailyWork.preferences[profileId],
    },
    next = { ...current };
  for (const key of [
    "enabled",
    "dueToday",
    "overdue",
    "dueSoon",
    "review",
    "dailyDigest",
  ])
    if (key in input) {
      if (typeof input[key] !== "boolean")
        invalid("Reminder options must be on or off.");
      next[key] = input[key];
    }
  if ("digestTime" in input) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.digestTime))
      invalid("Choose a valid daily summary time.");
    next.digestTime = input.digestTime;
  }
  data.dailyWork.preferences[profileId] = next;
  return next;
}
function completedOn(task, date) {
  const events = (task.activities || []).filter(
    (a) => dateInKarachi(a.createdAt) === date,
  );
  const latest = events.reduce(
    (best, event) =>
      !best || Date.parse(event.createdAt) > Date.parse(best.createdAt)
        ? event
        : best,
    null,
  );
  return latest?.toStage === 4;
}

export function dailyDashboard(data, options = {}) {
  hydrateDailyWork(data);
  const date = options.date || today();
  if (!validDate(date)) invalid("Choose a valid work date.");
  const scope = scopeFor(data, options),
    ids = new Set(scope.people.map((p) => p.id)),
    taskIds = new Set(scope.tasks.map((t) => t.id)),
    asOf = options.asOf || today(),
    isToday = date === asOf;
  const entries = data.dailyWork.entries.filter(
      (e) => e.date === date && taskIds.has(e.taskId) && ids.has(e.employeeId),
    ),
    plans = data.dailyWork.plans.filter(
      (p) => p.date === date && taskIds.has(p.taskId) && ids.has(p.employeeId),
    );
  const tasks = scope.tasks
    .filter(
      (t) =>
        plans.some((p) => p.taskId === t.id) ||
        entries.some((e) => e.taskId === t.id) ||
        dateInKarachi(t.dueDate) === date ||
        completedOn(t, date) ||
        (isToday &&
          ([1, 2, 3, 5, 6].includes(t.stage) ||
            (t.stage === 0 && t.assignees?.length > 0))),
    )
    .map((t) => {
      const updates = entries
          .filter((e) => e.taskId === t.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        plan = plans.find((p) => p.taskId === t.id),
        last = updates.at(-1),
        doneToday = completedOn(t, date),
        reportedProgress = isToday
          ? Number(t.progress || 0)
          : doneToday
            ? 100
            : (last?.progressAfter ?? plan?.baselineProgress ?? null);
      return {
        ...t,
        project: data.projects.find((p) => p.id === t.projectId),
        dayEntries: updates,
        dayMinutes: updates.reduce((s, e) => s + e.minutes, 0),
        dayDelta: updates.reduce(
          (s, e) => s + e.progressAfter - e.progressBefore,
          0,
        ),
        dailyPlan: plan,
        reportedProgress,
        reportedPhase: isToday
          ? phaseOf(t)
          : doneToday
            ? "done"
            : last?.phase || "planning",
        doneToday,
        dayBlocker: isToday ? t.blocker || "" : last?.blocker || "",
      };
    });
  const people = scope.people.map((person) => {
    const own = tasks.filter(
        (t) =>
          assigned(t, person.id) ||
          entries.some(
            (e) => e.taskId === t.id && e.employeeId === person.id,
          ) ||
          plans.some((p) => p.taskId === t.id && p.employeeId === person.id),
      ),
      updates = entries.filter((e) => e.employeeId === person.id),
      ownPlans = plans.filter((p) => p.employeeId === person.id);
    return {
      ...person,
      taskCount: own.length,
      updatedTasks: new Set(updates.map((e) => e.taskId)).size,
      minutes: updates.reduce((s, e) => s + e.minutes, 0),
      progressDelta: updates.reduce(
        (s, e) => s + e.progressAfter - e.progressBefore,
        0,
      ),
      completed: own.filter((t) => t.doneToday).length,
      review: own.filter((t) => t.reportedPhase === "review").length,
      blocked: own.filter((t) => t.dayBlocker).length,
      plans: ownPlans.length,
    };
  });
  const preferences = {
    ...defaultReminderPreferences,
    ...data.dailyWork.preferences[scope.profile.id],
  };
  const deadlines = scope.tasks
    .filter((t) => t.stage !== 4 && t.dueDate)
    .sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate))
    .slice(0, 8)
    .map((t) => ({
      ...t,
      project: data.projects.find((p) => p.id === t.projectId),
      deadlineState:
        dateInKarachi(t.dueDate) < date
          ? "Overdue"
          : dateInKarachi(t.dueDate) === date
            ? "Due today"
            : "Upcoming",
    }));
  const agenda = [];
  const add = (title, detail, path) => agenda.push({ title, detail, path });
  if (["SUPER_ADMIN", "ADMIN", "HR_MANAGER"].includes(scope.role)) {
    for (const i of data.records.interviews.filter(
      (i) => i.status === "Scheduled" && dateInKarachi(i.scheduledAt) === date,
    ))
      add(i.title, "Scheduled interview", "/hiring/interviews");
    for (const l of data.records.leaves.filter((l) => l.status === "Pending"))
      add(
        "Leave approval",
        `${data.records.employees.find((e) => e.id === l.employeeId)?.fullName || "Employee"} · ${l.days} days`,
        "/attendance/leaves",
      );
  }
  if (["SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER"].includes(scope.role))
    for (const p of data.records.payroll.filter(
      (p) => p.status === "Pending approval",
    ))
      add(
        "Payroll approval",
        `${data.records.employees.find((e) => e.id === p.employeeId)?.fullName || "Employee"} · ${p.month}`,
        "/finance/payroll",
      );
  if (["SUPER_ADMIN", "ADMIN", "SALES_MANAGER"].includes(scope.role))
    for (const l of data.records.leads.filter(
      (l) =>
        l.followUp &&
        l.followUp <= date &&
        !["Won", "Lost"].includes(l.status) &&
        (scope.company || l.ownerId === scope.profile.id),
    ))
      add(l.company, `Follow-up · ${l.followUp}`, "/crm/leads");
  if (scope.role === "INTERN")
    for (const e of data.records.enrollments.filter(
      (e) => e.employeeId === scope.profile.id && e.status !== "Withdrawn",
    ))
      add(
        e.name,
        `Training progress ${e.progress}% · ${e.status}`,
        "/internships/interns",
      );
  const taskCount = tasks.length,
    updatedCount = new Set(entries.map((e) => e.taskId)).size;
  return {
    date,
    isToday,
    role: scope.role,
    profile: scope.profile,
    isOwn: scope.isOwn,
    canReview: scope.canReview,
    company: scope.company,
    people,
    tasks,
    entries: [...entries].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
    plans,
    preferences,
    deadlines,
    agenda: agenda.slice(0, 8),
    phaseCounts: Object.fromEntries(
      deliveryPhases.map((p) => [
        p.id,
        tasks.filter((t) => t.reportedPhase === p.id).length,
      ]),
    ),
    summary: {
      taskCount,
      updatedCount,
      noUpdate: tasks.filter((t) => !t.dayEntries.length && !t.doneToday)
        .length,
      completed: tasks.filter((t) => t.doneToday).length,
      minutes: entries.reduce((s, e) => s + e.minutes, 0),
      blocked: tasks.filter((t) => t.dayBlocker).length,
      review: tasks.filter((t) => t.reportedPhase === "review").length,
      employees: scope.people.length,
      goalsMet: plans.filter((p) => {
        const t = tasks.find((t) => t.id === p.taskId);
        return (
          t?.reportedProgress !== null &&
          t?.reportedProgress >= p.targetProgress
        );
      }).length,
    },
  };
}
export function syncDailyReminders(data, options = {}) {
  const dashboard = dailyDashboard(data, options),
    prefs = dashboard.preferences;
  if (!dashboard.isToday || !prefs.enabled) return 0;
  const existing = new Set(data.records.notifications.map((n) => n.id)),
    profileId = dashboard.profile.id,
    now = options.now || new Date().toISOString(),
    notifications = [];
  const add = (kind, task, message) => {
    if (
      kind === "review" &&
      data.records.notifications.some(
        (n) =>
          n.taskId === task?.id &&
          n.employeeId === profileId &&
          n.eventType === "task-transition" &&
          n.targetStage === 3 &&
          dateInKarachi(n.createdAt) === dashboard.date,
      )
    )
      return;
    const id = `work-reminder:${dashboard.date}:${profileId}:${kind}:${task?.id || "summary"}`;
    if (existing.has(id)) return;
    existing.add(id);
    notifications.push({
      id,
      title:
        kind === "overdue"
          ? "Deadline overdue"
          : kind === "review"
            ? "Work awaiting review"
            : kind === "digest"
              ? "Daily work summary"
              : "Deadline reminder",
      message,
      employeeId: profileId,
      taskId: task?.id,
      status: "Unread",
      createdAt: now,
      reminderDate: dashboard.date,
      reminderKind: kind,
    });
  };
  const tomorrow = new Date(
    Date.parse(`${dashboard.date}T00:00:00Z`) + 86400000,
  )
    .toISOString()
    .slice(0, 10);
  for (const task of scopeFor(data, options).tasks) {
    if (task.stage === 4) continue;
    const due = dateInKarachi(task.dueDate);
    if (prefs.overdue && due && due < dashboard.date)
      add("overdue", task, `#${task.id} ${task.title} is past its deadline.`);
    else if (prefs.dueToday && due === dashboard.date)
      add("today", task, `#${task.id} ${task.title} is due today.`);
    else if (prefs.dueSoon && due === tomorrow)
      add("soon", task, `#${task.id} ${task.title} is due tomorrow.`);
    if (prefs.review && dashboard.canReview && task.stage === 3)
      add("review", task, `#${task.id} ${task.title} needs a review decision.`);
  }
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(now));
  if (prefs.dailyDigest && time >= prefs.digestTime)
    add(
      "digest",
      null,
      `${dashboard.summary.updatedCount}/${dashboard.summary.taskCount} tasks updated; ${dashboard.summary.minutes} minutes logged; ${dashboard.summary.completed} approved today.`,
    );
  data.records.notifications.unshift(...notifications);
  return notifications.length;
}
