import { test } from "node:test";
import assert from "node:assert/strict";
import {
  updateRevisionRound,
  addRevisionUpdate,
} from "../src/modules/taskRevisions.js";
import { availableStages } from "../src/modules/taskInteraction.js";
import { phaseOf } from "../src/modules/dailyWork.js";
import { revisionHtml } from "../src/modules/taskDocument.js";
test("revision rounds preserve instructions, updates, approval and later client requests", () => {
  const t = { id: 1, progress: 100 };
  assert.throws(() => updateRevisionRound(t, 6, ""));
  assert.equal(t.revisions, undefined);
  updateRevisionRound(t, 6, "Client asks for a smaller header");
  assert.equal(t.progress, 99);
  addRevisionUpdate(t, "Updated the component layout");
  updateRevisionRound(t, 2);
  assert.equal(t.revisions[0].status, "In progress");
  updateRevisionRound(t, 3);
  assert.equal(t.revisions[0].status, "Under review");
  updateRevisionRound(t, 4);
  assert.equal(t.revisions[0].status, "Approved");
  assert.throws(() => addRevisionUpdate(t, "Cannot alter approved round"));
  updateRevisionRound(t, 6, "Another client request");
  assert.equal(t.revisions.length, 2);
  assert.equal(
    t.revisions[0].updates[0].content,
    "Updated the component layout",
  );
  assert.match(revisionHtml(t), /Revision #2/);
  assert.match(revisionHtml(t), /smaller header/);
});
test("revision stage is distinct and does not bypass reviewer-only change requests", () => {
  assert.equal(phaseOf({ stage: 6 }), "revision");
  assert.deepEqual(availableStages({ stage: 2 }, false, true), [3]);
  assert.deepEqual(availableStages({ stage: 3 }, true, true), [4, 5, 6]);
  assert.deepEqual(availableStages({ stage: 6 }, false, true), [2]);
  assert.deepEqual(availableStages({ stage: 4 }, true, true), [2, 6]);
});
