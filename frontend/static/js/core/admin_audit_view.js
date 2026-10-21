import { esc, options } from "./admin_ui.js";

export function activityLogMarkup() {
  return `<section class="admin-card admin-activity-log" aria-labelledby="activity-log-title">
    <div class="admin-panel-heading"><div><h2 id="activity-log-title">Danh sách nhật ký</h2><p>Theo dõi lịch sử quản trị và những thay đổi trong hệ thống.</p></div><span class="admin-audit-source">Chưa kết nối dữ liệu</span></div>
    <form id="activity-log-filter" class="admin-toolbar" role="search" aria-label="Lọc nhật ký hoạt động">
      <label>Tìm kiếm<input type="search" name="q" placeholder="Mã log, người thực hiện, nội dung…"></label>
      <label>Hành động<select name="action">${options([["CREATE","Tạo mới"],["UPDATE","Cập nhật"],["LOCK","Khóa tài khoản"],["UNLOCK","Mở tài khoản"],["DELETE","Xóa / ngừng sử dụng"]])}</select></label>
      <label>Đối tượng<select name="target">${options([["USER","Tài khoản"],["PATIENT","Hồ sơ bệnh nhân"],["DOCTOR","Bác sĩ"],["DEPARTMENT","Chuyên khoa"],["ROOM","Phòng khám"],["WORK_SCHEDULE","Lịch làm việc"],["ASSIGNMENT","Phân công nhân viên"],["ARTICLE","Bài viết"],["CONFIGURATION","Cấu hình hệ thống"],["PAYMENT","Thanh toán"]])}</select></label>
      <label>Từ ngày<input type="date" name="from_date"></label><label>Đến ngày<input type="date" name="to_date"></label>
    </form>
    <p id="activity-log-feedback" class="admin-audit-feedback" role="status" aria-live="polite" hidden></p>
    <div class="admin-table-scroll" tabindex="0" role="region" aria-label="Danh sách nhật ký hoạt động"><table class="admin-table"><caption class="visually-hidden">Nhật ký admin thay đổi hệ thống</caption>
      <thead><tr>${["Mã log","Thời điểm","Người thực hiện","Hành động","Đối tượng","Nội dung","Thao tác"].map(title=>`<th scope="col">${esc(title)}</th>`).join("")}</tr></thead>
      <tbody><tr><td colspan="7"><div class="admin-audit-empty"><span class="admin-audit-empty-symbol" aria-hidden="true">↺</span><h3>Chưa kết nối nhật ký hệ thống</h3><p>Giao diện đã sẵn sàng để tra cứu lịch sử admin chỉnh sửa.<br>Các thao tác sẽ hiển thị khi chức năng ghi và lưu nhật ký được bổ sung.</p><span>Nhật ký chỉ dùng để tra cứu, không chỉnh sửa hoặc xóa tại đây.</span></div></td></tr></tbody>
    </table></div>
    <div class="admin-pagination"><span>Chưa có dữ liệu nhật ký để phân trang</span><div><button type="button" class="secondary" disabled aria-label="Trang nhật ký trước">Trang trước</button><button type="button" class="secondary" disabled aria-label="Trang nhật ký sau">Trang sau</button></div></div>
  </section>`;
}

export function bindActivityLogFilter(root = document) {
  const form=root.querySelector("#activity-log-filter"), feedback=root.querySelector("#activity-log-feedback");
  function update() {
    const from=form.elements.from_date.value, to=form.elements.to_date.value;
    const invalid=Boolean(from&&to&&to<from);
    form.elements.to_date.setCustomValidity(invalid?"Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.":"");
    form.elements.to_date.setAttribute("aria-invalid",String(invalid));
    const filtering=[...form.elements].some(input=>input.name&&input.value.trim());
    feedback.hidden=!invalid&&!filtering;
    feedback.dataset.error=String(invalid);
    feedback.textContent=invalid?"Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.":"Chưa thể tra cứu theo bộ lọc vì nhật ký hệ thống chưa kết nối dữ liệu.";
  }
  form.addEventListener("input",update);
  form.addEventListener("change",update);
  form.addEventListener("submit",event=>{event.preventDefault();update();});
}
