const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateTransition } = require("../../src/services/taskWorkflow");
test("employee submits in-progress work for review", () =>
  assert.doesNotThrow(() =>
    validateTransition({ from: 2, to: 3, canReview: false }),
  ));
test("reviewer approves and rejects with reason", () => {
  for (const to of [4, 5])
    assert.doesNotThrow(() =>
      validateTransition({
        from: 3,
        to,
        canReview: true,
        reason: "Needs corrections",
      }),
    );
});
test("employees cannot approve, reject or reopen", () => {
  for (const [from, to] of [
    [3, 4],
    [3, 5],
    [4, 2],
    [5, 2],
  ])
    assert.throws(
      () => validateTransition({ from, to, canReview: false, reason: "x" }),
      { status: 403 },
    );
});
test("cannot skip stages or move from Done to Upcoming", () => {
  for (const [from, to] of [
    [0, 4],
    [2, 4],
    [4, 0],
    [2, 2],
  ])
    assert.throws(() => validateTransition({ from, to, canReview: true }), {
      status: 409,
    });
});
test("rejection requires a nonempty reason", () =>
  assert.throws(
    () => validateTransition({ from: 3, to: 5, canReview: true, reason: " " }),
    { status: 400 },
  ));
