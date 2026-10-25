import {listDepartments} from '../api/catalog.js';
import {listDoctors} from '../api/doctor.js';
import {listAdminSchedules} from '../api/schedule.js';
import {listEncounters} from '../api/encounter.js';
import {listAdminPayments} from '../api/payment.js';
import {getPaymentStatistics,getReviewStatistics} from '../api/statistics.js';
import {allPages} from './admin_ui.js';
import {overviewReport} from './admin_overview_data.js';

export const transactionDay=value=>value?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value.length===10?`${value}T00:00:00+07:00`:value)):'';
export function selectReportRows(rows,range,day) {
  return rows.filter(row=>{const value=day(row);return value>=range.from&&value<=range.to&&(!range.department||String(row.department_id)===String(range.department));});
}
export async function loadStatisticsDepartments(signal) {
  const result=await listDepartments({include_inactive:true},{signal});
  return Array.isArray(result)?result:result.items;
}
export async function loadAdminStatistics(range,departments,signal) {
  const params={from_date:range.from,to_date:range.to,...(range.department?{department_id:range.department}:{})};
  const [doctors,shifts,encounters,payments,cash,reviews,reviewDepartment,reviewDoctor]=await Promise.all([
    allPages(listDoctors,{include_inactive:true,...(range.department?{department_id:range.department}:{})},signal),
    allPages(listAdminSchedules,params,signal),
    allPages(listEncounters,{},signal),
    allPages((query,options)=>listAdminPayments({...query,page_size:20},options),{},signal),
    getPaymentStatistics({...params,page_size:1},{signal}),
    overviewReport(getReviewStatistics,params,signal),
    overviewReport(getReviewStatistics,{...params,group_by:'department'},signal),
    overviewReport(getReviewStatistics,{...params,group_by:'doctor'},signal),
  ]);
  const encounterDepartments=new Map(encounters.map(row=>[String(row.encounter_id),row.department_id]));
  return {range,departments:departments.filter(d=>!range.department||String(d.department_id)===String(range.department)),doctors,shifts,
    encounters:selectReportRows(encounters,range,row=>row.work_date),
    payments:selectReportRows(payments.map(row=>({...row,department_id:encounterDepartments.get(String(row.encounter_id))})),range,row=>transactionDay(row.paid_at||row.created_at)),
    cash:cash.summary,reviews,reviewDepartment:reviewDepartment.items,reviewDoctor:reviewDoctor.items};
}
