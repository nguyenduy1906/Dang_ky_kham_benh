import * as api from '../api/notification.js';
import {allPages} from './admin_ui.js';
import {code} from './business_codes.js';
export function notificationTarget(row) {
  if(row.reference_type==='CONFIGURATION')return 'configuration.html';
  const id=Number(row.reference_id);
  if(!Number.isSafeInteger(id)||id<1)return null;
  const routes={ENCOUNTER:['encounters.html','detail_id'],PAYMENT:['payments.html','payment_id'],STAFF_LEAVE_REQUEST:['schedule.html','leave_request_id'],ARTICLE:['articles.html','article_id'],WORK_SCHEDULE:['schedule.html','detail_id'],SCHEDULE:['schedule.html','detail_id'],REVIEW:['reviews.html','review_id'],ROOM:['rooms.html','detail_id'],DEPARTMENT:['departments.html','detail_id'],USER:['users.html','detail_id'],NURSE_ASSIGNMENT:['assignments.html','detail_id']};
  const route=routes[row.reference_type];
  if(!route)return null;
  return `${route[0]}?${route[1]}=${id}`;
}
export function notificationRow(row) {
  const prefixes={ENCOUNTER:'LK',PAYMENT:'TT',STAFF_LEAVE_REQUEST:'NP',ARTICLE:'BV',WORK_SCHEDULE:'CA',SCHEDULE:'CA',REVIEW:'DG',ROOM:'PH',DEPARTMENT:'CK',USER:'TK',NURSE_ASSIGNMENT:'PC'};
  return {...row,id:row.notification_id,type:row.notification_type,is_read:Boolean(row.is_read),reference:prefixes[row.reference_type]?code(prefixes[row.reference_type],row.reference_id):'',target:notificationTarget(row)};
}
export async function readAdminNotifications() {return (await allPages(api.listNotifications)).map(notificationRow);}
export async function openNotification(row) {return notificationRow((await api.markRead(row.id)).notification);}
export const readAllNotifications=api.readAll;
