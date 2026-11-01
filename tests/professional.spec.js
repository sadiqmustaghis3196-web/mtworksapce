import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily work dashboard", exact: true }),
  ).toBeVisible();
  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "Project Boards" }),
  ).toBeVisible();
});
test("recruitment funnel opens the selected candidate stage instead of a generic dashboard", async ({
  page,
}) => {
  await page.goto("/hiring/jobs");
  const panel = page.locator(".operations-panel").filter({
    has: page.getByRole("heading", { name: "Recruitment pipeline" }),
  });
  await panel.locator(".funnel-item").filter({ hasText: "Applied" }).click();
  await expect(page).toHaveURL(/applicants\?status=Applied$/);
  await expect(page.getByLabel("Filter status")).toHaveValue("Applied");
  await expect(page.getByRole("table")).toContainText("Zara Ali");
  await page.getByLabel("Filter status").selectOption("Hired");
  await expect(page.getByText(/No applicants match/)).toBeVisible();
});
test("client profile links to scoped contacts and preselects their client in the form", async ({
  page,
}) => {
  await page.goto("/clients");
  await expect(
    page.getByRole("heading", { name: "Client portfolio", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Client A", exact: true }).click();
  await expect(
    page.getByRole("dialog").locator(".record-profile"),
  ).toContainText("Ayesha Malik");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Manage contacts", exact: true })
    .click();
  await expect(page).toHaveURL(/contacts\?clientId=client-a$/);
  await expect(page.locator(".active-context-filter")).toContainText(
    "Client A",
  );
  await page.getByRole("button", { name: "Add contact", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Client", { exact: true }),
  ).toHaveValue("client-a");
});
test("invoice document shows its ledger and contextual items have live decimal totals", async ({
  page,
}) => {
  await page.goto("/finance/invoices");
  await page.getByRole("button", { name: "INV-2026-001", exact: true }).click();
  const document = page
    .getByRole("dialog")
    .getByRole("region", { name: "Invoice document" });
  await expect(document).toContainText("Client A");
  await expect(document.getByRole("table")).toContainText(
    "Website design and development",
  );
  await expect(document.locator(".invoice-balance")).toContainText(
    "150,000.00",
  );
  await document
    .getByRole("link", { name: "View invoice items", exact: true })
    .click();
  await expect(page.locator(".active-context-filter")).toContainText(
    "INV-2026-001",
  );
  await page
    .getByRole("button", { name: "Add invoice item", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await expect(d.getByLabel("Invoice", { exact: true })).toHaveValue(
    "invoice-a",
  );
  await d.getByLabel("Quantity").fill("3");
  await d.getByLabel("Unit price").fill("0.10");
  await expect(d.locator(".form-calculation")).toContainText("PKR 0.30");
});
test("payroll salary suggestions respect manual edits and explain invalid deductions", async ({
  page,
}) => {
  await page.goto("/finance/payroll");
  await page
    .getByRole("button", { name: "Add payroll record", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Employee", { exact: true }).selectOption("preview-ali");
  await expect(d.getByLabel("Gross salary")).toHaveValue("120000.00");
  await expect(d.getByLabel("Deductions")).toHaveValue("0.00");
  await d.getByLabel("Gross salary").fill("100");
  await d.getByLabel("Employee", { exact: true }).selectOption("preview-sara");
  await expect(d.getByLabel("Gross salary")).toHaveValue("100");
  await d.getByLabel("Deductions").fill("200");
  await expect(d.locator(".form-calculation")).toContainText(
    "Deductions exceed gross salary",
  );
});
test("ticket conversation accepts an inline response and retains it on refresh", async ({
  page,
}) => {
  await page.goto("/support/tickets");
  await page.getByRole("button", { name: "TKT-1001", exact: true }).click();
  const d = page.getByRole("dialog");
  await d
    .getByLabel("Reply to ticket", { exact: true })
    .fill("We have reproduced the issue and are preparing a fix.");
  await d.getByRole("button", { name: "Post response", exact: true }).click();
  await expect(
    d
      .locator(".ticket-message")
      .filter({ hasText: "We have reproduced the issue" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("dialog").locator(".ticket-conversation"),
  ).toContainText("We have reproduced the issue");
});
test("record profiles and financial documents stay inside mobile dialogs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  for (const [path, record] of [
    ["/clients", "Client A"],
    ["/employees", "EMP-101"],
    ["/finance/invoices", "INV-2026-001"],
    ["/support/tickets", "TKT-1001"],
  ]) {
    await page.goto(path);
    await page.getByRole("button", { name: record, exact: true }).click();
    const d = page.getByRole("dialog");
    await expect(d.locator(".record-profile")).toBeVisible();
    expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(
      true,
    );
    await d.getByRole("button", { name: "Close dialog" }).click();
  }
});
test("workspace search shortcut works and theme survives a refresh", async ({
  page,
}) => {
  await page.goto("/clients");
  await expect(
    page.getByRole("heading", {
      name: "Client Operations",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByLabel("Search current view")).toBeFocused();
  await page.getByLabel("Search current view").fill("Client B");
  await expect(
    page.getByRole("button", { name: "Client A", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(
    page.getByRole("button", { name: "Client A", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator(".app")).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator(".app")).toHaveClass(/light/);
});
