import { test } from "node:test";
import assert from "node:assert/strict";
import {
  notificationFeed,
  notificationTarget,
  refreshNotificationFeed,
} from "../src/modules/notifications.js";
import { initialPreviewData } from "../src/preview/data.js";
import { hydrateWorkspace } from "../src/modules/store.js";
import { hydrateDailyWork } from "../src/modules/dailyWork.js";
const data = () => hydrateDailyWork(hydrateWorkspace(initialPreviewData()));
test("personal feed excludes other recipients and bulk-read set matches its unread count", () => {
  const d = data();
  d.records.notifications = [
    { id: "ali", employeeId: "preview-ali", taskId: 426, status: "Unread" },
    { id: "sara", employeeId: "preview-sara", taskId: 426, status: "Unread" },
  ];
  const f = notificationFeed(d, { role: "EMPLOYEE", profileId: "preview-ali" });
  assert.equal(f.unread, 1);
  assert.deepEqual(
    f.items.map((n) => n.id),
    ["ali"],
  );
  f.items.forEach((n) => (n.status = "Read"));
  assert.equal(
    notificationFeed(d, { role: "EMPLOYEE", profileId: "preview-ali" }).unread,
    0,
  );
  assert.equal(d.records.notifications[1].status, "Unread");
});
test("task and entity targets use real record routes", () => {
  assert.equal(notificationTarget({ taskId: 426 }), "/projects?task=426");
  assert.equal(
    notificationTarget({ entity: "clients", recordId: "client-a" }),
    "/clients/client-a",
  );
  assert.equal(notificationTarget({}), "/dashboard");
});
test("global feed generates deduplicated current reminders outside the dashboard", () => {
  const d = data();
  const options = {
    role: "SUPER_ADMIN",
    profileId: "preview-hamza",
    date: "2026-11-01",
    asOf: "2026-11-01",
    now: "2026-11-01T13:00:00Z",
  };
  const first = refreshNotificationFeed(d, options);
  assert.ok(first.created > 0);
  assert.equal(refreshNotificationFeed(d, options).created, 0);
  assert.equal(
    first.unread,
    first.items.filter((n) => n.status === "Unread").length,
  );
});

test("a review event does not also generate a duplicate same-day review reminder", () => {
  const d = data();
  const t = d.tasks.find((t) => t.id === 426);
  t.stage = 3;
  d.records.notifications.push({
    id: "review-event",
    taskId: 426,
    employeeId: "preview-hamza",
    eventType: "task-transition",
    targetStage: 3,
    status: "Unread",
    createdAt: "2026-11-01T10:00:00Z",
  });
  const f = refreshNotificationFeed(d, {
    role: "SUPER_ADMIN",
    profileId: "preview-hamza",
    date: "2026-11-01",
    asOf: "2026-11-01",
    now: "2026-11-01T13:00:00Z",
  });
  assert.equal(
    f.items.filter(
      (n) =>
        n.taskId === 426 &&
        (n.targetStage === 3 || n.reminderKind === "review"),
    ).length,
    1,
  );
});
