import {previewDoctorChange,confirmDoctorChange,doctorChangeReviewMarkup} from "../core/reception_doctor_change.js";
import {startAutoRefresh} from "../core/auto_refresh.js";
import {listDoctors} from "../api/doctor.js";
import {allPages} from "../core/admin_ui.js";
import { $, panel, esc, today, date, facts, dialog, submit, badge } from "../core/staff_ui.js";
import {listRooms} from "../api/catalog.js";
import {code} from "../core/business_codes.js";
import {sessionError} from "../core/staff_workspace.js";
import {loadReceptionDoctorSchedules,filterReceptionDoctorSchedules,normalizeScheduleSearch} from "../core/reception_doctor_schedule_data.js";
import {getStaffRoomOptions,assignReceptionRoom} from "../core/reception_coordination_data.js";

export function initDoctorCoordination() {
  $("#page-body").insertAdjacentHTML("beforeend",panel("Điều phối bác sĩ", '<div id="doctor-assignment"><div class="coordination-search-section"><div class="doctor-assignment-filters"><label>Tìm kiếm<input id="assignment-doctor-query" type="search" placeholder="Họ tên hoặc mã bác sĩ" aria-controls="assignment-doctor-results"></label><label>Chuyên khoa<input id="assignment-department" list="assignment-departments" placeholder="Tên chuyên khoa"><datalist id="assignment-departments"></datalist></label><label>Ngày làm việc<input id="assignment-work-date" type="date" required></label></div><p id="assignment-status" role="status"></p><div id="assignment-doctor-results" class="coordination-choices" hidden></div></div><div class="coordination-search-section"><label>Tìm kiếm<input id="assignment-room-query" type="search" placeholder="Tên phòng hoặc mã phòng" aria-controls="assignment-room-results"></label><div id="assignment-room-results" class="coordination-choices" hidden></div></div><div class="actions coordination-footer"><button id="assignment-confirm" type="button" disabled>Điều phối bác sĩ</button></div></div>'));
  const day=$("#assignment-work-date"),status=$("#assignment-status"),results=$("#assignment-doctor-results"),confirm=$("#assignment-confirm"),modal=$("#staff-dialog");
  day.value=today();
  let rows=[],allRooms=[],rooms=[],selected=null,selectedRoom=null,version=0,controller,roomRequest,roomVersion=0,detailRequest,detailVersion=0,active=true,saving=false;
  const canAssign=row=>row && ['OPEN','FULL'].includes(row.schedule_status) && !row.move && !row.booked_count && Date.parse(`${row.work_date}T${row.start_time}+07:00`)>Date.now();
  const canChange=row=>row&&!row.move&&row.schedule_status!=='CLOSED'&&Date.parse(`${row.work_date}T${row.start_time}+07:00`)>Date.now();
  const validRoom=()=>selectedRoom&&rooms.some(room=>String(room.room_id)===String(selectedRoom.room_id)&&room.available);
  function updateConfirm(){confirm.disabled=!(canChange(selected)||(canAssign(selected)&&validRoom()));}
  function render() {
    const query=$("#assignment-doctor-query").value,department=$("#assignment-department").value;
    results.hidden=!query.trim()&&!department.trim();
    const matches=selected?[selected]:filterReceptionDoctorSchedules(rows.map(row=>({...row,doctor_name:`${row.doctor_name} ${code('BS',row.doctor_profile_id)}`})),{q:query,department,work_date:day.value}).map(row=>rows.find(item=>item.schedule_id===row.schedule_id));
    results.innerHTML=matches.length?matches.map(row=>`<button type="button" class="coordination-choice${selected?.schedule_id===row.schedule_id?' is-selected':''}" data-assign-schedule="${esc(row.schedule_id)}" aria-pressed="${selected?.schedule_id===row.schedule_id}"><span><strong>${esc(row.doctor_name)}</strong><small>${esc(row.department_name)}</small></span><span>${esc(row.room_name)}</span><span>${date(row.work_date)}<small>${esc(row.start_time?.slice(0,5))} – ${esc(row.end_time?.slice(0,5))}</small></span><span>${badge(row.schedule_status)}<small>${row.move?'Ca đã chuyển':row.booked_count?'Đã có lượt khám':canAssign(row)?'Có thể đổi phòng':'Ca đã bắt đầu / kết thúc'}</small></span></button>`).join(""):'<p class="scope-note">Không có ca phù hợp.</p>';
    updateConfirm();
  }
  function renderRooms() {
    const target=$("#assignment-room-results"),query=normalizeScheduleSearch($("#assignment-room-query").value);
    target.hidden=!query&&!selectedRoom;
    if(target.hidden){target.innerHTML='';return;}
    const candidates=allRooms.map(room=>{
      const option=rooms.find(item=>String(item.room_id)===String(room.room_id));
      if(option)return option;
      const reason=!selected?'Chọn ca bác sĩ trước':!canAssign(selected)?'Ca đã bắt đầu, ngừng hoạt động hoặc đã có lượt khám':String(room.room_id)===String(selected.room_id)?'Phòng hiện tại của bác sĩ':room.department_name!==selected.department_name?'Phòng khác chuyên khoa':'Phòng chưa được xác nhận khả dụng';
      return {...room,available:false,unavailable_reason:reason};
    });
    const words=query.split(/\s+/).filter(Boolean);
    const matches=selectedRoom?[candidates.find(room=>String(room.room_id)===String(selectedRoom.room_id))||{...selectedRoom,available:false,unavailable_reason:'Chưa kiểm tra lại phòng với ca đã chọn'}]:candidates.filter(room=>words.every(word=>normalizeScheduleSearch(`${room.room_name} ${code('PH',room.room_id)} ${room.department_name||''}`).includes(word)));
    target.innerHTML=matches.length?matches.map(room=>`<button type="button" class="coordination-choice${selectedRoom?.room_id===room.room_id?' is-selected':''}" data-assign-room="${esc(room.room_id)}" aria-pressed="${selectedRoom?.room_id===room.room_id}" ${selected&&room.available?'':'disabled'}><span><strong>${esc(room.room_name)}</strong><small>${esc(code('PH',room.room_id))}</small></span><span>${esc(room.department_name)}</span><span>${selected?`${esc(selected.start_time.slice(0,5))} – ${esc(selected.end_time.slice(0,5))}`:'Chọn ca bác sĩ trước'}</span><span>${!selected?'Chưa kiểm tra lịch phòng':room.available?'Phòng trống trong ca':esc(room.unavailable_reason||'Không thể chọn')}</span></button>`).join(''):'<p class="scope-note">Không tìm thấy phòng phù hợp với tìm kiếm hoặc ca đã chọn.</p>';
    if(!selected)target.insertAdjacentHTML('afterbegin','<p class="scope-note">Chọn ca bác sĩ để kiểm tra và chọn phòng còn trống.</p>');
  }
  function clearRooms() {roomVersion++;roomRequest?.abort();rooms=[];selectedRoom=null;renderRooms();updateConfirm();}
  async function loadRooms() {
    clearRooms();if(!canAssign(selected))return;
    const row=selected,current=roomVersion;roomRequest=new AbortController();status.textContent='Đang kiểm tra phòng theo ca đã chọn…';
    try {
      const data=await getStaffRoomOptions(row.schedule_id,{signal:roomRequest.signal});
      if(!active||current!==roomVersion)return;
      if(String(data.schedule?.schedule_id)!==String(row.schedule_id))throw new Error('Phản hồi không khớp ca đã chọn.');
      rooms=data.items;renderRooms();updateConfirm();status.textContent='Đã chọn ca. Tìm và chọn phòng khám mới ở thanh bên dưới.';
    }catch(error){if(active&&current===roomVersion)status.textContent=sessionError(error);}
  }
  $('#assignment-room-query').addEventListener('input',()=>{selectedRoom=null;updateConfirm();renderRooms();});
  $('#assignment-room-results').addEventListener('click',event=>{
    const button=event.target.closest('[data-assign-room]');if(!button||button.disabled||saving)return;
    selectedRoom=rooms.find(room=>String(room.room_id)===button.dataset.assignRoom&&room.available);renderRooms();render();
  });
  async function load({preserve=false}={}) {
    if(!active)return;
    const current=++version;controller?.abort();controller=new AbortController();
    if(!preserve){rows=[];selected=null;clearRooms();confirm.disabled=true;results.innerHTML='';}
    status.textContent='Đang tải lịch phân phòng…';
    try {
      if(!day.value)throw new Error('Vui lòng chọn ngày làm việc.');
      const [data,catalog]=await Promise.all([loadReceptionDoctorSchedules(day.value,{signal:controller.signal}),listRooms({},{signal:controller.signal})]);
      if(!active||current!==version)return;
      const previous=preserve?selected:null,previousRoom=preserve?selectedRoom:null;
      allRooms=catalog.items;rows=data.rows;
      selected=previous&&rows.find(row=>String(row.schedule_id)===String(previous.schedule_id)&&row.version===previous.version)||null;
      clearRooms();renderRooms();
      $('#assignment-departments').innerHTML=data.departments.map(name=>`<option value="${esc(name)}"></option>`).join('');status.textContent='';render();
      if(selected&&canAssign(selected)){
        const chosenId=selected.schedule_id,expectedRoomVersion=roomVersion+1;
        await loadRooms();
        if(active&&current===version&&roomVersion===expectedRoomVersion&&selected?.schedule_id===chosenId&&previousRoom){selectedRoom=rooms.find(room=>String(room.room_id)===String(previousRoom.room_id)&&room.available)||null;renderRooms();updateConfirm();}
      }
    } catch(error) {
      if(active&&current===version){rows=[];selected=null;clearRooms();render();status.textContent=sessionError(error);}
    }
  }
  results.addEventListener('click',event=>{
    const button=event.target.closest('[data-assign-schedule]');if(!button || saving)return;
    clearRooms();selected=rows.find(row=>String(row.schedule_id)===button.dataset.assignSchedule);render();
    if(canAssign(selected))void loadRooms();else {clearRooms();status.textContent='Ca này chỉ cho phép tra cứu; không thể đổi phòng khi ca đã bắt đầu, đóng, nghỉ, đã chuyển hoặc có lượt khám.';}
  });
  confirm.addEventListener('click',async()=>{
    if(!selected||saving||confirm.disabled)return;
    const row=selected,token=++detailVersion;detailRequest?.abort();detailRequest=new AbortController();
    const options={signal:detailRequest.signal};
    dialog('Điều phối bác sĩ','<p>Đang tải bác sĩ và ca làm việc…</p>');
    try {
      const [doctors,schedules]=await Promise.all([allPages(listDoctors,{},options.signal),loadReceptionDoctorSchedules('',options)]);
      if(!active||token!==detailVersion)return;
      const replacements=doctors.filter(d=>String(d.doctor_profile_id)!==String(row.doctor_profile_id)&&d.department_name===row.department_name);
      const swapTargets=schedules.rows.filter(r=>r.schedule_id!==row.schedule_id&&r.doctor_profile_id!==row.doctor_profile_id&&r.department_name===row.department_name&&!r.move&&r.schedule_status!=='CLOSED'&&Date.parse(`${r.work_date}T${r.start_time}+07:00`)>Date.now());
      const allowReplace=canChange(row)&&replacements.length>0,allowSwap=canChange(row)&&swapTargets.length>0;
      const allowDoctor=allowReplace||allowSwap,allowRoom=Boolean(canAssign(row)&&validRoom());
      const roomChoice=allowRoom?selectedRoom:null;
      if(!allowDoctor&&!allowRoom)throw new Error('Ca không còn đủ điều kiện điều phối. Vui lòng chọn lại.');
      dialog('Điều phối bác sĩ',`<div class="reception-transfer-detail">${panel('Ca cần thay đổi',facts([['Bác sĩ',row.doctor_name],['Phòng',row.room_name],['Ngày',date(row.work_date)],['Giờ',`${row.start_time} – ${row.end_time}`]]))}<form id="doctor-change-form"><label>Thao tác<select name="mode">${allowReplace?'<option value="replace">Thay thế bác sĩ</option>':''}${allowSwap?'<option value="swap">Hoán đổi hai bác sĩ</option>':''}${allowRoom?'<option value="room">Đổi phòng bác sĩ</option>':''}</select></label><label id="replacement-picker">Bác sĩ mới<select name="doctor_profile_id">${doctors.filter(d=>String(d.doctor_profile_id)!==String(row.doctor_profile_id)&&d.department_name===row.department_name).map(d=>`<option value="${esc(d.doctor_profile_id)}">${esc(d.full_name)} · ${esc(d.department_name)}</option>`).join('')}</select></label><label id="swap-picker" hidden>Ca của bác sĩ hoán đổi<select name="target_schedule_id">${schedules.rows.filter(r=>r.schedule_id!==row.schedule_id&&r.doctor_profile_id!==row.doctor_profile_id&&r.department_name===row.department_name&&!r.move&&r.schedule_status!=='CLOSED'&&Date.parse(`${r.work_date}T${r.start_time}+07:00`)>Date.now()).map(r=>`<option value="${esc(r.schedule_id)}">${esc(r.doctor_name)} · ${date(r.work_date)} · ${esc(r.start_time)} · ${esc(r.room_name)}</option>`).join('')}</select></label><label id="room-change-picker" hidden>Phòng khám mới<input value="${esc(roomChoice?.room_name||'')}" readonly></label><label>Lý do *<textarea name="reason" required maxlength="500"></textarea></label><div data-doctor-change-review hidden></div><button type="submit">Xem trước thay đổi</button><p role="status"></p></form></div>`);
      const form=$('#doctor-change-form');
      const reviewRegion=form.querySelector('[data-doctor-change-review]'),submitButton=form.querySelector('button[type="submit"]');
      let reviewed=null;
      function invalidateReview(){
        reviewed=null;reviewRegion.hidden=true;reviewRegion.innerHTML='';
        submitButton.textContent=form.elements.mode.value==='room'?'Xác nhận đổi phòng':'Xem trước thay đổi';
      }
      form.addEventListener('input',invalidateReview);form.addEventListener('change',invalidateReview);
      const showMode=()=>{
        const mode=form.elements.mode.value;
        $('#replacement-picker').hidden=mode!=='replace';
        $('#swap-picker').hidden=mode!=='swap';
        $('#room-change-picker').hidden=mode!=='room';
      };
      form.elements.mode.addEventListener('change',showMode);showMode();invalidateReview();
      form.addEventListener('submit',event=>{
        event.preventDefault();if(saving||form.dataset.busy==='true')return;
        const data=new FormData(form),key=data.get('mode')==='swap'?'target_schedule_id':'doctor_profile_id';
        const mode=data.get('mode'),payload={[key]:Number(data.get(key)),reason:String(data.get('reason')).trim()};
        const confirming=Boolean(reviewed);
        saving=true;$('#staff-dialog-close').disabled=true;
        void submit(form,async()=>{
          if(mode==='room'){
            if(!allowRoom||!roomChoice)throw new Error('Vui lòng chọn phòng khả dụng.');
            const latest=await getStaffRoomOptions(row.schedule_id,options);
            if(String(latest.schedule?.schedule_id)!==String(row.schedule_id)||!latest.items.some(room=>String(room.room_id)===String(roomChoice.room_id)&&room.available))throw new Error('Phòng không còn khả dụng. Vui lòng chọn lại.');
            await assignReceptionRoom(latest.schedule,roomChoice.room_id,payload.reason,options);
            if(!active||token!==detailVersion)return;
            modal.close();await load();status.textContent='Đã đổi phòng bác sĩ.';return;
          }
          if((mode==='replace'&&!allowReplace)||(mode==='swap'&&!allowSwap)||!['replace','swap'].includes(mode))throw new Error('Thao tác không được phép với ca đã chọn.');
          if(!Number.isInteger(payload[key])||payload[key]<1)throw new Error('Vui lòng chọn bác sĩ hoặc ca hoán đổi.');
          if(!payload.reason)throw new Error('Vui lòng nhập lý do thay đổi.');
          if(!reviewed){
            const next=await previewDoctorChange(row.schedule_id,payload,options);
            if(!active||token!==detailVersion)return;
            reviewed=next;reviewRegion.innerHTML=doctorChangeReviewMarkup(reviewed,doctors);reviewRegion.hidden=false;
            submitButton.textContent='Xác nhận thay đổi';
            reviewRegion.scrollIntoView({block:'nearest'});
            return;
          }
          try {await confirmDoctorChange(reviewed,options);}
          catch(error){invalidateReview();throw error;}
          if(!active||token!==detailVersion)return;
          modal.close();await load();status.textContent='Đã thay đổi bác sĩ và cập nhật các lượt khám liên quan.';
        },mode==='room'||confirming?'Đã lưu thay đổi.':'Đã tải bản xem trước. Kiểm tra thông tin rồi xác nhận.',{commit:mode==='room'||confirming}).finally(()=>{saving=false;$('#staff-dialog-close').disabled=false;});
      });
    }catch(error){if(active&&token===detailVersion)dialog('Điều phối bác sĩ',`<p>${esc(sessionError(error))}</p>`);}
  });
  modal.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  modal.addEventListener('close',()=>{detailVersion++;detailRequest?.abort();});
  day.addEventListener("change",()=>void load());
  for(const id of ["#assignment-doctor-query","#assignment-department"])$(id).addEventListener("input",()=>{selected=null;clearRooms();render();});
  const stop=()=>{active=false;version++;detailVersion++;controller?.abort();roomVersion++;roomRequest?.abort();detailRequest?.abort();allRooms=[];rooms=[];rows=[];results.innerHTML="";$("#assignment-room-results").innerHTML="";};
  window.addEventListener("pagehide",stop,{once:true});window.addEventListener("neu:auth-change",stop,{once:true});
  void load();
  startAutoRefresh(()=>load({preserve:true}),{canRefresh:()=>active&&!saving});
}
