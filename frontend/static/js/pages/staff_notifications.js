import { readStaffNotifications, openStaffNotification } from "../core/staff_notification_data.js";
import { staffReady } from "../core/staff_workspace.js";
import { initFeedbackPresentation } from "../core/admin_feedback_presentation.js";
import { enhanceDialogDismiss } from "../core/dialog_dismiss.js";

const modal = document.querySelector("#admin-dialog");
enhanceDialogDismiss(modal);
document.querySelector("#dialog-close").addEventListener("click", () => modal.close());

const user = await staffReady;
if (user) {
  const role = document.body.dataset.role;
  await initFeedbackPresentation("notifications", {
    staffRole: role,
    readNotifications: () => readStaffNotifications(role),
    readNotification: row => openStaffNotification(row, role),
  });
}
