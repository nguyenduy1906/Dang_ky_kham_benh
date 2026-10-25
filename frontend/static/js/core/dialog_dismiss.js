export function enhanceDialogDismiss(dialog, { closeButtons = [], canClose = () => true } = {}) {
  if (!dialog) return;
  dialog.workflowCanClose=canClose;
  for (const button of closeButtons.filter(Boolean)) {
    button.textContent = "Đóng";
    button.dataset.dialogDismiss = "true";
  }
  let startedOutside = false;
  function outside(event) {
    if (event.target !== dialog) return false;
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }
  dialog.addEventListener("pointerdown", event => { startedOutside = outside(event); });
  dialog.addEventListener("click", event => {
    const dismiss = startedOutside && outside(event);
    startedOutside = false;
    if (dismiss && canClose()) dialog.close();
  });
}
