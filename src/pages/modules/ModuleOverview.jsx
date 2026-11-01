import { Link } from "react-router-dom";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { modulePanels } from "../../modules/insights";
export default function ModuleOverview({ module, data }) {
  const panels = modulePanels(module, data);
  if (!panels.length) return null;
  return (
    <div className="operations-overview">
      {panels.map((panel) => (
        <section
          className={`operations-panel ${panel.kind === "funnel" ? "funnel-panel" : ""}`}
          key={panel.title}
        >
          <header>
            <div>
              <p className="eyebrow">{panel.eyebrow}</p>
              <h2>{panel.title}</h2>
            </div>
            {panel.link && (
              <Link
                to={panel.link}
                aria-label={panel.linkLabel}
                title={panel.linkLabel}
              >
                <ArrowUpRight size={17} />
              </Link>
            )}
          </header>
          {panel.items.length ? (
            <div className="operations-items">
              {panel.items
                .slice(0, panel.kind === "funnel" ? 7 : 4)
                .map((item) => (
                  <Link
                    className={`operations-item tone-${item.tone || "normal"} ${panel.kind === "funnel" ? "funnel-item" : ""}`}
                    key={item.id}
                    to={item.href}
                  >
                    <div className="operations-item-main">
                      <strong>{item.label}</strong>
                      {item.detail && <small>{item.detail}</small>}
                    </div>
                    <span className="operations-value">
                      {item.value}
                      <ArrowUpRight size={12} />
                    </span>
                    {item.percent !== undefined && (
                      <span className="operations-progress">
                        <i
                          style={{
                            width: `${Math.max(0, Math.min(100, item.percent))}%`,
                          }}
                        />
                      </span>
                    )}
                  </Link>
                ))}
            </div>
          ) : (
            <div className="operations-empty">
              <CheckCircle2 size={20} />
              <p>{panel.empty || "No records to review."}</p>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
