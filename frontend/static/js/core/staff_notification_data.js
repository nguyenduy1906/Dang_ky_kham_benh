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
  const id=Number(row.reference_id);
  const encounterTarget=role==='reception'&&row.reference_type==='ENCOUNTER'&&Number.isSafeInteger(id)&&id>0
    ? `walk_in.html?encounter_id=${id}` : null;
  return { ...result, target: (role==='nurse'&&Number.isSafeInteger(id)&&id>0
    ? ({ENCOUNTER:`patients.html?encounter_id=${id}`,PATIENT:`records.html?patient_id=${id}`,NURSE_ASSIGNMENT:`assignments.html?assignment_id=${id}`,WORK_SCHEDULE:`assignments.html?schedule_id=${id}`,SCHEDULE:`assignments.html?schedule_id=${id}`})[row.reference_type] : null) || encounterTarget || (role==='doctor'&&Number.isSafeInteger(id)&&id>0
    ? row.reference_type==='ENCOUNTER'?`clinical.html?encounter_id=${id}&mode=view`:row.reference_type==='PATIENT'?`records.html?patient_id=${id}`:null : null) || routes[row.reference_type] || null };
}
export async function readStaffNotifications(role) {
  return (await allPages(api.listNotifications)).map(row => staffNotificationRow(row, role));
}
export async function openStaffNotification(row, role) {
  return staffNotificationRow((await api.markRead(row.id)).notification, role);
}
