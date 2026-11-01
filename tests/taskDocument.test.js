import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDocument,
  taskDocument,
  blocksHtml,
  printableDocument,
} from "../src/modules/taskDocument.js";
const image = {
  id: "img",
  type: "image",
  src: "data:image/png;base64,aGVsbG8=",
  caption: "Reference <image>",
};
test("legacy descriptions become editable text; an explicitly empty document stays empty", () => {
  assert.equal(
    taskDocument({ description: "Original brief" })[0].text,
    "Original brief",
  );
  assert.deepEqual(
    taskDocument({ description: "Old", documentBlocks: [] }),
    [],
  );
});
test("ordered text/image/text renders in the same order with escaped text", () => {
  const html = blocksHtml([
    { id: "one", type: "text", text: "Before <script>alert(1)</script>" },
    image,
    { id: "two", type: "text", text: "After" },
  ]);
  assert.ok(html.indexOf("Before") < html.indexOf("<img"));
  assert.ok(html.indexOf("<img") < html.indexOf("After"));
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Reference &lt;image&gt;/);
});
test("rejects SVG, remote image URLs, invalid blocks, duplicate IDs and oversized documents", () => {
  for (const blocks of [
    [{ ...image, src: "data:image/svg+xml;base64,aGVsbG8=" }],
    [{ ...image, src: "https://example.com/a.png" }],
    [{ id: "a", type: "script" }],
    [
      { id: "x", type: "text" },
      { id: "x", type: "text" },
    ],
    [{ id: "x", type: "text", text: "a".repeat(20001) }],
    Array.from({ length: 41 }, (_, i) => ({ id: String(i), type: "text" })),
  ])
    assert.throws(() => validateDocument(blocks));
});
test("print document contains current ownership, deadlines, stage history, daily reports and checklists", () => {
  const html = printableDocument(
    {
      id: 12,
      title: "Client <portal>",
      stage: 3,
      progress: 80,
      project: { name: "Portal" },
      assignees: [{ employee: { fullName: "Ali" } }],
      dueDate: "2026-11-01T12:00:00Z",
      activities: [{ fromStage: 2, toStage: 3, reason: "Ready <review>" }],
      dailyReports: [
        {
          date: "2026-11-01",
          employeeName: "Ali",
          minutes: 45,
          progressBefore: 60,
          progressAfter: 80,
          summary: "Mobile testing",
          blocker: "API",
          nextStep: "Accessibility",
        },
      ],
      checklists: [
        {
          title: "Delivery",
          items: [{ text: "Keyboard checks", isDone: true }],
        },
      ],
    },
    [image],
  );
  for (const text of [
    "Client &lt;portal&gt;",
    "Ali",
    "Review",
    "60% → 80%",
    "Mobile testing",
    "Ready &lt;review&gt;",
    "Keyboard checks",
    "Save as PDF",
    "@page",
    "<img",
  ])
    assert.ok(html.includes(text), text);
});
