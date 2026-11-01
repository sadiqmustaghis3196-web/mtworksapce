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
    if (
      body.email?.trim().toLowerCase() !== previewCredentials.email ||
      body.password !== previewCredentials.password
    )
      fail("Use the UI preview email and password shown on this page.", 401);
    sessionStorage.setItem(SESSION_KEY, "active");
    return { user: previewUser };
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
  if (sessionStorage.getItem(SESSION_KEY) !== "active")
    fail("Sign in to the UI preview.", 401);
  if (path === "/auth/me") return { user: previewUser };
  const data = hydrateWorkspace(load());
  if (path.startsWith("/workspace/")) {
    const result = workspaceRequest(data, path, { method, body });
    if (method !== "GET") save(data);
    return result;
  }
  if (path === "/projects" && method === "GET") return { data: data.projects };
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
      return { data: data.tasks.map((t) => decorate(t, data)) };
    if (method === "POST") {
      if (!body.title?.trim() || body.title.trim().length < 2)
        fail("Enter a task title of at least 2 characters.");
      const task = {
        ...body,
        id: Math.max(100, ...data.tasks.map((t) => t.id)) + 1,
        stage: 0,
        progress: 0,
        createdAt: new Date().toISOString(),
        assignees: [],
        updates: [],
        activities: [],
        checklists: [],
        attachments: [],
      };
      data.tasks.push(task);
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
    /^\/tasks\/(\d+)(?:\/(transition|comments|assign|checklists|attachments))?$/,
  );
  if (match) {
    const task = data.tasks.find((t) => t.id === Number(match[1]));
    if (!task) fail("Preview task not found.", 404);
    if (method === "GET") return { data: decorate(task, data) };
    if (match[2] === "transition" && method === "POST") {
      const allowed = { 0: [1], 1: [2], 2: [3], 3: [4, 5], 4: [2], 5: [2] };
      if (!allowed[task.stage].includes(body.targetStage))
        fail("This preview stage transition is not allowed.", 409);
      if (body.targetStage === 5 && !body.reason?.trim())
        fail("A rejection reason is required.");
      task.activities.unshift({
        id: crypto.randomUUID(),
        fromStage: task.stage,
        toStage: body.targetStage,
        reason: body.reason,
        createdAt: new Date().toISOString(),
      });
      task.stage = body.targetStage;
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
          }[task.stage] || creative.status;
      if (task.stage === 4) {
        task.progress = 100;
        task.approvedBy = "Preview Admin";
        task.rejectReason = null;
      }
      if (task.stage === 5) {
        task.rejectedBy = "Preview Admin";
        task.rejectReason = body.reason;
      }
    } else if (match[2] === "comments" && method === "POST") {
      if (!body.content?.trim()) fail("Enter a comment.");
      task.updates.unshift({
        id: crypto.randomUUID(),
        authorName: "Preview Admin",
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
        uploadedBy: "Preview Admin",
        createdAt: new Date().toISOString(),
      });
    } else if (!match[2] && method === "PATCH") {
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
