import * as api from "../api/notification.js";
import { allPages } from "./admin_ui.js";
import { notificationRow } from "./admin_notification_data.js";

export function staffNotificationRow(row, role) {
  const result = notificationRow(row);
  // Use staff pages only; administrator management links are not staff shortcuts.
  const routes = {
    RECEPTION_ASSIGNMENT: "work_calendar.html",
    WORK_SCHEDULE: "work_calendar.html", SCHEDULE: "work_calendar.html",
    STAFF_LEAVE_REQUEST: "work_calendar.html#leave-history-title",
    NURSE_ASSIGNMENT: role === "nurse" ? "assignments.html" : "work_calendar.html",
    ENCOUNTER: role === "reception" ? "walk_in.html" : role === "doctor" ? "encounters.html" : "patients.html",
    PATIENT: role === "reception" ? "patients.html" : role === "doctor" ? "records.html" : "records.html",
  };
  return { ...result, target: routes[row.reference_type] || null };
}
export async function readStaffNotifications(role) {
  return (await allPages(api.listNotifications)).map(row => staffNotificationRow(row, role));
}
export async function openStaffNotification(row, role) {
  return staffNotificationRow((await api.markRead(row.id)).notification, role);
}
