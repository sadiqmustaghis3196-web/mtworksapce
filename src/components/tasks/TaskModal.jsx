import { useEffect, useState } from "react";
import { Modal, State } from "../common/UI";
import { api } from "../../services/api";
import { Actions, stages } from "./TaskCard";
export default function TaskModal({
  task,
  onClose,
  onSaved,
  onTransition,
  canReview,
}) {
  const [record, setRecord] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("Activity");
  async function load() {
    try {
      setRecord((await api(`/tasks/${task.id}`)).data);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [task.id]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(`/tasks/${task.id}`, {
        method: "PATCH",
        body: {
          title: f.title,
          description: f.description,
          priority: f.priority,
          dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : null,
          progress: record.stage === 4 ? undefined : Number(f.progress),
        },
      });
      onSaved();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function comment(e) {
    e.preventDefault();
    const content = new FormData(e.currentTarget).get("content");
    try {
      await api(`/tasks/${task.id}/comments`, {
        method: "POST",
        body: { content },
      });
      e.target.reset();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Modal title={`Task #${task.id}`} onClose={onClose} wide>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!record ? (
        <State loading={!error} />
      ) : (
        <div className="task-detail">
          <div>
            <div className="detail-heading">
              <span className="badge category">{record.category}</span>
              <span className="badge">{stages[record.stage]}</span>
            </div>
            <form onSubmit={save}>
              <label>
                Task title
                <input
                  name="title"
                  defaultValue={record.title}
                  required
                  minLength={2}
                />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  defaultValue={record.description}
                  rows={5}
                  placeholder="Describe the work and expected outcome…"
                />
              </label>
              <div className="form-grid">
                <label>
                  Priority
                  <select name="priority" defaultValue={record.priority}>
                    {["Low", "Medium", "High", "Urgent", "Critical"].map(
                      (p) => (
                        <option key={p}>{p}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Due date
                  <input
                    name="dueDate"
                    type="date"
                    defaultValue={record.dueDate?.slice(0, 10)}
                  />
                </label>
              </div>
              <label>
                Progress{" "}
                <input
                  name="progress"
                  type="number"
                  min="0"
                  max="99"
                  disabled={record.stage === 4}
                  defaultValue={record.progress || 0}
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </form>
            <div className="tabs detail-tabs">
              {["Activity", "Comments", "Checklists", "Attachments"].map(
                (t) => (
                  <button
                    key={t}
                    className={tab === t ? "selected" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
            {tab === "Activity" &&
              (record.activities?.length ? (
                record.activities.map((a) => (
                  <div className="activity" key={a.id}>
                    <span className="activity-dot" />
                    <div>
                      <strong>
                        {stages[a.fromStage]} → {stages[a.toStage]}
                      </strong>
                      <p>{a.reason || "Stage updated"}</p>
                      <small>{new Date(a.createdAt).toLocaleString()}</small>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">No stage transitions recorded yet.</p>
              ))}
            {tab === "Comments" && (
              <>
                <form onSubmit={comment}>
                  <label>
                    Add a comment
                    <textarea name="content" required maxLength={5000} />
                  </label>
                  <button className="secondary">Post comment</button>
                </form>
                {record.updates?.map((c) => (
                  <div className="activity" key={c.id}>
                    <div>
                      <strong>{c.authorName}</strong>
                      <p>{c.content}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
            {tab === "Checklists" &&
              (record.checklists?.length ? (
                record.checklists.map((c) => (
                  <section key={c.id}>
                    <h3>{c.title}</h3>
                    {c.items.map((i) => (
                      <p key={i.id}>
                        {i.isDone ? "☑" : "☐"} {i.text}
                      </p>
                    ))}
                  </section>
                ))
              ) : (
                <p className="muted">No checklists attached.</p>
              ))}
            {tab === "Attachments" &&
              (record.attachments?.length ? (
                record.attachments.map((a) => (
                  <p key={a.id}>
                    {a.fileName} · {a.fileSize}
                  </p>
                ))
              ) : (
                <p className="muted">No attachments uploaded.</p>
              ))}
          </div>
          <aside className="detail-aside">
            <p className="eyebrow">WORKFLOW</p>
            <Actions
              task={record}
              canReview={canReview}
              onTransition={async (t, s) => {
                await onTransition(t, s);
                load();
              }}
            />
            <hr />
            <p className="eyebrow">PROJECT</p>
            <p>{record.project?.name || "Unassigned"}</p>
            <p className="eyebrow">ASSIGNEES</p>
            {record.assignees?.map((a) => (
              <p key={a.id}>{a.employee?.fullName}</p>
            ))}
            {!record.assignees?.length && <p className="muted">No assignees</p>}
            <p className="eyebrow">APPROVAL</p>
            <p>
              {record.approvedBy || record.rejectedBy || "Pending submission"}
            </p>
            {record.rejectReason && (
              <p className="error">{record.rejectReason}</p>
            )}
          </aside>
        </div>
      )}
    </Modal>
  );
}
