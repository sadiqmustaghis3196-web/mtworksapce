import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  RefreshCw,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Flag,
  Filter,
} from "lucide-react";
import { api } from "../../services/api";
import { today } from "../../modules/store";
import { dashboardRoles, deliveryPhases } from "../../modules/dailyWork";
import { State, Modal } from "../../components/common/UI";
import { Actions, stages } from "../../components/tasks/TaskCard";
import TaskModal from "../../components/tasks/TaskModal";
import DeliveryFlow from "./DeliveryFlow";
import { WorkUpdateForm, DailyGoalForm, ReminderForm } from "./DailyForms";
import "../../styles/dailyDashboard.css";
const duration = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const delta = (value) => `${value > 0 ? "+" : ""}${value} pp`;
function initialView() {
  try {
    const view = JSON.parse(sessionStorage.getItem("mt-daily-dashboard-view"));
    if (view && dashboardRoles.some((r) => r[0] === view.role)) return view;
  } catch {}
  return { role: "SUPER_ADMIN", profileId: "preview-hamza", focusId: "all" };
}
export default function DailyDashboard() {
  const [view, setView] = useState(initialView),
    [date, setDate] = useState(today),
    [data, setData] = useState(null),
    [workspace, setWorkspace] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [phase, setPhase] = useState("all"),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [logTask, setLogTask] = useState(null),
    [selectedTask, setSelectedTask] = useState(null),
    [goalOpen, setGoalOpen] = useState(false),
    [preferencesOpen, setPreferencesOpen] = useState(false),
    [rejectTask, setRejectTask] = useState(null),
    [syncedAt, setSyncedAt] = useState(null);
  const [params, setParams] = useSearchParams();
  async function load() {
    try {
      const world = (await api("/workspace/data")).data;
      setWorkspace(world);
      const profileId = world.records.employees.some(
        (e) => e.id === view.profileId,
      )
        ? view.profileId
        : world.records.employees[0]?.id;
      if (!profileId)
        throw new Error(
          "Create an employee profile before opening a daily work view.",
        );
      if (profileId !== view.profileId) {
        setView((v) => ({ ...v, profileId }));
        return;
      }
      const result = await api(
        `/dashboard/daily?${new URLSearchParams({ ...view, date })}`,
      );
      setData(result.data);
      setError("");
      setSyncedAt(new Date());
      const taskId = Number(params.get("task"));
      if (taskId) {
        const task =
          result.data.tasks.find((t) => t.id === taskId) ||
          result.data.deadlines.find((t) => t.id === taskId);
        if (task) setSelectedTask(task);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 60000),
      changed = () => load();
    window.addEventListener("mt-workspace-change", changed);
    return () => {
      clearInterval(timer);
      window.removeEventListener("mt-workspace-change", changed);
    };
  }, [view.role, view.profileId, view.focusId, date]);
  useEffect(() => {
    try {
      sessionStorage.setItem("mt-daily-dashboard-view", JSON.stringify(view));
      window.dispatchEvent(new Event("mt-notification-view-change"));
    } catch {}
    setPhase("all");
    setFilter("all");
  }, [view]);
  const moveDate = (days) =>
    setDate(
      new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
        .toISOString()
        .slice(0, 10),
    );
  async function transition(task, targetStage, reason) {
    if (targetStage === 5 && !reason) {
      setRejectTask(task);
      return;
    }
    try {
      await api(`/tasks/${task.id}/transition`, {
        method: "POST",
        body: { targetStage, reason },
      });
      setRejectTask(null);
      await load();
      setNotice(`#${task.id} moved to ${stages[targetStage]}.`);
    } catch (e) {
      setError(e.message);
    }
  }
  async function saveUpdate(body) {
    await api("/dashboard/daily/update", { method: "POST", body });
    setLogTask(null);
    await load();
    setNotice(
      "Daily work update recorded. Today’s progress and team report are refreshed.",
    );
  }
  async function saveGoal(body) {
    await api("/dashboard/daily/plan", { method: "POST", body });
    setGoalOpen(false);
    await load();
    setNotice("Daily goal saved.");
  }
  async function savePreferences(preferences) {
    await api("/dashboard/daily/preferences", {
      method: "PATCH",
      body: { profileId: view.profileId, preferences },
    });
    setPreferencesOpen(false);
    await load();
    setNotice("In-app notification preferences saved.");
  }
  async function readNotification(n) {
    try {
      await api(`/workspace/notifications/${n.id}/actions/read`, {
        method: "POST",
        body: {},
      });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  const tasks = (data?.tasks || []).filter(
    (t) =>
      (phase === "all" || phase === "rework"
        ? phase === "all" || t.stage === 5
        : t.reportedPhase === phase) &&
      (filter === "all" ||
        (filter === "no-update" && !t.dayEntries.length && !t.doneToday) ||
        (filter === "blocked" && t.dayBlocker) ||
        (filter === "review" && t.reportedPhase === "review")) &&
      `${t.id} ${t.title} ${t.project?.name || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  if (loading && !data) return <State loading />;
  return (
    <div className="daily-dashboard">
      <header className="daily-header">
        <div>
          <p className="eyebrow">PEOPLE · PROGRESS · DELIVERY</p>
          <h1>Daily work dashboard</h1>
          <p>
            {data?.isOwn
              ? `Your assigned work, progress and next steps · ${data.profile.fullName}`
              : "One place to see what everyone planned, worked on and completed today."}
          </p>
        </div>
        <div className="daily-header-actions">
          <button
            className="secondary"
            onClick={() => setPreferencesOpen(true)}
            disabled={!data}
          >
            <Bell size={15} /> Notification preferences
          </button>
          <button
            className="primary"
            onClick={() => setGoalOpen(true)}
            disabled={!data || date < today()}
          >
            <Plus size={16} /> Set daily goal
          </button>
        </div>
      </header>
      <section
        className="daily-view-toolbar"
        aria-label="Dashboard view controls"
      >
        <label>
          Dashboard view
          <select
            aria-label="Dashboard view"
            value={view.role}
            onChange={(e) =>
              setView((v) => ({ ...v, role: e.target.value, focusId: "all" }))
            }
          >
            {dashboardRoles.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Profile perspective
          <select
            aria-label="Profile perspective"
            value={view.profileId}
            onChange={(e) =>
              setView((v) => ({
                ...v,
                profileId: e.target.value,
                focusId: "all",
              }))
            }
          >
            {workspace?.records.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </label>
        <div className="daily-date-control">
          <button
            className="icon"
            aria-label="Previous work day"
            onClick={() => moveDate(-1)}
          >
            <ChevronLeft size={15} />
          </button>
          <label>
            <CalendarDays size={14} />
            <input
              type="date"
              aria-label="Work date"
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </label>
          <button
            className="icon"
            aria-label="Next work day"
            onClick={() => moveDate(1)}
          >
            <ChevronRight size={15} />
          </button>
          <button className="secondary" onClick={() => setDate(today())}>
            Today
          </button>
        </div>
        <button className="icon" aria-label="Refresh daily work" onClick={load}>
          <RefreshCw size={15} />
        </button>
      </section>
      <p className="daily-preview-context">
        Preview lens only: this changes the dashboard perspective, not the
        signed-in account or its permissions. Work dates use Asia/Karachi.
      </p>
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
      {data && (
        <>
          <div className="daily-scope-heading">
            <span>
              <i />
              {data.isOwn
                ? "MY WORK"
                : data.company
                  ? "TEAM DELIVERY"
                  : "DEPARTMENT DELIVERY"}{" "}
              ·{" "}
              {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "Asia/Karachi",
              })}
            </span>
            <small>
              {syncedAt
                ? `Refreshed ${syncedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" })}`
                : ""}{" "}
              · local workspace
            </small>
          </div>
          <div className="daily-metrics">
            {[
              ...(data.isOwn
                ? []
                : [
                    [
                      "Employees",
                      data.summary.employees,
                      "People in this view",
                    ],
                  ]),
              [
                "Today’s tasks",
                data.summary.taskCount,
                "Assigned, planned or due",
              ],
              [
                "Updated today",
                data.summary.updatedCount,
                "With a recorded daily update",
              ],
              [
                "Done today",
                data.summary.completed,
                "Approved on the selected date",
              ],
              [
                "Time logged",
                duration(data.summary.minutes),
                "Reported work time",
              ],
              ...(data.isOwn
                ? [
                    [
                      "Daily goals met",
                      `${data.summary.goalsMet}/${data.plans.length}`,
                      "Target progress reached",
                    ],
                  ]
                : []),
              [
                "Needs update",
                data.summary.noUpdate,
                "No daily update recorded",
              ],
            ].map(([label, value, hint]) => (
              <div className="daily-metric metric" key={label}>
                <p>{label}</p>
                <strong>{value}</strong>
                <small>{hint}</small>
              </div>
            ))}
          </div>
          <DeliveryFlow
            counts={data.phaseCounts}
            tasks={data.tasks}
            onOpenTask={setSelectedTask}
            selected={phase}
            onSelect={setPhase}
            reworkCount={data.tasks.filter((t) => t.stage === 5).length}
            isToday={data.isToday}
          />
          {!data.isToday && (
            <div className="daily-history-notice">
              Viewing {date < today() ? "history" : "a future plan"}. Progress
              below uses that day’s recorded updates; new work updates are
              available only for today.
            </div>
          )}
          {!data.isOwn && (
            <section className="daily-team-panel">
              <header>
                <div>
                  <p className="eyebrow">ACCOUNTABILITY</p>
                  <h2>Team daily progress</h2>
                </div>
                {view.focusId !== "all" && (
                  <button
                    className="link"
                    onClick={() => setView((v) => ({ ...v, focusId: "all" }))}
                  >
                    Show full team
                  </button>
                )}
                <span>
                  {data.summary.blocked} blocked · {data.summary.review}{" "}
                  awaiting review
                </span>
              </header>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Team member</th>
                      <th>Today’s work</th>
                      <th>Daily progress</th>
                      <th>Time logged</th>
                      <th>Approved today</th>
                      <th>Attention</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.people.map((person) => (
                      <tr key={person.id}>
                        <td>
                          <div className="daily-person">
                            <i>
                              {person.fullName
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                            </i>
                            <div>
                              <strong>{person.fullName}</strong>
                              <small>{person.jobTitle}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong>
                            {person.updatedTasks}/{person.taskCount}
                          </strong>
                          <small className="cell-caption">tasks updated</small>
                        </td>
                        <td>
                          <span
                            className={
                              person.progressDelta > 0
                                ? "positive-progress"
                                : ""
                            }
                          >
                            {delta(person.progressDelta)}
                          </span>
                          <small className="cell-caption">
                            reported change today
                          </small>
                        </td>
                        <td>{duration(person.minutes)}</td>
                        <td>{person.completed}</td>
                        <td>
                          {person.blocked ? (
                            <span className="day-badge danger">
                              {person.blocked} blocked
                            </span>
                          ) : person.taskCount && !person.updatedTasks ? (
                            <span className="day-badge warning">
                              No update yet
                            </span>
                          ) : (
                            <span className="day-badge">
                              {person.review
                                ? `${person.review} in review`
                                : person.taskCount
                                  ? "Up to date"
                                  : "No assigned work"}
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            className="table-open-button"
                            onClick={() =>
                              setView((v) => ({ ...v, focusId: person.id }))
                            }
                          >
                            View work <ArrowUpRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.people.length && (
                  <p className="muted daily-empty">
                    No team members in this view.
                  </p>
                )}
              </div>
            </section>
          )}
          <div className="daily-main-grid">
            <div>
              <section className="daily-work-panel">
                <header>
                  <div>
                    <p className="eyebrow">
                      {data.isOwn ? "MY DAILY WORKLIST" : "DELIVERY WORKLIST"}
                    </p>
                    <h2>What is moving today?</h2>
                  </div>
                  <Link to="/projects">
                    Open project boards <ArrowUpRight size={14} />
                  </Link>
                </header>
                <div className="daily-work-filters">
                  <input
                    aria-label="Search daily tasks"
                    placeholder="Find a task or project…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    aria-label="Filter daily tasks"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All daily work</option>
                    <option value="no-update">Needs an update</option>
                    <option value="blocked">Blocked</option>
                    <option value="review">Awaiting review</option>
                  </select>
                  {phase !== "all" && (
                    <button className="link" onClick={() => setPhase("all")}>
                      Clear stage filter
                    </button>
                  )}
                </div>
                <div className="daily-task-grid">
                  {tasks.map((task) => (
                    <article
                      className={`daily-task-card phase-${task.reportedPhase} ${task.stage === 2 ? "task-working" : ""} ${task.dayEntries.length ? "task-updated" : ""}`}
                      key={task.id}
                    >
                      <div className="daily-task-top">
                        <span className="day-badge">
                          {
                            deliveryPhases.find(
                              (p) => p.id === task.reportedPhase,
                            )?.label
                          }
                        </span>
                        <span
                          className={`task-priority priority-${task.priority?.toLowerCase()}`}
                        >
                          {task.priority}
                        </span>
                      </div>
                      <small>
                        {task.project?.name || "No project assigned"}
                      </small>
                      <button
                        className="daily-task-title"
                        onClick={() => setSelectedTask(task)}
                      >
                        #{task.id} {task.title}
                      </button>
                      <div className="daily-task-assignees">
                        {task.assignees?.map((a) => (
                          <span key={a.id}>{a.employee?.fullName}</span>
                        ))}
                      </div>
                      {task.dailyPlan && (
                        <div className="daily-task-goal">
                          <Flag size={12} />
                          <p>
                            {task.dailyPlan.goal}
                            <small>
                              Target overall progress:{" "}
                              {task.dailyPlan.targetProgress}%
                            </small>
                          </p>
                        </div>
                      )}
                      {task.stage === 2 && (
                        <div className="task-working-label">
                          <span />
                          {data.isToday
                            ? "Work in progress"
                            : "Current task in progress"}
                        </div>
                      )}
                      <div className="daily-task-progress">
                        <span>
                          {data.isToday
                            ? "Overall progress"
                            : "Last reported progress"}
                          <strong>
                            {task.reportedProgress === null
                              ? "Not reported"
                              : `${task.reportedProgress}%`}
                          </strong>
                        </span>
                        <progress
                          value={task.reportedProgress || 0}
                          max="100"
                        />
                      </div>
                      <div
                        className={`task-daily-result ${task.dayEntries.length ? "has-update" : ""}`}
                      >
                        <div>
                          <small>
                            {data.isToday
                              ? "TODAY’S PROGRESS"
                              : "DAY’S PROGRESS"}
                          </small>
                          <strong>{delta(task.dayDelta)}</strong>
                          <span>
                            {task.dayEntries.length
                              ? `${task.dayEntries.length} recorded update${task.dayEntries.length === 1 ? "" : "s"}`
                              : "No daily update yet"}
                          </span>
                        </div>
                        <div>
                          <small>TIME LOGGED</small>
                          <strong>
                            <Clock3 size={14} />
                            {duration(task.dayMinutes)}
                          </strong>
                          <span>Actual reported time</span>
                        </div>
                      </div>
                      {task.dueDate && (
                        <p className="daily-task-deadline">
                          <CalendarDays size={12} />
                          Due{" "}
                          {new Date(task.dueDate).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Karachi",
                          })}
                        </p>
                      )}
                      {task.dayBlocker && (
                        <p className="daily-task-blocker">
                          <AlertTriangle size={12} />
                          {task.dayBlocker}
                        </p>
                      )}
                      {task.stage === 5 && (
                        <p className="daily-task-blocker">
                          Rework requested:{" "}
                          {task.rejectReason ||
                            "Awaiting reviewer instructions."}
                        </p>
                      )}
                      <div className="daily-task-bottom">
                        <span>
                          {task.dayEntries.length
                            ? `${task.dayEntries.length} update${task.dayEntries.length > 1 ? "s" : ""} today`
                            : task.doneToday
                              ? "Approved today"
                              : "No daily update yet"}
                        </span>
                        {data.isToday && [2, 3].includes(task.stage) && (
                          <button
                            className="secondary"
                            onClick={() => setLogTask(task)}
                          >
                            <Plus size={12} />
                            Log daily update
                          </button>
                        )}
                      </div>
                      {data.isToday && (
                        <Actions
                          task={task}
                          canReview={data.canReview}
                          onTransition={transition}
                        />
                      )}
                    </article>
                  ))}
                </div>
                {!tasks.length && (
                  <div className="daily-empty">
                    <CheckCircle2 size={24} />
                    <h3>No matching daily work</h3>
                    <p>
                      Assign work on a project board or set a daily goal for
                      this person.
                    </p>
                  </div>
                )}
              </section>
              <section className="daily-activity-panel">
                <header>
                  <div>
                    <p className="eyebrow">ACTUAL WORK REPORTED</p>
                    <h2>Today’s work log</h2>
                  </div>
                  <span>{data.entries.length} entries</span>
                </header>
                {data.entries.length ? (
                  data.entries.map((entry) => (
                    <div className="daily-log-entry" key={entry.id}>
                      <i />
                      <div>
                        <strong>
                          {
                            workspace.records.employees.find(
                              (e) => e.id === entry.employeeId,
                            )?.fullName
                          }{" "}
                          <span>· #{entry.taskId}</span>
                        </strong>
                        <p>{entry.summary}</p>
                        {entry.blocker && (
                          <p className="log-blocker">
                            Blocker: {entry.blocker}
                          </p>
                        )}
                        {entry.nextStep && (
                          <p className="log-next">Next: {entry.nextStep}</p>
                        )}
                        <small>
                          {entry.progressBefore}% → {entry.progressAfter}% ·{" "}
                          {entry.minutes} min ·{" "}
                          {
                            deliveryPhases.find((p) => p.id === entry.phase)
                              ?.label
                          }{" "}
                          ·{" "}
                          {new Date(entry.createdAt).toLocaleTimeString(
                            "en-GB",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Karachi",
                            },
                          )}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="daily-empty">
                    No daily updates recorded. Existing overall progress is not
                    counted as today’s work.
                  </p>
                )}
              </section>
            </div>
            <aside className="daily-sidebar">
              <section className="daily-deadlines">
                <header>
                  <p className="eyebrow">TIME & COMMITMENTS</p>
                  <h2>Deadline watch</h2>
                </header>
                {data.deadlines.map((task) => (
                  <button key={task.id} onClick={() => setSelectedTask(task)}>
                    <div>
                      <span
                        className={`day-badge ${task.deadlineState === "Overdue" ? "danger" : task.deadlineState === "Due today" ? "warning" : ""}`}
                      >
                        {task.deadlineState}
                      </span>
                      <strong>
                        #{task.id} {task.title}
                      </strong>
                      <small>{task.project?.name}</small>
                    </div>
                    <span>
                      {new Date(task.dueDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        timeZone: "Asia/Karachi",
                      })}
                    </span>
                  </button>
                ))}
                {!data.deadlines.length && (
                  <p className="daily-empty">
                    No upcoming deadlines in this view.
                  </p>
                )}
              </section>
              <section className="daily-notifications">
                <header>
                  <h2>
                    <Bell size={16} /> Notifications
                  </h2>
                  <Link to="/notifications">View all</Link>
                </header>
                {workspace.records.notifications
                  .filter(
                    (n) =>
                      data.company ||
                      n.employeeId === data.profile.id ||
                      (!n.employeeId &&
                        (n.id === "notification-welcome" ||
                          data.tasks.some((t) => t.id === n.taskId))),
                  )
                  .slice(0, 5)
                  .map((n) => (
                    <div
                      className={n.status === "Unread" ? "unread" : ""}
                      key={n.id}
                    >
                      <strong>{n.title}</strong>
                      <p>{n.message}</p>
                      {n.taskId && (
                        <Link
                          to={`/projects?task=${n.taskId}`}
                          onClick={() => readNotification(n)}
                        >
                          Open related work →
                        </Link>
                      )}
                      {n.status === "Unread" && (
                        <button onClick={() => readNotification(n)}>
                          Mark read
                        </button>
                      )}
                    </div>
                  ))}
                <footer>
                  In-app reminders refresh while this workspace is open.
                </footer>
              </section>
              <section className="daily-agenda">
                <header>
                  <h2>Role-specific agenda</h2>
                </header>
                {data.agenda.length ? (
                  data.agenda.map((item, index) => (
                    <Link key={index} to={item.path}>
                      <strong>
                        {item.title}
                        <ArrowUpRight size={12} />
                      </strong>
                      <small>{item.detail}</small>
                    </Link>
                  ))
                ) : (
                  <p className="daily-empty">
                    No additional approvals or follow-ups for this view.
                  </p>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
      {logTask && data && (
        <WorkUpdateForm
          task={logTask}
          profileId={view.profileId}
          allowedPeople={data.people}
          date={date}
          onClose={() => setLogTask(null)}
          onSave={saveUpdate}
        />
      )}
      {goalOpen && workspace && (
        <DailyGoalForm
          workspace={workspace}
          profileId={view.profileId}
          allowedPeople={data.people}
          date={date}
          onClose={() => setGoalOpen(false)}
          onSave={saveGoal}
        />
      )}
      {preferencesOpen && data && (
        <ReminderForm
          preferences={data.preferences}
          profile={data.profile}
          onClose={() => setPreferencesOpen(false)}
          onSave={savePreferences}
        />
      )}
      {selectedTask && data && (
        <TaskModal
          task={selectedTask}
          canReview={data.canReview}
          onSaved={load}
          onTransition={transition}
          onClose={() => {
            setSelectedTask(null);
            if (params.has("task")) setParams({});
          }}
        />
      )}
      {rejectTask && (
        <Modal
          title={`Reject task #${rejectTask.id}`}
          onClose={() => setRejectTask(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              transition(
                rejectTask,
                5,
                new FormData(e.currentTarget).get("reason"),
              );
            }}
          >
            <label>
              Reason for rejection
              <textarea name="reason" required maxLength={2000} />
            </label>
            <button className="primary">Reject and move task</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
