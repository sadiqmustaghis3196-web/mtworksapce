import { test, expect } from "@playwright/test";
const login = async (page) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project Boards" }),
  ).toBeVisible();
};
test("public preview login, edits, transitions, refresh, reset and logout work with no API requests", async ({
  page,
}) => {
  const apiRequests = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/"))
      apiRequests.push(r.url());
  });
  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByText("UI Preview · Sample data only")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Use the UI preview");
  await page.getByLabel("Password", { exact: true }).fill("NexusUI@2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("UI PREVIEW", { exact: true })).toBeVisible();
  const card = page
    .locator(".task-card")
    .filter({
      has: page.getByRole("button", {
        name: "#426 SLI measurement",
        exact: true,
      }),
    });
  await card.getByRole("button", { name: "Send for Review" }).click();
  await expect(
    card.getByRole("button", { name: "Approve", exact: true }),
  ).toBeVisible();
  await card.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("moved to Done");
  await page.reload();
  await expect(card.getByRole("button", { name: "Rework" })).toBeVisible();
  await card.getByRole("button", { name: "#426 SLI measurement" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task title").fill("Preview task edited");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("button", { name: "#426 Preview task edited" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset sample data" }).click();
  await expect(
    page.getByRole("button", { name: "#426 SLI measurement" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "#426 Preview task edited" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Preview Admin PA" }).click();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  expect(apiRequests).toEqual([]);
});
test("preview shell fits required viewport sizes and mobile navigation closes", async ({
  page,
}) => {
  await login(page);
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByText("UI PREVIEW", { exact: true })).toBeVisible();
  }
  await page.screenshot({
    path: "/tmp/mt-ui-preview-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Close navigation" }).click();
  await page.screenshot({
    path: "/tmp/mt-ui-preview-mobile.png",
    fullPage: true,
  });
});
