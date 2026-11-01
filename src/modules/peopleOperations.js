import { dateInKarachi } from "./dailyWork.js";
export function attendanceSummary(data, employeeId, month) {
  const rows = data.records.attendance.filter(
    (a) =>
      (!employeeId || a.employeeId === employeeId) &&
      (!month || a.date?.startsWith(month)),
  );
  return {
    days: new Set(rows.map((a) => a.date)).size,
    minutes: rows.reduce(
      (s, a) => s + (a.checkOut ? Number(a.minutes) || 0 : 0),
      0,
    ),
    open: rows.filter((a) => !a.checkOut).length,
    rows: rows.sort((a, b) => b.date.localeCompare(a.date)),
  };
}
export function personWork(data, id) {
  const tasks = data.tasks.filter((t) =>
    t.assignees?.some((a) => a.employee?.id === id),
  );
  const entries = (data.dailyWork?.entries || []).filter(
    (e) => e.employeeId === id,
  );
  return {
    tasks,
    active: tasks.filter((t) => t.stage !== 4),
    done: tasks.filter((t) => t.stage === 4).length,
    minutes: entries.reduce((s, e) => s + e.minutes, 0),
    entries: [...entries].reverse(),
    progress: tasks.length
      ? Math.round(
          tasks.reduce((s, t) => s + (Number(t.progress) || 0), 0) /
            tasks.length,
        )
      : 0,
  };
}
export function localAttendanceTime(value) {
  if (!value) return "";
  const n = Date.parse(value);
  return Number.isFinite(n)
    ? new Date(n + 5 * 3600000).toISOString().slice(0, 16)
    : "";
}
export function correctAttendance(data, id, input, actor) {
  const employee = data.records.employees.find(
    (e) => e.id === input.employeeId,
  );
  if (!employee) throw new Error("Choose a valid employee.");
  const date = String(input.date || ""),
    reason = String(input.correctionReason || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || reason.length < 5)
    throw new Error(
      "Choose a date and give a correction reason of at least 5 characters.",
    );
  const parse = (value) =>
    value
      ? Date.parse(
          /[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : value + ":00+05:00",
        )
      : null;
  const start = parse(input.checkIn),
    end = parse(input.checkOut),
    breakMinutes = Number(input.breakMinutes || 0);
  if (
    !Number.isFinite(start) ||
    dateInKarachi(start) !== date ||
    (end !== null &&
      (!Number.isFinite(end) || end < start || end - start > 86400000)) ||
    !Number.isInteger(breakMinutes) ||
    breakMinutes < 0 ||
    breakMinutes > 480 ||
    (end !== null && breakMinutes > (end - start) / 60000)
  )
    throw new Error(
      "Check the attendance times. Check-out must follow check-in, within 24 hours, and breaks must fit inside the shift.",
    );
  if (start > Date.now() + 60000 || (end !== null && end > Date.now() + 60000))
    throw new Error(
      "Attendance can only record actual arrival and departure, not future times.",
    );
  if (
    data.records.attendance.some(
      (a) =>
        a.id !== id && a.employeeId === input.employeeId && a.date === date,
    )
  )
    throw new Error("Attendance already exists for this employee and date.");
  let record = data.records.attendance.find((a) => a.id === id);
  if (id && !record) throw new Error("Attendance record not found.");
  const before = record
    ? {
        employeeId: record.employeeId,
        date: record.date,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        minutes: record.minutes,
        breakMinutes: record.breakMinutes || 0,
      }
    : null;
  const values = {
    employeeId: employee.id,
    date,
    checkIn: new Date(start).toISOString(),
    checkOut: end === null ? "" : new Date(end).toISOString(),
    breakMinutes,
    minutes:
      end === null ? 0 : Math.floor((end - start) / 60000) - breakMinutes,
    status: end === null ? "Checked in" : "Checked out",
    correctionReason: reason,
  };
  if (!record) {
    record = { id: crypto.randomUUID(), corrections: [] };
    data.records.attendance.unshift(record);
  }
  record.corrections ??= [];
  record.corrections.push({
    id: crypto.randomUUID(),
    reason,
    before,
    after: values,
    actor: actor.email,
    createdAt: new Date().toISOString(),
  });
  Object.assign(record, values);
  data.records.auditLogs.unshift({
    id: crypto.randomUUID(),
    action: "ATTENDANCE_CORRECTED",
    entity: "attendance",
    recordId: record.id,
    actor: actor.email,
    detail: `${employee.fullName} · ${date}: ${reason}`,
    createdAt: new Date().toISOString(),
  });
  return record;
}
