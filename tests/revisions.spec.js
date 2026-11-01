import { test, expect } from "@playwright/test";
const card = (page, id) =>
  page
    .locator(".task-card")
    .filter({
      has: page.getByRole("button", { name: new RegExp(`^#${id} `) }),
    });
async function login(page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily work dashboard", exact: true }),
  ).toBeVisible();
}
async function request(page, task, reason) {
  await task
    .getByRole("button", { name: "Request revision", exact: true })
    .click();
  const d = page.getByRole("dialog").last();
  await d.getByLabel("Revision instructions").fill(reason);
  await d
    .getByRole("button", { name: "Request revision", exact: true })
    .click();
  await expect(d).toHaveCount(0);
}
test("review revision has a separate column, work updates, resubmission, approval and another preserved round", async ({
  page,
}) => {
  await login(page);
  await page.goto("/projects");
  await request(
    page,
    card(page, 423),
    "Client requests a compact header and smaller reference images.",
  );
  await expect(
    page
      .locator('[data-stage-index="6"]')
      .locator(".task-card")
      .filter({ hasText: "#423" }),
  ).toBeVisible();
  await expect(
    page
      .locator('[data-stage-index="5"]')
      .locator(".task-card")
      .filter({ hasText: "#423" }),
  ).toHaveCount(0);
  await page.reload();
  await card(page, 423).locator(".task-project").click();
  let d = page.getByRole("dialog");
  await expect(d.locator(".revision-history")).toContainText("Revision #1");
  await expect(d.locator(".revision-history")).toContainText("Requested");
  await d
    .getByLabel("Revision work update")
    .fill("Confirmed the client feedback and prepared the changes.");
  await d.getByRole("button", { name: "Post revision update" }).click();
  await expect(d.locator(".revision-update")).toContainText(
    "Confirmed the client feedback",
  );
  await d.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: /Revision & Updates.*Review → Revision/ })
    .click();
  await expect(page.locator(".pipeline-task-documents")).toContainText("#423");
  await page.goto("/projects");
  await card(page, 423)
    .getByRole("button", { name: "Start revision", exact: true })
    .click();
  await expect(card(page, 423)).toContainText("In progress");
  await card(page, 423)
    .getByRole("button", { name: "Send for Review" })
    .click();
  await card(page, 423)
    .getByRole("button", { name: "Approve", exact: true })
    .click();
  await expect(card(page, 423)).toContainText("Approved");
  await expect(card(page, 423)).toContainText("100%");
  await request(
    page,
    card(page, 423),
    "A new client update requires a revised navigation layout.",
  );
  await card(page, 423).locator(".task-project").click();
  d = page.getByRole("dialog");
  await expect(d.locator(".revision-round")).toHaveCount(2);
  await expect(d.locator(".revision-history")).toContainText("Revision #2");
  await expect(d.locator(".revision-history")).toContainText("Revision #1");
  await expect(d.locator(".revision-update")).toContainText(
    "Confirmed the client feedback",
  );
  const popupPromise = page.waitForEvent("popup");
  await d.getByRole("button", { name: "Print / Save PDF" }).click();
  const print = await popupPromise;
  await expect(print.locator("body")).toContainText("Revision #2");
  await expect(print.locator("body")).toContainText(
    "Confirmed the client feedback",
  );
  await print.close();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await d
    .locator(".revision-history")
    .screenshot({ path: "/tmp/mt-revision-history-mobile.png" });
});
test("revision request works from In Progress and drag/drop preserves the required instructions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await login(page);
  await page.goto("/projects");
  await card(page, 426)
    .locator(".task-drag-handle")
    .dragTo(page.locator('[data-stage-index="6"] .stage-heading'));
  const d = page.getByRole("dialog");
  await expect(d).toContainText("Request revision");
  await expect(d.getByLabel("Revision instructions")).toHaveAttribute(
    "required",
    "",
  );
  await d
    .getByLabel("Revision instructions")
    .fill("Update the measurement calculation per the client request.");
  await d
    .getByRole("button", { name: "Request revision", exact: true })
    .click();
  await expect(
    card(page, 426).getByRole("button", { name: "Start revision" }),
  ).toBeVisible();
  const task = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mt-nexus-ui-preview-v1")).tasks.find(
      (t) => t.id === 426,
    ),
  );
  expect(task.stage).toBe(6);
  expect(task.revisions).toHaveLength(1);
  expect(task.assignees.length).toBeGreaterThan(0);
  await card(page, 426).getByLabel("Move task #426").selectOption("2");
  await expect(
    card(page, 426).getByRole("button", { name: "Send for Review" }),
  ).toBeVisible();
});
