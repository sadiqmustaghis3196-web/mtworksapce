export function updateRevisionRound(
  task,
  to,
  reason,
  now = new Date().toISOString(),
) {
  if (to === 6) {
    const text = String(reason || "").trim();
    if (text.length < 5 || text.length > 2000)
      throw new Error("Describe the requested revision in 5–2,000 characters.");
    task.revisions ??= [];
    const previous = task.revisions.at(-1);
    if (previous && previous.status !== "Approved") {
      previous.status = "Superseded";
      previous.closedAt = now;
    }
    task.revisions.push({
      id: crypto.randomUUID(),
      number: task.revisions.length + 1,
      reason: text,
      status: "Requested",
      requestedBy: "Preview Admin",
      requestedAt: now,
      updates: [],
    });
    task.progress = Math.min(Number(task.progress) || 0, 99);
    task.approvedBy = null;
    task.revisionReason = text;
    return;
  }
  const current = task.revisions?.at(-1);
  if (!current || ["Approved", "Superseded"].includes(current.status)) return;
  if (to === 2) {
    current.status = "In progress";
    current.startedAt ??= now;
  }
  if (to === 3) {
    current.status = "Under review";
    current.submittedAt = now;
  }
  if (to === 4) {
    current.status = "Approved";
    current.approvedAt = now;
    task.revisionReason = "";
  }
  if (to === 5) current.status = "Rework requested";
}
export function addRevisionUpdate(
  task,
  content,
  now = new Date().toISOString(),
) {
  const current = task.revisions?.at(-1),
    text = String(content || "").trim();
  if (!current || ["Approved", "Superseded"].includes(current.status))
    throw new Error("There is no open revision to update.");
  if (text.length < 3 || text.length > 5000)
    throw new Error("Write an update in 3–5,000 characters.");
  const entry = {
    id: crypto.randomUUID(),
    content: text,
    authorName: "Preview Admin",
    createdAt: now,
  };
  current.updates.push(entry);
  task.updates ??= [];
  task.updates.unshift({
    ...entry,
    content: `Revision #${current.number}: ${text}`,
  });
  return entry;
}
