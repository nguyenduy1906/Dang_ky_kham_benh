import { clinicalPayload,saveClinicalProfile,finishClinicalProfile,beginClinicalProfile } from "./doctor_clinical_workflow.js";
import { recordDetailView } from "./record_detail_view.js";
import { canEditClinicalShift, clinicalShiftEnded } from "./clinical_shift_access.js";
import { $, esc, date, today, panel, facts, dialog, table, badge, money } from "./staff_ui.js";

const normalize = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g,"d").toLowerCase().trim();
function previousVisits(p) { return p.history || []; }
function historyMarkup(p) {
  return `<section class="panel clinical-history-panel" aria-labelledby="clinical-history-title"><div class="section-heading"><div><h2 id="clinical-history-title">Lịch sử khám bệnh</h2></div><span class="clinical-info-tag">Chỉ xem</span></div>${p.historyError ? `<p role="status">${esc(p.historyError)}</p>` : ""}${table(["Ngày khám","Bác sĩ / phòng","Trạng thái","Kết quả"],previousVisits(p).map((v,i)=>`<tr><td>${date(v.day)}<small class="cell-subtitle">Lượt ${v.id}</small></td><td>${esc(v.doctor)}<small class="cell-subtitle">${esc(v.room)}</small></td><td>${badge(v.status)}</td><td><button type="button" class="secondary" data-clinical-history="${i}">${v.status === "COMPLETED" ? "Xem bệnh án / đơn thuốc" : "Xem lượt khám"}</button></td></tr>`))}</section>`;
}
async function showHistory(p, index) {
  const v = previousVisits(p)[index];
  if (!v) return;
  if (v.loadClinical) {
    try {Object.assign(v,await v.loadClinical());}
    catch {dialog("Không tải được bệnh án",'<p role="status">Chưa tải được kết quả lần khám này. Vui lòng thử lại.</p>');return;}
  }

  const clinical = v.status === "COMPLETED" ? panel("Bệnh án",facts([["Chẩn đoán",v.diagnosis],["Hướng điều trị",v.treatment],["Ghi chú bác sĩ",v.note],["Ngày khám",date(v.day)]])) + panel("Đơn thuốc", v.meds.length ? table(["Thuốc","Liều dùng","Số lượng","Hướng dẫn"],v.meds.map(m=>`<tr>${m.map(value=>`<td>${esc(value)}</td>`).join("")}</tr>`)) : '<p>Bác sĩ không kê thuốc cho lần khám này.</p>') : '<p class="scope-note">Người bệnh không đến khám. Không có bệnh án hoặc đơn thuốc cho lượt này.</p>';
  dialog(v.status === "COMPLETED" ? "Bệnh án & đơn thuốc · Chỉ xem" : "Lượt không đến khám", recordDetailView({name:p.name,patientCode:p.patient,status:v.status,patientFields:[["Ngày sinh",date(p.dob)],["Giới tính",p.gender],["Điện thoại",p.phone],["BHYT",p.insurance]],visitFields:[["Mã lượt khám",v.id],["Mã phiếu",v.ticket],["Ngày khám",date(v.day)],["Khung giờ",v.clock],["Bác sĩ",v.doctor],["Chuyên khoa",v.department],["Phòng",v.room],["Hình thức",v.type],["Phí khám",v.fee == null ? "Chưa cập nhật" : money(v.fee)]],symptoms:v.symptom,clinical}));
}

export function renderClinicalDesign(options = {}) {
  let profiles = options.profiles || [];
  let active = true, dataVersion = 0, selectionVersion = 0;
  const savedProfiles = new Map();
  let saving = false;
  const shiftDay = today();
  const periodFor = p => Number(String(p.start_time || "").slice(0,2)) < 12 ? "morning" : "afternoon";
  const shiftFor = p => p;
  const canEdit = p => p.payment_confirmed === true && !["CLOSED","UNAVAILABLE"].includes(p.schedule_status) && p.status === "IN_PROGRESS" && canEditClinicalShift(p);
  const initiallySelected = profiles.find(p=>p.id === options.initialId);
  const pinnedReadOnlyId = initiallySelected && (options.mode === "view" || !canEdit(initiallySelected)) ? initiallySelected.id : null;
  const visible = p => p.id === pinnedReadOnlyId || !clinicalShiftEnded(shiftFor(p));
  let selected = null, dirty = false, editing = false;
  $("#page-body").innerHTML = `<div class="clinical-design">
    <section class="panel clinical-lookup" aria-labelledby="clinical-lookup-title">
      <div class="section-heading"><div><h2 id="clinical-lookup-title">Tìm người bệnh</h2></div></div>
      <div class="clinical-search-toolbar"><div class="clinical-search-half"><label for="clinical-profile-search">Tên bệnh nhân, mã hồ sơ, mã lượt khám hoặc số điện thoại</label>
      <input id="clinical-profile-search" type="search" placeholder="Nhập để tìm hồ sơ bệnh nhân…" autocomplete="off" aria-controls="clinical-profile-results"></div><label class="clinical-date-field">Ngày khám<input id="clinical-work-date" type="date" value="${shiftDay}" aria-controls="clinical-profile-results"></label><label class="clinical-period-field">Ca làm việc<select id="clinical-period"><option value="morning">Ca sáng</option><option value="afternoon">Ca chiều</option><option value="all">Cả ngày</option></select></label></div>
      <div id="clinical-profile-results" class="clinical-patient-list"></div>
      <p id="clinical-search-feedback" class="muted" role="status"></p>
    </section>
    <div id="clinical-design-body"></div>
  </div>`;
  $("#clinical-period").value = "all";
  function sizePatientList() {
    const wrapper = $("#clinical-profile-results .table-wrap");
    if (!wrapper) return;
    const rows = Array.from(wrapper.querySelectorAll("tbody tr")).slice(0,5);
    const header = wrapper.querySelector("thead");
    const height = (header?.getBoundingClientRect().height || 0) + rows.reduce((sum,row) => sum + row.getBoundingClientRect().height,0);
    if (height > 0) wrapper.style.maxHeight = `${Math.ceil(height) + 1}px`;
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role","region");
    wrapper.setAttribute("aria-label","Danh sách bệnh nhân, cuộn để xem thêm");
  }
  window.addEventListener("resize",sizePatientList);
  function renderResults() {
    const query = normalize($("#clinical-profile-search").value);
    const period = $("#clinical-period").value;
    const selectedDay = $("#clinical-work-date").value;
    const matches = profiles.filter(p => (!selectedDay || selectedDay === (p.work_date || shiftDay)) && visible(p) && (period === "all" || periodFor(p) === period) && normalize(`${p.name} ${p.patient} ${p.id} ${p.phone} ${p.phone.replace(/ /g,"")}`).includes(query));
    $("#clinical-profile-results").innerHTML = table(["Người bệnh / phiếu khám", "Khung giờ", "Phòng / bác sĩ", "Trạng thái", "Thao tác"], matches.map(p => `<tr${selected?.id === p.id ? ' class="is-selected"' : ''}><td><strong>${esc(p.name)}</strong><small class="cell-subtitle">${p.patient} · ${p.id}</small></td><td>${date(p.work_date || shiftDay)}<small class="cell-subtitle">${p.clock}</small></td><td>${esc(p.room)}<small class="cell-subtitle">${esc(p.doctor || "Chưa cập nhật")}</small></td><td>${badge(savedProfiles.get(p.id)?.status || p.status || "IN_PROGRESS")}</td><td><button type="button" class="clinical-detail-link" data-profile="${p.id}">Chi tiết</button>${canEdit(p) ? `<button type="button" class="clinical-detail-link" data-profile="${p.id}" data-edit>Chỉnh sửa</button>` : ""}</td></tr>`));
    sizePatientList();
    $("#clinical-search-feedback").textContent = matches.length ? "" : !period ? "Hiện không trong ca làm việc. Chọn ca để xem danh sách." : "Không tìm thấy hồ sơ phù hợp trong ca đã chọn.";
    $("#clinical-profile-results").querySelectorAll("[data-profile]").forEach(button => button.addEventListener("click", async () => {
      if (saving) return;
      const nextEditing = button.hasAttribute("data-edit");
      let nextProfile = profiles.find(p => p.id === button.dataset.profile);
      if (!visible(nextProfile) || (nextEditing && !canEdit(nextProfile))) { renderResults(); return; }
      if (button.dataset.profile === selected?.id && editing === nextEditing) { $("#clinical-design-body").scrollIntoView({behavior:"smooth",block:"start"}); return; }
      if (dirty && !confirm("Nội dung đang nhập chưa lưu. Chuyển sang hồ sơ khác?")) return;
      const requestVersion = ++selectionVersion;
      if (nextProfile.needsDetail && options.loadProfile) {
        try {
          const loaded = await options.loadProfile(nextProfile.encounter_id);
          if (!active || requestVersion !== selectionVersion) return;
          const index = profiles.findIndex(p=>p.id === loaded.id);
          if (index < 0) return;
          profiles[index] = loaded; nextProfile = loaded;
        } catch {if (active) $("#clinical-search-feedback").textContent = "Không tải được hồ sơ đã chọn. Vui lòng thử lại.";return;}
      }
      selected = nextProfile; editing = nextEditing && canEdit(nextProfile); dirty = false; renderResults(); renderEditor(); $("#clinical-design-body").scrollIntoView({behavior:"smooth",block:"start"});
    }));
  }
  function renderEditor() {
    const p = savedProfiles.get(selected.id) || selected;
    $("#clinical-design-body").innerHTML = `<section class="panel clinical-patient-summary" aria-label="Hồ sơ đang chọn">
      <div class="clinical-patient-heading"><div><h2>${esc(p.name)}</h2><p>${p.patient} · ${date(p.dob)} · ${esc(p.gender)}</p></div><div><span class="clinical-info-tag">${p.id}</span>${p.payment_confirmed === true && p.status === "CHECKED_IN" && canEditClinicalShift(p) ? '<button id="clinical-begin" type="button">Bắt đầu khám</button>' : ""}</div></div>
      <div class="clinical-summary-grid">${facts([["Số điện thoại",p.phone],["BHYT",p.insurance],["Ngày khám",date(p.work_date || shiftDay)],["Khung giờ",p.clock],["Phòng / chuyên khoa",`${p.room} · ${p.department || "Chưa cập nhật"}`]])}</div>
      <div class="clinical-symptom"><strong>Lý do đến khám / triệu chứng đã khai</strong><p>${esc(p.symptom)}</p></div>
    </section>
    <form id="clinical-design-form">
      <section class="panel clinical-results-panel" aria-labelledby="clinical-result-title">
        <div class="section-heading"><div><h2 id="clinical-result-title">Kết quả khám bệnh</h2></div></div>
        <label>Chẩn đoán <span aria-hidden="true">*</span><textarea name="diagnosis" required maxlength="10000" rows="3" placeholder="Nhập kết luận chẩn đoán sau thăm khám…">${esc(p.diagnosis)}</textarea></label>
        <div class="clinical-result-grid"><label>Hướng điều trị<textarea name="treatment" maxlength="10000" rows="5" placeholder="Phương án điều trị và theo dõi…">${esc(p.treatment)}</textarea></label><label>Ghi chú bác sĩ / lời dặn<textarea name="doctor_notes" maxlength="10000" rows="5" placeholder="Lưu ý chăm sóc, theo dõi và tái khám…">${esc(p.note)}</textarea></label></div>
        
      </section>
      <section class="panel clinical-prescription-panel" aria-labelledby="clinical-prescription-title">
        <div class="section-heading"><div><h2 id="clinical-prescription-title">Đơn thuốc <span id="clinical-med-count" class="clinical-count"></span></h2></div><button type="button" id="clinical-add-medicine" class="secondary">＋ Thêm thuốc</button></div>
        
        <div class="clinical-medicine-scroll"><table class="clinical-medicine-table"><thead><tr><th scope="col">STT</th><th scope="col">Tên thuốc *</th><th scope="col">Liều dùng</th><th scope="col">Số lượng *</th><th scope="col">Hướng dẫn sử dụng</th><th scope="col">Thao tác</th></tr></thead><tbody id="clinical-medicine-rows"></tbody></table></div>
        <p id="clinical-no-medicine" class="clinical-no-medicine" hidden>Không kê thuốc cho lượt khám này. Bạn vẫn có thể lưu bệnh án không kèm thuốc.</p>
      </section>
      ${historyMarkup(p)}
      <div class="clinical-editor-footer"><p id="clinical-save-feedback" role="status"></p><div class="actions"><button id="clinical-reload" type="button" class="secondary">Đọc lại hồ sơ</button><button type="submit">Lưu bệnh án và đơn thuốc</button></div></div>
    </form>`;
    function updateCount() {
      const rows = Array.from($("#clinical-medicine-rows").children);
      rows.forEach((row,i) => {row.querySelector(".medicine-index").textContent=i+1;row.querySelector("button").setAttribute("aria-label",`Xóa thuốc số ${i+1}`);});
      $("#clinical-med-count").textContent = `${rows.length} thuốc`;
      $("#clinical-no-medicine").hidden = rows.length > 0;
    }
    function addMedicine(values = ["","","1",""]) {
      if ($("#clinical-medicine-rows").children.length >= 100) return;
      const row = document.createElement("tr");
      row.innerHTML = `<td class="medicine-index"></td>${["Tên thuốc","Liều dùng","Số lượng","Hướng dẫn sử dụng"].map((name,i) => `<td><input data-medicine="${i}" aria-label="${name}" ${i === 2 ? 'type="number" min="1" max="100000" step="1" required' : `type="text" maxlength="${[255,1000,0,3000][i]}" `} value="${esc(values[i])}" placeholder="${name}"></td>`).join("")}<td><button type="button" class="clinical-remove">Xóa</button></td>`;
      row.querySelector("button").addEventListener("click", () => {row.remove();dirty=true;updateCount();});
      $("#clinical-medicine-rows").append(row);updateCount();
    }
    if (savedProfiles.has(p.id) || (p.meds.length || !editing)) p.meds.forEach(addMedicine);
    else addMedicine(p.meds[0]);
    updateCount();
    $("#clinical-design-body").querySelectorAll("[data-clinical-history]").forEach(button => button.addEventListener("click", () => showHistory(p, Number(button.dataset.clinicalHistory))));
    $("#clinical-add-medicine").addEventListener("click", () => {addMedicine();dirty=true;$("#clinical-medicine-rows").lastElementChild?.querySelector("input").focus();});
    const form = $("#clinical-design-form");
    form.addEventListener("input", () => {dirty=true;});
    async function performAction(action,feedback) {
      if(saving || !active) return false;
      saving=true;lockEditor();
      $("#clinical-work-date").disabled=true;$("#clinical-period").disabled=true;
      try {await action();return active;}
      catch(error) {if(active) feedback.textContent=error.message || "Không thực hiện được thao tác. Vui lòng thử lại.";return false;}
      finally {saving=false;if(active){$("#clinical-work-date").disabled=false;$("#clinical-period").disabled=false;lockEditor();}}
    }
    $("#clinical-reload").addEventListener("click", async()=>{
      if(saving || (dirty && !confirm("Đọc lại hồ sơ sẽ bỏ nội dung chưa lưu. Tiếp tục?"))) return;
      const ok=await performAction(async()=>{
        const loaded=await options.loadProfile(p.encounter_id);
        if(!active)return;
        const index=profiles.findIndex(row=>row.id===p.id);if(index>=0)profiles[index]=loaded;
        selected=loaded;savedProfiles.delete(p.id);dirty=false;editing=editing&&canEdit(loaded);
      },$("#clinical-save-feedback"));
      if(ok){renderResults();renderEditor();}
    });
    $("#clinical-begin")?.addEventListener("click",async()=>{
      if(saving || !confirm(`Bắt đầu khám cho ${p.name}?`))return;
      const feedback=$("#clinical-save-feedback");feedback.textContent="Đang bắt đầu khám…";
      const ok=await performAction(async()=>{
        const e=await beginClinicalProfile(p);if(!active)return;
        p.status=e.encounter_status;selected=p;editing=true;dirty=false;
      },feedback);
      if(ok){renderResults();renderEditor();}
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (saving || !editing || !canEdit(p)) {lockEditor();return;}
      const feedback=$("#clinical-save-feedback");
      let payload;
      try {
        payload=clinicalPayload(Object.fromEntries(new FormData(form)),Array.from($("#clinical-medicine-rows").children).map(row=>Array.from(row.querySelectorAll("input")).map(input=>input.value)));
      } catch(error) {feedback.textContent=error.message;return;}
      feedback.textContent="Đang lưu bệnh án và đơn thuốc…";
      const ok=await performAction(async()=>{
        const saved=await saveClinicalProfile(p,payload);if(!active)return;
        savedProfiles.set(p.id,saved);Object.assign(p,saved);selected=p;dirty=false;
      },feedback);
      if(!ok)return;
      feedback.textContent="Đã lưu bệnh án và đơn thuốc.";
      dialog("Xác nhận hoàn thành lượt khám", `<p>Xác nhận hoàn thành lượt khám cho <strong>${esc(p.name)}</strong>?</p>${facts([["Mã hồ sơ",p.patient],["Mã lượt khám",p.id],["Ngày khám",date(p.work_date)],["Khung giờ",p.clock],["Chẩn đoán",payload.diagnosis],["Số thuốc",String(payload.items.length)]])}<div class="actions"><button id="clinical-confirm-complete" type="button">Xác nhận</button><button id="clinical-complete-later" type="button" class="secondary">Để sau</button></div><p id="clinical-completion-feedback" role="status"></p>`);
      $("#clinical-complete-later").addEventListener("click",()=>{if(!saving)$("#staff-dialog").close();});
      $("#clinical-confirm-complete").addEventListener("click",async event=>{
        if(saving || !active)return;
        const button=event.currentTarget;button.disabled=true;
        const status=$("#clinical-completion-feedback");status.textContent="Đang xác nhận hoàn tất…";
        const done=await performAction(async()=>{
          const e=await finishClinicalProfile(p);if(!active)return;
          p.status=e.encounter_status;savedProfiles.set(p.id,{...p});selected=p;editing=false;
        },status);
        if(!active)return;
        if(done){$("#staff-dialog").close();renderResults();renderEditor();$("#clinical-save-feedback").textContent="Đã hoàn tất lượt khám.";}
        else button.disabled=!canEdit(p);
      });
    });
    form.addEventListener("input", event => event.target.setCustomValidity?.(""));
    lockEditor();
  }
  function lockEditor() {
    const form = $("#clinical-design-form");
    if (!form || !selected) return;
    const allowed = editing && canEdit(selected);
    if (!allowed) editing = false;
    form.querySelectorAll("input,textarea").forEach(input => {input.readOnly = !allowed || saving;});
    const reload=$("#clinical-reload");if(reload)reload.disabled=saving;
    const begin=$("#clinical-begin");if(begin){begin.disabled=saving;begin.hidden=selected.payment_confirmed!==true||!canEditClinicalShift(selected)||selected.status!=="CHECKED_IN";}
    form.querySelectorAll(".clinical-remove,#clinical-add-medicine,button[type=submit]").forEach(button => {button.hidden = !allowed;button.disabled = !allowed || saving;});
  }
  const accessSignature = () => profiles.map(p => `${visible(p)}:${canEdit(p)}`).join(",");
  let eligibility = accessSignature();
  const shiftTimer = setInterval(() => {
    if (!saving && selected && !visible(selected)) {
      selected = null; editing = false; dirty = false;
      $("#clinical-design-body").replaceChildren();
      $("#staff-dialog").close();
    }
    const next = accessSignature();
    if (next !== eligibility) {eligibility = next;renderResults();lockEditor();}
  }, 1000);
  const stopTimer = () => {active=false;$("#page-body").replaceChildren();$("#staff-dialog").close();dataVersion++;selectionVersion++;clearInterval(shiftTimer);window.removeEventListener("resize",sizePatientList);};
  window.addEventListener("pagehide", stopTimer, {once:true});
  window.addEventListener("neu:auth-change", stopTimer, {once:true});
  $("#clinical-work-date").addEventListener("change", async () => {
    if(saving)return;
    const day = $("#clinical-work-date").value;
    if (!day || !options.loadDay) {renderResults();return;}
    if (dirty && !confirm("Nội dung chưa lưu sẽ bị bỏ khi đổi ngày. Tiếp tục?")) {$("#clinical-work-date").value=selected?.work_date || shiftDay;return;}
    const version=++dataVersion;selectionVersion++;
    selected=null;editing=false;dirty=false;profiles=[];
    $("#clinical-design-body").replaceChildren();renderResults();
    $("#clinical-search-feedback").textContent="Đang tải lượt khám…";
    try {const rows=await options.loadDay(day);if(active && version===dataVersion){profiles=rows;renderResults();}}
    catch {if(active && version===dataVersion) $("#clinical-search-feedback").textContent="Không tải được lượt khám. Vui lòng thử lại.";}
  });
  $("#clinical-period").addEventListener("change", renderResults);
  $("#clinical-profile-search").addEventListener("input",renderResults);
  window.addEventListener("beforeunload", event => {if(dirty){event.preventDefault();event.returnValue="";}});
  if (options.initialId) {
    selected = profiles.find(p => p.id === options.initialId) || null;
    if (selected) {
      $("#clinical-work-date").value = selected.work_date || shiftDay;
      $("#clinical-period").value = "all";
      editing = options.mode !== "view" && canEdit(selected);
      renderResults();renderEditor();
      $("#clinical-design-body").scrollIntoView({behavior:"smooth",block:"start"});
      return;
    }
  }
  renderResults();
}
