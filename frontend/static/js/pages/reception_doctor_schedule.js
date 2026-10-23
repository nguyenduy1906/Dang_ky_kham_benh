import { staffReady } from "../core/staff_workspace.js";
import { $, panel, table, esc, today, date, facts, dialog, bindDialog, pagination } from "../core/staff_ui.js";

// Local presentation examples only; these are not backend schedule identifiers.
const examples = [
  ["Nguyễn Hoàng Minh", "Nội tổng quát", "Phòng Nội 101"],
  ["Trần Quốc Bảo", "Tim mạch", "Phòng Tim mạch 201"],
  ["Lê Thu Trang", "Da liễu", "Phòng Da liễu 202"],
  ["Phạm Đức Long", "Nhi khoa", "Phòng Nhi 102"],
  ["Vũ Minh Anh", "Sản phụ khoa", "Phòng Sản 301"],
  ["Lê Hoàng Nam", "Cơ xương khớp", "Phòng CXK 304"],
];
if (await staffReady) {
  bindDialog();
  const rows = examples.flatMap(([doctor, department, room], index) => [
    { id: `${index}-morning`, doctor, department, room, day: today(), count: 8 + index, capacity: 20, shift: "Ca sáng", hours: "08:00 – 11:30" },
    { id: `${index}-afternoon`, doctor, department, room, day: today(), count: 5 + index, capacity: 20, shift: "Ca chiều", hours: "13:30 – 17:00" },
  ]);
  $("#page-body").innerHTML = panel("Danh sách lịch khám bác sĩ", '<form id="doctor-schedule-filter" class="staff-toolbar" role="search" aria-label="Tra cứu lịch khám bác sĩ"><label>Tên bác sĩ, chuyên khoa hoặc phòng khám<input type="search" name="q" placeholder="Nhập thông tin để tìm lịch khám"></label><label>Chuyên khoa<input type="text" name="department" list="reception-schedule-departments" placeholder="Nhập hoặc chọn chuyên khoa" autocomplete="off"><datalist id="reception-schedule-departments"></datalist></label><label>Ngày khám<input type="date" name="work_date"></label></form><div id="doctor-schedule-list"></div><div id="list-pagination" class="list-pagination"></div>');
  const form = $("#doctor-schedule-filter");
  form.elements.work_date.value = today();
  $("#reception-schedule-departments").innerHTML = [...new Set(rows.map(row => row.department))].map(name => `<option value="${esc(name)}"></option>`).join("");
  const normalize = value => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
  function render(page = 1) {
    const q = normalize(form.elements.q.value.trim());
    const department = normalize(form.elements.department.value.trim());
    const matches = rows.filter(row => (!department || normalize(row.department).includes(department)) && (!q || normalize(`${row.doctor} ${row.department} ${row.room}`).includes(q)) && (!form.elements.work_date.value || row.day === form.elements.work_date.value));
    const current = Math.min(page, Math.max(1, Math.ceil(matches.length / 10)));
    $("#doctor-schedule-list").innerHTML = table(["Bác sĩ / chuyên khoa", "Ngày khám", "Ca / giờ khám", "Số lượng", "Phòng khám", "Thao tác"], matches.slice((current - 1) * 10, current * 10).map(row => `<tr><td><strong>BS. ${esc(row.doctor)}</strong><small class="cell-subtitle">${esc(row.department)}</small></td><td>${date(row.day)}</td><td><strong>${esc(row.shift)}</strong><small class="cell-subtitle">${esc(row.hours)}</small></td><td><span class="reception-schedule-count">${row.count} / ${row.capacity}</span></td><td>${esc(row.room)}</td><td><div class="reception-schedule-actions"><button type="button" class="secondary" data-schedule-detail="${esc(row.id)}">Xem chi tiết</button><button type="button" class="secondary" data-schedule-add="${esc(row.id)}">Thêm bệnh nhân</button></div></td></tr>`));
    pagination({ total: matches.length, page: current, page_size: 10 }, render);
  }
  form.addEventListener("input", () => render());
  form.addEventListener("change", () => render());
  form.addEventListener("submit", event => { event.preventDefault(); render(); });
  $("#doctor-schedule-list").addEventListener("click", event => {
    const button = event.target.closest("[data-schedule-detail], [data-schedule-add]");
    if (!button) return;
    const row = rows.find(item => item.id === (button.dataset.scheduleDetail || button.dataset.scheduleAdd));
    if (!row) return;
    if (button.hasAttribute("data-schedule-add")) {
      dialog("Thêm bệnh nhân vào ca khám", `<div class="reception-schedule-detail">${panel("Ca khám đã chọn", facts([["Bác sĩ", `BS. ${row.doctor}`], ["Ngày khám", date(row.day)], ["Ca / giờ khám", `${row.shift} · ${row.hours}`], ["Phòng khám", row.room], ["Số lượng", `${row.count} / ${row.capacity}`]]))}<section class="panel reception-patient-picker"><label>Tìm bệnh nhân<input type="search" id="schedule-patient-search" placeholder="Nhập họ tên, mã hồ sơ hoặc số điện thoại" aria-controls="schedule-patient-results"></label><div id="schedule-patient-results" class="reception-patient-results" aria-label="Kết quả tìm bệnh nhân"></div></section><div class="actions"><button type="button" class="secondary" data-schedule-cancel>Hủy</button><button type="button" disabled>Thêm bệnh nhân</button></div></div>`);
      // Local examples for choosing a patient; no registration is submitted.
      const patients = [
        {id:"BN_009",name:"Đặng Thu Phương",dob:"1996-10-29",phone:"0911000009"},
        {id:"BN_008",name:"Hoàng Quốc Việt",dob:"1989-06-14",phone:"0911000008"},
        {id:"BN_007",name:"Bùi Thị Mai",dob:"1968-12-02",phone:"0911000007"},
      ];
      const search = $("#schedule-patient-search"), results = $("#schedule-patient-results");
      let selected = "";
      function renderPatients() {
        const query = normalize(search.value.trim());
        const matches = patients.filter(patient => normalize(`${patient.name} ${patient.id} ${patient.phone}`).includes(query));
        results.innerHTML = matches.length ? matches.map(patient => `<button type="button" class="reception-patient-choice${selected === patient.id ? " is-selected" : ""}" data-pick-patient="${esc(patient.id)}" aria-pressed="${selected === patient.id}"><strong>${esc(patient.name)}</strong><span>${esc(patient.id)} · ${date(patient.dob)}</span><span>Điện thoại: ${esc(patient.phone)}</span></button>`).join("") : '<p class="scope-note">Không tìm thấy bệnh nhân phù hợp.</p>';
      }
      search.addEventListener("input", renderPatients);
      results.addEventListener("click", event => {
        const choice = event.target.closest("[data-pick-patient]");
        if (!choice) return;
        selected = choice.dataset.pickPatient;
        renderPatients();
        results.querySelector(`[data-pick-patient="${selected}"]`)?.focus();
      });
      $("#staff-dialog-content [data-schedule-cancel]").addEventListener("click", () => $("#staff-dialog").close());
      renderPatients();
      return;
    }
    dialog("Chi tiết lịch khám bác sĩ", `<div class="reception-schedule-detail"><div class="reception-checkin-heading"><div><span>LỊCH KHÁM BÁC SĨ</span><h3>BS. ${esc(row.doctor)}</h3><p>${esc(row.department)}</p></div><div class="reception-checkin-time"><span>${esc(row.shift)}</span><strong>${esc(row.hours)}</strong><small>${date(row.day)}</small></div></div>${panel("Thông tin ca khám", facts([["Bác sĩ", `BS. ${row.doctor}`], ["Chuyên khoa", row.department], ["Ngày khám", date(row.day)], ["Ca khám", row.shift], ["Giờ khám", row.hours], ["Phòng khám", row.room], ["Số lượng", `${row.count} / ${row.capacity}`]]))}</div>`);
  });
  render();
}
