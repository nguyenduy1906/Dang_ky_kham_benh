import { code, parseCode } from "../core/business_codes.js";
import { initOverviewPeriod, overviewRows, overviewDayParams } from "../core/staff_overview.js";
import { staffReady } from "../core/staff_workspace.js";
import * as schedules from "../api/schedule.js";
import * as encounters from "../api/encounter.js";
import * as records from "../api/medical_record.js";
import { initEncounterList } from "../core/staff_encounters.js";
import { $, esc, today, date, time, money, badge, facts, panel, stats, empty, dialog, bindDialog, pagination, run, submit, status, encounterSummary, table, encounterColumns } from "../core/staff_ui.js";

const user = await staffReady;
if (user) {
  bindDialog();
  const page = document.body.dataset.page;
  if (page === "overview") await run(overview);
  if (page === "schedule") await schedulePage();
  if (page === "encounters" || page === "history") await initEncounterList({ role: "doctor", completed: page === "history" });
  if (page === "clinical") await run(clinical);
}

async function overview() {
  await initOverviewPeriod(async (range, options) => {
    const params = overviewDayParams(range);
    const rangeLabel = `${date(range.from)}${range.to !== range.from ? ` – ${date(range.to)}` : ""}`;
    const [all, shifts, upcoming] = await Promise.all([
      overviewRows(encounters.listEncounters, params, range, options),
      overviewRows(schedules.listOwnSchedules, { from_date: range.from, to_date: range.to }, range, options),
      overviewRows(encounters.listStaffTickets, params, range, options),
    ]);
    return stats([["Lượt khám", all.length, rangeLabel], ["Đã check-in", all.filter(e => e.encounter_status === "CHECKED_IN").length, "Sẵn sàng chờ khám"], ["Đang khám", all.filter(e => e.encounter_status === "IN_PROGRESS").length, "Trong phạm vi được giao"]]) +
    panel("Ca làm việc trong thời gian đã chọn", shiftCards(shifts), '<a href="schedule.html">Xem lịch làm việc →</a>') +
    panel("Lượt khám trong thời gian đã chọn", table(["Người bệnh", "Khung giờ", "Phòng / bác sĩ", "Trạng thái", "Thao tác"], upcoming.slice(0, 8).map(e => `<tr>${encounterColumns(e)}<td><a class="button-link secondary" href="clinical.html?encounter_id=${e.encounter_id}">Mở lượt khám</a></td></tr>`)), '<a href="encounters.html">Tất cả lượt được giao →</a>') +
    panel("Khu vực làm việc", '<div class="doctor-shortcuts"><a href="clinical.html"><h3>Bệnh án & đơn thuốc</h3><p>Ghi chẩn đoán và điều trị cho lượt khám được giao.</p></a><a href="history.html"><h3>Lịch sử khám</h3><p>Xem và bổ sung bệnh án sau hoàn tất, có lưu lý do.</p></a><a href="../components/profile.html?role=doctor"><h3>Hồ sơ cá nhân</h3><p>Cập nhật thông tin cá nhân, chuyên môn và ảnh đại diện.</p></a></div>');
  });
}
function shiftCards(items, allowLeave = false) {
  return items.length ? `<div class="shift-grid">${items.map(s => `<article class="shift-card"><div class="section-heading"><h3>${esc(s.room_name)}</h3>${badge(s.schedule_status)}</div><p class="doctor-shift-time">${esc(s.start_time.slice(0, 5))} — ${esc(s.end_time.slice(0, 5))}</p>${facts([["Ngày làm việc", date(s.work_date)], ["Chuyên khoa", s.department_name], ["Đã đặt / sức chứa", `${s.booked_count} / ${s.max_quota}`], ["Thời lượng lượt khám", `${s.slot_minutes} phút`], ...(s.unavailable_reason ? [["Lý do nghỉ", s.unavailable_reason]] : [])])}<div class="actions"><a class="button-link" href="encounters.html?schedule_id=${s.schedule_id}">Xem lượt trong ca →</a>${allowLeave && s.work_date >= today() && ["OPEN", "FULL"].includes(s.schedule_status) ? `<button class="secondary" data-leave="${s.schedule_id}">Báo nghỉ ca này</button>` : ""}</div></article>`).join("")}</div>` : empty("Chưa có ca làm việc trong khoảng đã chọn.");
}
async function schedulePage() {
  $("#page-body").innerHTML = panel("Lịch được phân công", `<form id="schedule-filters" class="staff-toolbar"><label>Từ ngày<input type="date" name="from_date" value="${today()}"></label><label>Đến ngày<input type="date" name="to_date"></label><button type="submit">Xem lịch</button><button type="reset" class="secondary">Xem tất cả</button></form><div id="schedule-list"></div><div id="list-pagination" class="list-pagination"></div>`);
  const form = $("#schedule-filters");
  async function load(page = 1) {
    await run(async () => {
      const result = await schedules.listOwnSchedules({ ...Object.fromEntries(new FormData(form)), page, page_size: 12 });
      $("#schedule-list").innerHTML = shiftCards(result.items, true); pagination(result, load);
      document.querySelectorAll("[data-leave]").forEach(button => button.addEventListener("click", () => {
        const shift = result.items.find(s => s.schedule_id === Number(button.dataset.leave));
        dialog("Báo nghỉ ca làm việc", facts([["Phòng", shift.room_name], ["Ngày", date(shift.work_date)], ["Giờ", `${shift.start_time.slice(0,5)} – ${shift.end_time.slice(0,5)}`]]) + '<form id="leave-form"><label>Lý do nghỉ *<textarea name="reason" required maxlength="500" rows="4"></textarea></label><p>Các lượt khám trong ca sẽ cần được lễ tân điều phối.</p><button type="submit">Xác nhận báo nghỉ</button><p role="status" class="form-feedback"></p></form>');
        $("#leave-form").addEventListener("submit", event => {
          event.preventDefault(); const reason = event.currentTarget.elements.reason.value.trim();
          if (!reason) { event.currentTarget.elements.reason.setCustomValidity("Vui lòng nhập lý do."); event.currentTarget.reportValidity(); return; }
          submit(event.currentTarget, async () => { await schedules.reportUnavailable(shift.schedule_id, { reason }); await load(page); }, "Đã báo nghỉ ca làm việc.");
        });
        $("#leave-form textarea").addEventListener("input", event => event.target.setCustomValidity(""));
      }));
    });
  }
  form.addEventListener("submit", event => { event.preventDefault(); load(); });
  form.addEventListener("reset", event => { event.preventDefault(); form.elements.from_date.value = ""; form.elements.to_date.value = ""; load(); });
  await load();
}
async function clinical() {
  const requested = new URLSearchParams(location.search).get("encounter_id");
  let encounter = null, record = null, dirty = false, loadVersion = 0;
  const result = await encounters.listEncounters({ page_size: 100 });
  const available = result.items.filter(e => ["CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(e.encounter_status));
  if (requested && /^\d+$/.test(requested)) {
    const e = (await encounters.getEncounter(requested)).encounter;
    if (!available.some(item => item.encounter_id === e.encounter_id)) available.unshift(e);
  }
  $("#page-body").innerHTML = panel("Chọn lượt khám", `<form id="encounter-picker" class="staff-toolbar"><label>Lượt khám<select id="clinical-encounter"><option value="">Chọn lượt khám được giao</option>${available.map(e => `<option value="${e.encounter_id}">${code("LK", e.encounter_id)} · ${esc(e.patient_name)} · ${date(e.work_date)} · ${esc(e.room_name)}</option>`).join("")}</select></label><label>Hoặc nhập mã lượt khám<input type="text" id="clinical-id" placeholder="LK_001"></label><button type="submit">Mở lượt khám</button></form><p class="muted">Danh sách hiển thị các lượt gần nhất. Có thể mở theo mã lượt khám hoặc từ trang Lượt khám được giao.</p>`) + '<div id="clinical-body"></div>';
  function medRow(item = {}) {
    const row = document.createElement("fieldset"); row.className = "medication-row";
    row.innerHTML = `<legend>Thuốc</legend><div class="form-grid"><label>Tên thuốc *<input data-field="medication_name" required maxlength="200" value="${esc(item.medication_name)}"></label><label>Liều dùng<input data-field="dosage" maxlength="200" value="${esc(item.dosage)}"></label><label>Số lượng *<input data-field="quantity" type="number" min="1" step="1" required value="${esc(item.quantity || 1)}"></label><label>Hướng dẫn sử dụng<input data-field="instructions" maxlength="500" value="${esc(item.instructions)}"></label></div><button class="secondary" type="button">Xóa thuốc</button>`;
    row.querySelector("button").addEventListener("click", () => { row.remove(); dirty = true; }); $("#medications").append(row);
  }
  async function select(id) {
    const version = ++loadVersion;
    if (dirty && !confirm("Nội dung chưa lưu sẽ bị bỏ. Mở lượt khám khác?")) return;
    $("#clinical-body").innerHTML = ""; encounter = null; record = null; dirty = false;
    if (!id) return;
    const e = (await encounters.getEncounter(id)).encounter;
    let r = null, items = [];
    try { r = (await records.getRecord(id)).medical_record; items = (await records.listPrescriptionItems(r.record_id, { page_size: 100 })).items; }
    catch (error) { if (error.code !== "MEDICAL_RECORD_NOT_FOUND") throw error; }
    if (version !== loadVersion) return;
    encounter = e; record = r;
    const url = new URL(location.href); url.searchParams.set("encounter_id", e.encounter_id); history.replaceState(null, "", url);
    $("#clinical-encounter").value = String(id); $("#clinical-id").value = "";
    $("#clinical-body").innerHTML = panel("Thông tin lượt khám", encounterSummary(e)) +
      (e.encounter_status === "CHECKED_IN" ? panel("Bắt đầu khám", '<form id="start-form"><p>Kiểm tra đúng người bệnh trước khi bắt đầu khám.</p><button type="submit">Bắt đầu khám</button><p role="status" class="form-feedback"></p></form>') : "") +
      (["IN_PROGRESS", "COMPLETED"].includes(e.encounter_status) ? `<form id="clinical-form">${panel("Nội dung bệnh án", `<div class="form-grid"><label class="full-width">Chẩn đoán *<textarea name="diagnosis" required maxlength="5000" rows="3">${esc(r?.diagnosis)}</textarea></label><label>Hướng điều trị<textarea name="treatment" maxlength="10000" rows="4">${esc(r?.treatment)}</textarea></label><label>Ghi chú bác sĩ<textarea name="doctor_notes" maxlength="10000" rows="4">${esc(r?.doctor_notes)}</textarea></label>${e.encounter_status === "COMPLETED" ? '<label class="full-width">Lý do bổ sung sau hoàn tất *<textarea name="reason" required maxlength="1000" rows="2"></textarea></label>' : ""}</div>`)}${panel("Đơn thuốc", '<p class="muted">Có thể lưu đơn thuốc trống nếu không kê thuốc.</p><div id="medications"></div><button id="add-medication" type="button" class="secondary">+ Thêm thuốc</button>')}<div class="actions"><button type="submit">${e.encounter_status === "COMPLETED" ? "Lưu bổ sung bệnh án" : "Lưu bệnh án & đơn thuốc"}</button>${e.encounter_status === "IN_PROGRESS" ? '<button id="complete-encounter" type="button" class="secondary">Lưu và hoàn tất khám</button>' : ""}<button type="button" id="clinical-reset" class="secondary">Đọc lại bản đã lưu</button></div><p role="status" class="form-feedback"></p></form>` : ["CONFIRMED", "HOLDING"].includes(e.encounter_status) ? '<p class="scope-note">Lượt khám cần được lễ tân check-in trước khi bắt đầu khám.</p>' : e.encounter_status !== "CHECKED_IN" ? '<p class="scope-note">Trạng thái này không cho phép ghi bệnh án.</p>' : "");
    $("#start-form")?.addEventListener("submit", event => { event.preventDefault(); submit(event.currentTarget, async () => { await encounters.startExamination(id); dirty = false; await select(id); }, "Đã bắt đầu khám."); });
    const form = $("#clinical-form"); if (!form) return;
    items.forEach(medRow);
    $("#add-medication").addEventListener("click", () => { medRow(); dirty = true; });
    form.addEventListener("input", () => { dirty = true; });
    $("#clinical-reset").addEventListener("click", () => run(() => select(id)));
    function values() {
      const fields = Object.fromEntries(new FormData(form));
      const meds = [...form.querySelectorAll(".medication-row")].map(row => Object.fromEntries([...row.querySelectorAll("[data-field]")].map(input => [input.dataset.field, input.dataset.field === "quantity" ? Number(input.value) : input.value.trim() || null])));
      return { fields, meds };
    }
    async function save(payload, complete = false) {
      const reason = payload.fields.reason || null;
      record = (await records.saveRecord(id, { diagnosis: payload.fields.diagnosis.trim(), treatment: payload.fields.treatment || null, doctor_notes: payload.fields.doctor_notes || null, reason, expected_version: record?.version ?? 0 })).medical_record;
      try {
        const rx = await records.savePrescriptionItems(record.record_id, { items: payload.meds, reason, expected_version: record.version }); record.version = rx.record_version;
      } catch (error) { error.message = `Bệnh án đã lưu, đơn thuốc chưa lưu: ${error.message} Vui lòng kiểm tra và gửi lại.`; throw error; }
      dirty = false;
      if (complete) { await records.completeEncounter(id); await select(id); }
    }
    form.addEventListener("submit", event => { event.preventDefault(); const payload = values(); if (!payload.fields.diagnosis.trim()) { status("Vui lòng nhập chẩn đoán.", true); return; } submit(form, () => save(payload)); });
    $("#complete-encounter")?.addEventListener("click", () => {
      if (!form.reportValidity()) return;
      const payload = values(); if (!payload.fields.diagnosis.trim()) { status("Vui lòng nhập chẩn đoán.", true); return; }
      dialog("Xác nhận hoàn tất khám", facts([["Người bệnh", encounter.patient_name], ["Chẩn đoán", payload.fields.diagnosis], ["Số dòng thuốc", String(payload.meds.length)]]) + '<form id="complete-form"><p>Bệnh án và đơn thuốc sẽ được lưu trước khi hoàn tất lượt khám. Bổ sung sau hoàn tất phải có lý do.</p><button type="submit">Xác nhận lưu và hoàn tất</button><p role="status" class="form-feedback"></p></form>');
      $("#complete-form").addEventListener("submit", event => { event.preventDefault(); submit(event.currentTarget, async () => { await save(payload, true); $("#staff-dialog").close(); }, "Đã hoàn tất khám."); });
    });
  }
  $("#encounter-picker").addEventListener("submit", event => { event.preventDefault(); const id = $("#clinical-id").value || $("#clinical-encounter").value; run(() => select(parseCode(id, "LK"))); });
  if (requested && /^\d+$/.test(requested)) await select(requested);
  window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
}
