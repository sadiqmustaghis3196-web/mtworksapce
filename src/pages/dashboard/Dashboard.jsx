import DailyDashboard from "./DailyDashboard";
import { isPreview } from "../../preview/config";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, PanelsTopLeft } from "lucide-react";
import { api } from "../../services/api";
import { PageHeader, State, DataTable } from "../../components/common/UI";
import { stages } from "../../components/tasks/TaskCard";
function BackendDashboard() {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      setData((await api("/dashboard/overview")).data);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <PageHeader eyebrow="YOUR WORKSPACE AT A GLANCE" title="Company overview">
        <Link className="primary" to="/projects">
          <PanelsTopLeft size={16} /> Open boards
        </Link>
      </PageHeader>
      {error ? (
        <>
          <State error={error} />
          <button className="secondary" onClick={load}>
            Retry
          </button>
        </>
      ) : !data ? (
        <State loading />
      ) : (
        <>
          <div className="metric-grid">
            {[
              ["Projects", data.projects],
              ["In progress", data.inProgress],
              ["Awaiting review", data.review],
              ["Completed", data.completed],
              ...(data.employees !== undefined
                ? [
                    ["Employees", data.employees],
                    ["Active clients", data.clients],
                    ["Attendance today", data.attendance],
                    ["Pending leave", data.pendingLeaves],
                  ]
                : []),
            ].map(([label, value]) => (
              <div className="panel metric" key={label}>
                <p>{label}</p>
                <strong>{value}</strong>
                <span>
                  {isPreview
                    ? "From browser-only sample records"
                    : "From your authorized records"}
                </span>
              </div>
            ))}
          </div>
          {data.approvals && (
            <div className="dashboard-lower">
              <section className="panel">
                <h3>Pending approvals</h3>
                {data.approvals.map((a) => (
                  <Link className="approval-link" key={a.title} to={a.path}>
                    <span>{a.title}</span>
                    <strong>{a.count}</strong>
                    <ArrowUpRight size={15} />
                  </Link>
                ))}
              </section>
              <section className="panel">
                <h3>Recent activity</h3>
                {data.activity?.length ? (
                  data.activity.map((a) => (
                    <div className="dashboard-activity" key={a.id}>
                      <p>{a.detail}</p>
                      <small>
                        {a.actor} · {new Date(a.createdAt).toLocaleString()}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    Workspace activity will appear as you add records and move
                    work forward.
                  </p>
                )}
              </section>
            </div>
          )}
          <section className="panel">
            <h3>Upcoming deadlines</h3>
            <DataTable
              rows={data.deadlines}
              columns={[
                { key: "title", label: "Task" },
                {
                  key: "stage",
                  label: "Status",
                  render: (r) => stages[r.stage],
                },
                {
                  key: "dueDate",
                  label: "Due date",
                  render: (r) => r.dueDate?.slice(0, 10),
                },
                { key: "priority", label: "Priority" },
              ]}
            />
          </section>
        </>
      )}
    </>
  );
}

export default function Dashboard() {
  return isPreview ? <DailyDashboard /> : <BackendDashboard />;
}
