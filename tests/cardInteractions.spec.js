import { test, expect } from "@playwright/test";
async function login(page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily work dashboard", exact: true }),
  ).toBeVisible();
}
const card = (page, id) =>
  page.locator(".task-card").filter({
    has: page.getByRole("button", { name: new RegExp(`^#${id} `) }),
  });
test("whole card opens from metadata or keyboard; workflow buttons do not accidentally open it", async ({
  page,
}) => {
  await login(page);
  await page.goto("/projects");
  await card(page, 426).locator(".task-project").click();
  await expect(page.getByRole("dialog")).toContainText("Task #426");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await card(page, 426).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toContainText("Task #426");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await card(page, 426)
    .getByRole("button", { name: "Send for Review" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    card(page, 426).getByRole("button", { name: "Approve", exact: true }),
  ).toBeVisible();
  await page.goto("/dashboard");
  const daily = page.locator(".daily-task-card").filter({
    has: page.getByRole("button", {
      name: "#426 SLI measurement",
      exact: true,
    }),
  });
  await daily.locator(".daily-task-progress").click();
  await expect(page.getByRole("dialog")).toContainText("Task #426");
});
test("dragging moves the original card, enforces review/rejection and persists after refresh", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await login(page);
  await page.goto("/projects");
  await card(page, 418)
    .locator(".task-drag-handle")
    .dragTo(page.locator('[data-stage-index="2"] .stage-heading'));
  await expect(
    page
      .locator('[data-stage-index="2"]')
      .locator(".task-card")
      .filter({ hasText: "#418 Fix header bug" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await card(page, 418)
    .locator(".task-drag-handle")
    .dragTo(page.locator('[data-stage-index="4"] .stage-heading'));
  await expect(
    page
      .locator('[data-stage-index="2"]')
      .locator(".task-card")
      .filter({ hasText: "#418 Fix header bug" }),
  ).toBeVisible();
  await card(page, 418)
    .locator(".task-drag-handle")
    .dragTo(page.locator('[data-stage-index="3"] .stage-heading'));
  await expect(
    card(page, 418).getByRole("button", { name: "Approve", exact: true }),
  ).toBeVisible();
  await card(page, 418)
    .locator(".task-drag-handle")
    .dragTo(page.locator('[data-stage-index="5"] .stage-heading'));
  await expect(page.getByRole("dialog")).toContainText("Reject task #418");
  await page
    .getByLabel("Reason for rejection")
    .fill("Please fix the responsive header states.");
  await page.getByRole("button", { name: "Reject and move task" }).click();
  await expect(
    page
      .locator('[data-stage-index="5"]')
      .locator(".task-card")
      .filter({ hasText: "#418 Fix header bug" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator('[data-stage-index="5"]')
      .locator(".task-card")
      .filter({ hasText: "#418 Fix header bug" }),
  ).toBeVisible();
  await card(page, 418).getByLabel("Move task #418").selectOption("2");
  await expect(
    card(page, 418).getByRole("button", { name: "Send for Review" }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mt-nexus-ui-preview-v1")).tasks.filter(
      (t) => t.id === 418,
    ),
  );
  expect(saved).toHaveLength(1);
  expect(saved[0].activities.length).toBeGreaterThanOrEqual(4);
});
test("document images stay small and open in a dismissible viewer without closing the task", async ({
  page,
}) => {
  await login(page);
  await page.goto("/projects?task=426");
  const d = page.getByRole("dialog");
  await expect(d).toBeVisible();
  const img = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1000;
    const c = canvas.getContext("2d");
    c.fillStyle = "#13506c";
    c.fillRect(0, 0, 1600, 1000);
    c.fillStyle = "#49ddca";
    c.fillRect(80, 100, 1400, 700);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await d.getByLabel("Document image file").setInputFiles({
    name: "large-reference.png",
    mimeType: "image/png",
    buffer: Buffer.from(img, "base64"),
  });
  const thumb = d.locator(".document-image-thumb").last();
  const bounds = await thumb.locator("img").boundingBox();
  expect(bounds.height).toBeLessThanOrEqual(130);
  expect(bounds.width).toBeLessThanOrEqual(220);
  await thumb.click();
  const viewer = page.getByRole("dialog", {
    name: "Image preview",
    exact: true,
  });
  await expect(viewer).toBeVisible();
  expect((await viewer.locator("img").boundingBox()).width).toBeGreaterThan(
    220,
  );
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(d).toBeVisible();
  await d.getByRole("button", { name: "Save document", exact: true }).click();
  await d.getByRole("button", { name: "Page preview", exact: true }).click();
  await d
    .getByRole("button", { name: "Open image: Task reference", exact: true })
    .click();
  await expect(viewer).toBeVisible();
  await viewer.getByRole("button", { name: "Close image" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await d
    .locator(".task-document-editor")
    .screenshot({ path: "/tmp/mt-document-thumbnails-mobile.png" });
  expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});
test("touch drag handle moves a card to the next highlighted column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 1000 });
  await login(page);
  await page.goto("/projects");
  const handle = card(page, 431).getByRole("button", {
    name: "Drag task #431",
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  const source = await handle.boundingBox();
  await handle.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 1,
    clientX: source.x + 10,
    clientY: source.y + 10,
    bubbles: true,
  });
  const target = page.locator('[data-stage-index="1"]');
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  await page.locator("body").dispatchEvent("pointermove", {
    pointerType: "touch",
    pointerId: 1,
    clientX: box.x + 80,
    clientY: box.y + 60,
    bubbles: true,
  });
  await page.locator("body").dispatchEvent("pointerup", {
    pointerType: "touch",
    pointerId: 1,
    clientX: box.x + 80,
    clientY: box.y + 60,
    bubbles: true,
  });
  await expect(
    page
      .locator('[data-stage-index="1"]')
      .locator(".task-card")
      .filter({ hasText: "#431 Landing page UI" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
