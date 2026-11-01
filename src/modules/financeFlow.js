import { toCents } from "./store.js";
export function financeFlow(data, month = "") {
  const r = data.records,
    entries = [];
  for (const p of r.payments) {
    const invoice = r.invoices.find((i) => i.id === p.invoiceId);
    entries.push({
      id: p.id,
      date: p.date,
      direction: "Money in",
      amount: toCents(p.amount),
      counterparty:
        r.clients.find((c) => c.id === invoice?.clientId)?.company || "Client",
      clientId: invoice?.clientId,
      reference: p.reference,
      source: "Invoice payment",
    });
  }
  for (const x of r.expenses.filter((x) => x.status === "Recorded"))
    entries.push({
      id: x.id,
      date: x.date,
      direction: "Money out",
      amount: toCents(x.amount),
      counterparty: x.description,
      reference: x.category,
      source: "Expense",
    });
  for (const x of r.payroll.filter((x) => x.status === "Recorded"))
    entries.push({
      id: x.id,
      date: String(x.recordedAt || x.updatedAt || x.createdAt || x.month).slice(
        0,
        10,
      ),
      direction: "Money out",
      amount: Math.max(0, toCents(x.gross) - toCents(x.deductions)),
      counterparty:
        r.employees.find((e) => e.id === x.employeeId)?.fullName || "Employee",
      reference: x.month,
      source: "Payroll",
    });
  for (const x of (r.cashbook || []).filter((x) => x.status === "Posted"))
    entries.push({ ...x, amount: toCents(x.amount), source: "Cash / bank" });
  const filtered = entries
    .filter((e) => !month || e.date?.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const incoming = filtered
      .filter((e) => e.direction === "Money in")
      .reduce((s, e) => s + e.amount, 0),
    outgoing = filtered
      .filter((e) => e.direction === "Money out")
      .reduce((s, e) => s + e.amount, 0);
  const clients = r.clients.map((c) => {
    const invoices = r.invoices.filter(
      (i) => i.clientId === c.id && !["Draft", "Cancelled"].includes(i.status),
    );
    return {
      ...c,
      received: filtered
        .filter((e) => e.clientId === c.id && e.direction === "Money in")
        .reduce((s, e) => s + e.amount, 0),
      paid: filtered
        .filter((e) => e.clientId === c.id && e.direction === "Money out")
        .reduce((s, e) => s + e.amount, 0),
      outstanding: invoices.reduce(
        (s, i) => s + Math.max(0, i.totalCents - i.paidCents),
        0,
      ),
    };
  });
  return {
    entries: filtered,
    incoming,
    outgoing,
    net: incoming - outgoing,
    clients,
  };
}
