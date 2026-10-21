import {esc,facts,badge,label} from "./admin_ui.js";
import {code} from "./business_codes.js";
export function departmentDetails(row) {
  const section=(title,body)=>`<section class="admin-department-section"><h3>${esc(title)}</h3>${body}</section>`;
  const text=(title,value)=>value?section(title,`<p class="admin-department-prose">${esc(value)}</p>`):"";
  const lists=[["Chuyên môn",row.specialties],["Dịch vụ",row.clinical_services],["Trang thiết bị",row.equipment],["Thành tựu",row.achievements],["Hướng dẫn người bệnh",row.patient_guide]].filter(([,items])=>items?.length).map(([title,items])=>section(title,`<ul>${items.map(v=>`<li>${esc(v)}</li>`).join("")}</ul>`)).join("");
  return `<div class="admin-department-details"><div class="admin-department-title"><span>${esc(code("CK",row.department_id))}</span><h3>${esc(row.name)}</h3>${badge(row.is_active?"ACTIVE":"LOCKED")}</div>`+section("Thông tin chuyên khoa",facts([["Khối",label(row.group_type)],["Số bác sĩ",row.doctor_count??0],["Trưởng khoa",row.leadership?.head?.full_name||"Chưa phân công"],["Phó khoa",row.leadership?.deputies?.map(v=>v.full_name).join(", ")||"Chưa phân công"]]))+text("Mô tả",row.description)+text("Giới thiệu",row.overview)+text("Chức năng, nhiệm vụ",row.mission)+lists+(row.extra_sections||[]).map(v=>text(v.title,v.content)).join("")+`</div>`;
}
export const memberRole=role=>({HEAD:"Trưởng khoa",DEPUTY:"Phó khoa",DOCTOR:"Bác sĩ"}[role]||"Bác sĩ");
export function departmentMemberRows(rows) {
  return rows.map(row=>`<div class="admin-department-member"><div><strong>${esc(row.full_name)}</strong><small>${esc(code("BS",row.doctor_profile_id))}</small></div><div class="admin-member-role-actions"><span class="badge ${row.position==='HEAD'?'green':row.position==='DEPUTY'?'purple':'blue'}">${memberRole(row.position)}</span>${["HEAD","DEPUTY"].includes(row.position)?`<button type="button" class="admin-member-revoke" data-action="revoke-member-role" data-id="${esc(row.doctor_profile_id)}" aria-label="Thu hồi quyền ${esc(memberRole(row.position))} của ${esc(row.full_name)}">Thu hồi quyền</button>`:""}</div></div>`).join("")||'<p class="muted">Chưa có thành viên.</p>';
}
export const departmentDeputyLimit=count=>count>20?3:2;
export function addDepartmentMember(rows,doctor,position) {
  if(!doctor)throw new Error("Vui lòng chọn bác sĩ.");
  if(!["HEAD","DEPUTY","DOCTOR"].includes(position))throw new Error("Vui lòng chọn chức vụ.");
  if(rows.some(r=>String(r.doctor_profile_id)===String(doctor.doctor_profile_id)))throw new Error("Bác sĩ đã có trong danh sách thành viên.");
  if(position==='HEAD'&&rows.some(r=>r.position==='HEAD'))throw new Error("Khoa chỉ có một trưởng khoa. Cần thay đổi phân công trưởng khoa hiện tại trước.");
  if(position==='DEPUTY'&&rows.filter(r=>r.position==='DEPUTY').length>=departmentDeputyLimit(rows.length+1))throw new Error(`Khoa ${rows.length+1} thành viên chỉ được tối đa ${departmentDeputyLimit(rows.length+1)} phó khoa.`);
  return [...rows,{...doctor,position}];
}

export function departmentMemberGroups(rows,departmentId) {
  const leaders=rows.filter(row=>['HEAD','DEPUTY'].includes(row.position)).sort((a,b)=>(a.position==='HEAD'?0:1)-(b.position==='HEAD'?0:1));
  const doctors=rows.filter(row=>!['HEAD','DEPUTY'].includes(row.position));
  const group=(title,description,items,empty,kind)=>`<section class="admin-member-group is-${kind}"><div class="admin-member-group-heading"><div class="admin-member-group-title"><h3>${title}</h3></div><span class="admin-member-count">${items.length}</span></div><div class="admin-member-group-list">${items.length?departmentMemberRows(items):`<p class="admin-member-group-empty">${empty}</p>`}</div></section>`;
  return `<div class="admin-member-groups">${group('Lãnh đạo khoa','Trưởng khoa và các phó khoa',leaders,'Chưa phân công lãnh đạo khoa.','leaders')}${group('Bác sĩ trong khoa','Các bác sĩ không giữ chức vụ lãnh đạo',doctors,'Chưa có bác sĩ ngoài nhóm lãnh đạo.','doctors')}</div>`;
}

export function revokeDepartmentMemberRole(rows,id) {
  return rows.map(row=>String(row.doctor_profile_id)===String(id)?{...row,position:'DOCTOR'}:row);
}
