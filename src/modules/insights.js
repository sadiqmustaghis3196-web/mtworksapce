import { toCents, today } from "./store.js";
import { collectionPath, modules } from "./catalog.js";
export const records = (data, key) =>
  key === "projects" ? data.projects : data.records[key] || [];
const count = (list, states) =>
  list.filter((r) => states.includes(r.status)).length;
const textDate = (value) => value?.slice(0, 10) || "";
export function recordLink(entity, id) {
  const owner =
    entity === "projects"
      ? "projects"
      : Object.keys(modules).find((key) =>
          modules[key].tabs.some((t) => t[0] === entity),
        );
  return `${collectionPath(owner, entity)}${id ? `/${id}` : ""}`;
}
export function moneyLabel(cents, currency = "PKR") {
  return `${currency} ${(cents / 100).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function projectHealth(data, projectId, asOf = today()) {
  const tasks = data.tasks.filter(
      (t) => t.projectId === projectId && !t.deletedAt,
    ),
    done = tasks.filter((t) => t.stage === 4).length,
    overdue = tasks.filter(
      (t) => t.stage !== 4 && t.dueDate && textDate(t.dueDate) < asOf,
    ).length;
  return {
    total: tasks.length,
    done,
    overdue,
    review: tasks.filter((t) => t.stage === 3).length,
    progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  };
}
export function dueLabel(date, status, asOf = today()) {
  if (
    [
      "Done",
      "Paid",
      "Completed",
      "Resolved",
      "Closed",
      "Cancelled",
      "Approved",
      "Recorded",
      "Hired",
      "Accepted",
      "Archived",
    ].includes(status)
  )
    return { text: "Complete", tone: "good" };
  if (!date) return { text: "Not scheduled", tone: "muted" };
  const day = textDate(date);
  return day < asOf
    ? { text: "Overdue", tone: "danger" }
    : day === asOf
      ? { text: "Due today", tone: "warning" }
      : { text: "Upcoming", tone: "muted" };
}
export function moduleSummary(
  module,
  data,
  { asOf = today(), leaveBalance = 0 } = {},
) {
  const r = (k) => records(data, k),
    currency = r("settings").find((s) => s.name === "Currency")?.value || "PKR",
    m = (label, value, hint) => ({ label, value, hint });
  switch (module) {
    case "clients":
      return [
        m(
          "Active clients",
          count(r("clients"), ["Active"]),
          "Current client relationships",
        ),
        m(
          "Live projects",
          count(r("projects"), ["Active"]),
          "Delivery currently in motion",
        ),
        m(
          "Client contacts",
          r("contacts").length,
          "People across your accounts",
        ),
        m(
          "Outstanding",
          moneyLabel(
            r("invoices")
              .filter((i) => ["Issued", "Partially paid"].includes(i.status))
              .reduce((s, i) => s + i.totalCents - i.paidCents, 0),
            currency,
          ),
          "Issued invoices awaiting payment",
        ),
      ];
    case "projects":
      return [
        m(
          "Active projects",
          count(r("projects"), ["Active"]),
          "Current delivery portfolio",
        ),
        m(
          "Tasks in review",
          data.tasks.filter((t) => t.stage === 3).length,
          "Waiting for a decision",
        ),
        m(
          "Overdue tasks",
          data.tasks.filter(
            (t) => t.stage !== 4 && t.dueDate && textDate(t.dueDate) < asOf,
          ).length,
          "Open work past its due date",
        ),
        m(
          "Completed projects",
          count(r("projects"), ["Completed"]),
          "All work approved",
        ),
      ];
    case "hiring":
      return [
        m("Open roles", count(r("jobs"), ["Open"]), "Published opportunities"),
        m(
          "Active candidates",
          r("applications").filter(
            (a) => !["Hired", "Rejected"].includes(a.status),
          ).length,
          "Across the hiring pipeline",
        ),
        m(
          "Scheduled interviews",
          count(r("interviews"), ["Scheduled"]),
          "Upcoming evaluation sessions",
        ),
        m(
          "Hires",
          count(r("applications"), ["Hired"]),
          "Linked employee profiles",
        ),
      ];
    case "employees":
      return [
        m(
          "Active employees",
          count(r("employees"), ["Active"]),
          "Currently on the team",
        ),
        m(
          "Onboarding",
          count(r("employees"), ["Onboarding"]),
          "New starters to support",
        ),
        m(
          "Departments",
          count(r("departments"), ["Active"]),
          "Active organizational teams",
        ),
        m(
          "Offboarding",
          count(r("employees"), ["Offboarding"]),
          "Exit checklists in progress",
        ),
      ];
    case "attendance":
      return [
        m(
          "Checked in today",
          r("attendance").filter((a) => a.date === asOf).length,
          "Asia/Karachi working day",
        ),
        m(
          "Currently checked in",
          r("attendance").filter((a) => a.date === asOf && !a.checkOut).length,
          "Open attendance sessions",
        ),
        m(
          "Leave approvals",
          count(r("leaves"), ["Pending"]),
          "Requests awaiting a decision",
        ),
        m(
          "Annual leave balance",
          `${leaveBalance} days`,
          "For the selected employee",
        ),
      ];
    case "internships": {
      const active = r("enrollments").filter(
        (e) => !["Completed", "Withdrawn"].includes(e.status),
      );
      return [
        m(
          "Active programs",
          count(r("programs"), ["Active"]),
          "Learning programs underway",
        ),
        m("Active interns", active.length, "Enrolled or in training"),
        m(
          "Average progress",
          `${active.length ? Math.round(active.reduce((s, e) => s + Number(e.progress), 0) / active.length) : 0}%`,
          "Current active enrollments",
        ),
        m(
          "Completed",
          count(r("enrollments"), ["Completed"]),
          "Reviewed completion records",
        ),
      ];
    }
    case "finance":
      return [
        m(
          "Outstanding",
          moneyLabel(
            r("invoices")
              .filter((i) => ["Issued", "Partially paid"].includes(i.status))
              .reduce((s, i) => s + i.totalCents - i.paidCents, 0),
            currency,
          ),
          "Unpaid issued invoice balances",
        ),
        m(
          "Recorded this month",
          moneyLabel(
            r("payments")
              .filter((p) => p.date?.startsWith(asOf.slice(0, 7)))
              .reduce((s, p) => s + toCents(p.amount), 0),
            currency,
          ),
          "Payment ledger · no bank integration",
        ),
        m(
          "Overdue invoices",
          r("invoices").filter(
            (i) =>
              ["Issued", "Partially paid"].includes(i.status) &&
              i.dueDate < asOf,
          ).length,
          "Outstanding beyond the due date",
        ),
        m(
          "Payroll approvals",
          count(r("payroll"), ["Pending approval"]),
          "Waiting for authorization",
        ),
      ];
    case "creative":
      return [
        m(
          "Work in production",
          count(r("creativeRequests"), ["In progress", "Revision requested"]),
          "Assigned creative requests",
        ),
        m(
          "Awaiting review",
          count(r("creativeRequests"), ["Review"]),
          "Ready for feedback",
        ),
        m(
          "Approved",
          count(r("creativeRequests"), ["Approved"]),
          "Completed creative deliveries",
        ),
        m(
          "Deliverables",
          r("creativeAssets").length,
          "Files in the asset library",
        ),
      ];
    case "crm":
      return [
        m(
          "Open leads",
          r("leads").filter((l) => !["Won", "Lost"].includes(l.status)).length,
          "Active sales conversations",
        ),
        m(
          "Open opportunity value",
          moneyLabel(
            r("opportunities")
              .filter((o) => o.status === "Open")
              .reduce((s, o) => s + toCents(o.value || 0), 0),
            currency,
          ),
          "Expected value · not booked revenue",
        ),
        m(
          "Follow-ups due",
          r("leads").filter(
            (l) =>
              !["Won", "Lost"].includes(l.status) &&
              l.followUp &&
              l.followUp <= asOf,
          ).length,
          "Today or overdue",
        ),
        m(
          "Converted clients",
          r("leads").filter((l) => l.clientId).length,
          "Won leads linked to clients",
        ),
      ];
    case "support":
      return [
        m(
          "Open tickets",
          r("tickets").filter((t) => !["Resolved", "Closed"].includes(t.status))
            .length,
          "Active support workload",
        ),
        m(
          "Unassigned",
          r("tickets").filter(
            (t) => !["Resolved", "Closed"].includes(t.status) && !t.assigneeId,
          ).length,
          "Needs an owner",
        ),
        m(
          "Past deadline",
          r("tickets").filter(
            (t) =>
              !["Resolved", "Closed"].includes(t.status) && t.dueDate < asOf,
          ).length,
          "Requires attention",
        ),
        m(
          "Resolved",
          count(r("tickets"), ["Resolved", "Closed"]),
          "Issues with a recorded resolution",
        ),
      ];
    case "departments":
      return [
        m(
          "Active departments",
          count(r("departments"), ["Active"]),
          "Current organization structure",
        ),
        m(
          "Team members",
          r("employees").filter((e) => e.status !== "Inactive").length,
          "Across all departments",
        ),
        m(
          "Managers assigned",
          r("departments").filter((d) => d.managerId && d.status === "Active")
            .length,
          "Departments with an accountable owner",
        ),
        m(
          "Active projects",
          count(r("projects"), ["Active"]),
          "Delivery across your teams",
        ),
      ];
    case "admin":
      return [
        m(
          "Active preview accounts",
          count(r("users"), ["Active"]),
          "Configuration records only",
        ),
        m("Defined roles", r("roles").length, "Stored permission groups"),
        m("Audit events", r("auditLogs").length, "Recorded workspace changes"),
        m(
          "Inactive accounts",
          count(r("users"), ["Inactive"]),
          "Not real login provisioning",
        ),
      ];
    case "notifications":
      return [
        m("Unread", count(r("notifications"), ["Unread"]), "Updates to review"),
        m(
          "Read",
          count(r("notifications"), ["Read"]),
          "Reviewed notifications",
        ),
        m(
          "Today",
          r("notifications").filter((n) => textDate(n.createdAt) === asOf)
            .length,
          "Workspace updates today",
        ),
        m(
          "Total updates",
          r("notifications").length,
          "Current browser workspace",
        ),
      ];
    default:
      return [];
  }
}
export function modulePanels(module, data, { asOf = today() } = {}) {
  const r = (k) => records(data, k),
    find = (key, id) => r(key).find((v) => v.id === id),
    currency = r("settings").find((s) => s.name === "Currency")?.value || "PKR";
  const item = (entity, record, label, detail, extra = {}) => ({
    id: record.id,
    label,
    detail,
    href: recordLink(entity, record.id),
    ...extra,
  });
  const workload = () =>
    r("projects")
      .filter((p) => p.status === "Active")
      .map((p) => {
        const h = projectHealth(data, p.id, asOf);
        return item(
          "projects",
          p,
          p.name,
          `${h.done}/${h.total} tasks approved · ${find("employees", p.managerId)?.fullName || "No manager"}`,
          {
            percent: h.progress,
            value: h.overdue ? `${h.overdue} overdue` : `${h.progress}%`,
            tone: h.overdue ? "danger" : "good",
          },
        );
      });
  const followups = () =>
    r("leads")
      .filter((l) => !["Won", "Lost"].includes(l.status) && l.followUp)
      .sort((a, b) => a.followUp.localeCompare(b.followUp))
      .map((l) =>
        item(
          "leads",
          l,
          l.company,
          `${l.followUp} · ${find("employees", l.ownerId)?.fullName || "Unassigned"}`,
          {
            value: l.followUp <= asOf ? "Due" : "Upcoming",
            tone: l.followUp < asOf ? "danger" : "muted",
          },
        ),
      );
  switch (module) {
    case "clients":
      return [
        {
          title: "Client portfolio",
          eyebrow: "RELATIONSHIPS & DELIVERY",
          link: "/clients/projects",
          linkLabel: "View client projects",
          items: r("clients")
            .filter((c) => c.status === "Active")
            .map((c) => {
              const ps = r("projects").filter(
                  (p) => p.clientId === c.id && p.status === "Active",
                ),
                ts = data.tasks.filter((t) =>
                  ps.some((p) => p.id === t.projectId),
                );
              return item(
                "clients",
                c,
                c.company,
                `${ps.length} active projects · ${c.industry || c.contact || "Client account"}`,
                {
                  percent: ts.length
                    ? Math.round(
                        (ts.filter((t) => t.stage === 4).length / ts.length) *
                          100,
                      )
                    : 0,
                  value: `${ts.filter((t) => t.stage === 3).length} in review`,
                },
              );
            }),
          empty: "Add a client and link a project to see delivery health.",
        },
        {
          title: "Delivery watchlist",
          eyebrow: "ACCOUNT MANAGER FOCUS",
          items: workload(),
          empty: "No active projects are linked yet.",
        },
      ];
    case "projects":
      return [
        {
          title: "Delivery health",
          eyebrow: "PROJECT PORTFOLIO",
          items: workload(),
          empty: "Create a project and add its delivery team.",
        },
        {
          title: "Review queue",
          eyebrow: "UNBLOCK THE TEAM",
          link: "/projects",
          linkLabel: "Open boards",
          items: data.tasks
            .filter((t) => t.stage === 3)
            .map((t) => ({
              id: t.id,
              label: `#${t.id} ${t.title}`,
              detail: find("projects", t.projectId)?.name || "No project",
              value: "Review",
              tone: "warning",
              href: `/projects/${t.projectId}/board`,
            })),
          empty: "No tasks are awaiting review.",
        },
      ];
    case "hiring": {
      const stages = [
        "Applied",
        "Screening",
        "Interview",
        "Assessment",
        "Offer",
        "Hired",
      ];
      return [
        {
          title: "Recruitment pipeline",
          eyebrow: "CANDIDATE JOURNEY",
          kind: "funnel",
          items: stages.map((status) => ({
            id: status,
            label: status,
            value: count(r("applications"), [status]),
            percent: r("applications").length
              ? (count(r("applications"), [status]) /
                  r("applications").length) *
                100
              : 0,
            href: `/hiring/applicants?status=${encodeURIComponent(status)}`,
          })),
        },
        {
          title: "Interview schedule",
          eyebrow: "INTERVIEW DESK",
          link: "/hiring/interviews",
          linkLabel: "Manage interviews",
          items: r("interviews")
            .filter((i) => i.status === "Scheduled")
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
            .map((i) =>
              item(
                "interviews",
                i,
                find("applications", i.applicationId)?.name || i.title,
                `${textDate(i.scheduledAt)} · ${find("employees", i.interviewerId)?.fullName || "No interviewer"}`,
                { value: "Scheduled" },
              ),
            ),
          empty: "Schedule interviews from screened candidate profiles.",
        },
      ];
    }
    case "employees":
      return [
        {
          title: "People by department",
          eyebrow: "TEAM STRUCTURE",
          items: r("departments")
            .filter((d) => d.status === "Active")
            .map((d) => {
              const n = r("employees").filter(
                (e) => e.departmentId === d.id && e.status !== "Inactive",
              ).length;
              return item(
                "departments",
                d,
                d.name,
                find("employees", d.managerId)?.fullName ||
                  "Manager not assigned",
                {
                  value: `${n} people`,
                  percent: r("employees").length
                    ? (n / r("employees").length) * 100
                    : 0,
                },
              );
            }),
        },
        {
          title: "People operations",
          eyebrow: "ONBOARDING & EXITS",
          items: r("employees")
            .filter((e) =>
              ["Onboarding", "Offboarding", "On leave"].includes(e.status),
            )
            .map((e) =>
              item(
                "employees",
                e,
                e.fullName,
                `${e.jobTitle} · ${find("departments", e.departmentId)?.name || "No department"}`,
                { value: e.status, tone: "warning" },
              ),
            ),
          empty: "No onboarding or offboarding actions are waiting.",
        },
      ];
    case "attendance":
      return [
        {
          title: "Today’s team availability",
          eyebrow: "ASIA/KARACHI",
          items: r("employees")
            .filter((e) => e.status === "Active")
            .map((e) => {
              const a = r("attendance").find(
                  (a) => a.employeeId === e.id && a.date === asOf,
                ),
                leave = r("leaves").find(
                  (l) =>
                    l.employeeId === e.id &&
                    l.status === "Approved" &&
                    l.startDate <= asOf &&
                    l.endDate >= asOf,
                );
              return item("employees", e, e.fullName, e.jobTitle, {
                value: leave
                  ? "On leave"
                  : a?.checkOut
                    ? "Checked out"
                    : a
                      ? "Checked in"
                      : "Not checked in",
                tone: leave ? "warning" : a ? "good" : "muted",
              });
            }),
        },
        {
          title: "Leave approval desk",
          eyebrow: "COVERAGE & BALANCES",
          link: "/attendance/leaves",
          linkLabel: "Review leave requests",
          items: r("leaves")
            .filter((l) => l.status === "Pending")
            .map((l) =>
              item(
                "leaves",
                l,
                find("employees", l.employeeId)?.fullName || "Employee",
                `${l.startDate} → ${l.endDate} · ${l.type}`,
                { value: `${l.days} working days`, tone: "warning" },
              ),
            ),
          empty: "All leave requests have been reviewed.",
        },
      ];
    case "internships":
      return [
        {
          title: "Program capacity",
          eyebrow: "LEARNING COHORTS",
          items: r("programs")
            .filter((p) => p.status !== "Completed")
            .map((p) => {
              const n = r("enrollments").filter(
                (e) => e.programId === p.id && e.status !== "Withdrawn",
              ).length;
              return item(
                "programs",
                p,
                p.name,
                `${p.startDate} → ${p.endDate}`,
                {
                  value: `${n}/${p.capacity} seats`,
                  percent: (n / Number(p.capacity)) * 100,
                },
              );
            }),
        },
        {
          title: "Mentor review desk",
          eyebrow: "PROGRESS & READINESS",
          link: "/internships/reviews",
          linkLabel: "Open progress reviews",
          items: r("enrollments")
            .filter((e) => !["Completed", "Withdrawn"].includes(e.status))
            .map((e) =>
              item(
                "enrollments",
                e,
                find("employees", e.employeeId)?.fullName || e.name,
                `Mentor: ${find("employees", e.mentorId)?.fullName || "Unassigned"}`,
                { value: `${e.progress}%`, percent: Number(e.progress) },
              ),
            ),
          empty:
            "Enroll an intern and assign a mentor to start tracking progress.",
        },
      ];
    case "finance":
      return [
        {
          title: "Receivables watchlist",
          eyebrow: "COLLECTIONS",
          items: r("invoices")
            .filter((i) => ["Issued", "Partially paid"].includes(i.status))
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .map((i) =>
              item(
                "invoices",
                i,
                i.number,
                `${find("clients", i.clientId)?.company || "Client"} · due ${i.dueDate}`,
                {
                  value: moneyLabel(i.totalCents - i.paidCents, currency),
                  tone: i.dueDate < asOf ? "danger" : "muted",
                },
              ),
            ),
          empty:
            "No unpaid issued invoices. Draft invoices are not counted as receivables.",
        },
        {
          title: "Finance approval desk",
          eyebrow: "BEFORE RECORDING",
          items: [
            ...r("payroll")
              .filter((p) => p.status === "Pending approval")
              .map((p) =>
                item(
                  "payroll",
                  p,
                  find("employees", p.employeeId)?.fullName || "Employee",
                  `Payroll · ${p.month}`,
                  {
                    value: moneyLabel(toCents(p.net), currency),
                    tone: "warning",
                  },
                ),
              ),
            ...r("invoices")
              .filter((i) => i.status === "Draft")
              .map((i) =>
                item(
                  "invoices",
                  i,
                  i.number,
                  "Draft invoice · review line items before issuing",
                  { value: "Draft" },
                ),
              ),
            ...r("expenses")
              .filter((e) => e.status === "Draft")
              .map((e) =>
                item("expenses", e, e.description, "Expense approval", {
                  value: moneyLabel(toCents(e.amount), currency),
                }),
              ),
          ],
          empty: "No finance approvals are waiting.",
        },
      ];
    case "creative":
      return [
        {
          title: "Production workload",
          eyebrow: "DESIGNERS & EDITORS",
          items: r("employees")
            .map((e) => {
              const assigned = r("creativeRequests").filter(
                (c) =>
                  c.assigneeId === e.id && !["Approved"].includes(c.status),
              );
              return { employee: e, assigned };
            })
            .filter((v) => v.assigned.length)
            .map(({ employee: e, assigned }) =>
              item(
                "employees",
                e,
                e.fullName,
                `${assigned.length} active briefs · ${e.jobTitle}`,
                {
                  value: `${assigned.filter((a) => a.status === "Review").length} in review`,
                  percent:
                    (assigned.length /
                      Math.max(
                        1,
                        r("creativeRequests").filter(
                          (c) => c.status !== "Approved",
                        ).length,
                      )) *
                    100,
                },
              ),
            ),
          empty: "Assign a designer or editor to a creative request.",
        },
        {
          title: "Creative review queue",
          eyebrow: "DELIVERY GATES",
          items: r("creativeRequests")
            .filter((c) => ["Review", "Revision requested"].includes(c.status))
            .map((c) =>
              item(
                "creativeRequests",
                c,
                c.title,
                find("projects", c.projectId)?.name || "Project",
                {
                  value: c.status,
                  tone: c.status === "Review" ? "warning" : "danger",
                },
              ),
            ),
          empty: "No deliverables are waiting for feedback.",
        },
      ];
    case "crm":
      return [
        {
          title: "Sales pipeline",
          eyebrow: "LEAD PROGRESSION",
          kind: "funnel",
          items: [
            "New Lead",
            "Contacted",
            "Qualified",
            "Proposal",
            "Negotiation",
            "Won",
          ].map((status) => ({
            id: status,
            label: status,
            value: count(r("leads"), [status]),
            percent: r("leads").length
              ? (count(r("leads"), [status]) / r("leads").length) * 100
              : 0,
            href: `/crm/leads?status=${encodeURIComponent(status)}`,
          })),
        },
        {
          title: "Follow-up agenda",
          eyebrow: "NEXT CONVERSATIONS",
          link: "/crm/activities",
          linkLabel: "Manage sales activities",
          items: followups(),
          empty: "No follow-ups are scheduled.",
        },
      ];
    case "support":
      return [
        {
          title: "Priority response queue",
          eyebrow: "SLA WATCH",
          items: r("tickets")
            .filter((t) => !["Resolved", "Closed"].includes(t.status))
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .map((t) =>
              item(
                "tickets",
                t,
                t.subject,
                `${t.number} · ${find("clients", t.clientId)?.company || "Client"}`,
                {
                  value: dueLabel(t.dueDate, t.status, asOf).text,
                  tone: dueLabel(t.dueDate, t.status, asOf).tone,
                },
              ),
            ),
          empty: "No unresolved support tickets.",
        },
        {
          title: "Agent workload",
          eyebrow: "OWNERSHIP",
          items: r("employees")
            .map((e) => ({
              e,
              tickets: r("tickets").filter(
                (t) =>
                  t.assigneeId === e.id &&
                  !["Resolved", "Closed"].includes(t.status),
              ),
            }))
            .filter((v) => v.tickets.length)
            .map(({ e, tickets }) =>
              item("employees", e, e.fullName, e.jobTitle, {
                value: `${tickets.length} open`,
                percent:
                  (tickets.length /
                    Math.max(
                      1,
                      r("tickets").filter(
                        (t) => !["Resolved", "Closed"].includes(t.status),
                      ).length,
                    )) *
                  100,
              }),
            ),
          empty: "Assign an agent to an open ticket.",
        },
      ];
    case "departments":
      return [
        {
          title: "Department workload",
          eyebrow: "PEOPLE & DELIVERY",
          items: r("departments")
            .filter((d) => d.status === "Active")
            .map((d) => {
              const projects = r("projects").filter(
                (p) => p.departmentId === d.id && p.status === "Active",
              );
              return item(
                "departments",
                d,
                d.name,
                `${d.members || 0} people · ${projects.length} active projects`,
                {
                  value:
                    find("employees", d.managerId)?.fullName || "No manager",
                },
              );
            }),
        },
        {
          title: "Management coverage",
          eyebrow: "ACCOUNTABILITY",
          items: r("departments").map((d) =>
            item(
              "departments",
              d,
              d.name,
              d.parentId
                ? `Reports to ${find("departments", d.parentId)?.name || "parent department"}`
                : "Top-level department",
              {
                value: d.managerId ? "Manager assigned" : "Needs manager",
                tone: d.managerId ? "good" : "warning",
              },
            ),
          ),
        },
      ];
    case "admin":
      return [
        {
          title: "Role coverage",
          eyebrow: "PREVIEW CONFIGURATION",
          items: r("roles").map((role) =>
            item(
              "roles",
              role,
              role.name,
              `${role.permissions?.length || 0} selected permissions`,
              {
                value: `${r("users").filter((u) => u.roleId === role.id).length} accounts`,
              },
            ),
          ),
        },
        {
          title: "Latest administration activity",
          eyebrow: "CHANGE HISTORY",
          link: "/admin/audit-logs",
          linkLabel: "Open audit log",
          items: r("auditLogs")
            .filter((a) =>
              ["users", "roles", "settings", "departments"].includes(a.entity),
            )
            .slice(0, 5)
            .map((a) => ({
              id: a.id,
              label: a.detail,
              detail: a.actor,
              href: recordLink("auditLogs", a.id),
              value: textDate(a.createdAt),
            })),
          empty: "Account and settings changes will appear here.",
        },
      ];
    default:
      return [];
  }
}
