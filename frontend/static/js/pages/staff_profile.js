import { staffReady, staffRoles, backendRoles, avatarUrl } from "../core/staff_workspace.js";
import { nursePortraitUrl } from "../core/staff_shell.js";
import { updateMe } from "../api/auth.js";
import { getOwnProfile, uploadAvatar } from "../api/doctor.js";
import { $, esc, date, money, badge, facts, bindDialog, run, submit } from "../core/staff_ui.js";

const readonlyField = (label, value, multiline = false) => {
  const text = value === null || value === undefined || value === "" ? "Chưa cập nhật" : value;
  return `<label${multiline ? ' class="full-width"' : ""}>${esc(label)}${multiline
    ? `<textarea rows="4" readonly aria-describedby="profile-managed-note">${esc(text)}</textarea>`
    : `<input type="text" value="${esc(text)}" readonly aria-describedby="profile-managed-note">`}</label>`;
};

let user = await staffReady;
if (user) {
  bindDialog();
  await run(async () => {
    const role = backendRoles[user.role_name];
    let doctor = null;
    if (role === "doctor") {
      try { doctor = (await getOwnProfile()).doctor; }
      catch (error) { if (error.status !== 404) throw error; }
    }
    const url = new URL(location.href); url.searchParams.set("role", role); history.replaceState(null, "", url);
    $("#staff-profile-description").textContent = "Xem hồ sơ nhân viên và thay đổi thông tin liên hệ khi cần.";
    const professionalFields = role !== "doctor" ? "" : doctor
      ? `${[
        ["Khoa", doctor.department_name], ["Học vị / chức danh", doctor.academic_degree],
        ["Chuyên môn", doctor.specialization], ["Số năm kinh nghiệm", doctor.experience_years],
        ["Phí khám", doctor.consultation_fee == null ? null : money(doctor.consultation_fee)],
        ["Trạng thái chuyên môn", doctor.is_active ? "Đang hoạt động" : "Ngừng hoạt động"],
      ].map(([label, value]) => readonlyField(label, value)).join("")}${readonlyField("Giới thiệu chuyên môn", doctor.introduction, true)}`
      : '<p class="scope-note full-width">Chưa có hồ sơ chuyên môn. Vui lòng liên hệ quản trị để được bổ sung.</p>';
    const avatarForm = doctor ? '<form id="avatar-form" class="staff-profile-avatar-form"><label>Ảnh đại diện<input name="file" id="professional-photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><p class="muted">JPEG, PNG hoặc WebP, tối đa 2 MB.</p><button type="submit">Cập nhật ảnh đại diện</button><p role="status" class="form-feedback"></p></form>' : "";
    $("#page-body").innerHTML = `<div class="staff-profile-grid"><aside class="panel staff-profile-identity"><div class="staff-profile-monogram" id="staff-profile-avatar">${esc(staffRoles[role].initials)}</div>${role === "nurse" ? '<p class="staff-profile-photo-note">Ảnh minh họa điều dưỡng</p>' : ""}<h2 id="staff-profile-name"></h2><span class="badge green">${esc(staffRoles[role].label)}</span><div id="staff-profile-facts"></div>${avatarForm}</aside><div class="staff-profile-sections">
      <section class="panel"><div class="section-heading"><h2>Thông tin nhân viên</h2><div class="profile-header-actions"><button id="staff-profile-edit" type="button" class="secondary">Thay đổi thông tin</button><button id="staff-password-open" type="button" class="secondary">Đổi mật khẩu</button></div></div><form id="staff-profile-form"><div id="staff-managed-fields" class="profile-readonly-grid"></div><p id="profile-managed-note" class="profile-managed-note">Bạn có thể thay đổi số điện thoại và email. Các thông tin khác do bệnh viện quản lý.</p><div id="staff-profile-actions" class="actions" hidden><button type="submit">Lưu</button><button id="staff-profile-cancel" type="button" class="secondary">Hủy</button></div><p role="status" class="form-feedback"></p></form></section>
    </div></div>`;
    const form = $("#staff-profile-form");
    const editButton = $("#staff-profile-edit"), cancelButton = $("#staff-profile-cancel");
    let editing = false;
    function setEditing(active) {
      editing = active;
      form.dataset.editing = String(active);
      editButton.hidden = active;
      $("#staff-profile-actions").hidden = !active;
      for (const key of ["phone", "email"]) {
        const field = form.elements[key];
        field.readOnly = !active;
        field.setCustomValidity("");
        if (!active) field.value = user[key] || "";
      }
    }
    function render() {
      $("#staff-profile-name").textContent = user.full_name;
      $("#staff-account-name").textContent = user.full_name;
      $("#staff-profile-facts").innerHTML = facts([["Đơn vị", "NEU Medical"], ["Mã tài khoản", user.user_id]]) + `<p>${badge(user.account_status)} ${badge(user.approval_status)}</p>`;
      $("#staff-managed-fields").innerHTML = [
        ["Họ và tên", user.full_name], ["Mã tài khoản", user.user_id], ["Vai trò trên hệ thống", staffRoles[role].label],
      ].map(([label, value]) => readonlyField(label, value)).join("") +
        '<label>Số điện thoại<input name="phone" type="tel" maxlength="20" autocomplete="tel" placeholder="Chưa cập nhật" readonly></label><label>Email<input name="email" type="email" maxlength="254" autocomplete="email" placeholder="Chưa cập nhật" readonly></label>' + [
        ["Trạng thái tài khoản", user.account_status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"],
        ["Trạng thái phê duyệt", ({ APPROVED: "Đã duyệt", PENDING: "Chờ duyệt", REJECTED: "Từ chối" })[user.approval_status] || user.approval_status],
        ["Ngày tạo tài khoản", user.created_at ? date(user.created_at) : null],
        ["Cập nhật gần nhất", user.updated_at ? date(user.updated_at) : null],
      ].map(([label, value]) => readonlyField(label, value)).join("") + professionalFields;
      for (const key of ["phone", "email"]) { form.elements[key].value = user[key] || ""; form.elements[key].defaultValue = user[key] || ""; }
      setEditing(false);
      renderAvatar();
    }
    function renderAvatar() {
      const avatar = role === "nurse" ? nursePortraitUrl : avatarUrl(doctor?.avatar_url);
      for (const node of [$("#staff-profile-avatar"), $(".staff-initials")]) {
        if (!node) continue;
        node.textContent = staffRoles[role].initials;
        if (!avatar) continue;
        const img = document.createElement("img"); img.src = avatar;
        img.alt = node.id === "staff-profile-avatar" ? role === "nurse" ? "Ảnh minh họa điều dưỡng" : `Ảnh ${user.full_name}` : "";
        img.className = "staff-avatar-image";
        img.addEventListener("error", () => { node.textContent = staffRoles[role].initials; }); node.replaceChildren(img);
      }
    }
    render();
    editButton.addEventListener("click", () => {
      if (form.dataset.busy === "true") return;
      setEditing(true);
      form.querySelector('[role="status"]').textContent = "";
      form.elements.phone.focus();
    });
    cancelButton.addEventListener("click", () => {
      if (form.dataset.busy === "true") return;
      setEditing(false);
      form.querySelector('[role="status"]').textContent = "";
      editButton.focus();
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (!editing || form.dataset.busy === "true") return;
      // Only these two fields may leave the self-service form, even if the DOM is altered.
      const data = {};
      for (const key of ["phone", "email"]) {
        const value = form.elements[key].value.trim();
        if (!value && user[key]) {
          form.elements[key].setCustomValidity(`Vui lòng nhập ${key === "phone" ? "số điện thoại" : "email"}.`);
          form.reportValidity(); return;
        }
        if ((value || null) !== (user[key] || null)) data[key] = value || null;
      }
      if (!Object.keys(data).length) { setEditing(false); form.querySelector('[role="status"]').textContent = "Thông tin chưa thay đổi."; editButton.focus(); return; }
      editButton.disabled = true;
      submit(form, async () => { user = (await updateMe(data)).user; render(); })
        .finally(() => { editButton.disabled = false; if (!editing) editButton.focus(); });
    });
    form.addEventListener("input", event => {
      if (["phone", "email"].includes(event.target.name)) event.target.setCustomValidity("");
    });
    if (doctor) {
      const photoForm = $("#avatar-form"), photoInput = $("#professional-photo");
      photoForm.addEventListener("submit", event => {
        event.preventDefault(); const file = photoInput.files[0];
        const valid = file && ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 2 * 1024 * 1024;
        photoInput.setCustomValidity(valid ? "" : "Chọn ảnh JPEG, PNG hoặc WebP, tối đa 2 MB.");
        if (!valid) { photoForm.reportValidity(); return; }
        submit(photoForm, async () => { doctor = (await uploadAvatar(file)).doctor; renderAvatar(); photoForm.reset(); }, "Đã cập nhật ảnh đại diện.");
      });
      photoInput.addEventListener("change", () => photoInput.setCustomValidity(""));
    }
    bindPasswordPreview();
  });
}

function bindPasswordPreview() {
  const modal = $("#staff-password-dialog"), form = $("#staff-password-form"), feedback = $("#staff-password-feedback");
  const current = form.elements.current_password, fresh = form.elements.new_password, confirm = form.elements.confirm_password;
  function clear() {
    form.reset(); feedback.textContent = "";
    for (const field of [current, fresh, confirm]) field.setCustomValidity("");
  }
  $("#staff-password-open").addEventListener("click", () => { clear(); modal.showModal(); current.focus(); });
  $("#staff-password-close").addEventListener("click", () => modal.close());
  modal.addEventListener("close", clear);
  window.addEventListener("pagehide", () => { clear(); modal.close(); });
  for (const field of [current, fresh, confirm]) field.addEventListener("input", () => { field.setCustomValidity(""); feedback.textContent = ""; });
  form.addEventListener("submit", event => {
    event.preventDefault(); fresh.setCustomValidity(""); confirm.setCustomValidity("");
    if (fresh.value.length < 12 || fresh.value.length > 128 || !/[A-Za-z]/.test(fresh.value) || !/\d/.test(fresh.value)) fresh.setCustomValidity("Mật khẩu mới cần từ 12 đến 128 ký tự, gồm chữ cái và chữ số.");
    if (fresh.value === current.value) fresh.setCustomValidity("Mật khẩu mới cần khác mật khẩu hiện tại.");
    if (confirm.value !== fresh.value) confirm.setCustomValidity("Mật khẩu nhập lại chưa khớp.");
    if (!form.reportValidity()) return;
    clear();
    feedback.textContent = "Định dạng mật khẩu mới hợp lệ. Đây là bản xem trước, mật khẩu chưa được thay đổi và mật khẩu hiện tại chưa được xác minh.";
  });
}
