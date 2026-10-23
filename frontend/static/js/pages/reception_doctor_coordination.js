import { $, panel, esc, dialog, facts, today, date } from "../core/staff_ui.js";

const normalize = value => String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();

// Presentation state only. Room assignments are not sent to the backend.
export function initDoctorCoordination() {
  const doctors = [
    { id: "doctor-1", name: "Nguyễn Hoàng Minh", department: "Nội tổng quát" },
    { id: "doctor-2", name: "Trần Quốc Bảo", department: "Tim mạch" },
    { id: "doctor-3", name: "Lê Thu Trang", department: "Da liễu" },
    { id: "doctor-4", name: "Phạm Đức Long", department: "Nhi khoa" },
    { id: "doctor-5", name: "Vũ Minh Anh", department: "Sản phụ khoa" },
  ];
  const initialRooms = [
    { id: "room-1", name: "Phòng Nội 101", area: "Tầng 1", doctorId: "doctor-1" },
    { id: "room-2", name: "Phòng Tim mạch 201", area: "Tầng 2", doctorId: "doctor-2" },
    { id: "room-3", name: "Phòng Da liễu 202", area: "Tầng 2", doctorId: "doctor-3" },
    { id: "room-4", name: "Phòng Nhi 102", area: "Tầng 1", doctorId: "doctor-4" },
    { id: "room-5", name: "Phòng khám 203", area: "Tầng 2", doctorId: null },
    { id: "room-6", name: "Phòng khám 301", area: "Tầng 3", doctorId: null },
  ];
  $("#page-body").insertAdjacentHTML("beforeend", panel("Điều phối bác sĩ", '<div id="doctor-assignment"><div class="coordination-search-section"><div class="doctor-assignment-filters"><label>Tìm bác sĩ<input id="assignment-doctor-query" type="search" placeholder="Họ tên hoặc mã bác sĩ" aria-controls="assignment-doctor-results"></label><label>Chuyên khoa<input id="assignment-department" type="text" list="assignment-departments" placeholder="Nhập hoặc chọn chuyên khoa"><datalist id="assignment-departments"></datalist></label><label>Ngày làm việc<input id="assignment-work-date" type="date" required></label></div><div id="assignment-doctor-results" class="coordination-choices" hidden></div></div><div class="coordination-search-section"><label>Tìm phòng khám<input id="assignment-room-query" type="search" placeholder="Tên phòng, mã phòng hoặc tầng" aria-controls="assignment-room-results"></label><div id="assignment-room-results" class="coordination-choices" hidden></div></div><p id="assignment-status" class="scope-note" role="status" hidden></p><div class="actions coordination-footer"><button id="assignment-confirm" type="button" disabled>Phân phòng bác sĩ</button></div></div>'));
  $("#assignment-departments").innerHTML = [...new Set(doctors.map(row => row.department))].map(name => `<option value="${esc(name)}"></option>`).join("");
  const dateInput = $("#assignment-work-date");
  dateInput.value = today();
  const assignmentsByDay = new Map();
  function roomsForDay(day) {
    if (!assignmentsByDay.has(day)) assignmentsByDay.set(day, initialRooms.map(room => ({ ...room })));
    return assignmentsByDay.get(day);
  }
  let rooms = roomsForDay(dateInput.value);
  let selectedDoctor = null, selectedRoom = null;
  const confirm = $("#assignment-confirm");
  const assignedRoom = doctor => rooms.find(room => room.doctorId === doctor?.id);
  function updateConfirm() { confirm.disabled = !dateInput.value || !selectedDoctor || !selectedRoom || Boolean(selectedRoom.doctorId); }
  function renderDoctors() {
    const query = normalize($("#assignment-doctor-query").value.trim());
    const department = normalize($("#assignment-department").value.trim());
    const target = $("#assignment-doctor-results");
    target.hidden = !dateInput.value || (!query && !department);
    if (target.hidden) { target.innerHTML = ""; return; }
    const matches = doctors.filter(row => (!query || normalize(`${row.name} ${row.id}`).includes(query)) && (!department || normalize(row.department).includes(department))).slice(0, 3);
    target.innerHTML = matches.length ? matches.map(row => `<button type="button" class="coordination-choice${selectedDoctor?.id === row.id ? " is-selected" : ""}" data-assign-doctor="${esc(row.id)}" aria-pressed="${selectedDoctor?.id === row.id}"><span><strong>BS. ${esc(row.name)}</strong><small>${esc(row.id)}</small></span><span>${esc(row.department)}</span><span>${esc(assignedRoom(row)?.name || "Chưa có phòng")}</span><span>${assignedRoom(row) ? "Cần xác nhận khi chuyển" : "Có thể phân phòng"}</span></button>`).join("") : '<p class="scope-note">Không tìm thấy bác sĩ phù hợp.</p>';
  }
  function renderRooms() {
    const query = normalize($("#assignment-room-query").value.trim());
    const target = $("#assignment-room-results");
    target.hidden = !dateInput.value || !query;
    if (target.hidden) { target.innerHTML = ""; return; }
    const matches = rooms.filter(row => normalize(`${row.name} ${row.id} ${row.area}`).includes(query)).slice(0, 3);
    target.innerHTML = matches.length ? matches.map(row => {
      const doctor = doctors.find(doctor => doctor.id === row.doctorId);
      return `<button type="button" class="coordination-choice${selectedRoom?.id === row.id ? " is-selected" : ""}" data-assign-room="${esc(row.id)}" aria-pressed="${selectedRoom?.id === row.id}" ${doctor ? 'disabled aria-disabled="true"' : ""}><span><strong>${esc(row.name)}</strong><small>${esc(row.id)}</small></span><span>${esc(row.area)}</span><span>${doctor ? `BS. ${esc(doctor.name)}` : "Chưa có bác sĩ"}</span><span>${doctor ? "Đã có bác sĩ · Không thể chọn" : "Phòng trống"}</span></button>`;
    }).join("") : '<p class="scope-note">Không tìm thấy phòng phù hợp.</p>';
  }
  for (const id of ["#assignment-doctor-query", "#assignment-department"]) $(id).addEventListener("input", () => { selectedDoctor = null; updateConfirm(); renderDoctors(); });
  $("#assignment-room-query").addEventListener("input", () => { selectedRoom = null; updateConfirm(); renderRooms(); });
  $("#assignment-doctor-results").addEventListener("click", event => {
    const button = event.target.closest("[data-assign-doctor]"); if (!button) return;
    selectedDoctor = doctors.find(row => row.id === button.dataset.assignDoctor); updateConfirm(); renderDoctors();
  });
  $("#assignment-room-results").addEventListener("click", event => {
    const button = event.target.closest("[data-assign-room]"); if (!button || button.disabled) return;
    const room = rooms.find(row => row.id === button.dataset.assignRoom); if (room.doctorId) return;
    selectedRoom = room; updateConfirm(); renderRooms();
  });
  dateInput.addEventListener("change", () => {
    selectedDoctor = null; selectedRoom = null;
    rooms = dateInput.value ? roomsForDay(dateInput.value) : [];
    $("#assignment-status").hidden = true;
    updateConfirm(); renderDoctors(); renderRooms();
  });
  confirm.addEventListener("click", () => {
    if (!selectedDoctor || !selectedRoom || selectedRoom.doctorId) return;
    const doctor = selectedDoctor, target = selectedRoom, previous = assignedRoom(doctor);
    dialog("Xác nhận chuyển bác sĩ", `<div class="reception-transfer-detail">${panel("Thông tin bác sĩ", facts([["Họ tên bác sĩ", `BS. ${doctor.name}`], ["Mã bác sĩ", doctor.id], ["Chuyên khoa", doctor.department]]))}${panel("Thông tin ca trước", facts([["Ngày làm việc", date(dateInput.value)], ["Phòng khám", previous?.name || "Chưa có phòng"], ["Khu vực", previous?.area || "—"]]))}<form id="assignment-transfer-form">${panel("Thông tin ca mới", facts([["Ngày làm việc", date(dateInput.value)], ["Phòng khám", target.name], ["Khu vực", target.area]]))}${previous ? '<p class="reception-checkin-note">Sau khi xác nhận chuyển, phòng cũ sẽ trở thành phòng trống.</p>' : ""}<label class="transfer-reason">Lý do chuyển *<textarea name="reason" rows="3" maxlength="1000" placeholder="Nhập lý do phân công hoặc chuyển phòng bác sĩ" required></textarea></label><div class="actions transfer-confirm-actions"><button type="button" class="secondary" id="assignment-dialog-cancel">Hủy</button><button type="submit" id="assignment-dialog-confirm">Xác nhận chuyển</button></div></form></div>`);
    $("#assignment-dialog-cancel").addEventListener("click", () => $("#staff-dialog").close());
    $("#assignment-transfer-form").addEventListener("submit", event => {
      event.preventDefault();
      const reason = event.currentTarget.elements.reason;
      if (!reason.value.trim()) { reason.setCustomValidity("Vui lòng nhập lý do chuyển."); reason.reportValidity(); reason.addEventListener("input", () => reason.setCustomValidity(""), { once: true }); return; }
      if (target.doctorId) return;
      if (previous) previous.doctorId = null;
      target.doctorId = doctor.id;
      selectedRoom = null; updateConfirm(); renderDoctors(); renderRooms();
      $("#staff-dialog").close();
      $("#assignment-status").hidden = false;
      $("#assignment-status").textContent = `Đã cập nhật lựa chọn trên giao diện: BS. ${doctor.name} → ${target.name}${previous ? `; ${previous.name} đã trống` : ""}.`;
    });
  });
}
