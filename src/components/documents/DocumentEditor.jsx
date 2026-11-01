import ImagePreview from "./ImagePreview";
import { useRef, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  ImagePlus,
  FileText,
  Printer,
  Save,
} from "lucide-react";
import { readFile } from "../../services/files";
import { printDocument } from "../../modules/taskDocument";
import "../../styles/taskDocument.css";
export function DocumentBlocks({ blocks }) {
  return blocks.map((b) => (
    <div className="document-render-block" key={b.id}>
      {b.type === "image" ? (
        <figure>
          <ImagePreview src={b.src} caption={b.caption} />
          {b.caption && <figcaption>{b.caption}</figcaption>}
        </figure>
      ) : b.type === "heading" ? (
        <h2>{b.text}</h2>
      ) : b.type === "divider" ? (
        <hr />
      ) : b.type === "list" ? (
        <ul>
          {b.text
            .split("\n")
            .filter(Boolean)
            .map((t, i) => (
              <li key={i}>{t}</li>
            ))}
        </ul>
      ) : (
        <p>{b.text}</p>
      )}
    </div>
  ));
}
function WorkflowSnapshot({ task }) {
  const names = [
    "Upcoming",
    "Today To Do",
    "In Progress",
    "Review",
    "Done",
    "Reject / Rework",
    "Revision & Updates",
  ];
  return (
    <section className="document-workflow-snapshot">
      <h2>Workflow & ownership</h2>
      <p>
        <strong>Stage:</strong> {names[task.stage] || "Upcoming"} ·{" "}
        <strong>Progress:</strong> {task.progress || 0}%
      </p>
      <p>
        <strong>Assigned to:</strong>{" "}
        {task.assignees?.map((a) => a.employee?.fullName).join(", ") ||
          "Unassigned"}
        <br />
        <strong>Deadline:</strong>{" "}
        {task.dueDate
          ? new Date(task.dueDate).toLocaleString("en-GB", {
              timeZone: "Asia/Karachi",
            }) + " PKT"
          : "Not set"}
      </p>
      {task.activities?.length > 0 && (
        <>
          <h3>Stage history</h3>
          <ul>
            {task.activities.map((a) => (
              <li key={a.id}>
                {names[a.fromStage]} → {names[a.toStage]} ·{" "}
                {a.reason || "Stage updated"}
              </li>
            ))}
          </ul>
        </>
      )}
      {task.dailyReports?.length > 0 && (
        <>
          <h3>Daily work reports</h3>
          {task.dailyReports.map((r) => (
            <p key={r.id}>
              <strong>
                {r.date} · {r.employeeName || r.employeeId}
              </strong>
              <br />
              {r.minutes} min · {r.progressBefore}% → {r.progressAfter}%<br />
              {r.summary}
              {r.blocker && (
                <>
                  <br />
                  Blocker: {r.blocker}
                </>
              )}
              {r.nextStep && (
                <>
                  <br />
                  Next: {r.nextStep}
                </>
              )}
            </p>
          ))}
        </>
      )}
      {task.revisions?.length > 0 && (
        <>
          <h3>Revision & Updates</h3>
          {task.revisions.map((r) => (
            <section key={r.id}>
              <h3>
                Revision #{r.number} · {r.status}
              </h3>
              <p>{r.reason}</p>
              {r.updates?.map((u) => (
                <p key={u.id}>
                  <strong>{u.authorName}</strong>
                  <br />
                  {u.content}
                </p>
              ))}
            </section>
          ))}
        </>
      )}
      {task.checklists?.map((c) => (
        <div key={c.id}>
          <h3>{c.title}</h3>
          <ul>
            {c.items.map((i) => (
              <li key={i.id}>
                {i.isDone ? "✓" : "○"} {i.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
export default function DocumentEditor({
  value,
  onChange,
  onSave,
  task = {},
  saving = false,
  dirty = false,
}) {
  const [mode, setMode] = useState("edit"),
    [type, setType] = useState("text"),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false);
  const fileRef = useRef(null),
    insertAt = useRef(null);
  function insert(block, index = value.length) {
    if (value.length >= 40) {
      setError("Use up to 40 document blocks.");
      return;
    }
    const next = [...value];
    next.splice(index, 0, { id: crypto.randomUUID(), ...block });
    onChange(next);
  }
  function add(index = value.length) {
    setError("");
    if (type === "image") {
      insertAt.current = index;
      fileRef.current.click();
    } else insert({ type, text: "" }, index);
  }
  function update(id, patch) {
    onChange(value.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function move(index, offset) {
    const next = [...value];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  }
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const f = await readFile(file);
      if (!["image/png", "image/jpeg"].includes(f.type))
        throw new Error("Choose a PNG or JPG image.");
      insert(
        { type: "image", src: f.data, caption: "" },
        insertAt.current ?? value.length,
      );
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <section
      className="task-document-editor"
      aria-label="Workflow document editor"
    >
      <div className="document-toolbar">
        <div>
          <FileText size={17} />
          <strong>Workflow document</strong>
          <span>{dirty ? "Unsaved changes" : "Text · images · notes"}</span>
        </div>
        <div>
          <button
            type="button"
            className={mode === "edit" ? "selected" : ""}
            onClick={() => setMode("edit")}
          >
            Edit document
          </button>
          <button
            type="button"
            className={mode === "preview" ? "selected" : ""}
            onClick={() => setMode("preview")}
          >
            Page preview
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                printDocument(task, value);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <Printer size={14} /> Print / Save PDF
          </button>
          {onSave && (
            <button
              type="button"
              className="primary"
              disabled={saving || uploading}
              onClick={onSave}
            >
              <Save size={14} />
              {saving ? "Saving…" : "Save document"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {mode === "edit" && (
        <div className="document-insert-bar">
          <label>
            Block type
            <select
              aria-label="Document block type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="text">Paragraph</option>
              <option value="heading">Heading</option>
              <option value="image">Image</option>
              <option value="list">Bullet list</option>
              <option value="divider">Divider</option>
            </select>
          </label>
          <button
            type="button"
            disabled={uploading || saving}
            onClick={() => add()}
          >
            <Plus size={14} /> Add block
          </button>
          <button
            type="button"
            disabled={uploading || saving}
            onClick={() => {
              insertAt.current = value.length;
              fileRef.current.click();
            }}
          >
            <ImagePlus size={14} /> Add image
          </button>
          <small>
            Insert text, an image, then more text. Move blocks into any order.
          </small>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        aria-label="Document image file"
        className="document-file-input"
        onChange={upload}
      />
      <div
        className={`document-paper ${mode === "preview" ? "is-preview" : ""}`}
      >
        <p className="document-brand">MT NEXUS GLOBAL · WORKFLOW</p>
        <h2 className="document-title">{task.title || "New task document"}</h2>
        {task.id && (
          <p className="document-reference">
            Task #{task.id} · {task.project?.name || "No project"}
          </p>
        )}
        {!value.length && (
          <p className="document-empty">
            Add your brief, requirements, reference images and delivery notes
            here.
          </p>
        )}
        {mode === "preview" ? (
          <DocumentBlocks blocks={value} />
        ) : (
          value.map((b, index) => (
            <div className="document-edit-block" key={b.id}>
              <div className="document-block-controls">
                <span>
                  {index + 1} · {b.type}
                </span>
                <button
                  type="button"
                  aria-label={`Move block ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Move block ${index + 1} down`}
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove block ${index + 1}`}
                  onClick={() => onChange(value.filter((x) => x.id !== b.id))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {b.type === "image" ? (
                <figure>
                  <ImagePreview src={b.src} caption={b.caption} />
                  <input
                    aria-label={`Image caption ${index + 1}`}
                    placeholder="Image caption…"
                    maxLength={1000}
                    value={b.caption}
                    onChange={(e) => update(b.id, { caption: e.target.value })}
                  />
                </figure>
              ) : b.type === "divider" ? (
                <hr />
              ) : (
                <textarea
                  className={
                    b.type === "heading" ? "document-heading-input" : ""
                  }
                  aria-label={`Document ${b.type} ${index + 1}`}
                  placeholder={
                    b.type === "heading"
                      ? "Section heading…"
                      : b.type === "list"
                        ? "One bullet per line…"
                        : "Write your text here…"
                  }
                  rows={b.type === "heading" ? 2 : 4}
                  maxLength={20000}
                  value={b.text}
                  onChange={(e) => update(b.id, { text: e.target.value })}
                />
              )}
              <button
                type="button"
                className="document-insert-after"
                disabled={uploading}
                onClick={() => add(index + 1)}
              >
                <Plus size={12} /> Insert {type === "text" ? "paragraph" : type}{" "}
                below
              </button>
            </div>
          ))
        )}
        {mode === "preview" && <WorkflowSnapshot task={task} />}
      </div>
      <p className="document-hint">
        PNG/JPG up to 1 MB each · 40 blocks · Print opens an A4 document with
        ownership, stage history and daily reports. Choose Save as PDF in the
        print dialog.
      </p>
    </section>
  );
}
