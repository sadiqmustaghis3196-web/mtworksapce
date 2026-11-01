import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { State } from "../common/UI";
import { stages } from "./TaskCard";
const day = 86400000;
const dateKey = (d) => d.toISOString().slice(0, 10);
const parse = (value) => {
  const time = Date.parse(`${String(value || "").slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(time) ? time : null;
};
export function TaskCalendar({ tasks, onOpen }) {
  const [month, setMonth] = useState(() => {
    const initial =
      tasks.find((t) => t.dueDate)?.dueDate || new Date().toISOString();
    const d = new Date(initial);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  });
  const offset = (month.getUTCDay() + 6) % 7,
    days = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
    ).getUTCDate(),
    cells = Math.ceil((offset + days) / 7) * 7;
  const move = (delta) =>
    setMonth(
      new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1),
      ),
    );
  return (
    <section className="schedule-panel">
      <div className="schedule-toolbar">
        <h2>
          <CalendarDays size={18} />
          {month.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </h2>
        <div>
          <button
            className="icon"
            aria-label="Previous month"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="secondary"
            onClick={() => {
              const n = new Date();
              setMonth(
                new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)),
              );
            }}
          >
            Today
          </button>
          <button
            className="icon"
            aria-label="Next month"
            onClick={() => move(1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="calendar-scroll">
        <div className="month-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div className="weekday" key={d}>
              {d}
            </div>
          ))}
          {Array.from({ length: cells }, (_, i) => {
            const date = new Date(month.getTime() + (i - offset) * day),
              key = dateKey(date),
              matching = tasks.filter((t) => t.dueDate?.slice(0, 10) === key);
            return (
              <div
                className={`month-day ${date.getUTCMonth() !== month.getUTCMonth() ? "other-month" : ""}`}
                key={key}
              >
                <span className={key === dateKey(new Date()) ? "today" : ""}>
                  {date.getUTCDate()}
                </span>
                {matching.map((t) => (
                  <button
                    key={t.id}
                    title={`${t.title} · ${stages[t.stage]}`}
                    className={`calendar-event stage-${t.stage}`}
                    onClick={() => onOpen(t)}
                  >
                    #{t.id} {t.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {tasks.some((t) => !t.dueDate) && (
        <div className="unscheduled-tasks">
          <h3>Unscheduled tasks</h3>
          {tasks
            .filter((t) => !t.dueDate)
            .map((t) => (
              <button
                className="secondary"
                key={t.id}
                onClick={() => onOpen(t)}
              >
                #{t.id} {t.title}
              </button>
            ))}
        </div>
      )}
    </section>
  );
}
export function TaskTimeline({ tasks, onOpen }) {
  const [zoom, setZoom] = useState(28);
  if (!tasks.length) return <State>No tasks to show on the timeline.</State>;
  const dates = tasks
      .flatMap((t) => [parse(t.startDate || t.createdAt), parse(t.dueDate)])
      .filter((t) => t !== null),
    first = Math.min(...dates),
    last = Math.max(...dates),
    span = Math.max(1, Math.ceil((last - first) / day) + 1),
    days = Math.min(span, 730),
    width = days * zoom;
  return (
    <section className="schedule-panel">
      <div className="schedule-toolbar">
        <h2>Project timeline</h2>
        <label>
          Day width
          <select
            aria-label="Timeline zoom"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value="20">Compact</option>
            <option value="28">Comfortable</option>
            <option value="40">Detailed</option>
          </select>
        </label>
      </div>
      <p className="timeline-caption">
        Start date (or created date) → due date · bar length follows actual
        dates
      </p>
      <div className="gantt-scroll">
        <div className="gantt" style={{ minWidth: 210 + width }}>
          <div className="gantt-axis">
            <span>Task</span>
            <div style={{ width }}>
              {Array.from({ length: days }, (_, i) => {
                const date = new Date(first + i * day);
                return (
                  <span style={{ width: zoom }} title={dateKey(date)} key={i}>
                    {date.getUTCDate() === 1
                      ? date.toLocaleDateString("en-GB", {
                          month: "short",
                          timeZone: "UTC",
                        })
                      : date.getUTCDate()}
                  </span>
                );
              })}
            </div>
          </div>
          {tasks.map((t) => {
            const start = parse(t.startDate || t.createdAt) ?? first,
              end = Math.max(start, parse(t.dueDate) ?? start),
              left =
                Math.max(0, Math.min(days - 1, (start - first) / day)) * zoom,
              length = Math.max(
                zoom,
                Math.min(width - left, ((end - start) / day + 1) * zoom),
              );
            return (
              <button
                className="gantt-row"
                key={t.id}
                onClick={() => onOpen(t)}
                aria-label={`Timeline task #${t.id} ${t.title}`}
              >
                <span>
                  #{t.id} {t.title}
                </span>
                <div
                  className="gantt-track"
                  style={{ width, backgroundSize: `${zoom}px 100%` }}
                >
                  <div
                    className={`gantt-bar stage-${t.stage}`}
                    style={{ left, width: length }}
                    title={`${new Date(start).toISOString().slice(0, 10)} → ${t.dueDate?.slice(0, 10) || "Unscheduled"}`}
                  >
                    <i style={{ width: `${t.progress || 0}%` }} />
                    <span>
                      {stages[t.stage]} · {t.progress || 0}%
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {span > 730 && (
        <p className="module-disclaimer">
          Showing the first two years. Filter by project to narrow this
          timeline.
        </p>
      )}
    </section>
  );
}
