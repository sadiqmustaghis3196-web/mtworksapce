import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Building2,
  GraduationCap,
  ArrowUpRight,
  Clock3,
} from "lucide-react";
import { personWork, attendanceSummary } from "../../modules/peopleOperations";
import { stages } from "../../components/tasks/TaskCard";
import { collectionPath } from "../../modules/catalog";
const initials = (name) =>
  String(name || "NX")
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
const time = (n) => `${Math.floor(n / 60)}h ${n % 60}m`;
export function DirectoryCards({ entity, records, data, onOpen }) {
  const find = (key, id) =>
    data.records[key]?.find((r) => r.id === id) ||
    (key === "employees"
      ? data.referencePeople?.find((e) => e.id === id)
      : null);
  return (
    <div className="people-directory">
      {records.map((r) => {
        const person =
          entity === "employees"
            ? r
            : entity === "enrollments"
              ? find("employees", r.employeeId)
              : null;
        const work = person ? personWork(data, person.id) : null;
        const members =
          entity === "departments"
            ? data.records.employees.filter((e) => e.departmentId === r.id)
            : [];
        const title = person?.fullName || r.name || r.title || r.subject;
        const subtitle =
          person?.jobTitle ||
          r.description ||
          r.category ||
          r.type ||
          "Workspace team";
        return (
          <article
            key={r.id}
            className={`people-directory-card directory-${entity}`}
          >
            <header>
              <span className="person-avatar">
                {person ? (
                  initials(person.fullName)
                ) : entity === "departments" ? (
                  <Building2 size={25} />
                ) : (
                  <GraduationCap size={25} />
                )}
              </span>
              <span className="record-status">{r.status}</span>
            </header>
            <button className="directory-person-name" onClick={() => onOpen(r)}>
              {title}
            </button>
            <p>{subtitle}</p>
            {entity === "enrollments" && (
              <button className="employee-code-link" onClick={() => onOpen(r)}>
                {r.name}
              </button>
            )}
            {entity === "employees" && (
              <>
                <small>
                  {find("departments", r.departmentId)?.name} · {r.workMode}
                </small>
                <button
                  className="employee-code-link"
                  onClick={() => onOpen(r)}
                >
                  {r.employeeCode}
                </button>
                <div className="person-work-totals">
                  <span>
                    <strong>{work.active.length}</strong> Assigned / active
                  </span>
                  <span>
                    <strong>{work.done}</strong> Completed
                  </span>
                  <span>
                    <strong>{work.progress}%</strong> Overall task average
                  </span>
                </div>
              </>
            )}
            {entity === "enrollments" && (
              <>
                <small>
                  {find("programs", r.programId)?.name} · Mentor:{" "}
                  {find("employees", r.mentorId)?.fullName}
                </small>
                <progress max="100" value={r.progress || 0} />
                <p>
                  {r.progress || 0}% learning progress ·{" "}
                  {work?.active.length || 0} active assignments
                </p>
                <small>{r.startDate}</small>
              </>
            )}
            {entity === "departments" && (
              <>
                <small>
                  Lead:{" "}
                  {find("employees", r.managerId)?.fullName || "Unassigned"}
                </small>
                <div className="person-work-totals">
                  <span>
                    <strong>{members.length}</strong> People
                  </span>
                  <span>
                    <strong>
                      {
                        data.projects.filter((p) => p.departmentId === r.id)
                          .length
                      }
                    </strong>{" "}
                    Projects
                  </span>
                </div>
                <div className="department-people-dots">
                  {members.slice(0, 6).map((p) => (
                    <span title={p.fullName} key={p.id}>
                      {initials(p.fullName)}
                    </span>
                  ))}
                </div>
              </>
            )}
            {entity === "programs" && (
              <>
                <small>
                  Mentor:{" "}
                  {find("employees", r.mentorId)?.fullName || "Not assigned"}
                </small>
                <p>
                  {r.startDate} → {r.endDate}
                </p>
                <span>Capacity {r.capacity}</span>
              </>
            )}
            <button className="directory-open" onClick={() => onOpen(r)}>
              Open{" "}
              {entity === "departments"
                ? "department"
                : person
                  ? "profile"
                  : "program"}{" "}
              <ArrowUpRight size={14} />
            </button>
          </article>
        );
      })}
    </div>
  );
}
export function PersonProfile({ person, data }) {
  const [month, setMonth] = useState(
    new Date()
      .toLocaleDateString("en-CA", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
      })
      .slice(0, 7),
  );
  const work = personWork(data, person.id),
    attendance = attendanceSummary(data, person.id, month);
  return (
    <section className="person-profile-work">
      <header>
        <div>
          <p className="eyebrow">PERSON / WORK / ATTENDANCE</p>
          <h3>{person.fullName}’s work record</h3>
        </div>
        <label>
          Attendance month
          <input
            aria-label="Profile attendance month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </header>
      <div className="person-work-totals">
        <span>
          <strong>{work.active.length}</strong> Current assignments
        </span>
        <span>
          <strong>{work.done}</strong> Approved tasks
        </span>
        <span>
          <strong>{attendance.days}</strong> Recorded days
        </span>
        <span>
          <strong>{time(attendance.minutes)}</strong> Attendance hours
        </span>
        <span>
          <strong>{time(work.minutes)}</strong> Reported task time
        </span>
      </div>
      <h4>Assigned work and deadlines</h4>
      {work.tasks.length ? (
        <div className="person-assignment-list">
          {work.tasks.map((t) => (
            <Link to={`/projects?task=${t.id}`} key={t.id}>
              <span>
                <strong>
                  #{t.id} {t.title}
                </strong>
                <small>
                  {data.projects.find((p) => p.id === t.projectId)?.name} ·{" "}
                  {stages[t.stage]} ·{" "}
                  {t.dueDate ? "Due " + t.dueDate.slice(0, 10) : "No deadline"}
                </small>
              </span>
              <span>
                <progress max="100" value={t.progress || 0} />
                <b>{t.progress || 0}%</b>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p>No work assigned yet.</p>
      )}
      <h4>Recent work updates</h4>
      {work.entries.slice(0, 8).map((e) => (
        <article className="person-log" key={e.id}>
          <strong>
            {e.date} · {time(e.minutes)} · {e.progressBefore}% →{" "}
            {e.progressAfter}%
          </strong>
          <p>{e.summary}</p>
          {e.blocker && <p className="error">Blocker: {e.blocker}</p>}
        </article>
      ))}
      {!work.entries.length && (
        <p className="muted">No daily work report recorded yet.</p>
      )}
      <h4>Attendance history</h4>
      <div className="person-attendance-history">
        {attendance.rows.map((a) => (
          <div key={a.id}>
            <strong>{a.date}</strong>
            <span>
              {new Date(a.checkIn).toLocaleTimeString("en-GB", {
                timeZone: "Asia/Karachi",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              →{" "}
              {a.checkOut
                ? new Date(a.checkOut).toLocaleTimeString("en-GB", {
                    timeZone: "Asia/Karachi",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Still checked in"}
            </span>
            <b>{time(a.minutes || 0)}</b>
          </div>
        ))}
      </div>
      {!attendance.days && (
        <p className="muted">
          No attendance records in this month. Unrecorded days are not assumed
          absent.
        </p>
      )}
    </section>
  );
}
export function AttendanceRoster({ data, onEdit, canManage }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)),
    [person, setPerson] = useState("all");
  const people = data.records.employees.filter(
      (e) => person === "all" || e.id === person,
    ),
    total = attendanceSummary(data, person === "all" ? null : person, month);
  return (
    <section className="attendance-ledger">
      <header>
        <div>
          <p className="eyebrow">ATTENDANCE REGISTER</p>
          <h2>People, days and recorded hours</h2>
        </div>
        <label>
          Month
          <input
            aria-label="Attendance register month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label>
          Person
          <select
            aria-label="Attendance register employee"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          >
            <option value="all">All employees</option>
            {data.records.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="attendance-person-grid">
        {people.map((e) => {
          const a = attendanceSummary(data, e.id, month);
          return (
            <article key={e.id}>
              <span className="person-avatar">{initials(e.fullName)}</span>
              <strong>{e.fullName}</strong>
              <span>
                {a.days} recorded days · {time(a.minutes)}
              </span>
              <small>
                {a.open} open check-in{a.open === 1 ? "" : "s"}
              </small>
            </article>
          );
        })}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Date</th>
              <th>Arrival (PKT)</th>
              <th>Departure (PKT)</th>
              <th>Status</th>
              <th>Recorded time</th>
              {canManage && <th>Correction</th>}
            </tr>
          </thead>
          <tbody>
            {total.rows.map((a) => (
              <tr key={a.id}>
                <td>
                  {
                    data.records.employees.find((e) => e.id === a.employeeId)
                      ?.fullName
                  }
                </td>
                <td>{a.date}</td>
                <td>
                  {new Date(a.checkIn).toLocaleTimeString("en-GB", {
                    timeZone: "Asia/Karachi",
                  })}
                </td>
                <td>
                  {a.checkOut
                    ? new Date(a.checkOut).toLocaleTimeString("en-GB", {
                        timeZone: "Asia/Karachi",
                      })
                    : "Open"}
                </td>
                <td>{a.status}</td>
                <td>{time(a.minutes || 0)}</td>
                {canManage && (
                  <td>
                    <button className="link" onClick={() => onEdit(a)}>
                      Correct attendance
                    </button>
                    {a.corrections?.length > 0 && (
                      <details className="attendance-correction-history">
                        <summary>
                          {a.corrections.length} correction record
                          {a.corrections.length === 1 ? "" : "s"}
                        </summary>
                        {[...a.corrections].reverse().map((c) => (
                          <div key={c.id}>
                            <strong>{c.reason}</strong>
                            <p>
                              {c.actor} ·{" "}
                              {new Date(c.createdAt).toLocaleString("en-GB", {
                                timeZone: "Asia/Karachi",
                              })}{" "}
                              PKT
                            </p>
                            <small>
                              {c.before
                                ? time(c.before.minutes || 0)
                                : "New record"}{" "}
                              → {time(c.after.minutes || 0)}
                            </small>
                          </div>
                        ))}
                      </details>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-help">
        All times use Asia/Karachi. Corrections require a reason and retain the
        prior values in history.
      </p>
    </section>
  );
}
export function DepartmentProfile({ record, data }) {
  const members = data.records.employees.filter(
      (e) => e.departmentId === record.id,
    ),
    ids = new Set(members.map((e) => e.id)),
    tasks = data.tasks.filter((t) =>
      t.assignees?.some((a) => ids.has(a.employee?.id)),
    );
  return (
    <section className="department-profile">
      <h3>Department delivery pipeline</h3>
      <div className="department-delivery-flow">
        {[0, 1, 2, 3, 6, 4].map((stage) => (
          <div key={stage}>
            <strong>{tasks.filter((t) => t.stage === stage).length}</strong>
            <span>{stages[stage]}</span>
          </div>
        ))}
      </div>
      <h4>People in {record.name}</h4>
      <div className="department-member-grid">
        {members.map((e) => (
          <Link to={`/employees/${e.id}`} key={e.id}>
            <span className="person-avatar">{initials(e.fullName)}</span>
            <strong>{e.fullName}</strong>
            <small>
              {e.jobTitle} · {personWork(data, e.id).active.length} active tasks
            </small>
          </Link>
        ))}
      </div>
      {!members.length && <p>No people assigned to this department.</p>}
    </section>
  );
}
