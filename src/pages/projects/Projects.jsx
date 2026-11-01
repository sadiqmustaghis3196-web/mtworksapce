import DocumentEditor from "../../components/documents/DocumentEditor";
import { validateDocument } from "../../modules/taskDocument";
import {
  TaskCalendar,
  TaskTimeline,
} from "../../components/tasks/ScheduleViews";
import { isPreview } from "../../preview/config";
import { useEffect, useState } from "react";
import {
  useOutletContext,
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Plus,
  PanelsTopLeft,
  List,
  CalendarDays,
  GanttChart,
  ChevronRight,
  Folder,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Modal, State, DataTable } from "../../components/common/UI";
import TaskCard, { stages } from "../../components/tasks/TaskCard";
import TaskModal from "../../components/tasks/TaskModal";
const categories = [
  "All",
  "Web App",
  "Graphic Design",
  "Video Editing",
  "Social Media Marketing",
  "SEO",
];
export default function Projects() {
  const { search } = useOutletContext(),
    { user } = useAuth(),
    params = useParams(),
    navigate = useNavigate();
  const [tasks, setTasks] = useState([]),
    [documentBlocks, setDocumentBlocks] = useState([]),
    [newCardTitle, setNewCardTitle] = useState(""),
    [createProject, setCreateProject] = useState(""),
    [createAssignees, setCreateAssignees] = useState([]),
    [employees, setEmployees] = useState([]),
    [projects, setProjects] = useState([]),
    [category, setCategory] = useState("All"),
    [project, setProject] = useState(params.projectId || ""),
    [view, setView] = useState(params.view || "board"),
    [collapsed, setCollapsed] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState(null),
    [adding, setAdding] = useState(null),
    [reject, setReject] = useState(null),
    [busy, setBusy] = useState(false);
  const [taskParams, setTaskParams] = useSearchParams();
  useEffect(() => {
    const id = Number(taskParams.get("task"));
    if (id && tasks.length) {
      const target = tasks.find((t) => t.id === id);
      if (target) setSelected(target);
      else setError("The notification’s task is no longer available.");
    }
  }, [tasks, taskParams]);
  const canReview = !!user.effectivePermissions?.canManageTasks;
  const canCreate =
    user.isSuperAdmin || !!user.effectivePermissions?.canCreateTasks;
  async function load() {
    setError("");
    try {
      const [t, p] = await Promise.all([api("/tasks"), api("/projects")]);
      setTasks(t.data);
      setProjects(p.data);
      if (isPreview) setEmployees((await api("/workspace/employees")).data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (adding !== null) {
      setDocumentBlocks([]);
      setNewCardTitle("");
      setCreateProject(project);
      setCreateAssignees([]);
    }
  }, [adding]);
  const filtered = tasks.filter(
    (t) =>
      (category === "All" || t.category === category) &&
      (!project || t.projectId === project) &&
      `${t.title} ${t.id} ${t.project?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function transition(task, targetStage, reason) {
    if (targetStage === 5 && !reason) {
      setReject(task);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/tasks/${task.id}/transition`, {
        method: "POST",
        body: { targetStage, reason },
      });
      await load();
      setNotice(`#${task.id} moved to ${stages[targetStage]}`);
      setReject(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/tasks", {
        method: "POST",
        body: {
          ...f,
          ...(isPreview
            ? {
                documentBlocks: validateDocument(documentBlocks),
                employeeIds: createAssignees,
              }
            : {}),
          stage: 0,
          projectId: f.projectId || undefined,
          dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : undefined,
        },
      });
      setAdding(null);
      await load();
      setNotice("Task created.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function changeView(v) {
    setView(v);
    if (project) navigate(`/projects/${project}/${v}`);
  }
  return (
    <>
      <section className="board-heading">
        <div>
          <p className="eyebrow">WORKSPACE / PROJECT BOARDS</p>
          <div className="board-title">
            <PanelsTopLeft size={25} />
            <h1>{category === "All" ? "Project Boards" : category}</h1>
            <span className="count-label">{filtered.length} cards</span>
            <span className="hint">Click a stage to collapse or expand</span>
          </div>
        </div>
        {canCreate && (
          <button className="primary" onClick={() => setAdding(0)}>
            <Plus size={18} /> Add Card
          </button>
        )}
      </section>
      <div className="board-toolbar">
        <div className="category-filters">
          {categories.map((c, i) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {i > 0 && <span>{["", "◈", "◉", "▰", "⚑", "◌"][i]}</span>}
              {c}
            </button>
          ))}
        </div>
        <div className="view-controls">
          <div className="tabs">
            {[
              ["board", PanelsTopLeft],
              ["list", List],
              ["calendar", CalendarDays],
              ["timeline", GanttChart],
            ].map(([v, Icon]) => (
              <button
                className={view === v ? "selected" : ""}
                key={v}
                onClick={() => changeView(v)}
              >
                <Icon size={14} />
                <span>{v[0].toUpperCase() + v.slice(1)}</span>
              </button>
            ))}
          </div>
          <select
            aria-label="Filter by project"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
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
          <button className="link" onClick={load}>
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <State loading />
      ) : view === "board" ? (
        <div className="kanban">
          {stages.map((stage, index) => {
            const list = filtered.filter((t) => t.stage === index),
              closed = collapsed.includes(index);
            return (
              <section
                className={`stage ${closed ? "collapsed" : ""}`}
                key={stage}
              >
                <button
                  className="stage-heading"
                  aria-expanded={!closed}
                  onClick={() =>
                    setCollapsed(
                      closed
                        ? collapsed.filter((c) => c !== index)
                        : [...collapsed, index],
                    )
                  }
                >
                  <span>{stage}</span>
                  <b>{list.length}</b>
                  {closed && <ChevronRight size={17} />}
                </button>
                {!closed && (
                  <>
                    <div className="stage-cards">
                      {list.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onOpen={setSelected}
                          onTransition={transition}
                          canReview={canReview}
                        />
                      ))}
                    </div>
                    {canCreate && (
                      <button
                        className="add-card"
                        onClick={() => setAdding(index)}
                      >
                        <Plus size={16} /> Add a card…
                      </button>
                    )}
                    {!list.length && (
                      <p className="empty-column">No tasks in this stage</p>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>
      ) : view === "list" ? (
        <DataTable
          rows={filtered}
          onRow={setSelected}
          columns={[
            {
              key: "title",
              label: "Task",
              render: (t) => `#${t.id} ${t.title}`,
            },
            { key: "category", label: "Category" },
            { key: "stage", label: "Status", render: (t) => stages[t.stage] },
            { key: "priority", label: "Priority" },
            {
              key: "dueDate",
              label: "Due date",
              render: (t) => t.dueDate?.slice(0, 10) || "Unscheduled",
            },
          ]}
        />
      ) : view === "calendar" ? (
        <TaskCalendar tasks={filtered} onOpen={setSelected} />
      ) : (
        <TaskTimeline tasks={filtered} onOpen={setSelected} />
      )}
      <footer className="board-footer">
        <span>
          <span className="live-dot" />{" "}
          {isPreview
            ? "UI preview · browser-only sample data"
            : "Database-backed workspace"}
        </span>
        <span>
          {filtered.length} tasks · {projects.length} projects
        </span>
      </footer>
      {selected && (
        <TaskModal
          task={selected}
          onClose={() => {
            setSelected(null);
            if (taskParams.has("task")) setTaskParams({});
          }}
          onSaved={load}
          onTransition={transition}
          canReview={canReview}
        />
      )}{" "}
      {adding !== null && (
        <Modal
          title="Add card · Upcoming"
          onClose={() => setAdding(null)}
          wide={isPreview}
        >
          <form onSubmit={create}>
            <label>
              Title
              <input
                name="title"
                required
                minLength={2}
                maxLength={200}
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
              />
            </label>
            {isPreview ? (
              <DocumentEditor
                value={documentBlocks}
                onChange={setDocumentBlocks}
                task={{
                  title: newCardTitle || "New task document",
                  stage: 0,
                  project: projects.find((p) => p.id === createProject),
                  assignees: createAssignees.map((id) => ({
                    employee: employees.find((e) => e.id === id),
                  })),
                }}
              />
            ) : (
              <label>
                Description
                <textarea name="description" rows={3} />
              </label>
            )}
            <div className="form-grid">
              <label>
                Category
                <select
                  name="category"
                  defaultValue={category === "All" ? "Web App" : category}
                >
                  {categories.slice(1).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select name="priority">
                  {["Medium", "Low", "High", "Urgent", "Critical"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Project
              <select
                name="projectId"
                {...(isPreview
                  ? {
                      value: createProject,
                      onChange: (e) => {
                        setCreateProject(e.target.value);
                        setCreateAssignees([]);
                      },
                    }
                  : { defaultValue: project })}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {isPreview && (
              <label>
                Assign card to
                <select
                  multiple
                  value={createAssignees}
                  onChange={(e) =>
                    setCreateAssignees(
                      Array.from(e.target.selectedOptions, (o) => o.value),
                    )
                  }
                >
                  {employees
                    .filter(
                      (e) =>
                        e.status !== "Offboarded" &&
                        (!projects.find((p) => p.id === createProject)
                          ?.memberIds?.length ||
                          projects
                            .find((p) => p.id === createProject)
                            .memberIds.includes(e.id)),
                    )
                    .map((e) => (
                      <option value={e.id} key={e.id}>
                        {e.fullName}
                      </option>
                    ))}
                </select>
                <small>
                  Select project members; assigned work appears in their
                  dashboard pipeline.
                </small>
              </label>
            )}
            <label>
              Due date
              <input type="date" name="dueDate" />
            </label>
            <button className="primary" disabled={busy}>
              Create card
            </button>
          </form>
        </Modal>
      )}
      {reject && (
        <Modal
          title={`Reject task #${reject.id}`}
          onClose={() => setReject(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              transition(
                reject,
                5,
                new FormData(e.currentTarget).get("reason"),
              );
            }}
          >
            <label>
              Reason for rejection
              <textarea name="reason" required maxLength={2000} />
            </label>
            <button className="primary" disabled={busy}>
              Reject and move task
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
