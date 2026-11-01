import { correctAttendance } from "../modules/peopleOperations";
import {
  hydrateAccess,
  accountUser,
  requireAccess,
  protectAccountChange,
  entityModule,
  moduleKey,
  adminUser,
  ownTask,
  ownData,
  can,
} from "../modules/access";
import {
  updateRevisionRound,
  addRevisionUpdate,
} from "../modules/taskRevisions";
import {
  refreshNotificationFeed,
  notificationFeed,
} from "../modules/notifications";
import { validateDocument } from "../modules/taskDocument";
import {
  hydrateDailyWork,
  dailyDashboard,
  recordDailyUpdate,
  planDailyTask,
  saveReminderPreferences,
  syncDailyReminders,
} from "../modules/dailyWork";
import { validateFile } from "../services/files";
import { hydrateWorkspace, workspaceRequest, today } from "../modules/store";
import { initialPreviewData, previewUser } from "./data";
import { previewCredentials } from "./config";
const DATA_KEY = "mt-nexus-ui-preview-v1",
  SESSION_KEY = "mt-nexus-ui-preview-session";
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(DATA_KEY));
    if (
      data?.version === 1 &&
      Array.isArray(data.tasks) &&
      Array.isArray(data.projects)
    )
      return data;
  } catch {}
  return initialPreviewData();
}
function save(data) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("mt-workspace-change"));
  } catch {
    fail("Browser storage is unavailable. Preview changes could not be saved.");
  }
}
const decorate = (task, data) => ({
  ...task,
  dailyReports: (data.dailyWork?.entries || [])
    .filter((e) => e.taskId === task.id)
    .map((e) => ({
      ...e,
      employeeName: data.records?.employees?.find((p) => p.id === e.employeeId)
        ?.fullName,
    })),
  project: data.projects.find((p) => p.id === task.projectId),
  assignees: task.assignees?.map((a) => ({
    ...a,
    employee:
      data.records?.employees?.find((e) => e.id === a.employee?.id) ||
      a.employee,
  })),
});
export function resetPreview() {
  localStorage.removeItem(DATA_KEY);
}
export async function previewApi(path, { method = "GET", body = {} } = {}) {
  if (path === "/auth/login" && method === "POST") {
    const world = hydrateAccess(hydrateDailyWork(hydrateWorkspace(load())));
    const account = world.records.users.find(
      (u) =>
        u.email.toLowerCase() === body.email?.trim().toLowerCase() &&
        u.status === "Active",
    );
    if (!account || body.password !== previewCredentials.password)
      fail(
        "Use the UI preview password shown on the form and an active preview account email.",
        401,
      );
    sessionStorage.setItem(SESSION_KEY, account.id);
    const signedIn = accountUser(world, account.id);
    sessionStorage.setItem(
      "mt-daily-dashboard-view",
      JSON.stringify({
        role: ["SUPER_ADMIN", "ADMIN", "INTERN"].includes(signedIn.primaryRole)
          ? signedIn.primaryRole
          : "EMPLOYEE",
        profileId: signedIn.employeeId || "preview-hamza",
        focusId: "all",
      }),
    );
    save(world);
    return { user: accountUser(world, account.id) };
  }
  if (path === "/auth/logout") {
    sessionStorage.removeItem(SESSION_KEY);
    return { success: true };
  }
  if (
    path === "/auth/forgot-password" ||
    path === "/auth/reset-password" ||
    path === "/auth/password"
  )
    fail(
      "Password changes and email delivery are unavailable in UI preview. Use the displayed test login.",
    );
  const data = hydrateAccess(hydrateDailyWork(hydrateWorkspace(load())));
  const stored = sessionStorage.getItem(SESSION_KEY);
  const user = accountUser(
    data,
    stored === "active" ? "ui-preview-user" : stored,
  );
  if (!user) fail("Sign in to an active UI preview account.", 401);
  if (path === "/auth/me") return { user };
  data.currentActor = user.email;
  const ownOptions = (options) =>
    adminUser(user)
      ? options
      : {
          role: user.primaryRole === "INTERN" ? "INTERN" : "EMPLOYEE",
          profileId: user.employeeId,
        };
  const entityMatch = path.match(/^\/workspace\/([A-Za-z]+)(?:\/([^/]+))?/);
  if (entityMatch && entityMatch[1] !== "data") {
    const entity = entityMatch[1],
      module = entityModule(entity);
    const action =
      method === "GET"
        ? "read"
        : method === "DELETE"
          ? "delete"
          : method === "POST" &&
              !path.includes("/actions/") &&
              !["check-in", "check-out"].includes(entityMatch[2])
            ? "create"
            : "update";
    const ownAttendance =
      entity === "attendance" &&
      ["check-in", "check-out"].includes(entityMatch[2]) &&
      body.employeeId === user.employeeId;
    const ownNotification =
      entity === "notifications" &&
      notificationFeed(data, ownOptions({})).items.some(
        (n) => n.id === entityMatch[2],
      );
    if (!ownAttendance && !ownNotification)
      requireAccess(user, `${moduleKey(module)}.${action}`);
    if (
      !adminUser(user) &&
      [
        "employees",
        "attendance",
        "enrollments",
        "documents",
        "leaves",
      ].includes(entity) &&
      entityMatch[2] &&
      !["check-in", "check-out"].includes(entityMatch[2]) &&
      !can(user, `${moduleKey(module)}.manage`) &&
      !can(user, `${moduleKey(module)}.update`) &&
      !can(user, `${moduleKey(module)}.create`) &&
      !can(user, `${moduleKey(module)}.delete`)
    ) {
      const record = data.records[entity]?.find((r) => r.id === entityMatch[2]);
      if (record && (record.employeeId || record.id) !== user.employeeId)
        fail("This employee record is outside your access.", 403);
    }
    protectAccountChange(
      data,
      user,
      entity,
      entityMatch[2],
      path.endsWith("/actions/deactivate")
        ? { ...body, status: "Inactive" }
        : body,
      method,
    );
  }
  if (path.startsWith("/tasks")) {
    if (method === "GET") requireAccess(user, "tasks.read");
    const id = Number(path.split("/")[2]),
      task = data.tasks.find((t) => t.id === id);
    if (id && !ownTask(user, task) && !can(user, "tasks.assign"))
      fail("This task is not assigned to you.", 403);
    if (method !== "GET") {
      let perm =
        method === "DELETE"
          ? "tasks.delete"
          : path === "/tasks"
            ? "tasks.create"
            : path.endsWith("/assign")
              ? "tasks.assign"
              : body.targetStage === 4
                ? "tasks.approve"
                : body.targetStage === 5
                  ? "tasks.reject"
                  : body.targetStage === 6
                    ? "tasks.approve"
                    : body.targetStage === 3
                      ? "tasks.submit_review"
                      : "tasks.update";
      requireAccess(user, perm);
    }
  }
  const dailyURL = new URL(path, "http://preview.local");
  if (dailyURL.pathname === "/notifications/feed" && method === "GET") {
    const options = ownOptions(
      Object.fromEntries(
        ["role", "profileId"]
          .filter((k) => dailyURL.searchParams.has(k))
          .map((k) => [k, dailyURL.searchParams.get(k)]),
      ),
    );
    const { created, ...feed } = refreshNotificationFeed(data, options);
    if (created) save(data);
    return { data: feed };
  }
  if (path === "/notifications/read-all" && method === "POST") {
    const feed = notificationFeed(
      data,
      ownOptions({ role: body.role, profileId: body.profileId }),
    );
    for (const n of feed.items) n.status = "Read";
    save(data);
    return { success: true };
  }
  if (dailyURL.pathname === "/dashboard/daily" && method === "GET") {
    const options = ownOptions(
      Object.fromEntries(
        ["role", "profileId", "focusId", "date"]
          .filter((key) => dailyURL.searchParams.has(key))
          .map((key) => [key, dailyURL.searchParams.get(key)]),
      ),
    );
    const dashboardData = can(user, "tasks.read")
      ? data
      : { ...data, tasks: [] };
    const created = syncDailyReminders(dashboardData, options);
    if (created) save(data);
    return { data: dailyDashboard(dashboardData, options) };
  }
  if (path === "/dashboard/daily/update" && method === "POST") {
    if (!adminUser(user) && body.employeeId !== user.employeeId)
      fail("Record your own daily work only.", 403);
    requireAccess(user, "tasks.update");
    const entry = recordDailyUpdate(data, body);
    save(data);
    return { data: entry };
  }
  if (path === "/dashboard/daily/plan" && method === "POST") {
    if (!adminUser(user) && body.employeeId !== user.employeeId)
      fail("Plan your own assigned work only.", 403);
    const plan = planDailyTask(data, body);
    save(data);
    return { data: plan };
  }
  if (path === "/dashboard/daily/preferences" && method === "PATCH") {
    const preferences = saveReminderPreferences(
      data,
      adminUser(user) ? body.profileId : user.employeeId,
      body.preferences || {},
    );
    save(data);
    return { data: preferences };
  }

  const notificationAction = path.match(
    /^\/workspace\/notifications\/([^/]+)\/actions\/(read|unread)$/,
  );
  if (notificationAction && method === "POST") {
    const n = data.records.notifications.find(
      (n) => n.id === notificationAction[1],
    );
    if (!n) fail("Notification no longer available.", 404);
    n.status = notificationAction[2] === "read" ? "Read" : "Unread";
    save(data);
    return { data: n };
  }
  if (
    entityMatch?.[1] === "attendance" &&
    ["POST", "PATCH"].includes(method) &&
    !["check-in", "check-out"].includes(entityMatch[2])
  ) {
    requireAccess(
      user,
      method === "POST" ? "attendance.create" : "attendance.update",
    );
    const record = correctAttendance(data, entityMatch[2], body, user);
    save(data);
    return { data: record };
  }
  if (
    entityMatch &&
    ["leads", "opportunities", "salesActivities"].includes(entityMatch[1]) &&
    method === "POST" &&
    !path.includes("/actions/") &&
    !adminUser(user) &&
    !can(user, "crm.manage")
  )
    body.ownerId = user.employeeId;
  if (path.startsWith("/workspace/")) {
    const result = workspaceRequest(data, path, { method, body });
    if (method !== "GET") {
      save(data);
      if (["users", "roles"].includes(entityMatch?.[1]))
        window.dispatchEvent(new Event("mt-access-change"));
    }
    if (path === "/workspace/data" && method === "GET")
      return { data: ownData(result.data, user) };
    if (method === "GET" && !adminUser(user) && entityMatch) {
      const scoped = ownData(data, user),
        key = entityMatch[1],
        list = key === "projects" ? scoped.projects : scoped.records[key];
      if (list) {
        if (entityMatch[2]) {
          const record = list.find((r) => r.id === entityMatch[2]);
          if (!record) fail("This record is outside your access.", 403);
          return { data: record };
        }
        return { data: list };
      }
    }
    return result;
  }
  if (path === "/projects" && method === "GET")
    return { data: ownData(data, user).projects };
  if (path === "/dashboard/overview")
    return {
      data: {
        projects: data.projects.length,
        tasks: data.tasks.length,
        employees: data.records.employees.filter((e) => e.status !== "Inactive")
          .length,
        clients: data.records.clients.filter((c) => c.status === "Active")
          .length,
        attendance: data.records.attendance.filter((a) => a.date === today())
          .length,
        pendingLeaves: data.records.leaves.filter((l) => l.status === "Pending")
          .length,
        approvals: [
          {
            title: "Leave requests",
            count: data.records.leaves.filter((l) => l.status === "Pending")
              .length,
            path: "/attendance/leaves",
          },
          {
            title: "Payroll approvals",
            count: data.records.payroll.filter(
              (p) => p.status === "Pending approval",
            ).length,
            path: "/finance/payroll",
          },
          {
            title: "Creative reviews",
            count: data.records.creativeRequests.filter(
              (r) => r.status === "Review",
            ).length,
            path: "/creative/requests",
          },
        ],
        activity: data.records.auditLogs.slice(0, 8),
        inProgress: data.tasks.filter((t) => t.stage === 2).length,
        review: data.tasks.filter((t) => t.stage === 3).length,
        completed: data.tasks.filter((t) => t.stage === 4).length,
        deadlines: data.tasks
          .filter((t) => t.stage !== 4 && t.dueDate)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .slice(0, 8),
      },
    };
  if (path === "/tasks") {
    if (method === "GET")
      return {
        data: data.tasks
          .filter((t) => ownTask(user, t) || can(user, "tasks.assign"))
          .map((t) => decorate(t, data)),
      };
    if (method === "POST") {
      if (!body.title?.trim() || body.title.trim().length < 2)
        fail("Enter a task title of at least 2 characters.");
      const documentBlocks =
        body.documentBlocks === undefined
          ? undefined
          : validateDocument(body.documentBlocks);
      const employeeIds = body.employeeIds || [];
      const project = data.projects.find((p) => p.id === body.projectId);
      if (
        !Array.isArray(employeeIds) ||
        employeeIds.some(
          (id) =>
            !data.records.employees.some(
              (e) => e.id === id && e.status !== "Offboarded",
            ) ||
            (project?.memberIds?.length && !project.memberIds.includes(id)),
        )
      )
        fail("Choose valid project members.");
      const task = {
        ...body,
        documentBlocks,
        id:
          Math.max(
            100,
            ...data.tasks.map((t) => t.id),
            ...(data.archivedTasks || []).map((t) => t.id),
          ) + 1,
        stage: 0,
        progress: 0,
        createdAt: new Date().toISOString(),
        assignees: [...new Set(employeeIds)].map((id) => ({
          id: crypto.randomUUID(),
          employee: data.records.employees.find((e) => e.id === id),
        })),
        updates: [],
        activities: [],
        checklists: [],
        attachments: [],
      };
      delete task.employeeIds;
      data.tasks.push(task);
      for (const id of [...new Set(employeeIds)])
        data.records.notifications.unshift({
          id: crypto.randomUUID(),
          title: "New task assignment",
          message: `#${task.id} ${task.title}`,
          employeeId: id,
          taskId: task.id,
          status: "Unread",
          createdAt: new Date().toISOString(),
        });
      save(data);
      return { success: true, data: decorate(task, data) };
    }
  }
  const checklist = path.match(
    /^\/tasks\/(\d+)\/(?:checklists\/([^/]+)\/items|checklist-items\/([^/]+))$/,
  );
  if (checklist) {
    const task = data.tasks.find((t) => t.id === Number(checklist[1]));
    if (!task) fail("Task not found.", 404);
    if (checklist[2] && method === "POST") {
      const list = task.checklists.find((c) => c.id === checklist[2]);
      if (!list) fail("Checklist not found.", 404);
      if (!body.text?.trim()) fail("Enter a checklist item.");
      list.items.push({
        id: crypto.randomUUID(),
        text: body.text.trim(),
        isDone: false,
      });
    } else if (checklist[3] && method === "PATCH") {
      const item = task.checklists
        .flatMap((c) => c.items)
        .find((i) => i.id === checklist[3]);
      if (!item) fail("Checklist item not found.", 404);
      if (typeof body.isDone !== "boolean") fail("Invalid checklist state.");
      item.isDone = body.isDone;
    } else fail("Unsupported checklist operation.");
    save(data);
    return { data: decorate(task, data) };
  }
  const match = path.match(
    /^\/tasks\/(\d+)(?:\/(transition|comments|assign|checklists|attachments|revision-updates))?$/,
  );
  if (match) {
    const task = data.tasks.find((t) => t.id === Number(match[1]));
    if (!task) fail("Preview task not found.", 404);
    if (method === "GET") return { data: decorate(task, data) };
    if (method === "DELETE" && !match[2]) {
      if (data.tasks.some((t) => t.parentTaskId === task.id))
        fail("Delete or reassign subtasks first.");
      if (data.records.creativeRequests.some((r) => r.taskId === task.id))
        fail(
          "This card is linked to Creative Studio. Close that workflow before deleting the card.",
        );
      task.deletedAt = new Date().toISOString();
      task.deletedBy = user.id;
      data.archivedTasks ??= [];
      data.archivedTasks.push(task);
      data.tasks = data.tasks.filter((t) => t.id !== task.id);
      data.records.auditLogs.unshift({
        id: crypto.randomUUID(),
        entity: "tasks",
        recordId: String(task.id),
        action: "DELETED",
        actor: user.email,
        detail: `Task #${task.id} ${task.title} archived`,
        createdAt: task.deletedAt,
      });
      save(data);
      return { success: true };
    }
    if (match[2] === "transition" && method === "POST") {
      const allowed = {
        0: [1],
        1: [2],
        2: [3, 6],
        3: [4, 5, 6],
        4: [2, 6],
        5: [2],
        6: [2],
      };
      if (!allowed[task.stage].includes(body.targetStage))
        fail("This preview stage transition is not allowed.", 409);
      if (body.targetStage === 5 && !body.reason?.trim())
        fail("A rejection reason is required.");
      updateRevisionRound(
        task,
        body.targetStage,
        body.reason,
        undefined,
        user.name || user.email,
      );
      task.activities.unshift({
        id: crypto.randomUUID(),
        fromStage: task.stage,
        toStage: body.targetStage,
        reason: body.reason,
        createdAt: new Date().toISOString(),
      });
      task.stage = body.targetStage;
      if (task.stage === 2) task.workPhase = "development";
      if (task.stage === 4) {
        task.blocker = "";
        task.workPhase = "done";
      }
      const creative = data.records.creativeRequests.find(
        (r) => r.taskId === task.id,
      );
      if (creative)
        creative.status =
          {
            2: "In progress",
            3: "Review",
            4: "Approved",
            5: "Revision requested",
            6: "Revision requested",
          }[task.stage] || creative.status;
      if (task.stage === 4) {
        task.progress = 100;
        task.approvedBy = user.name || user.email;
        task.rejectReason = null;
      }
      if (task.stage === 5) {
        task.rejectedBy = user.name || user.email;
        task.rejectReason = body.reason;
      }
      const recipients =
        body.targetStage === 3
          ? data.records.employees
              .filter(
                (e) =>
                  e.id ===
                    data.projects.find((p) => p.id === task.projectId)
                      ?.managerId || e.id === "preview-hamza",
              )
              .map((e) => e.id)
          : task.assignees.map((a) => a.employee.id);
      const titles = {
        1: "Task planned for today",
        2: "Task work started",
        3: "Task ready for review",
        4: "Task approved",
        5: "Task needs revisions",
        6: "Revision requested",
      };
      for (const employeeId of new Set(recipients))
        data.records.notifications.unshift({
          id: crypto.randomUUID(),
          title: titles[body.targetStage] || "Task stage updated",
          eventType: "task-transition",
          targetStage: body.targetStage,
          message: `#${task.id} ${task.title}${body.reason ? ": " + body.reason : ""}`,
          employeeId,
          taskId: task.id,
          status: "Unread",
          createdAt: new Date().toISOString(),
        });
    } else if (match[2] === "revision-updates" && method === "POST") {
      const entry = addRevisionUpdate(
        task,
        body.content,
        undefined,
        user.name || user.email,
      );
      data.records.notifications.unshift({
        id: crypto.randomUUID(),
        title: "Revision work update",
        message: `#${task.id}: ${entry.content}`,
        taskId: task.id,
        status: "Unread",
        createdAt: entry.createdAt,
      });
    } else if (match[2] === "comments" && method === "POST") {
      if (!body.content?.trim()) fail("Enter a comment.");
      task.updates.unshift({
        id: crypto.randomUUID(),
        authorName: user.name || user.email,
        content: body.content,
        createdAt: new Date().toISOString(),
      });
    } else if (match[2] === "assign" && method === "POST") {
      if (
        !Array.isArray(body.employeeIds) ||
        body.employeeIds.some(
          (id) => !data.records.employees.some((e) => e.id === id),
        )
      )
        fail("Choose valid employees.");
      const project = data.projects.find((p) => p.id === task.projectId);
      if (
        project?.memberIds?.length &&
        body.employeeIds.some((id) => !project.memberIds.includes(id))
      )
        fail(
          "Assignees must be members of the project. Add them to the project team first.",
        );
      const prior = new Set(task.assignees.map((a) => a.employee.id));
      for (const id of body.employeeIds.filter((id) => !prior.has(id)))
        data.records.notifications.unshift({
          id: crypto.randomUUID(),
          title: "New task assignment",
          message: `${data.records.employees.find((e) => e.id === id)?.fullName}: #${task.id} ${task.title}`,
          status: "Unread",
          employeeId: id,
          taskId: task.id,
          createdAt: new Date().toISOString(),
        });
      task.assignees = [...new Set(body.employeeIds)].map((id) => ({
        id: crypto.randomUUID(),
        employee: data.records.employees.find((e) => e.id === id),
      }));
    } else if (match[2] === "checklists" && method === "POST") {
      if (!body.title?.trim()) fail("Enter a checklist title.");
      task.checklists.push({
        id: crypto.randomUUID(),
        title: body.title.trim(),
        items: [],
      });
    } else if (match[2] === "attachments" && method === "POST") {
      const file = validateFile(body.file);
      task.attachments.push({
        id: crypto.randomUUID(),
        fileName: file.name,
        fileType: file.type,
        fileSize: `${Math.ceil(file.size / 1024)} KB`,
        fileUrl: file.data,
        uploadedBy: user.name || user.email,
        createdAt: new Date().toISOString(),
      });
    } else if (!match[2] && method === "PATCH") {
      if (body.documentBlocks !== undefined) {
        task.documentBlocks = validateDocument(body.documentBlocks);
        task.documentUpdatedAt = new Date().toISOString();
      }
      for (const key of [
        "title",
        "startDate",
        "description",
        "priority",
        "dueDate",
        "progress",
      ])
        if (body[key] !== undefined) task[key] = body[key];
    } else fail("This action is not available in UI preview.");
    save(data);
    return { success: true, data: decorate(task, data) };
  }
  fail("This module is not yet available in UI preview.", 404);
}
