export function availableStages(task, canReview, revisions = false) {
  return (
    {
      0: [1],
      1: [2],
      2: canReview && revisions ? [3, 6] : [3],
      3: canReview ? (revisions ? [4, 5, 6] : [4, 5]) : [],
      4: canReview ? (revisions ? [2, 6] : [2]) : [],
      5: canReview ? [2] : [],
      6: revisions ? [2] : [],
    }[task.stage] || []
  );
}
export function cardSurfaceClick(event, task, onOpen) {
  if (event.target.closest('button,a,input,select,textarea,[role="button"]'))
    return;
  if (window.getSelection()?.toString()) return;
  onOpen(task);
}
