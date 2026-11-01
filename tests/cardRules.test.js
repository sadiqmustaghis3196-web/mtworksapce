import { test } from "node:test";
import assert from "node:assert/strict";
import { availableStages } from "../src/modules/taskInteraction.js";
test("drag and keyboard move targets preserve review gates and reviewer permissions", () => {
  assert.deepEqual(availableStages({ stage: 0 }, false), [1]);
  assert.deepEqual(availableStages({ stage: 1 }, false), [2]);
  assert.deepEqual(availableStages({ stage: 2 }, false), [3]);
  assert.deepEqual(availableStages({ stage: 3 }, false), []);
  assert.deepEqual(availableStages({ stage: 3 }, true), [4, 5]);
  assert.deepEqual(availableStages({ stage: 4 }, false), []);
  assert.deepEqual(availableStages({ stage: 5 }, false), []);
  assert.deepEqual(availableStages({ stage: 4 }, true), [2]);
  assert.deepEqual(availableStages({ stage: 5 }, true), [2]);
});
