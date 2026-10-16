import { staffReady, staffRoles, backendRoles, avatarUrl } from "../core/staff_workspace.js";
import { updateMe } from "../api/auth.js";
import { getOwnProfile, updateOwnProfile, uploadAvatar } from "../api/doctor.js";
import { $, esc, date, money, badge, facts, panel, bindDialog, run, submit } from "../core/staff_ui.js";

let user = await staffReady;
if (user) {
  bindDialog(); $("#page-refresh").addEventListener("click", () => location.reload());
  await run(async () => {
    const role = backendRoles[user.role_name];
    let doctor = null;
    if (role === "doctor") {
      try { doctor = (await getOwnProfile()).doctor; }
      catch (error) { if (error.status !== 404) throw error; }
    }
    const url = new URL(location.href); url.searchParams.set("role", role); history.replaceState(null, "", url);
    if (role === "doctor") $("#staff-profile-description").textContent = "Quản lý thông tin cá nhân, ảnh đại diện và hồ sơ chuyên môn của bạn.";
    const professionalSection = role !== "doctor" ? "" : doctor
      ? panel("Thông tin chuyên môn", `<form id="professional-form"><div class="form-grid"><label>Học vị / chức danh<input name="academic_degree" maxlength="100"></label><label>Số năm kinh nghiệm<input name="experience_years" type="number" min="0" max="80" step="1"></label><label class="full-width">Chuyên môn<input name="specialization" maxlength="200"></label><label class="full-width">Giới thiệu<textarea name="introduction" rows="5" maxlength="5000"></textarea></label></div><div class="actions"><button type="submit">Lưu thông tin chuyên môn</button><button type="reset" class="secondary">Khôi phục</button></div><p role="status" class="form-feedback"></p></form><p class="scope-note">Khoa, phí khám và trạng thái hoạt động do quản trị quản lý.</p>`)
      : panel("Thông tin chuyên môn", '<p class="scope-note">Chưa có hồ sơ chuyên môn. Vui lòng liên hệ quản trị để được bổ sung.</p>');
    const avatarForm = doctor ? '<form id="avatar-form" class="staff-profile-avatar-form"><label>Ảnh đại diện<input name="file" id="professional-photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><p class="muted">JPEG, PNG hoặc WebP, tối đa 2 MB.</p><button type="submit">Cập nhật ảnh đại diện</button><p role="status" class="form-feedback"></p></form>' : "";
    $("#page-body").innerHTML = `<div class="staff-profile-grid"><aside class="panel staff-profile-identity"><div class="staff-profile-monogram" id="staff-profile-avatar">${esc(staffRoles[role].initials)}</div><h2 id="staff-profile-name"></h2><span class="badge green">${esc(staffRoles[role].label)}</span><div id="staff-profile-facts"></div>${doctor ? '<div id="professional-facts"></div>' : ""}${avatarForm}</aside><div class="staff-profile-sections"><section class="panel"><div class="section-heading"><h2>Thông tin cá nhân & liên hệ</h2></div><form id="staff-profile-form"><div class="form-grid"><label class="full-width">Họ và tên *<input name="full_name" required maxlength="150" autocomplete="name"></label><label>Số điện thoại<input name="phone" type="tel" maxlength="20" autocomplete="tel"></label><label>Email<input name="email" type="email" maxlength="254" autocomplete="email"></label></div><div class="actions"><button type="submit">Lưu thông tin cá nhân</button><button type="reset" class="secondary">Khôi phục</button></div><p role="status" class="form-feedback"></p><p class="scope-note">Vai trò và trạng thái tài khoản do bệnh viện quản lý. Thay đổi email sẽ cần xác minh lại.</p></form><div id="staff-profile-verification"></div></section>${professionalSection}</div></div>`;
    const form = $("#staff-profile-form");
    function render() {
      $("#staff-profile-name").textContent = user.full_name;
      $("#staff-account-name").textContent = user.full_name;
      $("#staff-profile-facts").innerHTML = facts([["Đơn vị", "NEU Medical"], ["Mã tài khoản", user.user_id]]) + `<p>${badge(user.account_status)} ${badge(user.approval_status)}</p>`;
      $("#staff-profile-verification").innerHTML = facts([["Xác minh email", user.email_verified ? "Đã xác minh" : "Chưa xác minh"], ["Ngày tạo tài khoản", date(user.created_at)]]);
      for (const key of ["full_name", "phone", "email"]) { form.elements[key].value = user[key] || ""; form.elements[key].defaultValue = user[key] || ""; }
      renderAvatar();
    }
    function renderAvatar() {
      const avatar = avatarUrl(doctor?.avatar_url);
      const containers = [$("#staff-profile-avatar"), ...(doctor ? [$(".staff-initials")] : [])];
      for (const node of containers) {
        if (!node) continue;
        node.textContent = staffRoles[role].initials;
        if (!avatar) continue;
        const img = document.createElement("img"); img.src = avatar; img.alt = node.id === "staff-profile-avatar" ? `Ảnh ${user.full_name}` : ""; img.className = "staff-avatar-image";
        img.addEventListener("error", () => { node.textContent = staffRoles[role].initials; }); node.replaceChildren(img);
      }
    }
    render();
    form.addEventListener("submit", event => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(form));
      for (const key of Object.keys(data)) data[key] = data[key].trim() || null;
      if (!data.full_name) { form.elements.full_name.setCustomValidity("Vui lòng nhập họ tên."); form.reportValidity(); return; }
      for (const key of Object.keys(data)) if (data[key] === (user[key] || null)) delete data[key];
      if (!Object.keys(data).length) { form.querySelector('[role="status"]').textContent = "Thông tin chưa thay đổi."; return; }
      submit(form, async () => { user = (await updateMe(data)).user; render(); });
    });
    form.elements.full_name.addEventListener("input", event => event.target.setCustomValidity(""));
    if (doctor) {
      const professionalForm = $("#professional-form");
      function renderProfessional() {
        for (const key of ["academic_degree", "experience_years", "specialization", "introduction"]) {
          professionalForm.elements[key].value = doctor[key] ?? "";
          professionalForm.elements[key].defaultValue = doctor[key] ?? "";
        }
        $("#professional-facts").innerHTML = facts([["Khoa", doctor.department_name], ["Phí khám", money(doctor.consultation_fee)], ["Trạng thái chuyên môn", doctor.is_active ? "Đang hoạt động" : "Ngừng hoạt động"]]);
      }
      renderProfessional();
      professionalForm.addEventListener("submit", event => {
        event.preventDefault(); const data = Object.fromEntries(new FormData(professionalForm));
        data.experience_years = data.experience_years === "" ? null : Number(data.experience_years);
        submit(professionalForm, async () => { doctor = (await updateOwnProfile(data)).doctor; renderProfessional(); });
      });
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
  });
}
