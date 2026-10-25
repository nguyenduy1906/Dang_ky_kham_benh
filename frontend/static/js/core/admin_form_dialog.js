import { enhanceDialogDismiss } from "./dialog_dismiss.js";

export function batchFinishedSuccessfully(results,expected,isSuccessful) {
  return expected>0&&results.length===expected&&results.every(isSuccessful);
}

// Creation forms sit above the existing list without replacing or hiding it.
export function openAdminFormDialog({ title, trigger, canClose = () => true, onClose = () => {} }) {
  const dialog = document.createElement("dialog");
  dialog.className = "admin-bulk-form-dialog";dialog.setAttribute("data-workflow-editor","true");
  dialog.setAttribute("aria-label", title);
  const heading = document.createElement("div");heading.className = "section-heading";
  const label = document.createElement("h2");label.textContent = title;label.tabIndex = -1;
  const button = document.createElement("button");button.type = "button";button.className = "secondary";button.textContent = "Đóng";
  heading.append(label, button);
  const content = document.createElement("div");
  dialog.append(heading, content);document.body.append(dialog);
  const close = () => { if (canClose()) dialog.close(); };
  const leave = () => { dialog.close(); };
  button.addEventListener("click", close);
  dialog.addEventListener("cancel", event => { if (!canClose()) event.preventDefault(); });
  enhanceDialogDismiss(dialog, { canClose });
  dialog.addEventListener("close", () => {
    window.removeEventListener("pagehide", leave);window.removeEventListener("neu:auth-change", leave);
    onClose();dialog.remove();if(trigger?.isConnected)trigger.focus();
  }, { once: true });
  window.addEventListener("pagehide", leave, { once: true });window.addEventListener("neu:auth-change", leave, { once: true });
  dialog.showModal();label.focus();
  return { dialog, content, close };
}
