import { test, expect } from "@playwright/test";
const password = "NexusUI@2026!";
async function login(page, email = "admin@mtnexus.test") {
  await page.goto("/login");
  await page.getByLabel("Company email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily work dashboard", exact: true }),
  ).toBeVisible();
}
async function add(page, label, fill) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const d = page.getByRole("dialog").last();
  await fill(d);
  await d.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(d).toHaveCount(0);
}
async function logout(page) {
  await page.locator(".profile").click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
}
async function perform(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
  const d = page.getByRole("dialog").last();
  await d.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
}
test("admin provisions an employee account; employee sees own work and lead entry without operations dashboards", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/users");
  await add(page, "Add preview account", async (d) => {
    await d.getByLabel("Full name", { exact: true }).fill("Operations Admin");
    await d
      .getByLabel("Email", { exact: true })
      .fill("operations@mtnexus.test");
    await d.getByLabel("Employee profile").selectOption("preview-sara");
    await d.getByLabel("Role", { exact: true }).selectOption("role-admin");
  });
  await logout(page);
  await login(page, "operations@mtnexus.test");
  await page.goto("/employees");
  await expect(
    page.getByText("OPERATIONS OVERVIEW", { exact: true }),
  ).toHaveCount(0);
  await add(page, "Add employee", async (d) => {
    await d.getByLabel("Full name", { exact: true }).fill("Rida Engineer");
    await d.getByLabel("Work email").fill("rida@mtnexus.test");
    await d.getByLabel("Department", { exact: true }).selectOption("dept-dev");
    await d.getByLabel("Designation").fill("Quality Engineer");
    await d.getByLabel("Work arrangement").selectOption("Remote");
  });
  const person = page
    .locator(".people-directory-card")
    .filter({ hasText: "Rida Engineer" });
  await person
    .getByRole("button", { name: "Rida Engineer", exact: true })
    .click();
  await perform(page, "Complete onboarding");
  await page.getByRole("button", { name: "Close dialog" }).click();
  const id = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("mt-nexus-ui-preview-v1"),
      ).records.employees.find((e) => e.email === "rida@mtnexus.test").id,
  );
  await page.goto("/admin/users");
  await add(page, "Add preview account", async (d) => {
    await d.getByLabel("Full name", { exact: true }).fill("Rida Engineer");
    await d
      .getByLabel("Email", { exact: true })
      .fill("rida-login@mtnexus.test");
    await d.getByLabel("Employee profile").selectOption(id);
    await expect(
      d
        .getByLabel("Role", { exact: true })
        .locator('option[value="role-super"]'),
    ).toHaveCount(0);
    await expect(
      d
        .getByLabel("Role", { exact: true })
        .locator('option[value="role-admin"]'),
    ).toHaveCount(0);
    await d.getByLabel("Role", { exact: true }).selectOption("role-employee");
  });
  await page.goto("/projects");
  await page.getByRole("button", { name: "Add Card", exact: true }).click();
  let d = page.getByRole("dialog");
  await d
    .getByLabel("Title", { exact: true })
    .fill("Rida daily testing assignment");
  await d.getByLabel("Assign card to").selectOption(id);
  await d.getByRole("button", { name: "Create card", exact: true }).click();
  await expect(d).toHaveCount(0);
  await logout(page);
  await login(page, "rida-login@mtnexus.test");
  await expect(page.getByLabel("Dashboard view", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator(".daily-task-card")).toContainText(
    "Rida daily testing assignment",
  );
  await page.goto("/employees");
  await expect(page.locator(".people-directory-card")).toHaveCount(1);
  await expect(page.locator(".people-directory-card")).toContainText(
    "Rida Engineer",
  );
  await expect(
    page.getByRole("button", { name: "Add employee", exact: true }),
  ).toHaveCount(0);
  await page.goto("/crm");
  await expect(page.locator(".module-metrics")).toHaveCount(0);
  await expect(
    page.getByText("OPERATIONS OVERVIEW", { exact: true }),
  ).toHaveCount(0);
  await add(page, "Add client lead", async (d) => {
    await d.getByLabel("Company name").fill("Rida client lead");
    await d.getByLabel("Contact person").fill("Client Contact");
    await d.getByLabel("Email", { exact: true }).fill("contact@client.test");
  });
  await expect(
    page.getByRole("button", { name: "Rida client lead", exact: true }),
  ).toBeVisible();
  await page.goto("/attendance");
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check-in recorded");
  await page.goto("/finance/invoices");
  await expect(page.getByRole("alert")).toContainText("Your role cannot open");
});
test("administrator deletes a card with an audit archive and subsequent cards keep unique IDs", async ({
  page,
}) => {
  await login(page);
  await page.goto("/projects");
  async function create(title) {
    await page.getByRole("button", { name: "Add Card", exact: true }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Title", { exact: true }).fill(title);
    await d.getByRole("button", { name: "Create card", exact: true }).click();
    await expect(d).toHaveCount(0);
    return page.evaluate(
      (title) =>
        JSON.parse(localStorage.getItem("mt-nexus-ui-preview-v1")).tasks.find(
          (t) => t.title === title,
        ).id,
      title,
    );
  }
  const removedId = await create("Temporary administrator card");
  await page.goto(`/projects?task=${removedId}`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete card", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm delete card", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/task=/);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: `#${removedId} Temporary administrator card`,
      exact: true,
    }),
  ).toHaveCount(0);
  await page.reload();
  const nextId = await create("Replacement administrator card");
  expect(nextId).toBeGreaterThan(removedId);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mt-nexus-ui-preview-v1")),
  );
  expect(saved.archivedTasks.find((t) => t.id === removedId)).toBeTruthy();
  expect(
    saved.records.auditLogs.some(
      (a) => a.action === "DELETED" && a.recordId === String(removedId),
    ),
  ).toBe(true);
});
test("attendance correction records arrival/departure, month totals and correction history", async ({
  page,
}) => {
  await login(page);
  await page.goto("/attendance");
  await add(page, "Add attendance", async (d) => {
    await d.getByLabel("Employee", { exact: true }).selectOption("preview-ali");
    await d.getByLabel("Date", { exact: true }).fill("2026-11-01");
    await d.getByLabel("Check-in", { exact: true }).fill("2026-11-01T09:00");
    await d.getByLabel("Check-out", { exact: true }).fill("2026-11-01T18:00");
    await d.getByLabel("Unpaid break (minutes)").fill("60");
    await d
      .getByLabel("Correction reason")
      .fill("Verified the employee arrival and departure register.");
  });
  await page.getByLabel("Attendance register month").fill("2026-11");
  await expect(
    page
      .locator(".attendance-person-grid")
      .getByText("1 recorded days · 8h 0m"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Correct attendance", exact: true })
    .click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Check-out", { exact: true }).fill("2026-11-01T19:00");
  await d
    .getByLabel("Correction reason")
    .fill("Approved one additional hour of work.");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(
    page
      .locator(".attendance-person-grid")
      .getByText("1 recorded days · 9h 0m"),
  ).toBeVisible();
  await page.goto("/employees");
  await page.getByRole("button", { name: "Ali Raza", exact: true }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("Profile attendance month").fill("2026-11");
  await expect(d.locator(".person-profile-work")).toContainText("9h 0m");
  await expect(d.locator(".person-assignment-list")).toContainText(
    "#426 SLI measurement",
  );
});
test("cash register posts and reverses client payouts; drafts never count as money paid", async ({
  page,
}) => {
  await login(page);
  await page.goto("/finance/cashbook");
  await add(page, "Add cash movement", async (d) => {
    await d.getByLabel("Transaction reference").fill("CLIENT-REFUND-100");
    await d.getByLabel("Paid to / received from").selectOption("Client");
    await d.getByLabel("Counterparty name").fill("Client A");
    await d.getByLabel("Related client").selectOption("client-a");
    await d.getByLabel("Amount", { exact: true }).fill("2500");
    await d.getByLabel("Purpose / description").fill("Approved client refund");
  });
  await page
    .getByRole("button", { name: "CLIENT-REFUND-100", exact: true })
    .click();
  await perform(page, "Post movement");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".money-flow-metrics")).toContainText("2,500.00");
  await page
    .getByRole("button", { name: "CLIENT-REFUND-100", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Void movement", exact: true })
    .click();
  const d = page.getByRole("dialog").last();
  await d
    .getByLabel("Reason for reversal")
    .fill("Client payout reversed by bank");
  await d.getByRole("button", { name: "Void movement", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  const state = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("mt-nexus-ui-preview-v1")).records
        .cashbook[0].status,
  );
  expect(state).toBe("Voided");
});

test("read-only roles hide editing controls and the preview transport rejects a forged edit", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/roles");
  await add(page, "Add role", async (d) => {
    await d.getByLabel("Role name").fill("READ_ONLY_OBSERVER");
    for (const name of ["tasks.read", "employees.read", "attendance.read"])
      await d.getByLabel(name, { exact: true }).check();
  });
  const roleId = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("mt-nexus-ui-preview-v1"),
      ).records.roles.find((r) => r.name === "READ_ONLY_OBSERVER").id,
  );
  await page.goto("/admin/users");
  await add(page, "Add preview account", async (d) => {
    await d.getByLabel("Full name", { exact: true }).fill("Read Only Observer");
    await d.getByLabel("Email", { exact: true }).fill("observer@mtnexus.test");
    await d.getByLabel("Employee profile").selectOption("preview-ali");
    await d.getByLabel("Role", { exact: true }).selectOption(roleId);
  });
  await logout(page);
  await login(page, "observer@mtnexus.test");
  await page.goto("/projects?task=426");
  const d = page.getByRole("dialog");
  await expect(d.getByLabel("Task title", { exact: true })).toBeDisabled();
  await expect(
    d.getByRole("button", { name: "Delete card", exact: true }),
  ).toHaveCount(0);
  await expect(
    d.getByRole("button", { name: "Save document", exact: true }),
  ).toHaveCount(0);
  await d.locator(".task-edit-fields").evaluate((el) => (el.disabled = false));
  await d
    .getByLabel("Task title", { exact: true })
    .fill("Unauthorized replacement");
  await d.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText("Your role does not allow");
  const title = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("mt-nexus-ui-preview-v1")).tasks.find(
        (t) => t.id === 426,
      ).title,
  );
  expect(title).toBe("SLI measurement");
});
test("task marker follows actual work phases; people/departments stay readable in both themes", async ({
  page,
}) => {
  await login(page);
  await page.getByLabel("Follow assigned task").selectOption("418");
  const card = page.locator(".daily-task-card").filter({
    has: page.getByRole("button", {
      name: "#418 Fix header bug",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Start work", exact: true }).click();
  await expect(
    page.locator(".delivery-step.phase-development .follow-task-token"),
  ).toContainText("#418");
  await card
    .getByRole("button", { name: "Log daily update", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Time spent (minutes)").fill("30");
  await d
    .getByLabel("What did you accomplish today?")
    .fill("Implemented the header and started regression testing.");
  await d.getByLabel("Work phase").selectOption("testing");
  await d.getByLabel("Overall progress after this update (%)").fill("30");
  await d
    .getByRole("button", { name: "Save daily update", exact: true })
    .click();
  await expect(
    page.locator(".delivery-step.phase-testing .follow-task-token"),
  ).toContainText("#418");
  await page
    .locator(".diagram-panel")
    .screenshot({ path: "/tmp/mt-assigned-work-tracker.png" });
  await page.goto("/employees");
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator(".app.light")).toBeVisible();
  const color = await page
    .locator(".directory-person-name")
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  expect(color).not.toBe("rgb(255, 255, 255)");
  const contrast = await page
    .locator(".module-table-controls .secondary")
    .first()
    .evaluate((el) => {
      const rgb = (s) =>
        s
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((x) => {
            x /= 255;
            return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          });
      const l = (v) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
      const style = getComputedStyle(el),
        a = l(rgb(style.color)),
        b = l(rgb(style.backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  expect(contrast).toBeGreaterThan(4.5);
  await page.screenshot({
    path: "/tmp/mt-people-directory-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ali Raza", exact: true }).click();
  await expect(
    page.getByRole("dialog").locator(".person-assignment-list"),
  ).toContainText("#426 SLI measurement");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/departments");
  await page.getByRole("button", { name: "Development", exact: true }).click();
  await expect(
    page.getByRole("dialog").locator(".department-delivery-flow"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/mt-departments-light-mobile.png",
    fullPage: true,
  });
});

test("delete permission can be granted independently from edit permission", async ({
  page,
}) => {
  await login(page);
  await page.goto("/clients");
  await add(page, "Add client", async (d) => {
    await d.getByLabel("Company name").fill("Permission test client");
    await d.getByLabel("Contact person").fill("Test contact");
    await d
      .getByLabel("Email", { exact: true })
      .fill("permission-client@test.example");
  });
  await page.goto("/admin/roles");
  await add(page, "Add role", async (d) => {
    await d.getByLabel("Role name").fill("CLIENT_CLEANUP");
    for (const name of [
      "clients.read",
      "clients.delete",
      "tasks.read",
      "employees.read",
    ])
      await d.getByLabel(name, { exact: true }).check();
  });
  const roleId = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("mt-nexus-ui-preview-v1"),
      ).records.roles.find((r) => r.name === "CLIENT_CLEANUP").id,
  );
  await page.goto("/admin/users");
  await add(page, "Add preview account", async (d) => {
    await d.getByLabel("Full name", { exact: true }).fill("Client Cleanup");
    await d.getByLabel("Email", { exact: true }).fill("cleanup@mtnexus.test");
    await d.getByLabel("Employee profile").selectOption("preview-ali");
    await d.getByLabel("Role", { exact: true }).selectOption(roleId);
  });
  await logout(page);
  await login(page, "cleanup@mtnexus.test");
  await page.goto("/clients");
  await page
    .getByRole("button", { name: "Permission test client", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await expect(
    d.getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await d.getByRole("button", { name: "Delete", exact: true }).click();
  const confirm = page.getByRole("dialog").last();
  await confirm
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Permission test client", exact: true }),
  ).toHaveCount(0);
});
