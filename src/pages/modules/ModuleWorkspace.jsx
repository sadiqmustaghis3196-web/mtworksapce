import ModuleOverview from "./ModuleOverview";
import RecordOverview from "./RecordOverview";
import { moduleSummary } from "../../modules/insights";
import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router-dom";
import {
  Plus,
  Search,
  Download,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  LayoutGrid,
  List,
  Clock3,
  CheckCircle2,
  Users,
  FolderKanban,
  FileText,
  Activity,
  Trash2,
  Pencil,
  ExternalLink,
} from "lucide-react";
import { api } from "../../services/api";
import { isPreview } from "../../preview/config";
import { entities, modules, collectionPath } from "../../modules/catalog";
import { balance, fromCents, toCents, today } from "../../modules/store";
import { State, PageHeader, Modal } from "../../components/common/UI";
import RecordForm, { displayName } from "./RecordForm";
const collection = (data, key) =>
  key === "projects" ? data.projects : data.records[key];
const label = (key) =>
  ({
    status: "Status",
    createdAt: "Created",
    employeeCode: "Employee ID",
    days: "Working days",
    total: "Total",
    paid: "Recorded paid",
    balance: "Balance",
    lineTotal: "Line total",
    net: "Net salary",
    minutes: "Minutes",
    members: "Members",
    permissionCount: "Permissions",
    number: "Number",
    updatedAt: "Updated",
  })[key] ||
  key
    .replace(/Id$/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());
function download(filename, text, type = "text/csv;charset=utf-8") {
  const link = document.createElement("a"),
    url = URL.createObjectURL(new Blob([text], { type }));
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function ModuleWorkspace({ module }) {
  const config = modules[module],
    location = useLocation(),
    navigate = useNavigate(),
    { search: globalSearch = "" } = useOutletContext();
  const base = module === "projects" ? "/projects/manage" : `/${module}`,
    tail = location.pathname.slice(base.length).split("/").filter(Boolean);
  const tab = config.tabs.find((t) => t[2] === tail[0]) || config.tabs[0],
    entity = tab[0],
    definition = entities[entity];
  const routeId = tab[2] === tail[0] ? tail[1] : tail[0];
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [view, setView] = useState("list"),
    [showOverview, setShowOverview] = useState(true),
    [form, setForm] = useState(null),
    [actionForm, setActionForm] = useState(null),
    [confirm, setConfirm] = useState(null),
    [attendanceEmployee, setAttendanceEmployee] = useState("preview-hamza");
  async function load() {
    if (!isPreview) {
      setLoading(false);
      return;
    }
    try {
      setData((await api("/workspace/data")).data);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    setSearch("");
    setStatus("");
    setPage(1);
    setForm(null);
  }, [module]);
  useEffect(() => {
    setPage(1);
    setStatus("");
    setSearch("");
    setView("list");
  }, [entity]);
  useEffect(() => {
    if (routeId === "new" && data && !definition.readOnly)
      setForm({ record: {} });
  }, [routeId, data, entity]);
  const urlParams = new URLSearchParams(location.search);
  const referenceFilters = definition.fields
    .filter((f) => f.ref && urlParams.has(f.key))
    .map((f) => ({ ...f, value: urlParams.get(f.key) }));
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("status") || "";
    setStatus(definition.states?.includes(requested) ? requested : "");
    setPage(1);
  }, [entity, location.search]);
  const newRecord = () =>
    Object.fromEntries(referenceFilters.map((f) => [f.key, f.value]));
  const records = data ? collection(data, entity) : [],
    selected = records.find((r) => r.id === routeId),
    query = `${globalSearch} ${search}`.trim().toLowerCase();
  const filtered = records.filter(
    (r) =>
      referenceFilters.every(
        (f) =>
          r[f.key] === f.value ||
          (Array.isArray(r[f.key]) && r[f.key].includes(f.value)),
      ) &&
      (!status || r.status === status) &&
      (!query ||
        Object.values(r)
          .filter((v) => typeof v === "string" || typeof v === "number")
          .join(" ")
          .toLowerCase()
          .includes(query) ||
        definition.fields.some(
          (f) =>
            f.ref &&
            String(
              displayName(
                f.ref,
                collection(data, f.ref).find((x) => x.id === r[f.key]),
              ),
            )
              .toLowerCase()
              .includes(query),
        )),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10)),
    visible = filtered.slice(
      (Math.min(page, totalPages) - 1) * 10,
      Math.min(page, totalPages) * 10,
    );
  function path(key = entity) {
    return collectionPath(module, key);
  }
  function closeDetail() {
    navigate(path());
  }
  async function save(values) {
    await api(
      `/workspace/${entity}${form.record.id ? `/${form.record.id}` : ""}`,
      { method: form.record.id ? "PATCH" : "POST", body: values },
    );
    setForm(null);
    if (routeId === "new") navigate(path());
    await load();
    setNotice(
      `${definition.singular} ${form.record.id ? "updated" : "created"}.`,
    );
  }
  async function runAction(record, action, values = {}) {
    await api(`/workspace/${entity}/${record.id}/actions/${action.key}`, {
      method: "POST",
      body: values,
    });
    await load();
    setActionForm(null);
    setNotice(`${action.label} completed.`);
  }
  function startAction(record, action) {
    setActionForm({ record, action });
  }
  async function remove() {
    try {
      await api(`/workspace/${entity}/${confirm.id}`, { method: "DELETE" });
      setConfirm(null);
      closeDetail();
      await load();
      setNotice(`${definition.singular} deleted.`);
    } catch (e) {
      setError(e.message);
      setConfirm(null);
    }
  }
  function currency() {
    return (
      data?.records.settings.find((s) => s.name === "Currency")?.value || "PKR"
    );
  }
  function value(record, key) {
    const field = definition.fields.find((f) => f.key === key),
      raw = record[key];
    if (field?.ref) {
      if (Array.isArray(raw))
        return (
          raw
            .map((id) =>
              displayName(
                field.ref,
                collection(data, field.ref).find((r) => r.id === id),
              ),
            )
            .join(", ") || "—"
        );
      return displayName(
        field.ref,
        collection(data, field.ref).find((r) => r.id === raw),
      );
    }
    if (field?.type === "file") return raw?.name || "—";
    if (field?.type === "permissions") return raw?.join(", ") || "None";
    if (
      field?.type === "money" ||
      ["total", "paid", "balance", "net", "lineTotal"].includes(key)
    )
      return `${currency()} ${Number(raw || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (["checkIn", "checkOut", "createdAt", "updatedAt"].includes(key) && raw)
      return new Date(raw).toLocaleString("en-GB", {
        timeZone: "Asia/Karachi",
        dateStyle: "medium",
        timeStyle: "short",
      });
    return raw == null || raw === "" ? "—" : String(raw);
  }
  function exportCSV() {
    const keys = definition.columns;
    const cell = (v) =>
      `"${String(v ?? "")
        .replace(/^[=+\-@]/, "'$&")
        .replaceAll('"', '""')}"`;
    download(
      `${entity}-${today()}.csv`,
      [
        keys.map((k) => cell(label(k))).join(","),
        ...filtered.map((r) => keys.map((k) => cell(value(r, k))).join(",")),
      ].join("\r\n"),
    );
  }
  function metrics() {
    return data
      ? moduleSummary(module, data, {
          leaveBalance: balance(
            data,
            attendanceEmployee,
            "Annual",
            today().slice(0, 4),
          ),
        })
      : [];
  }
  function relatedPath(key, recordId) {
    const owner =
      key === "projects"
        ? "projects"
        : Object.keys(modules).find((m) =>
            modules[m].tabs.some((t) => t[0] === key),
          );
    return owner ? `${collectionPath(owner, key)}/${recordId}` : null;
  }
  function related(record) {
    const result = [];
    for (const [key, def] of Object.entries(entities)) {
      if (key === "auditLogs" || key === "notifications") continue;
      for (const field of def.fields.filter((f) => f.ref === entity)) {
        const matches = collection(data, key).filter(
          (r) =>
            r[field.key] === record.id ||
            (Array.isArray(r[field.key]) && r[field.key].includes(record.id)),
        );
        if (matches.length)
          result.push({ key, title: def.label, records: matches });
      }
    }
    return result;
  }
  const canEdit = (r) =>
    !definition.readOnly &&
    !definition.immutable &&
    !definition.lockAfter?.includes(r.status);
  const canDelete = (r) => canEdit(r) && !definition.noCreate;
  if (!isPreview)
    return (
      <section className="panel">
        <h1>{config.title}</h1>
        <p>
          These browser workflows belong to UI preview. Database-backed
          integration is pending.
        </p>
      </section>
    );
  return (
    <>
      <PageHeader eyebrow="WORKSPACE / OPERATIONS" title={config.title}>
        {module === "admin" && entity === "settings" && data && (
          <button
            className="secondary"
            onClick={() =>
              download(
                `mt-nexus-workspace-${today()}.json`,
                JSON.stringify(data, null, 2),
                "application/json",
              )
            }
          >
            <Download size={15} /> Download workspace backup
          </button>
        )}
        {!definition.readOnly && !definition.noCreate && (
          <button
            className="primary"
            onClick={() => setForm({ record: newRecord() })}
          >
            <Plus size={17} /> Add {definition.singular.toLowerCase()}
          </button>
        )}
      </PageHeader>
      <p className="module-subtitle">{config.subtitle}</p>
      <div className="module-metrics">
        {metrics().map(({ label: title, value: count, hint }, i) => (
          <div className="module-metric" key={title}>
            <span>{title}</span>
            <strong>{count}</strong>
            <small className="metric-hint">{hint}</small>
            <span className={`metric-symbol symbol-${i}`}>
              {
                [
                  <FolderKanban size={19} />,
                  <Users size={19} />,
                  <Clock3 size={19} />,
                  <Activity size={19} />,
                ][i]
              }
            </span>
          </div>
        ))}
      </div>
      {data && entity === config.tabs[0][0] && module !== "notifications" && (
        <div className="overview-control">
          <span>OPERATIONS OVERVIEW</span>
          <button onClick={() => setShowOverview((v) => !v)}>
            {showOverview ? "Hide overview" : "Show overview"}
          </button>
        </div>
      )}
      {data && showOverview && entity === config.tabs[0][0] && (
        <ModuleOverview module={module} data={data} />
      )}
      <div
        className="module-tabs"
        role="navigation"
        aria-label={`${config.title} sections`}
      >
        {config.tabs.map(([key, title]) => (
          <Link
            key={key}
            className={entity === key ? "active" : ""}
            to={collectionPath(module, key)}
          >
            {title}
            <span>{data ? collection(data, key).length : 0}</span>
          </Link>
        ))}
      </div>
      {module === "attendance" && data && (
        <div className="attendance-controls panel">
          <div>
            <h3>Today’s attendance</h3>
            <p>{today()} · Asia/Karachi</p>
          </div>
          <label>
            Employee
            <select
              value={attendanceEmployee}
              onChange={(e) => setAttendanceEmployee(e.target.value)}
            >
              {data.records.employees
                .filter((e) => e.status === "Active")
                .map((e) => (
                  <option value={e.id} key={e.id}>
                    {e.fullName}
                  </option>
                ))}
            </select>
          </label>
          {["check-in", "check-out"].map((operation) => (
            <button
              key={operation}
              className={operation === "check-in" ? "primary" : "secondary"}
              onClick={async () => {
                try {
                  await api(`/workspace/attendance/${operation}`, {
                    method: "POST",
                    body: { employeeId: attendanceEmployee },
                  });
                  await load();
                  setNotice(
                    `${operation === "check-in" ? "Check-in" : "Check-out"} recorded.`,
                  );
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              {operation === "check-in" ? "Check in" : "Check out"}
            </button>
          ))}
        </div>
      )}
      {module === "admin" && (
        <p className="module-disclaimer">
          Account and permission changes are saved for preview workflow testing.
          They do not create real logins or enforce server authorization.
        </p>
      )}
      {module === "finance" && (
        <p className="module-disclaimer">
          Ledger records only. No bank transfers, payroll payments or invoice
          emails are sent.
        </p>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button className="link" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button className="link" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
      {data && referenceFilters.length > 0 && (
        <div className="active-context-filter">
          <span>
            Showing{" "}
            {referenceFilters
              .map(
                (f) =>
                  `${f.label}: ${displayName(
                    f.ref,
                    collection(data, f.ref).find((r) => r.id === f.value),
                  )}`,
              )
              .join(" · ")}
          </span>
          <Link to={path()}>Clear context</Link>
        </div>
      )}
      {loading ? (
        <State loading />
      ) : (
        data && (
          <section className="module-records">
            <div className="module-records-toolbar">
              <div>
                <h2>{definition.label}</h2>
                <span>
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "record" : "records"}
                </span>
              </div>
              <div className="module-table-controls">
                <label className="module-search">
                  <Search size={15} />
                  <input
                    aria-label={`Search ${definition.label.toLowerCase()}`}
                    placeholder="Search records…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                {definition.states && (
                  <select
                    aria-label="Filter status"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All statuses</option>
                    {definition.states.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                )}
                {definition.states && (
                  <div className="tabs">
                    <button
                      aria-label="List view"
                      className={view === "list" ? "selected" : ""}
                      onClick={() => setView("list")}
                    >
                      <List size={15} />
                    </button>
                    <button
                      aria-label="Pipeline view"
                      className={view === "pipeline" ? "selected" : ""}
                      onClick={() => setView("pipeline")}
                    >
                      <LayoutGrid size={15} />
                    </button>
                  </div>
                )}
                <button className="secondary export-button" onClick={exportCSV}>
                  <Download size={14} /> Export
                </button>
              </div>
            </div>
            {view === "pipeline" && definition.states ? (
              <div className="module-pipeline">
                {definition.states.map((state) => (
                  <section key={state}>
                    <h3>
                      {state}
                      <span>
                        {filtered.filter((r) => r.status === state).length}
                      </span>
                    </h3>
                    {filtered
                      .filter((r) => r.status === state)
                      .map((r) => (
                        <button
                          key={r.id}
                          className="pipeline-card"
                          onClick={() => navigate(`${path()}/${r.id}`)}
                        >
                          <strong>{displayName(entity, r)}</strong>
                          <small>
                            {definition.columns
                              .filter(
                                (k) => k !== definition.title && k !== "status",
                              )
                              .slice(0, 2)
                              .map((k) => value(r, k))
                              .join(" · ")}
                          </small>
                          <span>
                            Open workflow <ArrowUpRight size={13} />
                          </span>
                        </button>
                      ))}
                    {!filtered.some((r) => r.status === state) && (
                      <p className="muted">No records</p>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="table-wrap module-table">
                <table>
                  <thead>
                    <tr>
                      {definition.columns.map((k) => (
                        <th key={k}>
                          {definition.fields.find((f) => f.key === k)?.label ||
                            label(k)}
                        </th>
                      ))}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((record) => (
                      <tr key={record.id}>
                        {definition.columns.map((key, index) => (
                          <td key={key}>
                            {key === "status" ? (
                              <span
                                className={`record-status status-${String(record.status).toLowerCase().replaceAll(" ", "-")}`}
                              >
                                {record.status}
                              </span>
                            ) : index === 0 ? (
                              <button
                                className="record-open"
                                onClick={() =>
                                  navigate(`${path()}/${record.id}`)
                                }
                              >
                                {value(record, key)}
                              </button>
                            ) : (
                              <span className="table-cell-content">
                                {value(record, key)}
                              </span>
                            )}
                          </td>
                        ))}
                        <td>
                          <button
                            className="table-open-button"
                            onClick={() => navigate(`${path()}/${record.id}`)}
                          >
                            Open <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && (
                  <State>
                    No {definition.label.toLowerCase()} match your filters. Add
                    a record to begin.
                  </State>
                )}
              </div>
            )}
            <footer className="pagination">
              <span>
                {filtered.length
                  ? `${(Math.min(page, totalPages) - 1) * 10 + 1}–${Math.min(page * 10, filtered.length)} of ${filtered.length}`
                  : "0 records"}
              </span>
              <div>
                <button
                  className="icon"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Page {Math.min(page, totalPages)} of {totalPages}
                </span>
                <button
                  className="icon"
                  aria-label="Next page"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </footer>
          </section>
        )
      )}
      {selected && data && (
        <Modal
          title={`${definition.singular} · ${displayName(entity, selected)}`}
          onClose={closeDetail}
          wide
        >
          <div className="record-detail-toolbar">
            {selected.status && (
              <span className="record-status">{selected.status}</span>
            )}
            {canEdit(selected) && (
              <button
                className="secondary"
                onClick={() => setForm({ record: selected })}
              >
                <Pencil size={14} /> Edit
              </button>
            )}
            {canDelete(selected) && (
              <button
                className="secondary danger-button"
                onClick={() => setConfirm(selected)}
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
            {entity === "projects" && (
              <Link className="primary" to={`/projects/${selected.id}/board`}>
                Open project board <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
          <RecordOverview
            key={selected.id}
            entity={entity}
            record={selected}
            data={data}
            onChanged={load}
          />
          <h3 className="record-section-heading">Record details</h3>
          <div className="record-detail-grid">
            {[
              ...definition.fields.filter((f) => f.key !== definition.title),
              ...[
                "days",
                "total",
                "paid",
                "balance",
                "net",
                "members",
                "employeeCode",
              ]
                .filter((k) => selected[k] !== undefined)
                .map((key) => ({ key, label: label(key) })),
            ].map((f) => (
              <div
                className={
                  f.type === "textarea" || f.type === "permissions"
                    ? "detail-full"
                    : ""
                }
                key={f.key}
              >
                <span>{f.label}</span>
                {f.type === "file" && selected[f.key]?.data ? (
                  <a
                    className="attachment-download"
                    href={selected[f.key].data}
                    download={selected[f.key].name}
                  >
                    <FileText size={16} />
                    {selected[f.key].name}
                    <Download size={13} />
                  </a>
                ) : (
                  <p>{value(selected, f.key)}</p>
                )}
              </div>
            ))}
          </div>
          {definition.actions?.some((a) =>
            a.from.includes(selected.status),
          ) && (
            <section className="record-workflow">
              <h3>Workflow actions</h3>
              <div>
                {definition.actions
                  .filter(
                    (a) =>
                      a.from.includes(selected.status) &&
                      !(a.key === "convert" && selected.clientId),
                  )
                  .map((a) => (
                    <button
                      className={
                        ["approve", "hire", "convert", "accept"].includes(a.key)
                          ? "primary"
                          : "secondary"
                      }
                      key={a.key}
                      onClick={() => startAction(selected, a)}
                    >
                      {a.label}
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
              </div>
            </section>
          )}
          {related(selected).map((group) => (
            <section
              className="record-related"
              key={`${group.key}-${group.title}`}
            >
              <h3>
                {group.title}
                <span>{group.records.length}</span>
              </h3>
              {group.records.map((r) => (
                <div key={r.id}>
                  <Link
                    className="related-record-link"
                    to={relatedPath(group.key, r.id)}
                  >
                    <strong>{displayName(group.key, r)}</strong>
                    <ArrowUpRight size={12} />
                  </Link>
                  <small>{r.status || "Recorded"}</small>
                </div>
              ))}
            </section>
          ))}
          {entity === "projects" && (
            <section className="record-related">
              <h3>Project tasks</h3>
              {data.tasks
                .filter((t) => t.projectId === selected.id)
                .map((t) => (
                  <div key={t.id}>
                    <strong>
                      #{t.id} {t.title}
                    </strong>
                    <small>
                      {
                        [
                          "Upcoming",
                          "Today To Do",
                          "In Progress",
                          "Review",
                          "Done",
                          "Reject",
                        ][t.stage]
                      }
                    </small>
                  </div>
                ))}
            </section>
          )}
          <section className="record-related">
            <h3>Activity history</h3>
            {data.records.auditLogs
              .filter((a) => a.entity === entity && a.recordId === selected.id)
              .slice(0, 10)
              .map((a) => (
                <div key={a.id}>
                  <strong>{a.detail}</strong>
                  <small>{new Date(a.createdAt).toLocaleString()}</small>
                </div>
              ))}
            {!data.records.auditLogs.some(
              (a) => a.entity === entity && a.recordId === selected.id,
            ) && <p className="muted">No changes recorded yet.</p>}
          </section>
        </Modal>
      )}
      {form && data && (
        <RecordForm
          key={`${entity}-${form.record.id || "new"}`}
          title={`${form.record.id ? "Edit" : "Add"} ${definition.singular.toLowerCase()}`}
          fields={definition.fields}
          entity={entity}
          record={form.record}
          data={data}
          onClose={() => {
            setForm(null);
            if (routeId === "new") navigate(path());
          }}
          onSubmit={save}
        />
      )}{" "}
      {actionForm && data && (
        <RecordForm
          title={actionForm.action.label}
          fields={actionForm.action.fields || []}
          record={{}}
          data={data}
          onClose={() => setActionForm(null)}
          submitLabel={actionForm.action.label}
          onSubmit={(values) =>
            runAction(actionForm.record, actionForm.action, values)
          }
        />
      )}{" "}
      {confirm && (
        <Modal
          title={`Delete ${definition.singular.toLowerCase()}?`}
          onClose={() => setConfirm(null)}
        >
          <p>
            This removes “{displayName(entity, confirm)}” from this browser
            workspace. Related records may prevent deletion.
          </p>
          <div className="form-buttons">
            <button className="secondary" onClick={() => setConfirm(null)}>
              Keep record
            </button>
            <button className="primary" onClick={remove}>
              Delete record
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
