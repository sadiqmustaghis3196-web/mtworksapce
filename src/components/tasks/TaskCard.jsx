import { isPreview } from "../../preview/config";
import { useRef } from "react";
import {
  availableStages,
  cardSurfaceClick,
} from "../../modules/taskInteraction";
import {
  GripVertical,
  CalendarDays,
  Folder,
  Flag,
  MessageSquare,
  Check,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
export const stages = [
  "Upcoming",
  "Today To Do",
  "In Progress",
  "Review",
  "Done",
  "Reject",
  "Revision & Updates",
];
export function Actions({ task, canReview, onTransition }) {
  const s = task.stage;
  return (
    <div className="task-actions">
      {s === 0 && (
        <button onClick={() => onTransition(task, 1)}>
          Plan for today <ArrowRight size={12} />
        </button>
      )}
      {s === 1 && (
        <button onClick={() => onTransition(task, 2)}>
          Start work <ArrowRight size={12} />
        </button>
      )}
      {s === 2 && (
        <button onClick={() => onTransition(task, 3)}>
          <MessageSquare size={12} /> Send for Review
        </button>
      )}
      {s === 3 && canReview && (
        <>
          <button className="approve" onClick={() => onTransition(task, 4)}>
            <Check size={14} /> Approve
          </button>
          <button onClick={() => onTransition(task, 5)}>✕ Reject</button>
        </>
      )}
      {isPreview && [2, 3, 4].includes(s) && canReview && (
        <button
          className="request-revision"
          onClick={() => onTransition(task, 6)}
        >
          <RotateCcw size={12} /> Request revision
        </button>
      )}
      {isPreview && s === 6 && (
        <button onClick={() => onTransition(task, 2)}>
          <RotateCcw size={12} /> Start revision
        </button>
      )}
      {[4, 5].includes(s) && canReview && (
        <button onClick={() => onTransition(task, 2)}>
          <RotateCcw size={12} /> Rework
        </button>
      )}
    </div>
  );
}
export default function TaskCard({
  task,
  onOpen,
  onTransition,
  canReview,
  onDragTask,
  onDragFinish,
  onTouchDrag,
  dragging,
  busy,
}) {
  const suppressClick = useRef(false);
  const moves = availableStages(task, canReview, isPreview);
  const names = task.assignees?.map((a) => a.employee?.fullName) || [];
  return (
    <article
      className={`task-card clickable-task-card ${dragging ? "is-dragging" : ""}`}
      tabIndex={0}
      role="group"
      aria-label={`Task #${task.id} ${task.title}`}
      draggable={!!onDragTask && !busy && moves.length > 0}
      onClick={(e) => {
        if (!suppressClick.current) cardSurfaceClick(e, task, onOpen);
      }}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && ["Enter", " "].includes(e.key)) {
          e.preventDefault();
          onOpen(task);
        }
      }}
      onDragStart={(e) => {
        if (
          e.target.closest("button,select,input,a") &&
          !e.target.closest(".task-drag-handle")
        ) {
          e.preventDefault();
          return;
        }
        suppressClick.current = true;
        e.dataTransfer.setData("text/plain", String(task.id));
        e.dataTransfer.effectAllowed = "move";
        onDragTask?.(task);
      }}
      onDragEnd={() => {
        onDragFinish?.();
        setTimeout(() => {
          suppressClick.current = false;
        }, 150);
      }}
    >
      {onDragTask && moves.length > 0 && (
        <div className="task-move-tools">
          <button
            type="button"
            className="task-drag-handle"
            aria-label={`Drag task #${task.id}`}
            title="Drag to a highlighted column"
            disabled={busy}
            onPointerDown={(e) => {
              if (e.pointerType !== "mouse") {
                e.preventDefault();
                onTouchDrag?.(task, e);
              }
            }}
          >
            <GripVertical size={16} /> Drag
          </button>
          <label>
            <select
              aria-label={`Move task #${task.id}`}
              value=""
              disabled={busy}
              onChange={(e) => {
                if (e.target.value !== "")
                  onTransition(task, Number(e.target.value));
              }}
            >
              <option value="">Move to…</option>
              {moves.map((i) => (
                <option value={i} key={i}>
                  {stages[i]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="badges">
        <span className="badge category">{task.category}</span>
        {task.stage === 2 &&
          ["testing", "quality"].includes(task.workPhase) && (
            <span className="badge work-phase">
              {task.workPhase === "testing" ? "Testing" : "Quality check"}
            </span>
          )}
        {["High", "Urgent", "Critical"].includes(task.priority) && (
          <span className={`badge priority ${task.priority.toLowerCase()}`}>
            {task.priority}
          </span>
        )}
      </div>
      {!!task.revisions?.length && (
        <span className="badge revision-badge">
          Revision #{task.revisions.at(-1).number} ·{" "}
          {task.revisions.at(-1).status}
        </span>
      )}
      <div className="task-project">
        <Folder size={13} />
        {task.project?.name || "No project assigned"}
      </div>
      <button className="task-title" onClick={() => onOpen(task)}>
        #{task.id} {task.title}
      </button>
      <div className="task-meta">
        <span>
          <Flag size={12} />
          {task.priority}
        </span>
        <span className="avatar" title={names.join(", ") || "Unassigned"}>
          {names[0]?.[0] || "–"}
        </span>
      </div>
      {[2, 4].includes(task.stage) && (
        <div className="progress-row">
          <progress value={task.progress || 0} max="100" />
          <span>{task.progress || 0}%</span>
        </div>
      )}
      <div className="task-date">
        <CalendarDays size={13} />
        {task.dueDate
          ? new Date(task.dueDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "No due date"}
      </div>
      <Actions task={task} canReview={canReview} onTransition={onTransition} />
    </article>
  );
}
