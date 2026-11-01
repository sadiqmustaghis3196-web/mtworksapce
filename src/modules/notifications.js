import { scopeFor, syncDailyReminders } from "./dailyWork.js";
import { modules, collectionPath } from "./catalog.js";
export function notificationFeed(data, options = {}) {
  const scope = scopeFor(data, options);
  const items = data.records.notifications
    .filter(
      (n) =>
        scope.company ||
        n.employeeId === scope.profile.id ||
        (!n.employeeId &&
          (n.id === "notification-welcome" ||
            scope.tasks.some((t) => t.id === n.taskId))),
    )
    .sort(
      (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
    );
  return {
    items,
    unread: items.filter((n) => n.status === "Unread").length,
    profile: scope.profile,
    role: scope.role,
  };
}
export function notificationTarget(n) {
  if (n.taskId) return `/projects?task=${encodeURIComponent(n.taskId)}`;
  if (n.entity && n.recordId)
    for (const [key, module] of Object.entries(modules))
      if (module.tabs.some((t) => t[0] === n.entity))
        return `${collectionPath(key, n.entity)}/${encodeURIComponent(n.recordId)}`;
  return "/dashboard";
}
export function notificationOptions() {
  try {
    const value = JSON.parse(sessionStorage.getItem("mt-daily-dashboard-view"));
    if (value?.role && value?.profileId)
      return { role: value.role, profileId: value.profileId };
  } catch {}
  return { role: "SUPER_ADMIN", profileId: "preview-hamza" };
}
export function refreshNotificationFeed(data, options) {
  const created = syncDailyReminders(data, options);
  return { created, ...notificationFeed(data, options) };
}
