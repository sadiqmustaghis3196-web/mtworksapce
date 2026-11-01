import { today, toCents, fromCents } from "./store.js";
export function formDefaults(entity, data, record = {}) {
  const day = today(),
    defaults = {};
  if (entity === "employees")
    Object.assign(defaults, {
      joiningDate: day,
      annualLeave: 14,
      salary: "0.00",
    });
  if (entity === "invoices") {
    let n = data.records.invoices.length + 1,
      number;
    do {
      number = `INV-${day.slice(0, 4)}-${String(n++).padStart(3, "0")}`;
    } while (data.records.invoices.some((i) => i.number === number));
    Object.assign(defaults, { number, issueDate: day });
  }
  if (entity === "payroll")
    Object.assign(defaults, { month: day.slice(0, 7), deductions: "0.00" });
  if (["payments", "expenses", "evaluations"].includes(entity))
    defaults.date = day;
  if (entity === "invoiceItems") defaults.quantity = 1;
  return { ...defaults, ...record };
}
const help = {
  projects: {
    memberIds: "Only project members can be assigned its tasks.",
    deadline:
      "Used to plan the delivery timeline; individual tasks can have their own deadlines.",
  },
  applications: {
    jobId: "Link the candidate to the opening they applied for.",
    resume: "Supported files stay in this browser during UI review.",
  },
  interviews: {
    scheduledAt:
      "Use the team’s agreed local time. Conflicting interviewer slots are checked.",
  },
  employees: {
    managerId:
      "Choose the person responsible for reviews and day-to-day support.",
    annualLeave: "Working-day allowance used by the leave approval workflow.",
  },
  leaves: {
    startDate: "Leave is counted Monday–Friday; weekends are excluded.",
    endDate: "Submit separate requests if the dates cross into another year.",
  },
  enrollments: {
    mentorId: "The mentor must be different from the intern.",
    progress: "Completion also requires a recorded mentor evaluation.",
  },
  invoices: {
    dueDate:
      "Collections and overdue views use this date. Add line items before issuing.",
  },
  invoiceItems: {
    quantity: "Whole units. Line totals use exact integer-cent calculations.",
    invoiceId: "Line items can be changed only while the invoice is a draft.",
  },
  payments: {
    amount: "Cannot exceed the invoice’s remaining balance.",
    reference: "Use a unique bank, receipt or internal ledger reference.",
  },
  payroll: {
    employeeId:
      "The selected employee’s monthly salary is suggested for a new record.",
    deductions:
      "Deductions cannot exceed gross salary. No bank transfer is made.",
  },
  creativeRequests: {
    projectId: "Starting work creates a linked task on this project’s board.",
    brief:
      "Describe the audience, deliverables, brand guidance and acceptance criteria.",
  },
  leads: { followUp: "This appears in the sales follow-up agenda." },
  tickets: {
    dueDate: "Used by the support deadline watchlist.",
    description:
      "Include expected behavior, observed behavior and reproduction steps.",
  },
  users: {
    roleId: "Preview configuration only; this does not create a real login.",
  },
  roles: {
    permissions:
      "Stored preview permissions. Server-side authorization remains a later phase.",
  },
};
export const fieldHelp = (entity, key) => help[entity]?.[key];
export function formCalculation(entity, values, data) {
  try {
    if (entity === "invoiceItems")
      return {
        label: "Line total",
        amount: fromCents(
          toCents(values.unitPrice || 0) * Number(values.quantity || 0),
        ),
        detail: "Quantity × unit price",
      };
    if (entity === "payroll") {
      const net = toCents(values.gross || 0) - toCents(values.deductions || 0);
      return {
        label: "Net payroll record",
        amount: net < 0 ? null : fromCents(net),
        detail:
          net < 0
            ? "Deductions exceed gross salary."
            : "Gross salary − deductions · no external transfer",
      };
    }
    if (entity === "payments") {
      const invoice = data.records.invoices.find(
        (i) => i.id === values.invoiceId,
      );
      if (invoice)
        return {
          label: "Invoice balance",
          amount: fromCents(invoice.totalCents - invoice.paidCents),
          detail: `${invoice.number} · ${invoice.status}`,
        };
    }
  } catch {}
  return null;
}
