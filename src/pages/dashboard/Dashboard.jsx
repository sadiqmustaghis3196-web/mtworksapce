import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, PanelsTopLeft } from "lucide-react";
import { api } from "../../services/api";
import { PageHeader, State, DataTable } from "../../components/common/UI";
import { stages } from "../../components/tasks/TaskCard";
export default function Dashboard() {
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
            ].map(([label, value]) => (
              <div className="panel metric" key={label}>
                <p>{label}</p>
                <strong>{value}</strong>
                <span>From your authorized records</span>
              </div>
            ))}
          </div>
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
