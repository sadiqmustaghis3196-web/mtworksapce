import { useEffect, useState } from "react";
import DocumentEditor from "./DocumentEditor";
import { taskDocument, validateDocument } from "../../modules/taskDocument";
import { api } from "../../services/api";
import { stages } from "../tasks/TaskCard";
export default function TaskDocument({
  task,
  onSaved,
  onDirty,
  readOnly = false,
}) {
  const [blocks, setBlocks] = useState(() => taskDocument(task)),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) setBlocks(taskDocument(task));
  }, [task.documentBlocks]);
  async function save() {
    setSaving(true);
    setError("");
    try {
      await api(`/tasks/${task.id}`, {
        method: "PATCH",
        body: { documentBlocks: validateDocument(blocks) },
      });
      setDirty(false);
      setMessage("Document saved.");
      await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="document-live-context">
        <span>
          <small>STAGE</small>
          {stages[task.stage]}
        </span>
        <span>
          <small>ASSIGNED TO</small>
          {task.assignees?.map((a) => a.employee?.fullName).join(", ") ||
            "Unassigned"}
        </span>
        <span>
          <small>DEADLINE</small>
          {task.dueDate
            ? new Date(task.dueDate).toLocaleDateString("en-GB", {
                timeZone: "Asia/Karachi",
              })
            : "Not set"}
        </span>
        <span>
          <small>PROGRESS</small>
          {task.progress || 0}%
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <DocumentEditor
        task={task}
        value={blocks}
        onChange={(next) => {
          setBlocks(next);
          setDirty(true);
          setMessage("");
        }}
        onSave={readOnly ? undefined : save}
        readOnly={readOnly}
        saving={saving}
        dirty={dirty}
      />
    </>
  );
}
