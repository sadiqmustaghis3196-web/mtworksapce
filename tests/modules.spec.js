import { test, expect } from "@playwright/test";
async function login(page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project Boards" }),
  ).toBeVisible();
}
async function add(page, label, fill) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const dialog = page.getByRole("dialog").last();
  await fill(dialog);
  await dialog
    .getByRole("button", { name: "Save record", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
}
async function action(page, name, fill) {
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name, exact: true })
    .click();
  const confirm = page.getByRole("dialog").last();
  if (fill) await fill(confirm);
  await confirm.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
}
async function close(page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
}
test.beforeEach(async ({ page }) => login(page));
test("every previously unavailable module opens with working sections and no page overflow", async ({
  page,
}) => {
  const paths = [
    ["/clients", "Client Operations"],
    ["/hiring/jobs", "Hiring & ATS"],
    ["/employees", "Employees"],
    ["/attendance", "Attendance & Leaves"],
    ["/internships/programs", "Internship Program"],
    ["/finance/invoices", "Finance & Payroll"],
    ["/creative/requests", "Creative Studio"],
    ["/crm/leads", "Sales & Clients"],
    ["/support/tickets", "Support Tickets"],
    ["/departments", "Departments"],
    ["/admin/users", "Roles & Permissions"],
    ["/notifications", "Notifications"],
    ["/projects/manage", "Project management"],
  ];
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [path, title] of paths) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: title, exact: true, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Module not available yet")).toHaveCount(0);
    for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
test("client create, contact link, edit and refresh persist through the actual UI", async ({
  page,
}) => {
  await page.goto("/clients");
  await add(page, "Add client", async (d) => {
    await d.getByLabel("Company name").fill("UI Test Client");
    await d.getByLabel("Contact person").fill("Amina");
    await d.getByLabel("Email", { exact: true }).fill("amina@example.test");
  });
  await page
    .getByRole("button", { name: "UI Test Client", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  const d = page.getByRole("dialog").last();
  await d.getByLabel("Phone", { exact: true }).fill("03001234567");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await close(page);
  await page.getByRole("link", { name: /Contacts/ }).click();
  await add(page, "Add contact", async (d) => {
    await d
      .getByLabel("Client", { exact: true })
      .selectOption({ label: "UI Test Client" });
    await d.getByLabel("Full name").fill("Amina");
    await d.getByLabel("Email", { exact: true }).fill("amina@example.test");
  });
  await page.reload();
  await expect(
    page.getByRole("cell", { name: "UI Test Client", exact: true }),
  ).toBeVisible();
  await page.goto("/clients");
  await page
    .getByRole("button", { name: "UI Test Client", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Amina", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Contact · Amina", exact: true }),
  ).toBeVisible();
});
test("recruitment pipeline hires an employee and preserves audit history", async ({
  page,
}) => {
  await page.goto("/hiring/applicants");
  await page.getByRole("button", { name: "Zara Ali", exact: true }).click();
  for (const name of [
    "Start screening",
    "Move to interview",
    "Assessment",
    "Move to offer",
    "Hire candidate",
  ])
    await action(page, name);
  await close(page);
  await page.goto("/employees");
  const row = page.getByRole("row").filter({ hasText: "Zara Ali" });
  await expect(row).toContainText("Onboarding");
  await page.goto("/dashboard");
  await expect(
    page
      .locator(".metric")
      .filter({ has: page.getByText("Employees", { exact: true }) }),
  ).toContainText("5");
  await page.goto("/admin/audit-logs");
  await expect(page.getByRole("table")).toContainText("Hired Zara Ali");
});
test("attendance controls record check-in and check-out and prevent duplicate entry", async ({
  page,
}) => {
  await page.goto("/attendance");
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check-in recorded");
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("already been recorded");
  await page
    .getByRole("alert")
    .getByRole("button", { name: "Dismiss" })
    .click();
  await page.getByRole("button", { name: "Check out", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check-out recorded");
  await page.reload();
  await expect(page.getByRole("table")).toContainText("Checked out");
});
test("leave request and approval update the visible balance", async ({
  page,
}) => {
  await page.goto("/attendance/leaves");
  await add(page, "Add leave request", async (d) => {
    await d
      .getByLabel("Employee", { exact: true })
      .selectOption("preview-hamza");
    await d.getByLabel("Leave type").selectOption("Annual");
    await d.getByLabel("Start date").fill("2026-11-02");
    await d.getByLabel("End date").fill("2026-11-06");
    await d.getByLabel("Reason", { exact: true }).fill("Family visit");
  });
  await page.getByRole("button", { name: "Hamza Tariq", exact: true }).click();
  await action(page, "Approve leave");
  await close(page);
  await expect(
    page.locator(".module-metric").filter({ hasText: "Annual leave balance" }),
  ).toContainText("9 days");
});
test("invoice items and partial/full recorded payments update invoice balance exactly", async ({
  page,
}) => {
  await page.goto("/finance/invoices");
  await add(page, "Add invoice", async (d) => {
    await d.getByLabel("Invoice number").fill("INV-UI-001");
    await d.getByLabel("Client", { exact: true }).selectOption("client-a");
    await d.getByLabel("Issue date").fill("2026-11-01");
    await d.getByLabel("Due date").fill("2026-11-15");
  });
  await page.getByRole("link", { name: /Invoice items/ }).click();
  await add(page, "Add invoice item", async (d) => {
    await d
      .getByLabel("Invoice", { exact: true })
      .selectOption({ label: "INV-UI-001" });
    await d
      .getByLabel("Description", { exact: true })
      .fill("Small decimal item");
    await d.getByLabel("Quantity").fill("3");
    await d.getByLabel("Unit price").fill("0.10");
  });
  await page.getByRole("link", { name: /Invoices/ }).click();
  await page.getByRole("button", { name: "INV-UI-001", exact: true }).click();
  await action(page, "Issue invoice");
  await close(page);
  await page.getByRole("link", { name: /Payments/ }).click();
  for (const [reference, amount] of [
    ["UI-P1", "0.10"],
    ["UI-P2", "0.20"],
  ])
    await add(page, "Add payment record", async (d) => {
      await d.getByLabel("Payment reference").fill(reference);
      await d
        .getByLabel("Invoice", { exact: true })
        .selectOption({ label: "INV-UI-001" });
      await d.getByLabel("Amount", { exact: true }).fill(amount);
      await d.getByLabel("Payment date").fill("2026-11-02");
      await d.getByLabel("Payment method").selectOption("Cash");
    });
  await page.getByRole("link", { name: /Invoices/ }).click();
  const row = page.getByRole("row").filter({
    has: page.getByRole("button", { name: "INV-UI-001", exact: true }),
  });
  await expect(row).toContainText("Paid");
  await expect(row).toContainText("0.30");
  await page.reload();
  await expect(row).toContainText("Paid");
});
test("payroll submission requires approval before being recorded", async ({
  page,
}) => {
  await page.goto("/finance/payroll");
  await add(page, "Add payroll record", async (d) => {
    await d.getByLabel("Employee", { exact: true }).selectOption("preview-ali");
    await d.getByLabel("Payroll month").fill("2026-11");
    await d.getByLabel("Gross salary").fill("100000");
    await d.getByLabel("Deductions").fill("5000");
  });
  await page.getByRole("button", { name: "Ali Raza", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Record payroll" }),
  ).toHaveCount(0);
  for (const name of [
    "Submit for approval",
    "Approve payroll",
    "Record payroll",
  ])
    await action(page, name);
  await expect(page.getByRole("dialog")).toContainText("Recorded");
  await expect(page.getByRole("dialog")).toContainText("95,000.00");
});
test("creative deliverable upload, review and approval update its linked board task", async ({
  page,
}) => {
  await page.goto("/creative/requests");
  await page
    .getByRole("button", { name: "Brand identity launch kit", exact: true })
    .click();
  await action(page, "Start work");
  await close(page);
  await page.getByRole("link", { name: /Asset library/ }).click();
  await add(page, "Add creative asset", async (d) => {
    await d.getByLabel("Asset name").fill("Brand draft");
    await d
      .getByLabel("Creative request", { exact: true })
      .selectOption({ label: "Brand identity launch kit" });
    await d.getByLabel("Deliverable file").setInputFiles({
      name: "brand.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Brand guideline draft"),
    });
    await expect(d.getByText(/brand.txt ·/)).toBeVisible();
  });
  await page.getByRole("link", { name: /Requests/ }).click();
  await page
    .getByRole("button", { name: "Brand identity launch kit", exact: true })
    .click();
  await action(page, "Submit for review");
  await action(page, "Approve work");
  await close(page);
  await page.goto("/projects/preview-brand/board");
  const card = page
    .locator(".task-card")
    .filter({ hasText: "Brand identity launch kit" });
  await expect(card.getByRole("button", { name: "Rework" })).toBeVisible();
});
test("won sales lead converts into a linked client", async ({ page }) => {
  await page.goto("/crm/leads");
  await page.getByRole("button", { name: "Nova Labs", exact: true }).click();
  for (const name of [
    "Mark contacted",
    "Qualify",
    "Proposal",
    "Negotiation",
    "Mark won",
    "Convert to client",
  ])
    await action(page, name);
  await close(page);
  await page.goto("/clients");
  await expect(
    page.getByRole("button", { name: "Nova Labs", exact: true }),
  ).toBeVisible();
});
test("support resolution and reopening retain resolution notes", async ({
  page,
}) => {
  await page.goto("/support/tickets");
  await page.getByRole("button", { name: "TKT-1001", exact: true }).click();
  for (const name of ["Confirm assignment", "Start ticket"])
    await action(page, name);
  await action(page, "Resolve ticket", async (d) =>
    d.getByLabel("Resolution notes").fill("Submission handler fixed"),
  );
  await action(page, "Close ticket");
  await action(page, "Reopen ticket");
  await close(page);
  await page.reload();
  await expect(page.getByRole("table")).toContainText("In progress");
});
test("department creation and preview role permission matrix save on refresh", async ({
  page,
}) => {
  await page.goto("/departments");
  await add(page, "Add department", async (d) => {
    await d.getByLabel("Department name").fill("Quality Assurance");
    await d.getByLabel("Code", { exact: true }).fill("QA");
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Quality Assurance", exact: true }),
  ).toBeVisible();
  await page.goto("/admin/roles");
  await add(page, "Add role", async (d) => {
    await d.getByLabel("Role name").fill("UI_REVIEWER");
    await d.getByLabel("tasks.approve", { exact: true }).check();
    await d.getByLabel("tasks.reject", { exact: true }).check();
  });
  await page.reload();
  await page.getByRole("button", { name: "UI_REVIEWER", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "tasks.approve, tasks.reject",
  );
});
test("shared task dialog saves assignments, checklist checks, comments, subtasks and files", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "#426 SLI measurement", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d
    .getByLabel("Assign project members")
    .selectOption(["preview-hamza", "preview-ali"]);
  await d.getByRole("button", { name: "Save assignees" }).click();
  await d.getByRole("button", { name: "Checklists", exact: true }).click();
  await d.getByLabel("New checklist", { exact: true }).fill("UI acceptance");
  await d.getByRole("button", { name: "Add checklist" }).click();
  await d.getByLabel("New item for UI acceptance").fill("Responsive QA passed");
  await d
    .locator(".task-checklist")
    .filter({ hasText: "UI acceptance" })
    .getByRole("button", { name: "Add item" })
    .click();
  await d.getByLabel("Responsive QA passed").check();
  await d.getByRole("button", { name: "Comments", exact: true }).click();
  await d.getByLabel("Add a comment").fill("Ready for review");
  await d.getByRole("button", { name: "Post comment" }).click();
  await expect(d.getByText("Ready for review", { exact: true })).toBeVisible();
  await d.getByRole("button", { name: "Subtasks", exact: true }).click();
  await d.getByLabel("Subtask title").fill("Run mobile QA");
  await d.getByRole("button", { name: "Add subtask" }).click();
  await expect(d.getByText(/Run mobile QA/)).toBeVisible();
  await d.getByRole("button", { name: "Attachments", exact: true }).click();
  await d.getByLabel("Upload attachment").setInputFiles({
    name: "qa.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("QA report"),
  });
  await expect(d.getByRole("link", { name: /qa.txt/ })).toBeVisible();
  await d.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "#426 SLI measurement", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Checklists", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Responsive QA passed"),
  ).toBeChecked();
});
test("intern enrollment, mentor review and completion persist across refresh", async ({
  page,
}) => {
  await page.goto("/internships/interns");
  await add(page, "Add enrollment", async (d) => {
    await d.getByLabel("Enrollment name").fill("Ali fellowship");
    await d.getByLabel("Program", { exact: true }).selectOption("program-web");
    await d.getByLabel("Intern", { exact: true }).selectOption("preview-ali");
    await d.getByLabel("Mentor", { exact: true }).selectOption("preview-hamza");
    await d.getByLabel("Start date").fill("2026-11-02");
    await d.getByLabel("Progress %").fill("0");
  });
  await page
    .getByRole("button", { name: "Ali fellowship", exact: true })
    .click();
  await action(page, "Start training");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  const d = page.getByRole("dialog").last();
  await d.getByLabel("Progress %").fill("100");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await close(page);
  await page.getByRole("link", { name: /Progress reviews/ }).click();
  await add(page, "Add evaluation", async (d) => {
    await d.getByLabel("Review title").fill("Final review");
    await d
      .getByLabel("Enrollment", { exact: true })
      .selectOption({ label: "Ali fellowship" });
    await d
      .getByLabel("Reviewer", { exact: true })
      .selectOption("preview-hamza");
    await d.getByLabel("Review date").fill("2026-12-01");
    await d.getByLabel("Score out of 100").fill("92");
    await d.getByLabel("Mentor feedback").fill("Ready for project delivery");
  });
  await page
    .locator(".module-tabs")
    .getByRole("link", { name: /Interns/ })
    .click();
  await page
    .getByRole("button", { name: "Ali fellowship", exact: true })
    .click();
  await action(page, "Record completion");
  await close(page);
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Ali fellowship" }),
  ).toContainText("Completed");
});
test("project creation, team assignment and new task appear on their shared board", async ({
  page,
}) => {
  await page.goto("/projects/manage");
  await add(page, "Add project", async (d) => {
    await d.getByLabel("Project name").fill("Client portal delivery");
    await d.getByLabel("Client", { exact: true }).selectOption("client-a");
    await d.getByLabel("Category", { exact: true }).selectOption("Web App");
    await d.getByLabel("Project manager").selectOption("preview-hamza");
    await d
      .getByLabel("Project members")
      .selectOption(["preview-hamza", "preview-ali"]);
  });
  await page
    .getByRole("button", { name: "Client portal delivery", exact: true })
    .click();
  await page.getByRole("link", { name: /Open project board/ }).click();
  await page.getByRole("button", { name: "Add Card", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Title", { exact: true }).fill("Portal discovery");
  await d.getByRole("button", { name: "Create card" }).click();
  await expect(
    page.getByRole("button", { name: /Portal discovery/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Portal discovery/ }),
  ).toBeVisible();
});
test("calendar, timeline and list share the task dialog and keep horizontal scrolling inside the view", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(page.locator(".month-grid")).toBeVisible();
  await page
    .getByRole("button", { name: "#426 SLI measurement", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await close(page);
  await page.getByRole("button", { name: "Next month" }).click();
  await page.getByRole("button", { name: "Previous month" }).click();
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await page.getByLabel("Timeline zoom").selectOption("40");
  await page
    .getByRole("button", { name: "Timeline task #426 SLI measurement" })
    .click();
  await close(page);
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("SLI measurement");
});
test("workspace settings update company name and export an actual JSON backup", async ({
  page,
}) => {
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "Company name", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  const d = page.getByRole("dialog").last();
  await d.getByLabel("Value", { exact: true }).fill("Nexus Test Studio");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await close(page);
  await expect(page.locator(".sidebar-footer")).toContainText(
    "Nexus Test Studio",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download workspace backup" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/mt-nexus-workspace.*\.json$/);
  const { readFile } = await import("node:fs/promises");
  const saved = JSON.parse(await readFile(await file.path(), "utf8"));
  expect(
    saved.records.settings.find((s) => s.name === "Company name").value,
  ).toBe("Nexus Test Studio");
});
