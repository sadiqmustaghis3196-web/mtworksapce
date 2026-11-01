import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Users,
  FolderKanban,
  FileText,
  Ticket,
  ArrowUpRight,
  Send,
  Download,
} from "lucide-react";
import { entities } from "../../modules/catalog";
import {
  records,
  recordLink,
  projectHealth,
  moneyLabel,
  dueLabel,
} from "../../modules/insights";
import { api } from "../../services/api";
const initials = (value) =>
  String(value || "NX")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
function Stats({ items }) {
  return (
    <div className="record-key-stats">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
export default function RecordOverview({ entity, record, data, onChanged }) {
  const r = (key) => records(data, key),
    find = (key, id) => r(key).find((v) => v.id === id),
    currency = r("settings").find((s) => s.name === "Currency")?.value || "PKR",
    money = (value) => moneyLabel(value, currency),
    title = record[entities[entity].title];
  const [reply, setReply] = useState(""),
    [replyError, setReplyError] = useState(""),
    [sending, setSending] = useState(false);
  const Icon =
    {
      clients: Building2,
      employees: Users,
      projects: FolderKanban,
      invoices: FileText,
      tickets: Ticket,
    }[entity] || FolderKanban;
  const subtitle =
    entity === "clients"
      ? `${record.industry || "Client account"} · ${record.contact || "Contact not assigned"}`
      : entity === "employees"
        ? `${record.jobTitle} · ${find("departments", record.departmentId)?.name || "No department"}`
        : entity === "projects"
          ? `${record.category} · ${find("clients", record.clientId)?.company || "Internal project"}`
          : entity === "applications"
            ? `${find("jobs", record.jobId)?.title || "Candidate profile"} · ${record.email}`
            : entity === "leads"
              ? `${record.contact} · ${record.email}`
              : entity === "tickets"
                ? `${record.number} · ${find("clients", record.clientId)?.company || "Client ticket"}`
                : entity === "creativeRequests"
                  ? `${record.type} · ${find("projects", record.projectId)?.name || "Project"}`
                  : entity === "payroll"
                    ? `${find("employees", record.employeeId)?.fullName || "Employee"} · ${record.month}`
                    : entities[entity].singular;
  const workflow = entities[entity].states?.filter(
      (s) =>
        ![
          "Rejected",
          "Lost",
          "Declined",
          "Cancelled",
          "Withdrawn",
          "Archived",
        ].includes(s),
    ),
    step = workflow?.indexOf(record.status) ?? -1;
  async function sendReply(e) {
    e.preventDefault();
    setReplyError("");
    setSending(true);
    try {
      await api("/workspace/ticketComments", {
        method: "POST",
        body: { ticketId: record.id, content: reply },
      });
      setReply("");
      await onChanged();
    } catch (e) {
      setReplyError(e.message);
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="record-overview">
      <div className="record-profile">
        <div className={`record-profile-avatar avatar-${entity}`}>
          {["employees", "clients", "applications", "leads"].includes(
            entity,
          ) ? (
            initials(title)
          ) : (
            <Icon size={25} />
          )}
        </div>
        <div>
          <p className="eyebrow">{entities[entity].singular.toUpperCase()}</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {["projects", "tickets", "creativeRequests"].includes(entity) && (
          <span
            className={`due-indicator tone-${dueLabel(record.deadline || record.dueDate, record.status).tone}`}
          >
            {dueLabel(record.deadline || record.dueDate, record.status).text}
          </span>
        )}
      </div>
      {workflow?.length >= 3 && workflow.length <= 8 && (
        <div className="record-stage-track" aria-label="Workflow stages">
          {workflow.map((state, index) => (
            <div
              key={state}
              className={
                state === record.status
                  ? "current"
                  : step > index
                    ? "passed"
                    : ""
              }
            >
              <i>{step > index ? "✓" : index + 1}</i>
              <span>{state}</span>
            </div>
          ))}
        </div>
      )}
      {entity === "clients" && (
        <>
          <Stats
            items={[
              [
                "Active projects",
                r("projects").filter(
                  (p) => p.clientId === record.id && p.status === "Active",
                ).length,
              ],
              [
                "Contacts",
                r("contacts").filter((c) => c.clientId === record.id).length,
              ],
              [
                "Tasks awaiting review",
                data.tasks.filter(
                  (t) =>
                    t.stage === 3 &&
                    r("projects").some(
                      (p) => p.id === t.projectId && p.clientId === record.id,
                    ),
                ).length,
              ],
            ]}
          />
          <div className="record-context-actions">
            <Link to={`/clients/contacts?clientId=${record.id}`}>
              Manage contacts <ArrowUpRight size={13} />
            </Link>
            <Link to={`/clients/projects?clientId=${record.id}`}>
              View client projects <ArrowUpRight size={13} />
            </Link>
          </div>
        </>
      )}
      {entity === "projects" &&
        (() => {
          const h = projectHealth(data, record.id);
          return (
            <>
              <Stats
                items={[
                  ["Approved tasks", `${h.done} / ${h.total}`],
                  ["Awaiting review", h.review],
                  ["Overdue", h.overdue],
                ]}
              />
              <div className="project-progress-detail">
                <span>
                  Delivery progress <strong>{h.progress}%</strong>
                </span>
                <progress value={h.progress} max="100" />
                <small>Based on approved tasks, not manual estimates.</small>
              </div>
              <div className="detail-team">
                <span>Project team</span>
                {record.memberIds?.length ? (
                  record.memberIds.map((id) => {
                    const person = find("employees", id);
                    return (
                      <Link
                        key={id}
                        to={recordLink("employees", id)}
                        title={person?.fullName}
                      >
                        <i>{initials(person?.fullName)}</i>
                        <span>{person?.fullName}</span>
                      </Link>
                    );
                  })
                ) : (
                  <small>No members assigned yet</small>
                )}
              </div>
            </>
          );
        })()}
      {entity === "employees" && (
        <>
          <Stats
            items={[
              [
                "Active assignments",
                data.tasks.filter(
                  (t) =>
                    t.stage !== 4 &&
                    t.assignees?.some((a) => a.employee?.id === record.id),
                ).length,
              ],
              [
                "Documents",
                r("documents").filter((d) => d.employeeId === record.id).length,
              ],
              [
                "Pending leave",
                r("leaves").filter(
                  (l) => l.employeeId === record.id && l.status === "Pending",
                ).length,
              ],
            ]}
          />
          <div className="record-context-actions">
            <Link to={`/employees/documents?employeeId=${record.id}`}>
              Open documents <ArrowUpRight size={13} />
            </Link>
            <Link to={`/attendance/leaves?employeeId=${record.id}`}>
              Leave history <ArrowUpRight size={13} />
            </Link>
          </div>
        </>
      )}
      {entity === "applications" && (
        <Stats
          items={[
            [
              "Scheduled interviews",
              r("interviews").filter(
                (i) =>
                  i.applicationId === record.id && i.status === "Scheduled",
              ).length,
            ],
            [
              "Completed interviews",
              r("interviews").filter(
                (i) =>
                  i.applicationId === record.id && i.status === "Completed",
              ).length,
            ],
            [
              "Offers",
              r("offers").filter((o) => o.applicationId === record.id).length,
            ],
          ]}
        />
      )}
      {entity === "invoices" && (
        <section className="invoice-document" aria-label="Invoice document">
          <header>
            <div>
              <p className="eyebrow">BILL FROM</p>
              <strong>
                {r("settings").find((s) => s.name === "Company name")?.value ||
                  "MT Nexus Global"}
              </strong>
              <small>Software & creative services</small>
            </div>
            <div>
              <p className="eyebrow">BILL TO</p>
              <strong>{find("clients", record.clientId)?.company}</strong>
              <small>{find("clients", record.clientId)?.email}</small>
            </div>
          </header>
          <div className="invoice-dates">
            <span>
              Issued <strong>{record.issueDate}</strong>
            </span>
            <span>
              Due <strong>{record.dueDate}</strong>
            </span>
            <span>
              Currency <strong>{currency}</strong>
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {r("invoiceItems")
                  .filter((i) => i.invoiceId === record.id)
                  .map((i) => (
                    <tr key={i.id}>
                      <td>{i.description}</td>
                      <td>{i.quantity}</td>
                      <td>{Number(i.unitPrice).toFixed(2)}</td>
                      <td>{Number(i.lineTotal).toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!r("invoiceItems").some((i) => i.invoiceId === record.id) && (
            <p className="invoice-empty">
              Add line items to prepare this invoice.
            </p>
          )}
          <div className="invoice-totals">
            <div>
              <span>Total</span>
              <strong>{money(record.totalCents || 0)}</strong>
            </div>
            <div>
              <span>Payments recorded</span>
              <strong>{money(record.paidCents || 0)}</strong>
            </div>
            <div className="invoice-balance">
              <span>Balance due</span>
              <strong>
                {money((record.totalCents || 0) - (record.paidCents || 0))}
              </strong>
            </div>
          </div>
          <div className="record-context-actions">
            <Link to={`/finance/items?invoiceId=${record.id}`}>
              View invoice items <ArrowUpRight size={13} />
            </Link>
            <Link to={`/finance/payments?invoiceId=${record.id}`}>
              View payment ledger <ArrowUpRight size={13} />
            </Link>
          </div>
        </section>
      )}
      {entity === "payroll" && (
        <div className="payroll-breakdown">
          <div>
            <span>Gross salary</span>
            <strong>
              {currency}{" "}
              {Number(record.gross).toLocaleString("en-PK", {
                minimumFractionDigits: 2,
              })}
            </strong>
          </div>
          <div>
            <span>Deductions</span>
            <strong>
              − {currency}{" "}
              {Number(record.deductions).toLocaleString("en-PK", {
                minimumFractionDigits: 2,
              })}
            </strong>
          </div>
          <div>
            <span>Net payroll record</span>
            <strong>
              {currency}{" "}
              {Number(record.net).toLocaleString("en-PK", {
                minimumFractionDigits: 2,
              })}
            </strong>
          </div>
          <small>Approval and recording do not trigger a bank transfer.</small>
        </div>
      )}
      {entity === "tickets" && (
        <section className="ticket-conversation">
          <header>
            <h3>Client conversation</h3>
            <span>
              {
                r("ticketComments").filter((c) => c.ticketId === record.id)
                  .length
              }{" "}
              responses
            </span>
          </header>
          <div className="ticket-message original-message">
            <strong>Issue reported</strong>
            <p>{record.description}</p>
          </div>
          {r("ticketComments")
            .filter((c) => c.ticketId === record.id)
            .map((comment) => (
              <div className="ticket-message" key={comment.id}>
                <strong>
                  Workspace response{" "}
                  <small>
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </small>
                </strong>
                <p>{comment.content}</p>
                {comment.file && (
                  <a href={comment.file.data} download={comment.file.name}>
                    <Download size={13} />
                    {comment.file.name}
                  </a>
                )}
              </div>
            ))}
          {record.resolution && (
            <div className="ticket-resolution">
              <strong>Resolution recorded</strong>
              <p>{record.resolution}</p>
            </div>
          )}
          <form onSubmit={sendReply}>
            <label>
              Reply to ticket
              <textarea
                aria-label="Reply to ticket"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                maxLength={5000}
                required
                placeholder="Write a clear update for the ticket history…"
              />
            </label>
            {replyError && (
              <p className="error" role="alert">
                {replyError}
              </p>
            )}
            <button className="secondary" disabled={sending}>
              <Send size={13} />
              {sending ? "Saving…" : "Post response"}
            </button>
          </form>
        </section>
      )}
      {entity === "creativeRequests" && (
        <div className="creative-brief-summary">
          <p className="eyebrow">CREATIVE BRIEF</p>
          <p>{record.brief}</p>
          <div className="record-context-actions">
            <Link to={`/creative/assets?requestId=${record.id}`}>
              View deliverables <ArrowUpRight size={13} />
            </Link>
            <Link to={`/creative/revisions?requestId=${record.id}`}>
              Revision history <ArrowUpRight size={13} />
            </Link>
            {record.taskId && (
              <Link to={`/projects/${record.projectId}/board`}>
                Open linked board <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
