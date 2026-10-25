import {commitForm} from "../core/form_workflow.js";
import {getSessionUser,loginUrl} from '../core/session.js';
import {getPatient} from '../api/patient.js';
import {listDoctors} from '../api/doctor.js';
import {listDepartments} from '../api/catalog.js';
import {loadBookingOptions} from '../core/reception_coordination_data.js';
import {allPages,money,dateLabel,clock,todayVN} from '../core/booking.js';
import {thumbnailUrl} from '../core/articles.js';
import {createReceptionPayment,confirmReceptionPayment} from '../core/reception_payment_data.js';
import {getEncounter} from '../api/encounter.js';
import {enhanceDialogDismiss} from '../core/dialog_dismiss.js';
import {startAutoRefresh} from '../core/auto_refresh.js';
import {readReceptionRegistration,submitReceptionRegistration,readReceptionRegistrationPayments,hasVerifiedRegistrationPayment} from '../core/reception_registration_data.js';
import {encounterStatusLabels} from '../core/encounter_status.js';
import {previewPatientId,makeReceptionPreview,saveReceptionPreview,readReceptionPreview} from '../core/reception_booking_preview.js';
const $=selector=>document.querySelector(selector);
const e=(tag,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
const query=new URLSearchParams(location.search),stage=document.body.dataset.bookingStage;
let active=true,actor,patient,doctors=[],departments=[],doctor,rows=[],selected,day='',range=todayVN(),version=0,request,draftKey=query.get('draft');
const paymentStates={PENDING:'Chờ thanh toán',SUCCESS:'Thành công',FAILED:'Thất bại',REFUNDED:'Đã hoàn tiền'};
const normalize=value=>String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[đĐ]/g,'d').toLowerCase();
const shiftDay=(value,offset)=>new Date(Date.parse(value+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
window.addEventListener('pagehide',()=>{active=false;version++;request?.abort();},{once:true});
window.addEventListener('neu:auth-change',()=>{active=false;version++;request?.abort();$('#main').inert=true;$('#main').hidden=true;showError('Phiên làm việc đã thay đổi. Vui lòng mở lại trang.');},{once:true});
function showError(message){const note=$('#reception-booking-status');note.hidden=false;note.querySelector('p').textContent=message;$('#reception-booking-retry').hidden=false;}
function reveal(){document.body.classList.remove('auth-pending');$('#main').inert=false;$('#main').hidden=false;$('#reception-booking-status').hidden=true;}
function summaryPairs(value){return [['Người khám',value.patient.full_name],['Mã hồ sơ',`BN_${String(value.patient_id).padStart(3,'0')}`],['Bác sĩ',value.doctor.full_name],['Chuyên khoa',value.doctor.department_name],['Ngày khám',dateLabel(value.schedule.work_date)],['Khung giờ',`${clock(value.slot.starts_at)} – ${clock(value.slot.ends_at)}`],['Phòng khám',value.schedule.room_name]];}
function facts(pairs){const list=e('dl','','booking-review-list');for(const [name,value]of pairs)list.append(e('dt',name),e('dd',value||'—'));return list;}
async function start(){
 $('#main').inert=true;
 try{
  actor=await getSessionUser();if(!active)return;
  if(!actor){location.replace(loginUrl(new URL(location.href)).href);return;}
  if(actor.role_name!=='RECEPTIONIST')throw new Error('Trang này chỉ dành cho tài khoản lễ tân.');
  let draft=readReceptionPreview(draftKey,actor);
  if(!draft&&stage!=='booking'&&previewPatientId(query.get('encounter_id'))){
   const {encounter:row}=await getEncounter(query.get('encounter_id'));if(!active)return;
   if(query.get('patient_id')&&String(row.patient_id)!==String(query.get('patient_id')))throw new Error('Lượt khám không khớp người bệnh.');
   draft={context:'RECEPTION_PREVIEW',user_id:actor.user_id,patient_id:row.patient_id,patient:{patient_id:row.patient_id},doctor:{doctor_profile_id:row.doctor_profile_id,full_name:row.doctor_name,consultation_fee:row.consultation_fee_snapshot},schedule:{schedule_id:row.schedule_id,work_date:row.work_date,room_name:row.room_name},slot:{appointment_time:clock(row.estimated_exam_at),starts_at:row.estimated_exam_at,ends_at:row.appointment_end_at},symptoms:row.symptoms||'',encounter_id:row.encounter_id};
   draftKey=saveReceptionPreview(draft);history.replaceState(null,'',`${stage}.html?draft=${encodeURIComponent(draftKey)}`);
  }
  const id=previewPatientId(query.get('patient_id'))||draft?.patient_id;
  if(!id)throw new Error('Vui lòng chọn người bệnh từ danh sách Trực tiếp.');
  if(draft&&String(draft.patient_id)!==String(id))throw new Error('Thông tin chọn lịch không khớp người bệnh đã chọn.');
  patient=(await getPatient(id)).patient;
  if(!active)return;
  if(String(patient?.patient_id)!==String(id)||(stage==='booking'&&(patient.archived_at||patient.is_archived)))throw new Error('Hồ sơ người bệnh không còn sử dụng được.');
  if(stage==='booking')await setupBooking(draft);else{
   if(!draft||String(draft.patient_id)!==String(id))throw new Error('Thông tin chọn lịch đã hết hạn. Vui lòng đăng ký lại.');
   draft.patient=patient;
   if(stage==='booking_review')await setupReview(draft);else await setupPayment(draft);
  }
  if(active)reveal();
 }catch(error){if(active)showError(error.message||'Không tải được dữ liệu.');}
}
function portrait(value){const holder=e('span','','booking-portrait'),src=thumbnailUrl(value.avatar_url);if(src){const image=e('img');image.src=src;image.alt=`Ảnh ${value.full_name}`;image.addEventListener('error',()=>holder.replaceChildren(e('span','Chưa có ảnh','booking-portrait-missing')),{once:true});holder.append(image);}else holder.append(e('span','Chưa có ảnh','booking-portrait-missing'));return holder;}
function renderDepartments(){
 const term=normalize($('#department-search').value),holder=$('#booking-departments');holder.replaceChildren();
 for(const item of [{department_id:'',name:'Tất cả chuyên khoa'},...departments].filter(item=>normalize(item.name).includes(term))){
  const button=e('button','','booking-department');button.type='button';const label=e('span');label.append(e('strong',item.name),e('small',`${doctors.filter(d=>!item.department_id||String(d.department_id)===String(item.department_id)).length} bác sĩ`));
  const icon=e('span','','booking-department-icon'),img=e('img');const image={'co xuong khop':'khoa_xuong_khop.png','da lieu':'khoa_da_lieu.png','mat':'khoa_mat.png','nhi':'khoa_nhi.png','noi tong quat':'khoa_moi_tong_quat.png','rang ham mat':'khoa_rang_ham_mat.png','san phu khoa':'khoa_phu_san.png','tai mui hong':'khoa_tai_mui_hong.png','than kinh':'khoa_than_kinh.png','tim mach':'khoa_tim_mach.png'}[normalize(item.name)];img.src=image?`../../static/assets/medical_specialty/${image}`:'../../static/assets/bieu_trung_neu.png';img.alt='';icon.append(img);button.append(icon,label);button.setAttribute('aria-pressed',String($('#appointment-department').value===String(item.department_id)));
  button.addEventListener('click',()=>{$('#appointment-department').value=String(item.department_id);renderDepartments();renderDoctors();});holder.append(button);
 }
 $('#department-empty').hidden=holder.children.length>0;
}
function renderDoctors(){
 const dept=$('#appointment-department').value,term=normalize($('#appointment-search').value),visible=doctors.filter(d=>(!dept||String(d.department_id)===dept)&&normalize(d.full_name).includes(term));
 if(doctor&&!visible.includes(doctor)){doctor=null;selected=null;rows=[];version++;request?.abort();renderDays();renderSlots();updateSelection();}
 const holder=$('.booking-doctor-list');holder.replaceChildren();
 for(const item of visible){
  const chosen=String(doctor?.doctor_profile_id)===String(item.doctor_profile_id),card=e('article','',`booking-doctor${chosen?' selected':''}`),info=e('div','','booking-doctor-info');
  info.append(e('h2',item.full_name),e('p',`Chuyên khoa: ${item.department_name||'—'}`));if(item.academic_degree)info.append(e('span',item.academic_degree));if(item.experience_years!=null)info.append(e('span',`${item.experience_years} năm kinh nghiệm`));
  const photo=e('span','','booking-portrait-link');photo.append(portrait(item));const price=e('div','','booking-price');price.append(e('strong',money(item.consultation_fee)));
  const button=e('button',chosen?'Đang chọn':'Chọn','solid-button');button.type='button';button.setAttribute('aria-pressed',String(chosen));button.addEventListener('click',()=>{doctor=item;selected=null;renderDoctors();void loadSchedules();});card.append(photo,info,price,button);holder.append(card);
 }
 $('#appointment-count').textContent=`${visible.length} bác sĩ`;$('#appointment-empty').hidden=visible.length>0;
}
async function loadSchedules(restore){
 if(!doctor)return;const token=++version,doctorId=doctor.doctor_profile_id;request?.abort();request=new AbortController();selected=null;rows=[];renderDays();renderSlots();updateSelection();
 $('#schedule-status').textContent='Đang tải ca khám còn trống…';$('#schedule-retry').hidden=true;$('#chosen-schedule').setAttribute('aria-busy','true');
 try{
  const results=await Promise.all(Array.from({length:7},(_,i)=>loadBookingOptions(patient.patient_id,shiftDay(range,i),{signal:request.signal})));
  if(!active||token!==version)return;
  rows=results.flat().filter(row=>String(row.doctor_profile_id)===String(doctorId)&&row.slots?.length);day=rows.some(r=>r.work_date===restore?.schedule.work_date)?restore.schedule.work_date:rows[0]?.work_date||'';
  if(restore){const schedule=rows.find(r=>String(r.schedule_id)===String(restore.schedule.schedule_id)),slot=schedule?.slots.find(s=>s.appointment_time===restore.slot.appointment_time);if(slot)selected={schedule,slot};}
  $('#schedule-status').textContent=rows.length?'':'Chưa có ca khám còn trống trong 7 ngày này.';renderDays();renderSlots();updateSelection();
 }catch(error){if(active&&token===version&&error.code!=='CLIENT_ABORTED'){$('#schedule-status').textContent=error.message;$('#schedule-retry').hidden=false;}}
 finally{if(token===version)$('#chosen-schedule').setAttribute('aria-busy','false');}
}
function renderDays(){
 const holder=$('#appointment-day-buttons');holder.replaceChildren();for(let i=0;i<7;i++){const value=shiftDay(range,i),button=e('button','','appointment-day-button');button.type='button';button.disabled=!rows.some(r=>r.work_date===value);button.append(e('small',new Intl.DateTimeFormat('vi-VN',{weekday:'short'}).format(new Date(value+'T12:00:00+07:00'))),e('strong',dateLabel(value)));button.setAttribute('aria-pressed',String(day===value));button.addEventListener('click',()=>{day=value;selected=null;renderDays();renderSlots();updateSelection();});holder.append(button);}
 $('#booking-day-prev').disabled=range<=todayVN();
}
function renderSlots(){
 const holder=$('#booking-slots');holder.replaceChildren();const visible=rows.filter(r=>r.work_date===day);
 if(!visible.length)holder.append(e('p',doctor?'Chưa có khung giờ phù hợp.':'Chọn bác sĩ để xem ca khám.','field-note'));
 for(const schedule of visible){const group=e('section','','booking-slot-group');group.append(e('h3',`${Number(schedule.start_time.slice(0,2))<12?'Buổi sáng':'Buổi chiều'} (${schedule.start_time.slice(0,5)}–${schedule.end_time.slice(0,5)}) · ${schedule.room_name}`));const grid=e('div','','time-slot-grid');for(const slot of schedule.slots){const chosen=selected?.schedule.schedule_id===schedule.schedule_id&&selected.slot.appointment_time===slot.appointment_time,button=e('button',`${clock(slot.starts_at)}–${clock(slot.ends_at)}`,chosen?'selected':'');button.type='button';button.setAttribute('aria-pressed',String(chosen));button.append(e('small',chosen?'Đang chọn':'Còn trống'));button.addEventListener('click',()=>{selected={schedule,slot};renderSlots();updateSelection();});grid.append(button);}group.append(grid);holder.append(group);}
}
function updateSelection(){
 $('#booking-total-fee').textContent=doctor?money(doctor.consultation_fee):'Chưa chọn bác sĩ';$('#booking-selection-summary').textContent=selected?`${doctor.full_name} · ${dateLabel(selected.schedule.work_date)} · ${clock(selected.slot.starts_at)}–${clock(selected.slot.ends_at)} · ${selected.schedule.room_name}`:'Bạn chưa chọn khung giờ khám.';$('#booking-selection-fee').textContent=selected?`Phí khám: ${money(doctor.consultation_fee)}`:'';
}
async function setupBooking(draft){
 const results=await Promise.all([allPages(listDoctors,{}, {auth:false}),allPages(listDepartments,{}, {auth:false})]);if(!active)return;[doctors,departments]=results;
 $('#appointment-patient').value=`${patient.full_name} · BN_${String(patient.patient_id).padStart(3,'0')}`;$('#reception-patient-id').value=patient.patient_id;
 $('#relative-status').textContent=[patient.phone,patient.dob?dateLabel(patient.dob):''].filter(Boolean).join(' · ');
 const select=$('#appointment-department');select.replaceChildren(new Option('Tất cả chuyên khoa',''));departments.forEach(d=>select.add(new Option(d.name,d.department_id)));
 $('#booking-data-status').textContent='';$('.booking-doctor-list').setAttribute('aria-busy','false');$('#booking-data-retry').hidden=true;
 if(draft){doctor=doctors.find(d=>String(d.doctor_profile_id)===String(draft.doctor.doctor_profile_id));range=draft.schedule.work_date;$('#appointment-symptoms').value=draft.symptoms;}
 renderDepartments();renderDoctors();renderDays();renderSlots();updateSelection();if(doctor)await loadSchedules(draft);
 if($('#appointment-form').dataset.bound)return;$('#appointment-form').dataset.bound='true';
 $('#appointment-form').addEventListener('neu:discard-changes',()=>{
  if(draftKey&&draft&&!draft.encounter_id&&draft.submission_state!=='UNCERTAIN'){
   try{sessionStorage.removeItem('neu:reception-booking-preview:'+draftKey);}catch{}
  }
 });
 $('#department-search').addEventListener('input',renderDepartments);$('#appointment-search').addEventListener('input',renderDoctors);select.addEventListener('change',()=>{renderDepartments();renderDoctors();});
 $('#schedule-retry').addEventListener('click',()=>void loadSchedules());
 for(const [id,offset]of [['#booking-day-prev',-7],['#booking-day-next',7]])$(id).addEventListener('click',()=>{range=shiftDay(range,offset);if(range<todayVN())range=todayVN();void loadSchedules();});
 $('#appointment-form').addEventListener('submit',event=>{event.preventDefault();const note=$('#appointment-status');try{const value=makeReceptionPreview(actor,patient,doctor,selected?.schedule,selected?.slot,$('#appointment-symptoms').value);draftKey=saveReceptionPreview(value);commitForm($("#appointment-form"));location.assign(`booking_review.html?draft=${encodeURIComponent(draftKey)}`);}catch(error){note.textContent=error.message;note.focus();}});
}
function applyRegistration(draft,row){
 draft.encounter_id=row.encounter_id;draft.submission_state='CREATED';
 draft.schedule={...draft.schedule,schedule_id:row.schedule_id,work_date:row.work_date,room_name:row.room_name};
 draft.doctor={...draft.doctor,doctor_profile_id:row.doctor_profile_id,full_name:row.doctor_name||draft.doctor.full_name,consultation_fee:row.consultation_fee_snapshot};
 draft.slot={...draft.slot,starts_at:row.estimated_exam_at,ends_at:row.appointment_end_at};
 saveReceptionPreview(draft,draftKey);
}
async function setupReview(draft){
 $('#booking-review-page').hidden=false;
 const note=$('#booking-dialog-status'),confirm=$('#booking-confirm'),back=$('#booking-back');let busy=false,row;
 const data=[['Họ tên',patient.full_name],['Số điện thoại',patient.phone],['CCCD / mã định danh',patient.id_card],['Ngày sinh',patient.dob?dateLabel(patient.dob):''],['Giới tính',patient.gender],['Địa chỉ',patient.address],['BHYT',patient.health_insurance],['Vấn đề sức khỏe',draft.symptoms]];
 $('#booking-review-patient').replaceChildren(facts(data));
 function render(){
  $('#booking-review').replaceChildren(facts(summaryPairs(draft).slice(2)));$('#booking-review-total').textContent=money(draft.doctor.consultation_fee);
  confirm.textContent=draft.submission_state==='UNCERTAIN'?'Kiểm tra yêu cầu':draft.encounter_id?'Mở thanh toán →':'Thanh toán →';confirm.disabled=busy;
  back.disabled=busy||row?.encounter_status==='HOLDING'||draft.submission_state==='UNCERTAIN';
  $('#booking-confirm-note').textContent=row?`Lượt LK_${String(row.encounter_id).padStart(3,'0')} · ${encounterStatusLabels[row.encounter_status]||row.encounter_status}`:'Khi bấm Thanh toán, hệ thống tạo lượt khám và giữ chỗ theo thời hạn thanh toán.';
 }
 async function read(){if(!draft.encounter_id)return;row=await readReceptionRegistration(draft.encounter_id,draft.patient_id);if(!active)return;applyRegistration(draft,row);render();}
 back.onclick=()=>{if(!back.disabled)location.assign(`booking.html?patient_id=${patient.patient_id}&draft=${encodeURIComponent(draftKey)}`);};
 confirm.onclick=async()=>{
  if(busy)return;busy=true;render();note.textContent='Đang kiểm tra và đăng ký ca khám…';
  try{
   row=await submitReceptionRegistration(draft,actor,{persist:value=>saveReceptionPreview(value,draftKey)});
   if(!active)return;applyRegistration(draft,row);location.assign(`payment.html?draft=${encodeURIComponent(draftKey)}`);
  }catch(error){if(active)note.textContent=error.message||'Chưa xác định được kết quả đăng ký. Vui lòng chọn Kiểm tra yêu cầu.';}
  finally{busy=false;if(active)render();}
 };
 if(draft.encounter_id)await read();render();
}
async function setupPayment(draft){
 $('#payment-page').hidden=false;
 const note=$('#booking-payment-status'),method=$('#booking-payment-method'),result=$('#reception-payment-preview-result'),modal=$('#reception-payment-confirm'),form=$('#reception-payment-confirm-form');
 $('#payment-back').href=`booking_review.html?draft=${encodeURIComponent(draftKey)}`;
 const create=$('#booking-payment-create'),success=$('#booking-payment-success'),failed=$('#booking-payment-failed');
 $('.payment-results .payment-preview-notice').textContent='Chỉ xác nhận thành công sau khi đã đối chiếu khoản tiền người bệnh thanh toán.';
 modal.hidden=false;modal.querySelector('.payment-preview-notice').textContent='Kiểm tra thông tin và số tiền trước khi ghi nhận kết quả thanh toán.';
 form.querySelector('[type="submit"]').textContent='Xác nhận thanh toán';$('.payment-preview-label').textContent='KẾT QUẢ THANH TOÁN';
 let timer,loading=false,busy=false,row,payment,review,opener,displayFailure=false;
 function lock(value){busy=value;form.dataset.busy=String(value);for(const n of [method,create,success,failed,...modal.querySelectorAll('button,input')])n.disabled=value;if(!value){const expired=!row||row.encounter_status!=='HOLDING'||Date.parse(row.hold_expires_at)<=Date.now();method.disabled=Boolean(payment)||expired;create.disabled=expired;success.disabled=failed.disabled=!payment||expired;}}
 const stopTimer=()=>{if(timer)clearInterval(timer);timer=null;};window.addEventListener('pagehide',stopTimer,{once:true});window.addEventListener('neu:auth-change',stopTimer,{once:true});
 const paymentPairs=p=>[...summaryPairs(draft),['Mã thanh toán',`TT_${String(p.payment_id).padStart(3,'0')}`],['Phương thức',({CASH:'Tiền mặt',BANK:'Chuyển khoản',EWALLET:'Ví điện tử',CARD:'Thẻ'})[p.payment_method]],['Số tiền',money(p.amount)]];
 async function read(force=false){
  if(!active||loading||busy&&!force)return;loading=true;
  try{
   if(!draft.encounter_id)throw new Error('Lịch khám chưa được đăng ký. Vui lòng quay lại kiểm tra thông tin.');
   const [current,payments]=await Promise.all([readReceptionRegistration(draft.encounter_id,draft.patient_id),readReceptionRegistrationPayments(draft.encounter_id)]);if(!active)return;
   row=current;applyRegistration(draft,row);stopTimer();payment=payments.find(p=>p.payment_type==='DEPOSIT'&&p.transaction_status==='PENDING')||null;
   $('#payment-summary').replaceWith(Object.assign(facts([...summaryPairs(draft),['Mã lượt khám',`LK_${String(row.encounter_id).padStart(3,'0')}`],['Trạng thái',encounterStatusLabels[row.encounter_status]||row.encounter_status],...(row.ticket_code?[['Mã phiếu',row.ticket_code]]:[])]),{id:'payment-summary'}));$('#payment-total').textContent=money(row.deposit_amount_snapshot??row.consultation_fee_snapshot);
   const paid=hasVerifiedRegistrationPayment(row,payments),failure=displayFailure&&payments.find(p=>p.transaction_status==='FAILED');
   $('#payment-layout').hidden=paid||Boolean(failure);result.hidden=!(paid||failure);
   if(paid||failure){
    result.dataset.outcome=paid?'SUCCESS':'FAILED';$('#reception-payment-result-title').textContent=paid?'Đã thanh toán':'Thanh toán không thành công';$('#reception-payment-result-description').textContent=paid?'Giao dịch đã được ghi nhận và lịch khám đã được xác nhận. Check-in được thực hiện riêng khi người bệnh đến.':'Giao dịch đã được ghi nhận không thành công. Có thể tạo lại yêu cầu nếu lịch còn giữ chỗ.';
    $('#reception-payment-result-summary').replaceChildren(facts([...summaryPairs(draft),['Mã phiếu',row.ticket_code||'—'],['Trạng thái',encounterStatusLabels[row.encounter_status]||row.encounter_status]]));$('#reception-payment-result-icon').textContent=paid?'✓':'!';result.querySelector('.payment-preview-notice').hidden=true;$('#reception-payment-preview-back').hidden=paid;
   }
   method.disabled=Boolean(payment)||row.encounter_status!=='HOLDING';if(payment)method.value=payment.payment_method;
   create.hidden=Boolean(payment)||row.encounter_status!=='HOLDING';success.disabled=failed.disabled=!payment||row.encounter_status!=='HOLDING';
   const qr=$('#booking-qr');qr.hidden=!payment;if(payment)qr.replaceChildren(e('strong',`TT_${String(payment.payment_id).padStart(3,'0')} · Chờ xác nhận`),e('p',`${method.selectedOptions[0].textContent} · ${money(payment.amount)}`));
   note.textContent=payments.length?payments.map(p=>`TT_${String(p.payment_id).padStart(3,'0')}: ${paymentStates[p.transaction_status]} · ${money(p.amount)}`).join(' · '):'Chưa có giao dịch. Chọn phương thức và tạo yêu cầu thanh toán.';
   const countdown=()=>{if(!active){stopTimer();return;}const remaining=Math.max(0,Date.parse(row.hold_expires_at)-Date.now());$('#booking-countdown').textContent=row.encounter_status==='HOLDING'?(remaining>0?`Chờ thanh toán · Còn ${Math.floor(remaining/60000)} phút ${Math.floor(remaining/1000)%60} giây giữ chỗ.`:'Đã hết thời gian giữ chỗ. Vui lòng chọn Kiểm tra yêu cầu.'):encounterStatusLabels[row.encounter_status]||row.encounter_status;if(row.encounter_status==='HOLDING'&&remaining===0)create.disabled=success.disabled=failed.disabled=true;};countdown();if(row.encounter_status==='HOLDING')timer=setInterval(countdown,1000);
  }catch(error){if(active){note.textContent=error.message||'Không tải được trạng thái thanh toán.';success.disabled=failed.disabled=true;}}
  finally{loading=false;}
 }
 create.onclick=async()=>{if(busy)return;lock(true);note.textContent='Đang tạo yêu cầu thanh toán…';try{await createReceptionPayment(draft.encounter_id,draft.patient_id,method.value);await read(true);}catch(error){if(active)note.textContent=error.message;}finally{if(active)lock(false);}};
 function open(outcome,button){if(!payment||busy)return;review={...payment,outcome};opener=button;$('#reception-payment-confirm-title').textContent=outcome==='SUCCESS'?'Xác nhận đã nhận tiền':'Xác nhận thanh toán không thành công';$('#reception-payment-confirm-summary').replaceChildren(facts(paymentPairs(review)));form.reset();modal.showModal();}
 success.onclick=event=>open('SUCCESS',event.currentTarget);failed.onclick=event=>open('FAILED',event.currentTarget);
 const close=()=>{if(!busy)modal.close();};$('#reception-payment-confirm-close').onclick=close;$('#reception-payment-confirm-cancel').onclick=close;
 enhanceDialogDismiss(modal,{canClose:()=>!busy});modal.addEventListener('cancel',event=>{if(busy)event.preventDefault();});modal.addEventListener('close',()=>opener?.focus());
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!review||!form.reportValidity())return;lock(true);note.textContent='Đang ghi nhận kết quả thanh toán…';
  try{const response=await confirmReceptionPayment(review,review.outcome);if(!active)return;displayFailure=review.outcome==='FAILED';modal.close();await read(true);if(!result.hidden){$('#reception-payment-result-title').tabIndex=-1;$('#reception-payment-result-title').focus();}if(response.payment.transaction_status==='REFUNDED')note.textContent='Tiền đến sau khi lịch không còn hiệu lực đã được hoàn, không xác nhận lại lịch khám.';}
  catch(error){if(active){const feedback=$('#reception-payment-confirm-summary');feedback.append(e('p',error.message));note.textContent=error.message;}}
  finally{if(active)lock(false);}
 };
 $('#reception-payment-preview-back').onclick=()=>{displayFailure=false;void read();};await read();startAutoRefresh(read,{canRefresh:()=>active&&!loading&&!busy});
}
$('#reception-booking-retry').addEventListener('click',()=>void start());void start();
