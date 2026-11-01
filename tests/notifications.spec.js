import { test, expect } from "@playwright/test";
async function login(page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily work dashboard", exact: true }),
  ).toBeVisible();
}
test("bell opens a dropdown on the current screen; unread/read/all actions persist and update the badge", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("dialog", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Daily work dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".notification-row.is-unread").first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark all read", exact: true })
    .click();
  await expect(page.locator(".notification-count")).toHaveCount(0);
  await page.getByRole("button", { name: "Unread", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "You’re all caught up" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Read", exact: true }).click();
  const row = page.locator(".notification-row").first();
  await row.getByRole("button", { name: "Mark unread", exact: true }).click();
  await expect(page.locator(".notification-count")).toHaveText("1");
  await page.reload();
  await expect(page.locator(".notification-count")).toHaveText("1");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await page.getByRole("button", { name: "Unread", exact: true }).click();
  await expect(page.locator(".notification-row")).toHaveCount(1);
  await page
    .getByRole("dialog", { name: "Notifications", exact: true })
    .getByRole("button", { name: "Mark read", exact: true })
    .click();
  await expect(page.locator(".notification-count")).toHaveCount(0);
});
test("reminders refresh outside dashboard, open the related task document, and do not duplicate", async ({
  page,
}) => {
  await login(page);
  await page.goto("/projects");
  await page.evaluate(() => {
    const key = "mt-nexus-ui-preview-v1",
      data = JSON.parse(localStorage.getItem(key));
    data.records.notifications = [];
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new Event("mt-workspace-change"));
  });
  await expect
    .poll(() => page.locator(".notification-count").textContent())
    .toMatch(/[1-9]/);
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  const row = page
    .locator(".notification-row")
    .filter({ hasText: "is due today" })
    .first();
  await expect(row).toBeVisible();
  const title = await row.locator("p").textContent();
  const id = title.match(/#(\d+)/)[1];
  await row.getByRole("button", { name: "Open related work" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(`Task #${id}`);
  await expect(page.locator(".task-document-editor")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page).not.toHaveURL(/task=/);
  await page.goto("/notifications");
  await expect(page.locator(".notification-row").first()).toBeVisible();
  const count = await page.locator(".notification-row").count();
  await page.getByRole("button", { name: "Refresh notifications" }).click();
  await expect(page.locator(".notification-row")).toHaveCount(count);
});
test("mobile bell remains visible and workflow notifications lead to the correct card", async ({
  page,
}) => {
  await login(page);
  await page.goto("/projects");
  const card = page.locator(".task-card").filter({
    has: page.getByRole("button", {
      name: "#426 SLI measurement",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Send for Review" }).click();
  await expect(
    page.getByRole("region", { name: "New notification" }),
  ).toContainText("Task ready for review");
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "New notification" }),
  ).toHaveCount(0);
  const row = page
    .locator(".notification-row")
    .filter({ hasText: "Task ready for review" });
  await expect(row).toContainText("#426 SLI measurement");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/mt-notifications-mobile.png",
    fullPage: true,
  });
});

test("dropdown scrolls independently, searches and dismisses without losing the underlying screen", async ({
  page,
}) => {
  await login(page);
  await page.goto("/projects");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("Search current view").fill("SLI");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  const panel = page.getByRole("dialog", {
    name: "Notifications",
    exact: true,
  });
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(panel.locator(".notification-row").first()).toBeVisible();
  await panel
    .getByLabel("Search notifications")
    .fill("no notification matches xyz");
  await expect(panel.locator(".notification-row")).toHaveCount(0);
  await panel.getByLabel("Search notifications").fill("");
  expect(
    await panel
      .locator(".notification-inbox")
      .evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await panel
    .locator(".notification-inbox")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  expect(
    await panel.locator(".notification-inbox").evaluate((el) => el.scrollTop),
  ).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Project Boards", exact: true })
    .click();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByLabel("Search current view")).toHaveValue("SLI");
  await page.setViewportSize({ width: 320, height: 650 });
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y + box.height).toBeLessThanOrEqual(650);
  await panel.screenshot({ path: "/tmp/mt-notification-dropdown-mobile.png" });
});
