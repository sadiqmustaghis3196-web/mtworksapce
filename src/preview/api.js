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
  } catch {
    fail("Browser storage is unavailable. Preview changes could not be saved.");
  }
}
const decorate = (task, data) => ({
  ...task,
  project: data.projects.find((p) => p.id === task.projectId),
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
  const data = load();
  if (path === "/projects" && method === "GET") return { data: data.projects };
  if (path === "/dashboard/overview")
    return {
      data: {
        projects: data.projects.length,
        tasks: data.tasks.length,
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
  const match = path.match(/^\/tasks\/(\d+)(?:\/(transition|comments))?$/);
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
    } else if (!match[2] && method === "PATCH") {
      for (const key of [
        "title",
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
