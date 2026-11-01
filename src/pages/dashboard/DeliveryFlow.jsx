import {
  FileText,
  ClipboardList,
  Code2,
  FlaskConical,
  ShieldCheck,
  GitPullRequest,
  PackageCheck,
  RotateCcw,
  ArrowRight,
  Activity,
  Flag,
  Clock3,
} from "lucide-react";
import { deliveryPhases } from "../../modules/dailyWork";
const icons = [
  ClipboardList,
  Code2,
  FlaskConical,
  ShieldCheck,
  GitPullRequest,
  PackageCheck,
];
const paths = [
  "M300 210 H370",
  "M630 210 H700",
  "M960 210 H975 Q990 210 990 230 V430 Q990 450 970 450 H960",
  "M700 450 H630",
  "M370 450 H300",
];
export default function DeliveryFlow({
  counts,
  tasks = [],
  onOpenTask,
  selected,
  onSelect,
  reworkCount,
  isToday,
}) {
  return (
    <section className="delivery-flow-panel diagram-panel">
      <header>
        <div>
          <p className="eyebrow">PLAN → BUILD → VERIFY → DELIVER</p>
          <h2>Daily delivery workflow</h2>
          <p>
            {isToday
              ? "Follow today’s work from assignment to approval"
              : "Delivery phases recorded for this day"}
          </p>
        </div>
        <span>Click a stage to focus the worklist</span>
      </header>
      <div className="diagram-legend">
        <span>
          <i className="legend-live" /> Double border · work in progress
        </span>
        <span>
          <i className="legend-reported" /> Daily update recorded
        </span>
        <span>
          <i className="legend-waiting" /> Waiting for approval
        </span>
        <small>Arrows show workflow direction</small>
      </div>
      <div
        className="delivery-flow-scroll"
        tabIndex={0}
        aria-label="Delivery workflow diagram; scroll horizontally on smaller screens"
      >
        <div
          className={`delivery-diagram ${isToday ? "is-current-day" : "is-history"}`}
        >
          <div className="diagram-inputs">
            <div>
              <Flag size={18} />
              <strong>Daily plan</strong>
              <small>Owner · priority · deadline</small>
            </div>
            <div>
              <Activity size={18} />
              <strong>Work updates</strong>
              <small>Progress · time · blockers</small>
            </div>
            <div>
              <ShieldCheck size={18} />
              <strong>Quality evidence</strong>
              <small>Checks · notes · review</small>
            </div>
          </div>
          <svg
            className="diagram-connectors"
            viewBox="0 0 1000 560"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="workflow-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto-start-reverse"
              >
                <path
                  d="M0 0 L7 4 L0 8"
                  fill="none"
                  stroke="context-stroke"
                  strokeWidth="1.5"
                />
              </marker>
            </defs>
            {[170, 500, 830].map((x) => (
              <path
                key={x}
                className="diagram-input-line"
                d={`M${x} 78 V130`}
              />
            ))}
            {paths.map((d, i) => (
              <path
                key={d}
                d={d}
                markerEnd="url(#workflow-arrow)"
                className={`diagram-route ${isToday && counts[deliveryPhases[i].id] > 0 ? "route-moving" : ""}`}
              />
            ))}
            <path
              className={`diagram-rework ${isToday && reworkCount > 0 ? "route-moving" : ""}`}
              d="M830 370 V344 Q830 330 815 330 H515 Q500 330 500 315 V290"
              markerEnd="url(#workflow-arrow)"
            />
          </svg>
          <div className="delivery-flow">
            {deliveryPhases.map((phase, index) => {
              const Icon = icons[index];
              const phaseTasks = tasks.filter(
                (t) => t.reportedPhase === phase.id,
              );
              const updates = phaseTasks.reduce(
                (n, t) => n + (t.dayEntries?.length || 0),
                0,
              );
              const minutes = phaseTasks.reduce(
                (n, t) => n + (t.dayMinutes || 0),
                0,
              );
              const working =
                (counts[phase.id] || 0) > 0 &&
                ["development", "testing", "quality"].includes(phase.id);
              const waiting =
                (counts[phase.id] || 0) > 0 && phase.id === "review";
              return (
                <button
                  key={phase.id}
                  className={`delivery-step phase-${phase.id} ${working ? "has-work" : ""} ${waiting ? "awaiting-review" : ""} ${updates ? "has-reports" : ""} ${selected === phase.id ? "selected" : ""}`}
                  aria-pressed={selected === phase.id}
                  onClick={() =>
                    onSelect(selected === phase.id ? "all" : phase.id)
                  }
                >
                  <span className="delivery-step-top">
                    <i>
                      <Icon size={21} />
                    </i>
                    <b>{counts[phase.id] || 0}</b>
                  </span>
                  <strong>{phase.label}</strong>
                  <span className="diagram-stage-status">
                    <i />
                    {working
                      ? isToday
                        ? "Work in progress"
                        : "Recorded work"
                      : waiting
                        ? "Awaiting approval"
                        : phase.id === "done"
                          ? "Approved work"
                          : "Planned / queued"}
                  </span>
                  <span className="diagram-stage-stats">
                    <span>{updates} updates</span>
                    <span>
                      <Clock3 size={11} />
                      {minutes} min
                    </span>
                  </span>
                  <span className="delivery-step-number">0{index + 1}</span>
                </button>
              );
            })}
          </div>
          <span className="diagram-turn-label">Verify & continue</span>
          <span className="diagram-rework-label">
            <RotateCcw size={12} /> Revisions return to build
          </span>
          <span className="diagram-finish">
            <PackageCheck size={13} /> Approved & completed{" "}
            <ArrowRight size={13} />
          </span>
        </div>
      </div>
      <button
        type="button"
        className={`revision-pipeline-lane ${selected === "revision" ? "selected" : ""}`}
        aria-pressed={selected === "revision"}
        onClick={() => onSelect(selected === "revision" ? "all" : "revision")}
      >
        <RotateCcw size={18} />
        <span>
          <strong>Revision & Updates</strong>
          <small>Review → Revision → Build → Review</small>
        </span>
        <b>{tasks.filter((t) => t.reportedPhase === "revision").length}</b>
      </button>
      {selected !== "all" && (
        <section
          className="pipeline-task-documents"
          aria-label="Selected stage work"
        >
          <header>
            <h3>
              {selected === "rework"
                ? "Rework"
                : deliveryPhases.find((p) => p.id === selected)?.label ||
                  (selected === "revision"
                    ? "Revision & Updates"
                    : "Work")}{" "}
              · task documents
            </h3>
            <span>Click a task to edit its workflow document</span>
          </header>
          {tasks
            .filter((t) =>
              selected === "rework"
                ? t.stage === 5
                : t.reportedPhase === selected,
            )
            .map((t) => (
              <button type="button" key={t.id} onClick={() => onOpenTask?.(t)}>
                <FileText size={18} />
                <span>
                  <strong>
                    #{t.id} {t.title}
                  </strong>
                  <small>
                    {t.assignees?.map((a) => a.employee?.fullName).join(", ") ||
                      "Unassigned"}{" "}
                    · {t.reportedProgress ?? t.progress ?? 0}% ·{" "}
                    {t.dayMinutes || 0} min reported
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          {!tasks.some((t) =>
            selected === "rework"
              ? t.stage === 5
              : t.reportedPhase === selected,
          ) && <p>No tasks in this stage for the selected view.</p>}
        </section>
      )}
      <footer>
        <button
          aria-pressed={selected === "rework"}
          className={selected === "rework" ? "selected" : ""}
          onClick={() => onSelect(selected === "rework" ? "all" : "rework")}
        >
          <RotateCcw size={13} /> Rework returns to build{" "}
          <strong>{reworkCount}</strong>
        </button>
        <span>
          Stage counts and daily updates come from this view’s work. Done means
          approved work.
        </span>
      </footer>
    </section>
  );
}
