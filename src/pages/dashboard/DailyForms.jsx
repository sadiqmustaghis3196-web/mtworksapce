import { useState } from "react";
import { Modal } from "../../components/common/UI";
import { deliveryPhases } from "../../modules/dailyWork";
export function WorkUpdateForm({
  task,
  profileId,
  allowedPeople,
  date,
  onClose,
  onSave,
}) {
  const people =
      task.assignees
        ?.map((a) => a.employee)
        .filter(
          (p) =>
            p && (!allowedPeople || allowedPeople.some((v) => v.id === p.id)),
        ) || [],
    [person, setPerson] = useState(
      people.some((p) => p.id === profileId) ? profileId : people[0]?.id || "",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await onSave({
        ...fields,
        taskId: task.id,
        employeeId: person,
        date,
        minutes: Number(fields.minutes),
        progress: Number(fields.progress),
        phase: task.stage === 3 ? "review" : fields.phase,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Daily update · #${task.id}`} onClose={onClose} wide>
      <div className="daily-form-context">
        <strong>{task.title}</strong>
        <span>
          {date} · current overall progress {task.progress || 0}%
        </span>
      </div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            Record work for
            <select
              aria-label="Record work for"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              required
            >
              {people.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time spent (minutes)
            <input
              name="minutes"
              type="number"
              min="0"
              max="720"
              required
              placeholder="e.g. 45"
            />
          </label>
        </div>
        <label>
          What did you accomplish today?
          <textarea
            name="summary"
            required
            minLength={5}
            maxLength={2000}
            rows={3}
            placeholder="Describe the actual work completed or tested…"
          />
        </label>
        <div className="form-grid">
          <label>
            Work phase
            <select
              aria-label="Work phase"
              name="phase"
              defaultValue={
                task.stage === 3 ? "review" : task.workPhase || "development"
              }
              disabled={task.stage === 3}
            >
              {(task.stage === 3
                ? deliveryPhases.filter((p) => p.id === "review")
                : deliveryPhases.filter((p) =>
                    ["development", "testing", "quality"].includes(p.id),
                  )
              ).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Overall progress after this update (%)
            <input
              name="progress"
              type="number"
              min="0"
              max="99"
              defaultValue={task.progress || 0}
              readOnly={task.stage === 3}
              required
            />
          </label>
        </div>
        <label>
          Blocker (leave empty when resolved)
          <textarea
            name="blocker"
            rows={2}
            maxLength={1000}
            defaultValue={task.blocker || ""}
            placeholder="What is stopping you from moving forward?"
          />
        </label>
        <label>
          Next step
          <input
            name="nextStep"
            maxLength={1000}
            placeholder="What will you pick up next?"
          />
        </label>
        <p className="daily-form-note">
          Testing/quality phases describe reported work. Use Send for Review for
          approval; only approval records 100%.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-buttons">
          <button className="secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save daily update"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function DailyGoalForm({
  workspace,
  profileId,
  allowedPeople,
  date,
  onClose,
  onSave,
}) {
  const permitted =
    allowedPeople ||
    workspace.records.employees.filter((e) => e.status !== "Inactive");
  const [person, setPerson] = useState(
      permitted.some((p) => p.id === profileId)
        ? profileId
        : permitted[0]?.id || "",
    ),
    [taskId, setTaskId] = useState(""),
    [target, setTarget] = useState(""),
    [goal, setGoal] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    tasks = workspace.tasks.filter(
      (t) =>
        t.stage !== 4 && t.assignees?.some((a) => a.employee?.id === person),
    );
  const task = tasks.find((t) => t.id === Number(taskId));
  function choose(id) {
    setTaskId(id);
    const t = tasks.find((t) => t.id === Number(id)),
      plan = workspace.dailyWork?.plans?.find(
        (p) =>
          p.employeeId === person && p.taskId === Number(id) && p.date === date,
      );
    setTarget(
      plan?.targetProgress ?? Math.min(100, Number(t?.progress || 0) + 20),
    );
    setGoal(plan?.goal || "");
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSave({
        date,
        employeeId: person,
        taskId: Number(taskId),
        targetProgress: Number(target),
        goal,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Set a daily goal" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="muted">Set a clear target for assigned work on {date}.</p>
        <label>
          Employee
          <select
            value={person}
            onChange={(e) => {
              setPerson(e.target.value);
              setTaskId("");
              setGoal("");
            }}
          >
            {permitted.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assigned task
          <select
            value={taskId}
            onChange={(e) => choose(e.target.value)}
            required
          >
            <option value="">Choose assigned work</option>
            {tasks.map((t) => (
              <option value={t.id} key={t.id}>
                #{t.id} {t.title}
              </option>
            ))}
          </select>
        </label>
        {task && (
          <p className="daily-form-note">
            Current overall progress: {task.progress || 0}%
          </p>
        )}
        <label>
          Today’s goal
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            required
            minLength={3}
            maxLength={1000}
            rows={3}
            placeholder="e.g. Finish responsive states and run mobile QA"
          />
        </label>
        <label>
          Target overall progress (%)
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            min={task?.progress || 0}
            max="100"
            required
          />
        </label>
        {!tasks.length && (
          <p className="muted">
            Assign a task to this employee on a project board first.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-buttons">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !tasks.length}>
            {busy ? "Saving…" : "Save daily goal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ReminderForm({ preferences, profile, onClose, onSave }) {
  const [values, setValues] = useState(preferences),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(values);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Notification preferences" onClose={onClose}>
      <form className="reminder-form" onSubmit={submit}>
        <p className="muted">
          In-app reminders for {profile.fullName}. Existing notifications stay
          in your history.
        </p>
        {[
          ["enabled", "Enable in-app reminders"],
          ["dueToday", "Tasks due today"],
          ["overdue", "Overdue tasks"],
          ["dueSoon", "Tasks due tomorrow"],
          ["review", "Tasks waiting for review"],
          ["dailyDigest", "Daily work summary"],
        ].map(([key, label]) => (
          <label className="reminder-option" key={key}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={values[key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.checked }))
              }
            />
          </label>
        ))}
        <label>
          Daily summary time (Asia/Karachi)
          <input
            type="time"
            value={values.digestTime}
            onChange={(e) =>
              setValues((v) => ({ ...v, digestTime: e.target.value }))
            }
            required
          />
        </label>
        <p className="daily-form-note">
          Reminders refresh while this workspace is open. This does not schedule
          email, mobile push or background delivery.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-buttons">
          <button className="secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
