import { updateRevisionRound } from "./taskRevisions.js";
import { entities, permissionNames } from "./catalog.js";
export function invalid(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function toCents(value) {
  const s = String(value ?? "0").trim();
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(s))
    invalid("Enter a positive amount with up to two decimal places.");
  const [whole, fraction = ""] = s.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export const fromCents = (n) =>
  `${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`;
export const rows = (data, key) =>
  key === "projects" ? data.projects : data.records[key];
const id = (key) => `${key}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
const sampleFile = {
  name: "sample-brief.txt",
  size: 46,
  type: "text/plain",
  data: "data:text/plain;base64,TVQgTmV4dXMgR2xvYmFsIOKAlCBVSSBwcmV2aWV3IHNhbXBsZSBkb2N1bWVudC4=",
};
export function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k).value)
    .join("-");
}
export function defaults() {
  return {
    departments: [
      {
        id: "dept-dev",
        name: "Development",
        code: "DEV",
        managerId: "preview-hamza",
        description: "Web and application delivery",
        status: "Active",
      },
      {
        id: "dept-creative",
        name: "Creative Studio",
        code: "CRT",
        managerId: "preview-kiran",
        description: "Design and content production",
        status: "Active",
      },
      {
        id: "dept-operations",
        name: "Operations",
        code: "OPS",
        managerId: "preview-sara",
        description: "Client delivery and operations",
        status: "Active",
      },
    ],
    employees: [
      {
        id: "preview-hamza",
        employeeCode: "EMP-101",
        fullName: "Hamza Tariq",
        email: "hamza@example.test",
        departmentId: "dept-dev",
        jobTitle: "Project Manager",
        workMode: "Hybrid",
        salary: "180000.00",
        joiningDate: "2026-01-01",
        annualLeave: 14,
        status: "Active",
      },
      {
        id: "preview-ali",
        employeeCode: "EMP-102",
        fullName: "Ali Raza",
        email: "ali@example.test",
        departmentId: "dept-dev",
        jobTitle: "Software Engineer",
        managerId: "preview-hamza",
        workMode: "Remote",
        salary: "120000.00",
        joiningDate: "2026-03-01",
        annualLeave: 14,
        status: "Active",
      },
      {
        id: "preview-sara",
        employeeCode: "EMP-103",
        fullName: "Sara Khan",
        email: "sara@example.test",
        departmentId: "dept-operations",
        jobTitle: "Operations Manager",
        workMode: "On-site",
        salary: "150000.00",
        joiningDate: "2026-02-01",
        annualLeave: 14,
        status: "Active",
      },
      {
        id: "preview-kiran",
        employeeCode: "EMP-104",
        fullName: "Kiran Ahmed",
        email: "kiran@example.test",
        departmentId: "dept-creative",
        jobTitle: "Creative Lead",
        workMode: "Hybrid",
        salary: "130000.00",
        joiningDate: "2026-04-01",
        annualLeave: 14,
        status: "Active",
      },
    ],
    clients: [
      {
        id: "client-a",
        company: "Client A",
        contact: "Ayesha Malik",
        email: "ayesha@example.test",
        industry: "Technology",
        managerId: "preview-sara",
        status: "Active",
      },
      {
        id: "client-b",
        company: "Client B",
        contact: "Omar Ahmed",
        email: "omar@example.test",
        industry: "E-commerce",
        managerId: "preview-hamza",
        status: "Active",
      },
    ],
    contacts: [
      {
        id: "contact-a",
        clientId: "client-a",
        name: "Ayesha Malik",
        email: "ayesha@example.test",
        designation: "Product Owner",
      },
    ],
    jobs: [
      {
        id: "job-dev",
        title: "Frontend Developer",
        departmentId: "dept-dev",
        workMode: "Remote",
        openings: 2,
        closingDate: "2026-12-01",
        description: "Build accessible, responsive React applications.",
        status: "Open",
      },
    ],
    applications: [
      {
        id: "app-zara",
        name: "Zara Ali",
        email: "zara@example.test",
        jobId: "job-dev",
        reviewerId: "preview-hamza",
        notes: "Strong React portfolio",
        status: "Applied",
        resume: sampleFile,
      },
    ],
    interviews: [],
    offers: [],
    documents: [
      {
        id: "doc-contract",
        title: "Sample employment agreement",
        employeeId: "preview-ali",
        type: "Contract",
        file: sampleFile,
      },
    ],
    attendance: [],
    leaves: [],
    programs: [
      {
        id: "program-web",
        name: "Web Engineering Internship",
        departmentId: "dept-dev",
        startDate: "2026-11-01",
        endDate: "2027-01-31",
        capacity: 6,
        goals: "React fundamentals, testing and team delivery.",
        status: "Active",
      },
    ],
    enrollments: [],
    evaluations: [],
    invoices: [
      {
        id: "invoice-a",
        number: "INV-2026-001",
        clientId: "client-a",
        projectId: "preview-web",
        issueDate: "2026-11-01",
        dueDate: "2026-11-15",
        notes: "Website delivery milestone",
        status: "Draft",
      },
    ],
    invoiceItems: [
      {
        id: "item-a",
        invoiceId: "invoice-a",
        description: "Website design and development",
        quantity: 1,
        unitPrice: "150000.00",
      },
    ],
    payments: [],
    expenses: [],
    payroll: [],
    creativeRequests: [
      {
        id: "creative-brand",
        title: "Brand identity launch kit",
        type: "Graphic Design",
        clientId: "client-b",
        projectId: "preview-brand",
        assigneeId: "preview-kiran",
        dueDate: "2026-11-12",
        brief: "Create logo lockups, social banners and brand guidelines.",
        status: "Brief",
      },
    ],
    creativeAssets: [],
    creativeRevisions: [],
    leads: [
      {
        id: "lead-nova",
        company: "Nova Labs",
        contact: "Bilal Khan",
        email: "bilal@example.test",
        ownerId: "preview-sara",
        value: "250000.00",
        followUp: "2026-11-04",
        notes: "Needs a customer portal",
        status: "New Lead",
      },
    ],
    opportunities: [],
    salesActivities: [],
    tickets: [
      {
        id: "ticket-a",
        number: "TKT-1001",
        subject: "Contact form email not arriving",
        clientId: "client-a",
        assigneeId: "preview-ali",
        priority: "High",
        dueDate: "2026-11-03",
        description: "Investigate form submission and delivery settings.",
        status: "Open",
      },
    ],
    ticketComments: [],
    roles: [
      {
        id: "role-super",
        name: "SUPER_ADMIN",
        description: "Workspace design administrator",
        permissions: [...permissionNames],
      },
      {
        id: "role-employee",
        name: "EMPLOYEE",
        description: "Assigned work and own activity",
        permissions: ["tasks.update", "tasks.submit_review"],
      },
    ],
    users: [
      {
        id: "ui-preview-user",
        name: "Preview Admin",
        email: "admin@mtnexus.test",
        employeeId: "preview-hamza",
        roleId: "role-super",
        status: "Active",
      },
    ],
    auditLogs: [],
    settings: [
      {
        id: "setting-company",
        name: "Company name",
        value: "MT Nexus Global",
        description: "Workspace company name",
      },
      {
        id: "setting-currency",
        name: "Currency",
        value: "PKR",
        description: "Currency used for finance records",
      },
      {
        id: "setting-annual",
        name: "Annual leave allowance",
        value: "14",
        description: "Default working days per employee each calendar year",
      },
      {
        id: "setting-sick",
        name: "Sick leave allowance",
        value: "10",
        description: "Default working days per employee each calendar year",
      },
    ],
    notifications: [
      {
        id: "notification-welcome",
        title: "Your workspace is ready",
        message:
          "Explore linked clients, projects, people and approval workflows. Data stays in this browser.",
        status: "Unread",
        createdAt: now(),
      },
    ],
  };
}
export function hydrateWorkspace(data) {
  const seed = defaults();
  data.records ??= {};
  for (const key of Object.keys(entities))
    if (key !== "projects" && !Array.isArray(data.records[key]))
      data.records[key] = seed[key] || [];
  for (const project of data.projects) {
    project.clientId ??= project.id === "preview-web" ? "client-a" : "client-b";
    project.departmentId ??=
      project.category === "Graphic Design" ? "dept-creative" : "dept-dev";
    project.managerId ??= "preview-hamza";
    project.memberIds ??= ["preview-hamza", "preview-ali", "preview-kiran"];
    project.status ??= "Active";
  }
  derive(data);
  return data;
}
export function derive(data) {
  for (const item of rows(data, "invoiceItems")) {
    item.lineTotalCents = toCents(item.unitPrice) * Number(item.quantity);
    if (!Number.isSafeInteger(item.lineTotalCents))
      invalid("Invoice line exceeds the supported amount.");
    item.lineTotal = fromCents(item.lineTotalCents);
  }
  for (const invoice of rows(data, "invoices")) {
    invoice.totalCents = rows(data, "invoiceItems")
      .filter((i) => i.invoiceId === invoice.id)
      .reduce((s, i) => s + i.lineTotalCents, 0);
    invoice.paidCents = rows(data, "payments")
      .filter((p) => p.invoiceId === invoice.id)
      .reduce((s, p) => s + toCents(p.amount), 0);
    invoice.total = fromCents(invoice.totalCents);
    invoice.paid = fromCents(invoice.paidCents);
    invoice.balance = fromCents(invoice.totalCents - invoice.paidCents);
    if (!["Draft", "Cancelled"].includes(invoice.status))
      invoice.status =
        invoice.paidCents === invoice.totalCents
          ? "Paid"
          : invoice.paidCents
            ? "Partially paid"
            : "Issued";
  }
  for (const payroll of rows(data, "payroll"))
    payroll.net = fromCents(
      toCents(payroll.gross) - toCents(payroll.deductions),
    );
  for (const department of rows(data, "departments"))
    department.members = rows(data, "employees").filter(
      (e) => e.departmentId === department.id && e.status !== "Inactive",
    ).length;
  for (const role of rows(data, "roles"))
    role.permissionCount = role.permissions?.length || 0;
}
function validateFields(data, definition, input, current = {}) {
  const output = {};
  for (const field of definition.fields) {
    if (!(field.key in input)) continue;
    let value = input[field.key];
    if (typeof value === "string") value = value.trim();
    if (field.required && (value === "" || value == null))
      invalid(`${field.label} is required.`);
    if (value === "" || value == null) {
      output[field.key] = "";
      continue;
    }
    if (typeof value === "string" && value.length > 5000)
      invalid(`${field.label} must be under 5,000 characters.`);
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      invalid("Enter a valid email address.");
    if (field.type === "money") {
      toCents(value);
      value = fromCents(toCents(value));
    }
    if (field.type === "number") {
      value = Number(value);
      if (
        !Number.isFinite(value) ||
        value < (field.min ?? 0) ||
        value > (field.max ?? 10000000)
      )
        invalid(`${field.label} is outside its allowed range.`);
      if (!Number.isInteger(value))
        invalid(`${field.label} must be a whole number.`);
    }
    if (
      field.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
        new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)
    )
      invalid(`${field.label} must be a valid date.`);
    if (field.type === "datetime-local" && !Number.isFinite(Date.parse(value)))
      invalid(`${field.label} must be a valid date and time.`);
    if (field.type === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
      invalid("Enter a valid payroll month.");
    if (field.type === "select" && !field.options.includes(value))
      invalid(`Choose a valid ${field.label.toLowerCase()}.`);
    if (
      field.type === "reference" &&
      !rows(data, field.ref).some((r) => r.id === value)
    )
      invalid(`${field.label} does not exist.`);
    if (["multi-reference", "permissions"].includes(field.type)) {
      if (!Array.isArray(value)) invalid(`${field.label} must be a list.`);
      const choices = field.ref
        ? rows(data, field.ref).map((r) => r.id)
        : permissionNames;
      if (value.some((v) => !choices.includes(v)))
        invalid(`Invalid ${field.label.toLowerCase()}.`);
      value = [...new Set(value)];
    }
    if (field.type === "file") {
      if (
        !value?.name ||
        !value.data?.startsWith("data:") ||
        value.size > 1048576 ||
        !/^data:(?:application\/(?:pdf|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|image\/(?:png|jpeg)|text\/plain);base64,/.test(
          value.data,
        )
      )
        invalid("Use a PDF, PNG, JPG, TXT or DOCX file up to 1 MB.");
    }
    output[field.key] = value;
  }
  const merged = { ...current, ...output };
  for (const field of definition.fields)
    if (
      field.required &&
      (merged[field.key] == null || merged[field.key] === "")
    )
      invalid(`${field.label} is required.`);
  return output;
}
export function leaveDays(start, end) {
  if (!start || !end || end < start)
    invalid("Leave end date must be on or after its start date.");
  let count = 0,
    total = 0;
  for (
    let t = Date.parse(`${start}T00:00:00Z`);
    t <= Date.parse(`${end}T00:00:00Z`);
    t += 86400000
  ) {
    if (++total > 366) invalid("Leave requests cannot exceed one year.");
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  if (!count) invalid("Select at least one working day (Monday–Friday).");
  return count;
}
export function balance(
  data,
  employeeId,
  type = "Annual",
  year = String(new Date().getUTCFullYear()),
) {
  const employee = rows(data, "employees").find((e) => e.id === employeeId);
  const name =
    type === "Sick" ? "Sick leave allowance" : "Annual leave allowance";
  const allowance =
    type === "Annual" && employee?.annualLeave != null
      ? Number(employee.annualLeave)
      : Number(rows(data, "settings").find((s) => s.name === name)?.value || 0);
  return (
    allowance -
    rows(data, "leaves")
      .filter(
        (l) =>
          l.employeeId === employeeId &&
          l.type === type &&
          l.status === "Approved" &&
          l.startDate?.startsWith(year),
      )
      .reduce((s, l) => s + l.days, 0)
  );
}
function validateRecord(data, key, record, current) {
  const others = rows(data, key).filter((r) => r.id !== record.id);
  const unique = {
    employees: "email",
    clients: "company",
    departments: "code",
    users: "email",
    roles: "name",
    invoices: "number",
    payments: "reference",
  }[key];
  if (
    unique &&
    others.some(
      (r) =>
        String(r[unique]).toLowerCase() ===
        String(record[unique]).toLowerCase(),
    )
  )
    invalid(
      `A ${entities[key].singular.toLowerCase()} with this ${unique} already exists.`,
      409,
    );
  if (
    key === "applications" &&
    others.some(
      (a) =>
        a.email.toLowerCase() === record.email.toLowerCase() &&
        a.jobId === record.jobId,
    )
  )
    invalid("This candidate has already applied to this job.", 409);
  if (
    key === "offers" &&
    others.some(
      (o) =>
        o.applicationId === record.applicationId && o.status !== "Declined",
    )
  )
    invalid("An active offer already exists for this candidate.", 409);
  if (key === "employees" && record.managerId === record.id)
    invalid("An employee cannot be their own manager.");
  if (key === "departments" && record.parentId) {
    let parent = record.parentId;
    const visited = new Set([record.id]);
    while (parent) {
      if (visited.has(parent))
        invalid("Department hierarchy cannot contain a cycle.");
      visited.add(parent);
      parent = rows(data, "departments").find((d) => d.id === parent)?.parentId;
    }
  }
  if (["programs"].includes(key) && record.endDate < record.startDate)
    invalid("End date must be on or after start date.");
  if (key === "leaves") {
    record.days = leaveDays(record.startDate, record.endDate);
    if (record.startDate.slice(0, 4) !== record.endDate.slice(0, 4))
      invalid("Submit separate leave requests for each calendar year.");
    if (
      others.some(
        (l) =>
          l.employeeId === record.employeeId &&
          !["Rejected", "Cancelled"].includes(l.status) &&
          l.startDate <= record.endDate &&
          l.endDate >= record.startDate,
      )
    )
      invalid("This employee already has an overlapping leave request.");
  }
  if (key === "enrollments") {
    const program = rows(data, "programs").find(
      (p) => p.id === record.programId,
    );
    if (program.status === "Completed")
      invalid("This program has already completed.");
    if (
      others.some(
        (e) =>
          e.programId === record.programId &&
          e.employeeId === record.employeeId &&
          e.status !== "Withdrawn",
      )
    )
      invalid("This intern is already enrolled.");
    if (
      others.filter(
        (e) => e.programId === record.programId && e.status !== "Withdrawn",
      ).length >= Number(program.capacity)
    )
      invalid("This internship program is full.");
    if (record.employeeId === record.mentorId)
      invalid("An intern cannot be their own mentor.");
  }
  if (
    key === "interviews" &&
    record.status === "Scheduled" &&
    others.some(
      (i) =>
        i.status === "Scheduled" &&
        i.interviewerId === record.interviewerId &&
        i.scheduledAt === record.scheduledAt,
    )
  )
    invalid("This interviewer already has a meeting at that time.");
  if (key === "invoiceItems") {
    for (const invoiceId of new Set(
      [record.invoiceId, current?.invoiceId].filter(Boolean),
    )) {
      const invoice = rows(data, "invoices").find((i) => i.id === invoiceId);
      if (invoice.status !== "Draft")
        invalid("Only draft invoices can have their items changed.");
    }
    const nextTotal =
      others
        .filter((i) => i.invoiceId === record.invoiceId)
        .reduce(
          (sum, i) => sum + toCents(i.unitPrice) * Number(i.quantity),
          0,
        ) +
      toCents(record.unitPrice) * record.quantity;
    if (!Number.isSafeInteger(nextTotal))
      invalid("Invoice amount is too large.");
  }
  if (key === "payments") {
    const invoice = rows(data, "invoices").find(
      (i) => i.id === record.invoiceId,
    );
    if (!["Issued", "Partially paid"].includes(invoice.status))
      invalid(
        "Record payments only against an issued invoice with an outstanding balance.",
      );
    if (
      toCents(record.amount) <= 0 ||
      toCents(record.amount) > invoice.totalCents - invoice.paidCents
    )
      invalid(
        "Payment must be positive and cannot exceed the outstanding balance.",
      );
  }
  if (key === "payroll") {
    if (toCents(record.deductions) > toCents(record.gross))
      invalid("Deductions cannot exceed gross salary.");
    if (
      others.some(
        (p) =>
          p.employeeId === record.employeeId &&
          p.month === record.month &&
          p.status !== "Rejected",
      )
    )
      invalid("Payroll already exists for this employee and month.");
  }
  if (key === "invoices" && record.dueDate < record.issueDate)
    invalid("Invoice due date cannot precede issue date.");
  if (key === "settings") {
    if (current && record.name !== current.name)
      invalid("Setting names cannot be changed.");
    if (
      record.name.includes("leave allowance") &&
      (!/^\d+$/.test(record.value) || Number(record.value) > 366)
    )
      invalid("Leave allowance must be a whole number from 0 to 366.");
    if (record.name === "Currency" && !/^[A-Z]{3}$/.test(record.value))
      invalid("Currency must be a three-letter uppercase code.");
  }
}
function event(data, key, record, action, detail) {
  const time = now();
  rows(data, "auditLogs").unshift({
    id: id("audit"),
    entity: key,
    recordId: record.id,
    action,
    detail,
    actor: "Preview Admin",
    createdAt: time,
  });
  if (key !== "notifications")
    rows(data, "notifications").unshift({
      id: id("notification"),
      title: `${entities[key].singular} ${action.toLowerCase()}`,
      message: detail,
      entity: key,
      recordId: record.id,
      status: "Unread",
      createdAt: time,
    });
}
function hire(data, application) {
  if (application.employeeId) return;
  const job = rows(data, "jobs").find((j) => j.id === application.jobId);
  if (!job) invalid("Job opening is missing.");
  if (
    rows(data, "employees").some(
      (e) => e.email.toLowerCase() === application.email.toLowerCase(),
    )
  )
    invalid("An employee with this email already exists.");
  const employee = {
    id: id("employees"),
    employeeCode: `EMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    fullName: application.name,
    email: application.email,
    phone: application.phone || "",
    departmentId: job.departmentId,
    jobTitle: job.title,
    joiningDate: today(),
    workMode: job.workMode || "Remote",
    salary: "0.00",
    annualLeave: 14,
    status: "Onboarding",
    createdAt: now(),
  };
  rows(data, "employees").push(employee);
  application.employeeId = employee.id;
  application.status = "Hired";
  event(
    data,
    "employees",
    employee,
    "CREATED",
    `Hired ${employee.fullName} from the recruitment pipeline.`,
  );
}
function linkedTask(data, record, targetStage, reason) {
  let task = data.tasks.find((t) => t.id === record.taskId);
  if (!task) {
    const employee = rows(data, "employees").find(
      (e) => e.id === record.assigneeId,
    );
    task = {
      id: Math.max(100, ...data.tasks.map((t) => t.id)) + 1,
      title: record.title,
      description: record.brief,
      category: record.type,
      projectId: record.projectId,
      priority: "Medium",
      stage: 0,
      progress: 0,
      dueDate: `${record.dueDate}T18:00:00Z`,
      createdAt: now(),
      assignees: [{ id: id("assignment"), employee }],
      activities: [],
      updates: [],
      checklists: [],
      attachments: [],
    };
    data.tasks.push(task);
    record.taskId = task.id;
  }
  updateRevisionRound(task, targetStage, reason);
  task.activities.unshift({
    id: id("activity"),
    fromStage: task.stage,
    toStage: targetStage,
    reason: reason || "Creative Studio workflow",
    createdAt: now(),
  });
  task.stage = targetStage;
  if (targetStage === 4) task.progress = 100;
}
export function mutateRecord(data, key, method, recordId, input = {}) {
  const definition = entities[key];
  if (!definition) invalid("Unknown module.", 404);
  const collection = rows(data, key),
    current = recordId ? collection.find((r) => r.id === recordId) : null;
  if (recordId && !current) invalid("Record not found.", 404);
  if (definition.readOnly || (definition.immutable && method !== "POST"))
    invalid("This record is read-only.");
  if (method === "DELETE") {
    if (definition.noCreate || definition.lockAfter?.includes(current.status))
      invalid("This record cannot be removed in its current state.");
    for (const [related, config] of Object.entries(entities))
      for (const field of config.fields)
        if (
          field.ref === key &&
          rows(data, related).some(
            (r) =>
              r.id !== current.id &&
              (r[field.key] === current.id ||
                (Array.isArray(r[field.key]) &&
                  r[field.key].includes(current.id))),
          )
        )
          invalid(
            `Remove or reassign related ${config.label.toLowerCase()} before deleting this record.`,
          );
    if (key === "projects" && data.tasks.some((t) => t.projectId === recordId))
      invalid("Archive a project with existing tasks instead of deleting it.");
    if (
      key === "employees" &&
      data.tasks.some((t) =>
        t.assignees?.some((a) => a.employee?.id === recordId),
      )
    )
      invalid("Reassign this employee’s project tasks first.");
    if (key === "invoiceItems") {
      const invoice = rows(data, "invoices").find(
        (i) => i.id === current.invoiceId,
      );
      if (invoice.status !== "Draft")
        invalid("Issued invoice items cannot be deleted.");
    }
    collection.splice(collection.indexOf(current), 1);
    event(data, key, current, "DELETED", String(current[definition.title]));
    derive(data);
    return current;
  }
  if (method === "POST" && definition.noCreate)
    invalid("New workspace settings are not supported.");
  if (current && definition.lockAfter?.includes(current.status))
    invalid("This record is locked after submission or approval.");
  const fields = validateFields(data, definition, input, current || {});
  const record = {
    ...current,
    ...fields,
    id: current?.id || id(key),
    status: current?.status || definition.states?.[0],
    createdAt: current?.createdAt || now(),
    updatedAt: now(),
  };
  if (key === "employees" && !current)
    record.employeeCode = `EMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  if (key === "tickets" && !current)
    record.number = `TKT-${String(collection.length + 1001)}`;
  if (key === "roles") record.permissions ??= [];
  validateRecord(data, key, record, current);
  if (current) Object.assign(current, record);
  else collection.unshift(record);
  derive(data);
  event(
    data,
    key,
    record,
    current ? "UPDATED" : "CREATED",
    `${current ? "Updated" : "Created"} ${String(record[definition.title])}.`,
  );
  return record;
}
export function performAction(data, key, recordId, actionKey, input = {}) {
  const definition = entities[key],
    record = rows(data, key)?.find((r) => r.id === recordId);
  if (!record) invalid("Record not found.", 404);
  const action = definition.actions?.find(
    (a) => a.key === actionKey && a.from.includes(record.status),
  );
  if (!action) invalid("This action is not allowed in the current stage.", 409);
  const fields = validateFields(data, { fields: action.fields || [] }, input);
  const previous = record.status;
  if (
    key === "projects" &&
    actionKey === "complete" &&
    data.tasks.some((t) => t.projectId === recordId && t.stage !== 4)
  )
    invalid("Approve all project tasks before completing this project.");
  if (key === "applications" && actionKey === "hire") hire(data, record);
  if (key === "offers" && actionKey === "accept") {
    const application = rows(data, "applications").find(
      (a) => a.id === record.applicationId,
    );
    if (application.status === "Rejected")
      invalid("Cannot hire a rejected candidate.");
    hire(data, application);
    const employee = rows(data, "employees").find(
      (e) => e.id === application.employeeId,
    );
    employee.salary = record.salary;
    employee.joiningDate = record.startDate;
  }
  if (key === "tickets" && actionKey === "assign" && !record.assigneeId)
    invalid("Select an assigned agent before confirming assignment.");
  if (
    key === "leaves" &&
    actionKey === "approve" &&
    record.type !== "Unpaid" &&
    record.days >
      balance(
        data,
        record.employeeId,
        record.type,
        record.startDate.slice(0, 4),
      )
  )
    invalid("The employee does not have enough leave balance.");
  if (
    key === "programs" &&
    actionKey === "complete" &&
    rows(data, "enrollments").some(
      (e) =>
        e.programId === recordId &&
        !["Completed", "Withdrawn"].includes(e.status),
    )
  )
    invalid("Complete or withdraw active enrollments first.");
  if (
    key === "enrollments" &&
    actionKey === "complete" &&
    (Number(record.progress) !== 100 ||
      !rows(data, "evaluations").some((e) => e.enrollmentId === recordId))
  )
    invalid(
      "Record a progress review and set progress to 100 before completion.",
    );
  if (key === "invoices" && actionKey === "issue" && record.totalCents <= 0)
    invalid("Add at least one positive invoice item before issuing.");
  if (key === "invoices" && actionKey === "cancel" && record.paidCents > 0)
    invalid("An invoice with recorded payments cannot be cancelled.");
  if (
    key === "departments" &&
    actionKey === "deactivate" &&
    rows(data, "employees").some(
      (e) => e.departmentId === recordId && e.status !== "Inactive",
    )
  )
    invalid("Reassign or offboard active department members first.");
  if (key === "creativeRequests") {
    if (
      actionKey === "submit" &&
      !rows(data, "creativeAssets").some((a) => a.requestId === recordId)
    )
      invalid("Upload a deliverable before submitting for review.");
    if (actionKey === "revise")
      rows(data, "creativeRevisions").unshift({
        id: id("revision"),
        requestId: recordId,
        reason: fields.reason,
        createdAt: now(),
      });
    linkedTask(
      data,
      record,
      { start: 2, submit: 3, approve: 4, revise: 6 }[actionKey],
      fields.reason,
    );
  }
  if (key === "leads" && actionKey === "convert") {
    if (record.clientId) invalid("This lead has already been converted.");
    const client = {
      id: id("clients"),
      company: record.company,
      contact: record.contact,
      email: record.email,
      phone: record.phone || "",
      managerId: record.ownerId,
      notes: record.notes || "",
      status: "Active",
      createdAt: now(),
    };
    if (
      rows(data, "clients").some(
        (c) => c.company.toLowerCase() === client.company.toLowerCase(),
      )
    )
      invalid("A client with this company name already exists.");
    rows(data, "clients").push(client);
    record.clientId = client.id;
    for (const opportunity of rows(data, "opportunities").filter(
      (o) => o.leadId === recordId,
    ))
      opportunity.status = "Won";
    event(
      data,
      "clients",
      client,
      "CREATED",
      `Converted won lead ${record.company} to client.`,
    );
  }
  Object.assign(record, fields, { status: action.to, updatedAt: now() });
  event(
    data,
    key,
    record,
    "TRANSITION",
    `${String(record[definition.title])}: ${previous} → ${action.to}${fields.reason ? ` · ${fields.reason}` : ""}`,
  );
  derive(data);
  return record;
}
export function checkAttendance(data, employeeId, operation) {
  const employee = rows(data, "employees").find((e) => e.id === employeeId);
  if (!employee || employee.status !== "Active")
    invalid("Choose an active employee.");
  const day = today(),
    collection = rows(data, "attendance");
  let record = collection.find(
    (a) => a.employeeId === employeeId && a.date === day,
  );
  if (operation === "check-in") {
    if (record)
      invalid("Attendance has already been recorded for this employee today.");
    record = {
      id: id("attendance"),
      employeeId,
      date: day,
      checkIn: now(),
      checkOut: "",
      minutes: 0,
      status: "Checked in",
    };
    collection.unshift(record);
  } else {
    if (!record || record.checkOut)
      invalid("No active check-in to close for this employee today.");
    record.checkOut = now();
    record.minutes = Math.max(
      0,
      Math.floor(
        (Date.parse(record.checkOut) - Date.parse(record.checkIn)) / 60000,
      ),
    );
    record.status = "Checked out";
  }
  event(
    data,
    "attendance",
    record,
    operation.toUpperCase(),
    `${employee.fullName} ${operation} on ${day}.`,
  );
  return record;
}
export function workspaceRequest(
  data,
  path,
  { method = "GET", body = {} } = {},
) {
  if (path === "/workspace/data" && method === "GET") {
    derive(data);
    return { data };
  }
  const attendance = path.match(
    /^\/workspace\/attendance\/(check-in|check-out)$/,
  );
  if (attendance && method === "POST")
    return { data: checkAttendance(data, body.employeeId, attendance[1]) };
  const match = path.match(
    /^\/workspace\/([A-Za-z]+)(?:\/([^/]+))?(?:\/actions\/([a-z]+))?$/,
  );
  if (!match || !entities[match[1]]) invalid("Unknown module endpoint.", 404);
  const [, key, recordId, actionKey] = match;
  if (method === "GET")
    return {
      data: recordId
        ? rows(data, key).find((r) => r.id === recordId)
        : rows(data, key),
    };
  if (actionKey && method === "POST")
    return { data: performAction(data, key, recordId, actionKey, body) };
  if (!["POST", "PATCH", "DELETE"].includes(method))
    invalid("Unsupported operation.");
  return { data: mutateRecord(data, key, method, recordId, body) };
}
