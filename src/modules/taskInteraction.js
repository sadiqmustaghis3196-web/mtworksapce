export function availableStages(task, canReview) {
  return (
    {
      0: [1],
      1: [2],
      2: [3],
      3: canReview ? [4, 5] : [],
      4: canReview ? [2] : [],
      5: canReview ? [2] : [],
    }[task.stage] || []
  );
}
export function cardSurfaceClick(event, task, onOpen) {
  if (event.target.closest('button,a,input,select,textarea,[role="button"]'))
    return;
  if (window.getSelection()?.toString()) return;
  onOpen(task);
}
