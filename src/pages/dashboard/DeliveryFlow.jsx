import {
  ClipboardList,
  Code2,
  FlaskConical,
  ShieldCheck,
  GitPullRequest,
  PackageCheck,
  RotateCcw,
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
export default function DeliveryFlow({
  counts,
  selected,
  onSelect,
  reworkCount,
  isToday,
}) {
  return (
    <section className="delivery-flow-panel">
      <header>
        <div>
          <p className="eyebrow">PLAN → BUILD → VERIFY → DELIVER</p>
          <h2>Daily delivery workflow</h2>
          <p>
            {isToday
              ? "Current phases for today’s assigned work"
              : "Phases last reported for this day"}
          </p>
        </div>
        <span>Click a stage to focus the worklist</span>
      </header>
      <div className="delivery-flow-scroll">
        <div className="delivery-flow">
          {deliveryPhases.map((phase, index) => {
            const Icon = icons[index];
            return (
              <button
                className={`delivery-step phase-${phase.id} ${selected === phase.id ? "selected" : ""}`}
                key={phase.id}
                aria-pressed={selected === phase.id}
                onClick={() =>
                  onSelect(selected === phase.id ? "all" : phase.id)
                }
              >
                <span className="delivery-step-top">
                  <i>
                    <Icon size={19} />
                  </i>
                  <b>{counts[phase.id] || 0}</b>
                </span>
                <strong>{phase.label}</strong>
                <small>{phase.description}</small>
                <span className="delivery-step-number">0{index + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
      <footer>
        <span className="workflow-return-line" />
        <button
          aria-pressed={selected === "rework"}
          className={selected === "rework" ? "selected" : ""}
          onClick={() => onSelect(selected === "rework" ? "all" : "rework")}
        >
          <RotateCcw size={13} /> Rework returns to build{" "}
          <strong>{reworkCount}</strong>
        </button>
        <span>
          Done means approved work; no deployment automation is connected.
        </span>
      </footer>
    </section>
  );
}
