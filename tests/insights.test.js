import { test } from "node:test";
import assert from "node:assert/strict";
import { initialPreviewData } from "../src/preview/data.js";
import {
  hydrateWorkspace,
  mutateRecord,
  performAction,
} from "../src/modules/store.js";
import {
  moduleSummary,
  modulePanels,
  projectHealth,
  dueLabel,
} from "../src/modules/insights.js";
import { formDefaults, formCalculation } from "../src/modules/formSupport.js";
const data = () => hydrateWorkspace(initialPreviewData());
test("client and hiring summaries use relevant domain records rather than generic counters", () => {
  const d = data();
  const clients = moduleSummary("clients", d, { asOf: "2026-11-01" });
  assert.equal(clients[0].value, 2);
  assert.equal(clients[1].value, 4);
  assert.ok(!clients.some((c) => c.label === "Awaiting review"));
  const hiring = moduleSummary("hiring", d);
  assert.equal(hiring[0].value, 1);
  assert.equal(hiring[1].value, 1);
});
test("project progress uses approved tasks and overdue excludes completed work", () => {
  const d = data();
  const health = projectHealth(d, "preview-web", "2026-11-01");
  assert.equal(health.done, 1);
  assert.equal(health.progress, Math.round((1 / 8) * 100));
  assert.equal(projectHealth(d, "nonexistent", "2026-11-01").progress, 0);
  assert.deepEqual(dueLabel("2026-10-01", "Paid", "2026-11-01"), {
    text: "Complete",
    tone: "good",
  });
  assert.equal(dueLabel("2026-10-31", "Open", "2026-11-01").tone, "danger");
});
test("finance excludes draft balances and counts only this month’s recorded payments", () => {
  const d = data();
  let summary = moduleSummary("finance", d, { asOf: "2026-11-01" });
  assert.equal(summary[0].value, "PKR 0.00");
  performAction(d, "invoices", "invoice-a", "issue");
  mutateRecord(d, "payments", "POST", null, {
    reference: "October payment",
    invoiceId: "invoice-a",
    amount: "10.00",
    date: "2026-10-31",
    method: "Cash",
  });
  mutateRecord(d, "payments", "POST", null, {
    reference: "November payment",
    invoiceId: "invoice-a",
    amount: "20.00",
    date: "2026-11-01",
    method: "Cash",
  });
  summary = moduleSummary("finance", d, { asOf: "2026-11-01" });
  assert.equal(summary[0].value, "PKR 149,970.00");
  assert.equal(summary[1].value, "PKR 20.00");
});
test("pipeline drill-downs encode the actual stage as a record filter", () => {
  const d = data();
  const items = modulePanels("hiring", d)[0].items;
  assert.equal(items.find((i) => i.label === "Applied").value, 1);
  assert.equal(items.find((i) => i.label === "Screening").value, 0);
  assert.equal(
    items.find((i) => i.label === "Applied").href,
    "/hiring/applicants?status=Applied",
  );
});
test("workload bars use share of real assigned work, without invented capacities", () => {
  const d = data();
  let item = modulePanels("creative", d)[0].items[0];
  assert.equal(item.percent, 100);
  d.records.creativeRequests.push({
    ...d.records.creativeRequests[0],
    id: "another",
    assigneeId: "preview-ali",
  });
  assert.deepEqual(
    modulePanels("creative", d)[0].items.map((i) => i.percent),
    [50, 50],
  );
});
test("invoice suggestions do not overwrite records or repeat an existing number", () => {
  const d = data(),
    defaults = formDefaults("invoices", d);
  assert.equal(defaults.number.endsWith("002"), true);
  assert.equal(
    formDefaults("invoices", d, { number: "KEEP-THIS" }).number,
    "KEEP-THIS",
  );
  assert.match(formDefaults("payroll", d).month, /^\d{4}-\d{2}$/);
});
test("live form calculations keep cent precision and show invalid payroll deductions", () => {
  const d = data();
  assert.equal(
    formCalculation("invoiceItems", { quantity: 3, unitPrice: "0.10" }, d)
      .amount,
    "0.30",
  );
  assert.equal(
    formCalculation("payroll", { gross: "100.00", deductions: "20.00" }, d)
      .amount,
    "80.00",
  );
  assert.equal(
    formCalculation("payroll", { gross: "100.00", deductions: "200.00" }, d)
      .amount,
    null,
  );
});

test("approved creative work is complete even after its due date", () => {
  assert.equal(
    dueLabel("2026-10-01", "Approved", "2026-11-01").text,
    "Complete",
  );
});
