import { staffReady } from "../core/staff_workspace.js";
import * as patients from "../api/patient.js";
import * as doctors from "../api/doctor.js";
import * as schedules from "../api/schedule.js";
import * as encounters from "../api/encounter.js";
import { initEncounterList } from "../core/staff_encounters.js";
import { $, esc, today, date, time, badge, panel, stats, facts, dialog, bindDialog, empty, table, pagination, run, submit, status, encounterSummary, encounterColumns } from "../core/staff_ui.js";

const user = await staffReady;
if (user) {
  bindDialog();
  const page = document.body.dataset.page;
  if (page === "overview") await run(overview);
  if (page === "encounters") await initEncounterList({ role: "reception" });
  if (page === "patients") await patientPage();
  if (page === "walk_in") await run(walkInPage);
  if (page === "coordination") await run(coordinationPage);
}
async function overview() {
  const work_date = today();
  const [all, confirmed, checked, list] = await Promise.all([encounters.listEncounters({ work_date, page_size: 1 }), encounters.listEncounters({ work_date, encounter_status: "CONFIRMED", page_size: 1 }), encounters.listEncounters({ work_date, encounter_status: "CHECKED_IN", page_size: 1 }), encounters.listStaffTickets({ work_date, page_size: 8 })]);
  $("#page-body").innerHTML = stats([["Lượt khám hôm nay", all.total, date(work_date)], ["Chờ check-in", confirmed.total, "Đã xác nhận lịch khám"], ["Đã check-in", checked.total, "Đang chờ vào phòng khám"]]) + panel("Tiếp nhận người bệnh", '<div class="doctor-shortcuts"><a href="encounters.html"><h3>Tra cứu phiếu & check-in</h3><p>Đối chiếu thông tin trước khi xác nhận người bệnh đến viện.</p></a><a href="walk_in.html"><h3>Khách khám trực tiếp</h3><p>Dùng hồ sơ đã có; hệ thống chọn ca và phát phiếu.</p></a><a href="patients.html"><h3>Hồ sơ bệnh nhân</h3><p>Tìm đúng người bệnh trước khi tạo hồ sơ mới.</p></a></div>') + panel("Phiếu khám hôm nay", table(["Người bệnh / phiếu", "Khung giờ", "Phòng / bác sĩ", "Trạng thái", "Thao tác"], list.items.map(e => `<tr>${encounterColumns(e)}<td><a href="encounters.html?schedule_id=${e.schedule_id}" class="button-link secondary">Xem ca khám</a></td></tr>`)), '<a href="encounters.html">Tất cả lượt khám →</a>');
}
function patientFacts(p) { return facts([["Mã hồ sơ", p.patient_id], ["Họ tên", p.full_name], ["Ngày sinh", date(p.dob)], ["Giới tính", p.gender], ["Số điện thoại", p.phone], ["CCCD / mã định danh", p.id_card], ["BHYT", p.health_insurance], ["Địa chỉ", p.address], ["Trạng thái", p.is_archived ? "Đã lưu trữ" : "Đang sử dụng"]]); }
function patientFields(p = {}, edit = false) {
  return `<div class="form-grid"><label class="full-width">Họ và tên *<input name="full_name" value="${esc(p.full_name)}" required maxlength="150"></label><label>Số điện thoại *<input name="phone" type="tel" value="${esc(p.phone)}" required maxlength="20" ${edit ? 'readonly aria-describedby="patient-phone-note"' : ""}></label><label>Ngày sinh<input name="dob" type="date" value="${esc(p.dob)}" max="${today()}"></label><label>CCCD / mã định danh<input name="id_card" inputmode="numeric" pattern="([0-9]{9}|[0-9]{12})" value="${esc(p.id_card)}" maxlength="12"></label><label>Giới tính<select name="gender"><option value="">Chưa cập nhật</option>${["Nam", "Nữ", "Khác"].map(value => `<option ${p.gender === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Mã thẻ BHYT<input name="health_insurance" pattern="[A-Za-z0-9]{10,15}" value="${esc(p.health_insurance)}" maxlength="15"></label><label class="full-width">Địa chỉ<input name="address" value="${esc(p.address)}" maxlength="255"></label></div><p class="muted">Cần ngày sinh hoặc CCCD/mã định danh để phân biệt người bệnh.</p>${edit ? '<p id="patient-phone-note" class="muted">Số điện thoại liên kết được thay đổi tại tài khoản chủ hồ sơ.</p>' : ""}`;
}
function patientPayload(form) {
  const data = Object.fromEntries(new FormData(form));
  for (const key of Object.keys(data)) data[key] = data[key].trim() || null;
  const feedback = form.querySelector('[role="status"]');
  if (!data.dob && !data.id_card) { feedback.textContent = "Cần ngày sinh hoặc CCCD/mã định danh để xác định hồ sơ."; feedback.dataset.error = "true"; return null; }
  if (!data.full_name) { feedback.textContent = "Vui lòng nhập họ tên người bệnh."; feedback.dataset.error = "true"; return null; }
  return data;
}
async function patientPage() {
  $("#page-body").innerHTML = panel("Tra cứu hồ sơ trước khi tạo mới", '<form id="patient-search-form" class="staff-toolbar"><label>Tên, số điện thoại hoặc CCCD<input name="q" type="search" maxlength="100" placeholder="Nhập thông tin để tìm hồ sơ"></label><button type="submit">Tìm hồ sơ</button><button id="patient-clear" class="secondary" type="button">Bỏ tìm kiếm</button></form><div id="patient-list"></div><div id="list-pagination" class="list-pagination"></div>') + panel("Tạo hồ sơ bệnh nhân", `<form id="profile-form">${patientFields()}<div class="actions"><button type="submit">Tạo / dùng lại hồ sơ</button><button type="reset" class="secondary">Xóa nội dung nhập</button></div><p role="status" class="form-feedback"></p><div id="patient-created"></div></form>`);
  let currentPage = 1, version = 0;
  async function load(page = 1) {
    currentPage = page;
    const current = ++version;
    await run(async () => {
      const result = await patients.listPatients({ q: $("#patient-search-form").elements.q.value.trim(), page, page_size: 15 });
      if (current !== version) return;
      $("#patient-list").innerHTML = table(["Hồ sơ", "Ngày sinh / CCCD", "Liên hệ", "Thao tác"], result.items.map(p => `<tr><td><strong>${esc(p.full_name)}</strong><small class="cell-subtitle">Hồ sơ #${p.patient_id}</small></td><td>${date(p.dob)}<small class="cell-subtitle">${esc(p.id_card || "—")}</small></td><td>${esc(p.phone || "—")}</td><td><div class="actions"><button data-patient="${p.patient_id}" class="secondary">Xem / cập nhật</button><a class="button-link secondary" href="walk_in.html?patient_id=${p.patient_id}">Tiếp nhận</a></div></td></tr>`));
      pagination(result, load);
      $("#patient-list").querySelectorAll("[data-patient]").forEach(button => button.addEventListener("click", () => run(async () => {
        const p = (await patients.getPatient(button.dataset.patient)).patient;
        dialog("Hồ sơ bệnh nhân", patientFacts(p) + `<form id="patient-edit-form">${patientFields(p, true)}<button type="submit">Lưu thông tin hồ sơ</button><p role="status" class="form-feedback"></p></form>`);
        $("#patient-edit-form").addEventListener("submit", event => { event.preventDefault(); const data = patientPayload(event.currentTarget); if (!data) return; delete data.phone; submit(event.currentTarget, async () => { await patients.updatePatient(p.patient_id, data); await load(currentPage); }); });
      })));
    });
  }
  $("#patient-search-form").addEventListener("submit", event => { event.preventDefault(); load(); });
  $("#patient-clear").addEventListener("click", () => { $("#patient-search-form").reset(); load(); });
  $("#profile-form").addEventListener("submit", event => {
    event.preventDefault(); const form = event.currentTarget; const data = patientPayload(form); if (!data) return;
    submit(form, async () => {
      const result = await patients.createPatient(data); const p = result.patient;
      $("#patient-created").innerHTML = `<div class="staff-confirm"><strong>${result.patient_reused ? "Đã dùng lại hồ sơ hiện có" : "Đã tạo hồ sơ"}: ${esc(p.full_name)} · #${p.patient_id}</strong><p>${esc(result.message)}</p><a class="button-link" href="walk_in.html?patient_id=${p.patient_id}">Tiếp nhận khám trực tiếp →</a></div>`;
      await load();
    }, "Đã xác định hồ sơ người bệnh.");
  });
  await load();
}
async function allDoctors() {
  const first = await doctors.listDoctors({ page_size: 100 }); const items = [...first.items];
  for (let page = 2; (page - 1) * first.page_size < first.total; page++) items.push(...(await doctors.listDoctors({ page, page_size: first.page_size })).items);
  return items;
}
async function walkInPage() {
  const id = new URLSearchParams(location.search).get("patient_id");
  let selectedPatient = id && /^\d+$/.test(id) ? (await patients.getPatient(id)).patient : null;
  const doctorList = await allDoctors();
  $("#page-body").innerHTML = panel("01 / Chọn đúng người bệnh", '<form id="walkin-search" class="staff-toolbar"><label>Tìm hồ sơ theo tên, điện thoại hoặc CCCD<input type="search" name="q" required maxlength="100"></label><button type="submit">Tìm hồ sơ</button><a href="patients.html">Tạo hồ sơ mới →</a></form><div id="walkin-results"></div><div id="list-pagination" class="list-pagination"></div><div id="walkin-selected"></div>') + panel("02 / Tiếp nhận khám", `<form id="walkin-form"><div class="form-grid"><label class="full-width">Bác sĩ *<select name="doctor_profile_id" required><option value="">Chọn bác sĩ tiếp nhận</option>${doctorList.map(d => `<option value="${d.doctor_profile_id}">${esc(d.full_name)} · ${esc(d.department_name)}</option>`).join("")}</select></label><label class="full-width">Triệu chứng<textarea name="symptoms" rows="4" maxlength="5000"></textarea></label></div><p class="scope-note">Hệ thống chọn ca còn tiếp nhận và khung giờ phù hợp, chốt phí khám và phát mã phiếu. Khách khám trực tiếp được check-in khi tiếp nhận.</p><button type="submit">Tiếp nhận và phát phiếu</button><p role="status" class="form-feedback"></p><div id="walkin-created"></div></form>`);
  function renderSelected() { $("#walkin-selected").innerHTML = selectedPatient ? `<div class="staff-confirm"><strong>Hồ sơ đã chọn</strong>${patientFacts(selectedPatient)}</div>` : '<p class="scope-note">Chọn hồ sơ người bệnh trước khi tiếp nhận.</p>'; }
  renderSelected();
  async function search(page = 1) {
    await run(async () => {
      const result = await patients.listPatients({ q: $("#walkin-search").elements.q.value.trim(), page, page_size: 10 });
      $("#walkin-results").innerHTML = table(["Họ tên", "Ngày sinh", "CCCD", "Điện thoại", "Chọn hồ sơ"], result.items.map(p => `<tr><td>${esc(p.full_name)}</td><td>${date(p.dob)}</td><td>${esc(p.id_card || "—")}</td><td>${esc(p.phone)}</td><td><button class="secondary" data-use-patient="${p.patient_id}">Dùng hồ sơ #${p.patient_id}</button></td></tr>`));
      pagination(result, search);
      $("#walkin-results").querySelectorAll("[data-use-patient]").forEach(button => button.addEventListener("click", () => { selectedPatient = result.items.find(p => p.patient_id === Number(button.dataset.usePatient)); renderSelected(); $("#walkin-created").innerHTML = ""; }));
    });
  }
  $("#walkin-search").addEventListener("submit", event => { event.preventDefault(); search(); });
  $("#walkin-form").addEventListener("submit", event => {
    event.preventDefault(); if (!selectedPatient || selectedPatient.is_archived) { status("Vui lòng chọn hồ sơ đang sử dụng của đúng người bệnh.", true); return; }
    const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); data.patient_id = selectedPatient.patient_id; data.doctor_profile_id = Number(data.doctor_profile_id);
    submit(form, async () => {
      const e = (await encounters.createWalkIn(data)).encounter;
      $("#walkin-created").innerHTML = `<div class="staff-confirm"><h3>Đã tiếp nhận và phát phiếu</h3>${encounterSummary(e)}<a href="encounters.html?schedule_id=${e.schedule_id}">Xem lượt khám trong ca →</a></div>`;
    }, "Đã tiếp nhận khám trực tiếp.");
  });
}
async function coordinationPage() {
  const id = new URLSearchParams(location.search).get("encounter_id");
  $("#page-body").innerHTML = panel("Điều phối lượt khám", `<form id="coordination-search" class="staff-toolbar"><label>Mã lượt khám<input type="number" name="encounter_id" min="1" step="1" required value="${id && /^\d+$/.test(id) ? id : ""}"></label><button type="submit">Tìm phương án chuyển</button></form><div id="transfer-context"></div><div id="transfer-options"></div><div id="list-pagination" class="list-pagination"></div>`) + panel("Lịch phòng / ca", '<form id="room-search" class="staff-toolbar"><label>Bác sĩ<select id="coordination-doctor"><option value="">Chọn bác sĩ để xem ca</option></select></label><button type="submit">Xem ca tiếp nhận</button></form><div id="room-schedules"></div><div id="schedule-pagination" class="list-pagination"></div>');
  const doctorList = await allDoctors();
  $("#coordination-doctor").insertAdjacentHTML("beforeend", doctorList.map(d => `<option value="${d.doctor_profile_id}">${esc(d.full_name)} · ${esc(d.department_name)}</option>`).join(""));
  async function options(page = 1) {
    const encounterId = $("#coordination-search").elements.encounter_id.value;
    if (!encounterId) return;
    $("#transfer-context").innerHTML = ""; $("#transfer-options").innerHTML = "";
    await run(async () => {
      const e = (await encounters.getEncounter(encounterId)).encounter;
      $("#transfer-context").innerHTML = encounterSummary(e);
      const result = await encounters.getTransferOptions(encounterId, { page, page_size: 12 });
      $("#transfer-options").innerHTML = result.items.length ? `<div class="shift-grid">${result.items.map(s => `<article class="shift-card"><h3>${esc(s.doctor_name)}</h3>${facts([["Phòng", s.room_name], ["Ngày", date(s.work_date)], ["Ca", `${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)}`]])}<button data-transfer="${s.schedule_id}" ${s.slots.length ? "" : "disabled"}>Chọn ca chuyển</button></article>`).join("")}</div>` : empty("Không có ca chuyển cùng chuyên khoa còn chỗ.");
      pagination(result, options);
      $("#transfer-options").querySelectorAll("[data-transfer]").forEach(button => button.addEventListener("click", () => {
        const s = result.items.find(item => item.schedule_id === Number(button.dataset.transfer));
        dialog("Xác nhận chuyển bác sĩ / ca", facts([["Người bệnh", e.patient_name], ["Bác sĩ mới", s.doctor_name], ["Phòng", s.room_name], ["Ngày", date(s.work_date)]]) + `<form id="transfer-form"><label>Khung giờ mới *<select name="appointment_time" required>${s.slots.map(slot => `<option value="${slot.appointment_time}">${time(slot.starts_at)} – ${time(slot.ends_at)}</option>`).join("")}</select></label><label>Lý do chuyển *<textarea name="reason" rows="3" maxlength="1000" required></textarea></label><button type="submit">Xác nhận chuyển ca</button><p role="status" class="form-feedback"></p></form>`);
        $("#transfer-form").addEventListener("submit", event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); data.schedule_id = s.schedule_id; submit(event.currentTarget, async () => { await encounters.transfer(e.encounter_id, data); await options(); }, "Đã chuyển bác sĩ / ca và cấp lại phiếu."); });
      }));
    });
  }
  $("#coordination-search").addEventListener("submit", event => { event.preventDefault(); options(); });
  async function loadSchedules(page = 1) {
    const doctor = $("#coordination-doctor").value; if (!doctor) return;
    await run(async () => {
      const result = await schedules.listDoctorSchedules(doctor, { page, page_size: 12 });
      $("#room-schedules").innerHTML = table(["Ngày", "Phòng", "Giờ", "Đã đặt / sức chứa", "Trạng thái", "Lượt khám"], result.items.map(s => `<tr><td>${date(s.work_date)}</td><td>${esc(s.room_name)}</td><td>${esc(s.start_time.slice(0,5))} – ${esc(s.end_time.slice(0,5))}</td><td>${s.booked_count} / ${s.max_quota}</td><td>${badge(s.schedule_status)}</td><td><a href="encounters.html?schedule_id=${s.schedule_id}">Xem lượt trong ca →</a>${s.schedule_status === "UNAVAILABLE" ? `<button type="button" class="secondary" data-affected="${s.schedule_id}">Các lượt cần điều phối</button>` : ""}</td></tr>`));
      $("#room-schedules").querySelectorAll("[data-affected]").forEach(button => button.addEventListener("click", () => run(async () => {
        async function affected(page = 1) {
          const response = await encounters.listAffectedEncounters(button.dataset.affected, { page, page_size: 20 });
          dialog("Lượt khám cần điều phối", table(["Người bệnh", "Khung giờ", "Phòng / bác sĩ", "Trạng thái", "Điều phối"], response.items.map(e => `<tr>${encounterColumns(e)}<td>${["CONFIRMED", "CHECKED_IN"].includes(e.encounter_status) ? `<a href="coordination.html?encounter_id=${e.encounter_id}">Chọn ca chuyển →</a>` : `<a href="encounters.html?schedule_id=${e.schedule_id}">Xem lượt khám →</a>`}</td></tr>`)) + '<div id="affected-pagination" class="list-pagination"></div>');
          pagination(response, page => run(() => affected(page)), $("#affected-pagination"));
        }
        await affected();
      })));
      pagination(result, loadSchedules, $("#schedule-pagination"));
    });
  }
  $("#room-search").addEventListener("submit", event => { event.preventDefault(); loadSchedules(); });
  if (id && /^\d+$/.test(id)) await options();
}
