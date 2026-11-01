import { test, expect } from "@playwright/test";
async function login(page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily work dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".delivery-flow")).toBeVisible();
}
const taskCard = (page, id) =>
  page
    .locator(".daily-task-card")
    .filter({
      has: page.getByRole("button", { name: new RegExp(`^#${id} `) }),
    });
test.beforeEach(async ({ page }) => login(page));
test("dashboard is the new home and old sample completions are not counted as done today", async ({
  page,
}) => {
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".delivery-step")).toHaveCount(6);
  await expect(
    page
      .locator(".daily-metric")
      .filter({ has: page.getByText("Done today", { exact: true }) })
      .locator("strong"),
  ).toHaveText("0");
  await expect(page.locator(".daily-team-panel")).toContainText("Ali Raza");
  await expect(
    page.getByRole("button", { name: "Notification preferences" }),
  ).toBeVisible();
});
test("employee records daily work, testing phase, time and blocker; admin sees that progress after refresh", async ({
  page,
}) => {
  await page
    .getByLabel("Dashboard view", { exact: true })
    .selectOption("EMPLOYEE");
  await page
    .getByLabel("Profile perspective", { exact: true })
    .selectOption("preview-ali");
  await expect(page.locator(".daily-team-panel")).toHaveCount(0);
  const card = taskCard(page, 426);
  await expect(card).toBeVisible();
  await expect(taskCard(page, 423)).toHaveCount(0);
  await card
    .getByRole("button", { name: "Log daily update", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await expect(d.getByLabel("Record work for")).toHaveValue("preview-ali");
  await d.getByLabel("Time spent (minutes)").fill("45");
  await d
    .getByLabel("What did you accomplish today?")
    .fill("Completed responsive states and mobile test coverage.");
  await d.getByLabel("Work phase").selectOption("testing");
  await d.getByLabel("Overall progress after this update (%)").fill("80");
  await d
    .getByLabel("Blocker (leave empty when resolved)")
    .fill("Waiting for client API credentials");
  await d
    .getByLabel("Next step", { exact: true })
    .fill("Run the final accessibility checks");
  await d.getByRole("button", { name: "Save daily update" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card).toContainText("80%");
  await expect(card).toContainText("+20 pp");
  await expect(card).toContainText("0h 45m");
  await expect(page.locator(".daily-log-entry")).toContainText(
    "Completed responsive states",
  );
  await expect(page.locator(".delivery-step.phase-testing b")).toHaveText("1");
  await page.reload();
  await expect(card).toContainText("80%");
  await expect(card).toContainText("+20 pp");
  await page
    .getByLabel("Dashboard view", { exact: true })
    .selectOption("SUPER_ADMIN");
  const row = page
    .locator(".daily-team-panel")
    .getByRole("row")
    .filter({ hasText: "Ali Raza" });
  await expect(row).toContainText("+20 pp");
  await expect(row).toContainText("0h 45m");
  await expect(row).toContainText("1 blocked");
});
test("daily goals persist and employee lenses do not expose review or task assignment controls", async ({
  page,
}) => {
  await page
    .getByLabel("Dashboard view", { exact: true })
    .selectOption("EMPLOYEE");
  await page
    .getByLabel("Profile perspective", { exact: true })
    .selectOption("preview-ali");
  await page
    .getByRole("button", { name: "Set daily goal", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Assigned task").selectOption("426");
  await d
    .getByLabel("Today’s goal")
    .fill("Finish responsive QA and submit for review");
  await d.getByLabel("Target overall progress (%)").fill("90");
  await d.getByRole("button", { name: "Save daily goal" }).click();
  await expect(taskCard(page, 426)).toContainText("Finish responsive QA");
  await page.reload();
  await expect(taskCard(page, 426)).toContainText(
    "Target overall progress: 90%",
  );
  await taskCard(page, 426)
    .getByRole("button", { name: /^#426 / })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Save assignees" }),
  ).toHaveCount(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page
    .getByLabel("Profile perspective", { exact: true })
    .selectOption("preview-kiran");
  await expect(taskCard(page, 422)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toHaveCount(0);
});
test("notification settings save and refresh does not duplicate reminders", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Notification preferences" }).click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Tasks due tomorrow", { exact: true }).uncheck();
  await d.getByLabel("Daily summary time (Asia/Karachi)").fill("18:30");
  await d.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const count = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("mt-nexus-ui-preview-v1")).records
        .notifications.length,
  );
  await page.getByRole("button", { name: "Refresh daily work" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("mt-nexus-ui-preview-v1")).records
            .notifications.length,
      ),
    )
    .toBe(count);
  await page.reload();
  await page.getByRole("button", { name: "Notification preferences" }).click();
  d = page.getByRole("dialog");
  await expect(
    d.getByLabel("Tasks due tomorrow", { exact: true }),
  ).not.toBeChecked();
  await expect(d.getByLabel("Daily summary time (Asia/Karachi)")).toHaveValue(
    "18:30",
  );
});
test("all admin-to-employee dashboard templates load and remain responsive", async ({
  page,
}) => {
  for (const role of [
    "SUPER_ADMIN",
    "ADMIN",
    "DEPARTMENT_MANAGER",
    "PROJECT_MANAGER",
    "TEAM_LEAD",
    "EMPLOYEE",
    "INTERN",
    "HR_MANAGER",
    "FINANCE_MANAGER",
    "SALES_MANAGER",
    "SUPPORT_AGENT",
  ]) {
    await page.getByLabel("Dashboard view", { exact: true }).selectOption(role);
    await expect(page.locator(".delivery-flow")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByLabel("Dashboard view", { exact: true })
    .selectOption("SUPER_ADMIN");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: "/tmp/mt-daily-dashboard-admin.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/mt-daily-dashboard-mobile.png",
    fullPage: true,
  });
});
