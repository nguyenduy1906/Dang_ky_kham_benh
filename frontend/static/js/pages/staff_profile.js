import { staffReady, staffRoles, backendRoles, avatarUrl } from "../core/staff_workspace.js";
import { updateMe } from "../api/auth.js";
import { getOwnProfile } from "../api/doctor.js";
import { $, esc, date, badge, facts, panel, bindDialog, run, submit } from "../core/staff_ui.js";

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
    $("#page-body").innerHTML = `<div class="staff-profile-grid"><aside class="panel staff-profile-identity"><div class="staff-profile-monogram" id="staff-profile-avatar">${esc(staffRoles[role].initials)}</div><h2 id="staff-profile-name"></h2><span class="badge green">${esc(staffRoles[role].label)}</span><div id="staff-profile-facts"></div>${role === "doctor" ? '<a class="button-link secondary" href="../(doctor)/professional.html">Hồ sơ chuyên môn & ảnh →</a>' : ""}</aside><section class="panel"><div class="section-heading"><h2>Thông tin cá nhân & liên hệ</h2></div><form id="staff-profile-form"><div class="form-grid"><label class="full-width">Họ và tên *<input name="full_name" required maxlength="150" autocomplete="name"></label><label>Số điện thoại<input name="phone" type="tel" maxlength="20" autocomplete="tel"></label><label>Email<input name="email" type="email" maxlength="254" autocomplete="email"></label></div><div class="actions"><button type="submit">Lưu thông tin cá nhân</button><button type="reset" class="secondary">Khôi phục</button></div><p role="status" class="form-feedback"></p><p class="scope-note">Vai trò và trạng thái tài khoản do bệnh viện quản lý. Thay đổi email sẽ cần xác minh lại.</p></form><div id="staff-profile-verification"></div></section></div>`;
    const form = $("#staff-profile-form");
    function render() {
      $("#staff-profile-name").textContent = user.full_name;
      $("#staff-account-name").textContent = user.full_name;
      $("#staff-profile-facts").innerHTML = facts([["Đơn vị", "NEU Medical"], ["Mã tài khoản", user.user_id]]) + `<p>${badge(user.account_status)} ${badge(user.approval_status)}</p>`;
      $("#staff-profile-verification").innerHTML = facts([["Xác minh email", user.email_verified ? "Đã xác minh" : "Chưa xác minh"], ["Ngày tạo tài khoản", date(user.created_at)]]);
      for (const key of ["full_name", "phone", "email"]) { form.elements[key].value = user[key] || ""; form.elements[key].defaultValue = user[key] || ""; }
    }
    const avatar = avatarUrl(doctor?.avatar_url);
    if (avatar) { $("#staff-profile-avatar").innerHTML = `<img class="staff-avatar-image" src="${esc(avatar)}" alt="Ảnh ${esc(user.full_name)}">`; $("#staff-profile-avatar img").addEventListener("error", () => { $("#staff-profile-avatar").textContent = "BS"; }); }
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
  });
}
