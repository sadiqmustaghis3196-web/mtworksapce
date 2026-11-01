import { test, expect } from "@playwright/test";
const user = {
  id: "u1",
  email: "qa@example.test",
  name: "QA Admin",
  primaryRole: "Super Admin",
  avatar: "QA",
  isSuperAdmin: true,
  effectivePermissions: {
    allowedModules: ["dash", "boards"],
    canManageTasks: true,
  },
};
for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
  test(`login fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/auth/me", (r) =>
      r.fulfill({ status: 401, json: { message: "Sign in required" } }),
    );
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByLabel("Company email")).toBeVisible();
  });
}
test("board actions call the API and reflect returned state (API fixture, not database validation)", async ({
  page,
}) => {
  let task = {
    id: 426,
    title: "SLI measurement",
    category: "Web App",
    stage: 2,
    priority: "Medium",
    progress: 60,
    projectId: "p1",
    project: { name: "Client A – Website" },
    assignees: [],
    createdAt: "2026-11-01T00:00:00Z",
    dueDate: "2026-11-05T00:00:00Z",
  };
  await page.route("**/api/**", async (r) => {
    const p = new URL(r.request().url()).pathname;
    if (p === "/api/auth/me") return r.fulfill({ json: { user } });
    if (p === "/api/projects")
      return r.fulfill({
        json: { data: [{ id: "p1", name: "Client A – Website" }] },
      });
    if (p === "/api/tasks") return r.fulfill({ json: { data: [task] } });
    if (p === "/api/tasks/426/transition") {
      const body = r.request().postDataJSON();
      task = { ...task, stage: body.targetStage };
      return r.fulfill({ json: { data: task } });
    }
    if (p === "/api/tasks/426")
      return r.fulfill({ json: { data: { ...task, activities: [] } } });
    return r.fulfill({ status: 404, json: { message: "Unknown test API" } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/projects");
  await expect(
    page.getByRole("button", { name: "Send for Review" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send for Review" }).click();
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("moved to Done");
  await page
    .getByRole("button", { name: "In Progress 0", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "In Progress 0", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await page
    .getByRole("button", { name: "In Progress 0", exact: true })
    .click();
  await page.getByRole("button", { name: "#426 SLI measurement" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/mt-board-desktop.png", fullPage: true });
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.getByRole("button", { name: "Close navigation" }).click();
  await page.screenshot({ path: "/tmp/mt-board-mobile.png", fullPage: true });
});
