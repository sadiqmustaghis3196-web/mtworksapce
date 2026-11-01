import { test, expect } from "@playwright/test";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=",
  "base64",
);
async function login(page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily work dashboard", exact: true }),
  ).toBeVisible();
}
test("card document text/image/text persists and assigned card automatically opens from its pipeline stage", async ({
  page,
}) => {
  await login(page);
  await page.goto("/projects");
  await page.getByRole("button", { name: "Add Card", exact: true }).click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Title", { exact: true }).fill("Portal document delivery");
  await d.getByRole("button", { name: "Add block", exact: true }).click();
  await d
    .getByLabel("Document text 1", { exact: true })
    .fill("First: implement the client portal.");
  await d.getByLabel("Document image file").setInputFiles({
    name: "reference.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 280;
        const c = canvas.getContext("2d");
        c.fillStyle = "#eef3fa";
        c.fillRect(0, 0, 640, 280);
        c.fillStyle = "#183957";
        c.fillRect(20, 20, 600, 45);
        c.fillStyle = "#fff";
        c.font = "20px sans-serif";
        c.fillText("CLIENT PORTAL · REFERENCE", 38, 50);
        c.fillStyle = "#16b9ca";
        c.fillRect(20, 85, 180, 170);
        c.fillStyle = "#cbd8e9";
        c.fillRect(220, 85, 400, 70);
        c.fillRect(220, 175, 190, 80);
        c.fillRect(430, 175, 190, 80);
        return canvas.toDataURL("image/png").split(",")[1];
      }),
      "base64",
    ),
  });
  await expect(d.locator(".document-paper img")).toHaveCount(1);
  await d.getByLabel("Image caption 2").fill("Portal reference layout");
  await d.getByRole("button", { name: "Add block", exact: true }).click();
  await d
    .getByLabel("Document text 3", { exact: true })
    .fill("After image: run responsive testing.");
  await d.getByRole("button", { name: "Page preview", exact: true }).click();
  await expect(d.locator(".document-render-block")).toHaveCount(3);
  await expect(d.locator(".document-render-block").nth(0)).toContainText(
    "First:",
  );
  await expect(
    d.locator(".document-render-block").nth(1).locator("img"),
  ).toBeVisible();
  await expect(d.locator(".document-render-block").nth(2)).toContainText(
    "After image:",
  );
  await d.getByLabel("Assign card to").selectOption("preview-ali");
  await d.getByRole("button", { name: "Create card", exact: true }).click();
  await expect(d).toHaveCount(0);
  await page.goto("/dashboard");
  await page.locator(".delivery-step.phase-planning").click();
  const row = page
    .locator(".pipeline-task-documents")
    .getByRole("button", { name: /Portal document delivery/ });
  await expect(row).toContainText("Ali Raza");
  await row.click();
  d = page.getByRole("dialog");
  await expect(d.getByLabel("Document text 1", { exact: true })).toHaveValue(
    "First: implement the client portal.",
  );
  await expect(d.locator(".document-live-context")).toContainText("Ali Raza");
  await d
    .getByLabel("Document text 3", { exact: true })
    .fill("After image: test on mobile and desktop.");
  await d.getByRole("button", { name: "Save document", exact: true }).click();
  await expect(d.getByRole("status")).toContainText("Document saved.");
  await d.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page.locator(".delivery-step.phase-planning").click();
  await page
    .locator(".pipeline-task-documents")
    .getByRole("button", { name: /Portal document delivery/ })
    .click();
  d = page.getByRole("dialog");
  await expect(d.getByLabel("Document text 3", { exact: true })).toHaveValue(
    "After image: test on mobile and desktop.",
  );
  const popupPromise = page.waitForEvent("popup");
  await d
    .getByRole("button", { name: "Print / Save PDF", exact: true })
    .click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await expect(
    popup.getByRole("heading", {
      name: "Portal document delivery",
      exact: true,
    }),
  ).toBeVisible();
  await expect(popup.locator("body")).toContainText("Ali Raza");
  await expect(popup.locator("img")).toHaveCount(1);
  const pdf = await popup.pdf({
    path: "/tmp/mt-workflow-document.pdf",
    format: "A4",
    printBackground: true,
  });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  await popup.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await d.getByRole("button", { name: "Page preview", exact: true }).click();
  expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await d
    .locator(".task-document-editor")
    .screenshot({ path: "/tmp/mt-document-editor-mobile.png" });
});
test("document blocks reorder, remove and protect unsaved work", async ({
  page,
}) => {
  await login(page);
  await page.locator(".delivery-step.phase-development").click();
  await page
    .locator(".pipeline-task-documents")
    .getByRole("button", { name: /#426 / })
    .click();
  const d = page.getByRole("dialog");
  const baseline = await d.locator(".document-edit-block").count();
  await d.getByLabel("Document block type").selectOption("heading");
  await d.getByRole("button", { name: "Add block", exact: true }).click();
  await d
    .getByLabel(`Document heading ${baseline + 1}`, { exact: true })
    .fill("Acceptance criteria");
  if (baseline > 0) {
    await d
      .getByRole("button", {
        name: `Move block ${baseline + 1} up`,
        exact: true,
      })
      .click();
    await expect(
      d
        .locator(".document-edit-block")
        .nth(baseline - 1)
        .locator("textarea"),
    ).toHaveValue("Acceptance criteria");
  }
  page.once("dialog", (dialog) => dialog.dismiss());
  await d.getByRole("button", { name: "Close dialog" }).click();
  await expect(d).toBeVisible();
  await d.getByRole("button", { name: "Save document", exact: true }).click();
  await expect(d.getByRole("status")).toContainText("Document saved.");
  await d.getByRole("button", { name: "Remove block 1", exact: true }).click();
  await d.getByRole("button", { name: "Save document", exact: true }).click();
  await d.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page.locator(".delivery-step.phase-development").click();
  await page
    .locator(".pipeline-task-documents")
    .getByRole("button", { name: /#426 / })
    .click();
  await expect(
    page.getByRole("dialog").locator(".document-edit-block"),
  ).toHaveCount(baseline);
});
