import { isPreview } from "../../preview/config";
import { readFile } from "../../services/files";
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
    [tab, setTab] = useState("Activity"),
    [employees, setEmployees] = useState([]),
    [assigneeIds, setAssigneeIds] = useState([]),
    [subtasks, setSubtasks] = useState([]);
  async function load() {
    try {
      const loaded = (await api(`/tasks/${task.id}`)).data;
      setRecord(loaded);
      setAssigneeIds(loaded.assignees?.map((a) => a.employee.id) || []);
      if (isPreview) {
        setEmployees((await api("/workspace/employees")).data);
        setSubtasks(
          (await api("/tasks")).data.filter((t) => t.parentTaskId === task.id),
        );
      }
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
          ...(isPreview ? { startDate: f.startDate || null } : {}),
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
  async function change(path, body, method = "POST") {
    setBusy(true);
    try {
      setError("");
      await api(`/tasks/${task.id}${path}`, { method, body });
      await load();
      await onSaved();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function addChecklist(e) {
    e.preventDefault();
    if (
      await change("/checklists", {
        title: new FormData(e.currentTarget).get("title"),
      })
    )
      e.target.reset();
  }
  async function addItem(e, id) {
    e.preventDefault();
    if (
      await change(`/checklists/${id}/items`, {
        text: new FormData(e.currentTarget).get("text"),
      })
    )
      e.target.reset();
  }
  async function attach(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await change("/attachments", { file: await readFile(file) });
    } catch (e) {
      setError(e.message);
    }
  }
  async function subtask(e) {
    e.preventDefault();
    try {
      await api("/tasks", {
        method: "POST",
        body: {
          title: new FormData(e.currentTarget).get("title"),
          description: "Subtask",
          projectId: record.projectId,
          category: record.category,
          priority: record.priority,
          parentTaskId: task.id,
        },
      });
      e.target.reset();
      await load();
      await onSaved();
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
              {isPreview && (
                <label>
                  Start date
                  <input
                    name="startDate"
                    type="date"
                    defaultValue={record.startDate?.slice(0, 10)}
                  />
                </label>
              )}
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
              <p className="field-help">
                Overall progress is separate from daily reporting. Use the Daily
                dashboard to record time, today’s work and blockers.
              </p>
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </form>
            <div className="tabs detail-tabs">
              {[
                "Activity",
                "Comments",
                "Checklists",
                ...(isPreview ? ["Subtasks"] : []),
                "Attachments",
              ].map((t) => (
                <button
                  key={t}
                  className={tab === t ? "selected" : ""}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
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
            {tab === "Checklists" && (
              <>
                {isPreview && (
                  <form className="inline-task-form" onSubmit={addChecklist}>
                    <label>
                      New checklist
                      <input name="title" required maxLength={200} />
                    </label>
                    <button className="secondary" disabled={busy}>
                      Add checklist
                    </button>
                  </form>
                )}
                {record.checklists?.map((c) => (
                  <section className="task-checklist" key={c.id}>
                    <h3>
                      {c.title}
                      <small>
                        {c.items.filter((i) => i.isDone).length}/
                        {c.items.length}
                      </small>
                    </h3>
                    {c.items.map((i) => (
                      <label className="check" key={i.id}>
                        <input
                          type="checkbox"
                          checked={i.isDone}
                          disabled={!isPreview || busy}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setRecord((prev) => ({
                              ...prev,
                              checklists: prev.checklists.map((list) => ({
                                ...list,
                                items: list.items.map((item) =>
                                  item.id === i.id
                                    ? { ...item, isDone: checked }
                                    : item,
                                ),
                              })),
                            }));
                            change(
                              `/checklist-items/${i.id}`,
                              { isDone: checked },
                              "PATCH",
                            ).then((ok) => {
                              if (!ok) load();
                            });
                          }}
                        />
                        {i.text}
                      </label>
                    ))}
                    {isPreview && (
                      <form
                        className="inline-task-form"
                        onSubmit={(e) => addItem(e, c.id)}
                      >
                        <label>
                          New item for {c.title}
                          <input name="text" required maxLength={2000} />
                        </label>
                        <button className="secondary" disabled={busy}>
                          Add item
                        </button>
                      </form>
                    )}
                  </section>
                ))}
                {!record.checklists?.length && (
                  <p className="muted">No checklists yet.</p>
                )}
              </>
            )}
            {tab === "Subtasks" && (
              <>
                <form className="inline-task-form" onSubmit={subtask}>
                  <label>
                    Subtask title
                    <input name="title" required minLength={2} />
                  </label>
                  <button className="secondary">Add subtask</button>
                </form>
                {subtasks.map((t) => (
                  <div className="activity" key={t.id}>
                    <div>
                      <strong>
                        #{t.id} {t.title}
                      </strong>
                      <p>{stages[t.stage]}</p>
                    </div>
                  </div>
                ))}
                {!subtasks.length && <p className="muted">No subtasks yet.</p>}
              </>
            )}
            {tab === "Attachments" && (
              <>
                {isPreview && (
                  <label>
                    Upload attachment
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.txt,.docx"
                      onChange={attach}
                    />
                    <small className="field-help">
                      Maximum 1 MB · saved in this browser
                    </small>
                  </label>
                )}
                {record.attachments?.map((a) => (
                  <div className="activity" key={a.id}>
                    <a
                      className="attachment-download"
                      href={a.fileUrl}
                      download={a.fileName}
                    >
                      {a.fileName} · {a.fileSize}
                    </a>
                  </div>
                ))}
                {!record.attachments?.length && (
                  <p className="muted">No attachments uploaded.</p>
                )}
              </>
            )}
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
            {isPreview && canReview && (
              <form
                className="task-assign-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  change("/assign", { employeeIds: assigneeIds });
                }}
              >
                <label>
                  Assign project members
                  <select
                    multiple
                    value={assigneeIds}
                    onChange={(e) =>
                      setAssigneeIds(
                        Array.from(e.target.selectedOptions, (o) => o.value),
                      )
                    }
                  >
                    {employees
                      .filter(
                        (e) =>
                          !record.project?.memberIds?.length ||
                          record.project.memberIds.includes(e.id),
                      )
                      .map((e) => (
                        <option value={e.id} key={e.id}>
                          {e.fullName}
                        </option>
                      ))}
                  </select>
                </label>
                <button className="secondary" disabled={busy}>
                  Save assignees
                </button>
              </form>
            )}
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
