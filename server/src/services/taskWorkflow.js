const transitions = Object.freeze({
  0: [1],
  1: [2],
  2: [3],
  3: [4, 5],
  4: [2],
  5: [2],
});
function validateTransition({ from, to, canReview, reason }) {
  if (!Number.isInteger(to) || !transitions[from]?.includes(to)) {
    const error = new Error("This stage transition is not allowed.");
    error.status = 409;
    throw error;
  }
  if ((from === 3 || from === 4 || from === 5) && !canReview) {
    const error = new Error("Reviewer permission is required.");
    error.status = 403;
    throw error;
  }
  if (to === 5 && !reason?.trim()) {
    const error = new Error("A rejection reason is required.");
    error.status = 400;
    throw error;
  }
}
module.exports = { transitions, validateTransition };
