export const documentTypes = ["heading", "text", "image", "list", "divider"];
export function validateDocument(blocks) {
  if (!Array.isArray(blocks) || blocks.length > 40)
    throw new Error("Use up to 40 document blocks.");
  const ids = new Set();
  const result = blocks.map((block) => {
    if (
      !block ||
      !documentTypes.includes(block.type) ||
      typeof block.id !== "string" ||
      ids.has(block.id)
    )
      throw new Error("Invalid document block.");
    ids.add(block.id);
    if (block.type === "image") {
      if (
        typeof block.src !== "string" ||
        !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(block.src) ||
        block.src.length > 1400000
      )
        throw new Error("Use PNG or JPG images up to 1 MB.");
      return {
        id: block.id,
        type: block.type,
        src: block.src,
        caption: String(block.caption || "").slice(0, 1000),
      };
    }
    const text = String(block.text || "");
    if (text.length > 20000)
      throw new Error("Each text block allows up to 20,000 characters.");
    return { id: block.id, type: block.type, text };
  });
  if (JSON.stringify(result).length > 2500000)
    throw new Error(
      "This document is too large. Use fewer or smaller images (2.5 MB total).",
    );
  return result;
}
export function taskDocument(task) {
  return (
    task.documentBlocks ??
    (task.description
      ? [{ id: "original-description", type: "text", text: task.description }]
      : [])
  );
}
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function blocksHtml(blocks) {
  return validateDocument(blocks)
    .map((b) =>
      b.type === "image"
        ? `<figure><img src="${b.src}" alt="${escapeHtml(b.caption)}"/><figcaption>${escapeHtml(b.caption)}</figcaption></figure>`
        : b.type === "divider"
          ? "<hr/>"
          : b.type === "heading"
            ? `<h2>${escapeHtml(b.text)}</h2>`
            : b.type === "list"
              ? `<ul>${b.text
                  .split("\n")
                  .filter(Boolean)
                  .map((t) => `<li>${escapeHtml(t)}</li>`)
                  .join("")}</ul>`
              : `<p>${escapeHtml(b.text)}</p>`,
    )
    .join("");
}
const stageNames = [
  "Upcoming",
  "Today To Do",
  "In Progress",
  "Review",
  "Done",
  "Reject / Rework",
  "Revision & Updates",
];
export function revisionHtml(task) {
  return task.revisions?.length
    ? "<h3>Revision & Updates</h3>" +
        task.revisions
          .map(
            (r) =>
              `<section><h3>Revision #${Number(r.number)} · ${escapeHtml(r.status)}</h3><p>${escapeHtml(r.reason)}</p>${(r.updates || []).map((u) => `<p><strong>${escapeHtml(u.authorName)}</strong><br/>${escapeHtml(u.content)}</p>`).join("")}</section>`,
          )
          .join("")
    : "";
}
export function workflowHtml(task) {
  const e = escapeHtml;
  return `<section class="workflow-summary"><h2>Workflow & ownership</h2><p><strong>Stage:</strong> ${e(stageNames[task.stage] || "Upcoming")} · <strong>Progress:</strong> ${Number(task.progress) || 0}%</p><p><strong>Project:</strong> ${e(task.project?.name || "Unassigned")}<br/><strong>Assigned to:</strong> ${e(
    task.assignees
      ?.map((a) => a.employee?.fullName)
      .filter(Boolean)
      .join(", ") || "Unassigned",
  )}<br/><strong>Deadline:</strong> ${e(task.dueDate ? new Date(task.dueDate).toLocaleString("en-GB", { timeZone: "Asia/Karachi" }) + " PKT" : "Not set")}</p>${task.activities?.length ? `<h3>Stage history</h3><ul>${task.activities.map((a) => `<li>${e(stageNames[a.fromStage])} → ${e(stageNames[a.toStage])} · ${e(a.reason || "Stage updated")}</li>`).join("")}</ul>` : ""}${task.dailyReports?.length ? `<h3>Daily work reports</h3>${task.dailyReports.map((r) => `<p><strong>${e(r.date)}</strong> · ${e(r.employeeName || r.employeeId)} · ${Number(r.minutes) || 0} min · ${Number(r.progressBefore) || 0}% → ${Number(r.progressAfter) || 0}%<br/>${e(r.summary)}${r.blocker ? "<br/>Blocker: " + e(r.blocker) : ""}${r.nextStep ? "<br/>Next: " + e(r.nextStep) : ""}</p>`).join("")}` : ""}${revisionHtml(task)}</section>`;
}
export function printableDocument(task, blocks) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(task.title)} — Workflow</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:12pt/1.65 Arial,sans-serif;color:#17243b;max-width:760px;margin:30px auto;padding:0 20px}h1{font-size:26pt;line-height:1.2}h2{font-size:17pt;break-after:avoid}p,li{white-space:pre-wrap;overflow-wrap:anywhere}figure{margin:24px 0;break-inside:avoid}img{max-width:100%;max-height:220mm;object-fit:contain}figcaption{font-size:10pt;color:#526079}hr{border:0;border-top:1px solid #c7cfdd;margin:25px 0}.brand{letter-spacing:3px;color:#55708e;font-size:9pt}.workflow-summary{border-top:2px solid #22a8c6;margin-top:35px;padding-top:15px}button{padding:12px 20px;background:#183650;color:white;border:0;border-radius:6px;cursor:pointer}@media print{body{margin:0;padding:0;max-width:none}button,.print-help{display:none}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><p class="print-help">Choose “Save as PDF” in the print dialog. Images and text keep their document order.</p><p class="brand">MT NEXUS GLOBAL · WORKFLOW DOCUMENT</p><h1>${escapeHtml(task.title)}</h1><p>Task #${escapeHtml(task.id || "Draft")}</p>${blocksHtml(blocks)}${workflowHtml(task)}${task.checklists?.length ? "<h2>Checklists</h2>" + task.checklists.map((c) => "<h3>" + escapeHtml(c.title) + "</h3><ul>" + c.items.map((i) => "<li>" + (i.isDone ? "[Done] " : "[Pending] ") + escapeHtml(i.text) + "</li>").join("") + "</ul>").join("") : ""}${task.updates?.length ? "<h2>Comments & updates</h2>" + task.updates.map((u) => "<p><strong>" + escapeHtml(u.authorName) + "</strong><br/>" + escapeHtml(u.content) + "</p>").join("") : ""}</body></html>`;
}
export function printDocument(task, blocks) {
  const html = printableDocument(task, blocks);
  const tab = window.open("", "_blank");
  if (!tab)
    throw new Error("Allow the document window to open, then try again.");
  tab.opener = null;
  tab.document.open();
  tab.document.write(html);
  tab.document.close();
}
