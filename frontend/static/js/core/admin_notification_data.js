import * as api from '../api/notification.js';
import {allPages} from './admin_ui.js';
import {code} from './business_codes.js';
export function notificationTarget(row) {
  if(row.reference_type==='CONFIGURATION')return 'configuration.html';
  const id=Number(row.reference_id);
  if(!Number.isSafeInteger(id)||id<1)return null;
  const routes={RECEPTION_ASSIGNMENT:['reception_assignments.html','detail_id'],RECEPTION_WORKSTATION:['reception_assignments.html','workstation_id'],DOCTOR:['doctors.html','detail_id'],PATIENT:['patients.html','detail_id'],ENCOUNTER:['encounters.html','detail_id'],PAYMENT:['payments.html','payment_id'],STAFF_LEAVE_REQUEST:['schedule.html','leave_request_id'],ARTICLE:['articles.html','article_id'],WORK_SCHEDULE:['schedule.html','detail_id'],SCHEDULE:['schedule.html','detail_id'],REVIEW:['reviews.html','review_id'],ROOM:['rooms.html','detail_id'],DEPARTMENT:['departments.html','detail_id'],USER:['users.html','detail_id'],NURSE_ASSIGNMENT:['assignments.html','detail_id']};
  const route=routes[row.reference_type];
  if(!route)return null;
  return `${route[0]}?${route[1]}=${id}`;
}
export function notificationRow(row) {
  const prefixes={RECEPTION_ASSIGNMENT:'PC',RECEPTION_WORKSTATION:'QT',DOCTOR:'BS',PATIENT:'BN',ENCOUNTER:'LK',PAYMENT:'TT',STAFF_LEAVE_REQUEST:'NP',ARTICLE:'BV',WORK_SCHEDULE:'CA',SCHEDULE:'CA',REVIEW:'DG',ROOM:'PH',DEPARTMENT:'CK',USER:'TK',NURSE_ASSIGNMENT:'PC'};
  const type=({ENCOUNTER_STATUS:'ENCOUNTER',PAYMENT_RESULT:'PAYMENT',APPOINTMENT_REMINDER:'REMINDER'})[row.notification_type]||row.notification_type;
  return {...row,id:row.notification_id,type,is_read:Boolean(row.is_read),reference:prefixes[row.reference_type]?code(prefixes[row.reference_type],row.reference_id):'',target:notificationTarget(row)};
}
export async function readAdminNotifications() {return (await allPages(api.listNotifications)).map(notificationRow);}
export async function openNotification(row) {return notificationRow((await api.markRead(row.id)).notification);}
export const readAllNotifications=api.readAll;
