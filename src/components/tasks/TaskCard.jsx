import {
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
      {[4, 5].includes(s) && canReview && (
        <button onClick={() => onTransition(task, 2)}>
          <RotateCcw size={12} /> Rework
        </button>
      )}
    </div>
  );
}
export default function TaskCard({ task, onOpen, onTransition, canReview }) {
  const names = task.assignees?.map((a) => a.employee?.fullName) || [];
  return (
    <article className="task-card">
      <div className="badges">
        <span className="badge category">{task.category}</span>
        {["High", "Urgent", "Critical"].includes(task.priority) && (
          <span className={`badge priority ${task.priority.toLowerCase()}`}>
            {task.priority}
          </span>
        )}
      </div>
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
