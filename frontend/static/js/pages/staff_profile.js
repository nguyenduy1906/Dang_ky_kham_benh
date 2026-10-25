import {commitForm} from "../core/form_workflow.js";
import { code } from "../core/business_codes.js";
import { staffReady, staffRoles, backendRoles } from "../core/staff_workspace.js";
import { nursePortraitUrl } from "../core/staff_shell.js";
import { changeOwnPassword, clearSession } from "../core/session.js";
import { updateMe } from "../api/auth.js";
import { getOwnProfile, updateOwnProfile } from "../api/doctor.js";
import { $, esc, date, money, badge, facts, bindDialog, run, submit } from "../core/staff_ui.js";
import { enhanceDialogDismiss } from "../core/dialog_dismiss.js";
import { bindAvatarForm, renderAccountAvatar } from "../core/avatar.js";
import { editableProfileKeys, todayVN, profileChanges } from "../core/profile.js";

const readonlyField = (label, value, multiline = false) => {
  const text = value === null || value === undefined || value === "" ? "Chưa cập nhật" : value;
  return `<label${multiline ? ' class="full-width"' : ""}>${esc(label)}${multiline
    ? `<textarea rows="4" readonly>${esc(text)}</textarea>`
    : `<input type="text" value="${esc(text)}" readonly>`}</label>`;
};

let user = await staffReady;
if (user) {
  bindDialog({ dismissible: ["NURSE", "RECEPTIONIST"].includes(user.role_name) });
  await run(async () => {
    const role = backendRoles[user.role_name];
    let doctor = null;
    if (role === "doctor") {
      try { doctor = (await getOwnProfile()).doctor; }
      catch (error) { if (error.status !== 404) throw error; }
    }
    const url = new URL(location.href); url.searchParams.set("role", role); history.replaceState(null, "", url);
    $("#staff-profile-description").textContent = "Xem và cập nhật thông tin cá nhân của bạn.";
    const professionalFields = () => role !== "doctor" ? "" : doctor
      ? `${[
        ["Khoa", doctor.department_name], ["Học vị / chức danh", doctor.academic_degree],
        ["Chuyên môn", doctor.specialization], ["Số năm kinh nghiệm", doctor.experience_years],
        ["Phí khám", doctor.consultation_fee == null ? null : money(doctor.consultation_fee)],
      ].map(([label, value]) => readonlyField(label, value)).join("")}<label class="profile-introduction" for="doctor-introduction">Giới thiệu chuyên môn<textarea id="doctor-introduction" name="introduction" rows="6" maxlength="5000" readonly>${esc(doctor.introduction || "")}</textarea></label>`
      : '<p class="scope-note full-width">Chưa có hồ sơ chuyên môn. Vui lòng liên hệ quản trị để được bổ sung.</p>';
    const avatarForm = '<form id="avatar-form" class="staff-profile-avatar-form"><input name="file" id="avatar-file" class="avatar-file-input" type="file" hidden aria-hidden="true" accept="image/jpeg,image/png,image/webp" tabindex="-1" aria-label="Ảnh đại diện"><button id="avatar-choose" type="button" class="secondary">Chọn ảnh đại diện</button><p id="avatar-feedback" role="status" aria-live="polite" class="form-feedback"></p></form>';
    $("#page-body").innerHTML = `<div class="staff-profile-grid"><aside class="panel staff-profile-identity"><div class="staff-profile-monogram" id="staff-profile-avatar">${esc(staffRoles[role].initials)}</div>${avatarForm}<h2 id="staff-profile-name"></h2><span class="badge green">${esc(staffRoles[role].label)}</span><div id="staff-profile-facts"></div><p id="staff-profile-status" class="profile-account-status"></p></aside><div class="staff-profile-sections">
      <section class="panel"><div class="section-heading"><h2>Thông tin nhân viên</h2><div class="profile-header-actions"><button id="staff-profile-edit" type="button" class="secondary">Thay đổi thông tin</button><button id="staff-password-open" type="button" class="secondary">Đổi mật khẩu</button></div></div><form id="staff-profile-form"><div id="staff-managed-fields" class="profile-readonly-grid"></div><div id="staff-profile-actions" class="actions" hidden><button type="submit">Lưu</button><button id="staff-profile-cancel" type="button" class="secondary">Hủy</button></div><p role="status" class="form-feedback"></p></form></section>
    </div></div>`;
    const form = $("#staff-profile-form");
    const editButton = $("#staff-profile-edit"), cancelButton = $("#staff-profile-cancel");
    const editableKeys = editableProfileKeys;
    let editing = false;
    function setEditing(active) {
      const identity = $(".staff-profile-identity");
      if (identity) {
        if (active && !editing) identity.style.setProperty("--staff-profile-view-height", `${identity.getBoundingClientRect().height}px`);
        if (!active) identity.style.removeProperty("--staff-profile-view-height");
      }
      editing = active;
      form.dataset.editing = String(active);
      editButton.hidden = active;
      $("#staff-profile-actions").hidden = !active;
      for (const key of editableKeys) {
        const field = form.elements[key];
        field.readOnly = !active;
        field.setCustomValidity("");
        if (key === "dob") { field.type = active ? "date" : "text"; field.value = active ? user.dob || "" : user.dob ? date(user.dob) : ""; }
        else if (!active) field.value = user[key] || "";
      }
      if (form.elements.introduction) {
        form.elements.introduction.readOnly = !active;
        if (!active) form.elements.introduction.value = doctor.introduction || "";
      }
    }
    function render() {
      $("#staff-profile-name").textContent = user.full_name;
      $("#staff-account-name").textContent = user.full_name;
      const accountStatus = $("#staff-profile-status");
      accountStatus.textContent = user.account_status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa";
      accountStatus.dataset.active = String(user.account_status === "ACTIVE");
      $("#staff-profile-facts").innerHTML = facts([["Đơn vị", "NEU Medical"], ["Mã tài khoản", code("TK", user.user_id)], ["Ngày tạo tài khoản", user.created_at ? date(user.created_at) : null]]);
      const inputField = (key, label, type = "text", max = null) => `<label for="staff-profile-${key}">${label}<input id="staff-profile-${key}" name="${key}" type="${type}"${max ? ` maxlength="${max}"` : ""}${key === "dob" ? ` min="1900-01-01" max="${todayVN()}"` : ""}${key === "full_name" ? ' required autocomplete="name"' : ""} readonly></label>`;
      $("#staff-managed-fields").innerHTML =
        inputField("full_name", "Họ và tên", "text", 150) + inputField("dob", "Ngày sinh", "date") +
        inputField("phone", "Số điện thoại", "tel", 20) + inputField("email", "Email", "email", 254) +
        readonlyField("Giới tính", user.gender) + readonlyField("CCCD", user.id_card) +
        `<div>${readonlyField("Địa chỉ", user.address)}</div>` +
        `<fieldset class="profile-emergency full-width"><legend>Người liên hệ khẩn cấp</legend><div class="profile-emergency-fields">${inputField("emergency_contact_name", "Họ và tên", "text", 150)}${inputField("emergency_contact_phone", "Số điện thoại", "tel", 30)}${inputField("emergency_contact_relationship", "Quan hệ", "text", 50)}</div></fieldset>` + professionalFields();
      for (const key of editableKeys) { form.elements[key].value = user[key] || ""; form.elements[key].defaultValue = user[key] || ""; }
      setEditing(false);
      renderAvatar();
    }
    function renderAvatar() {
      for (const node of [$("#staff-profile-avatar"), $(".staff-initials")]) {
        renderAccountAvatar(node, user, { initials: staffRoles[role].initials, className: "staff-avatar-image",
          fallback: role === "nurse" ? nursePortraitUrl : "",
          alt: node?.id === "staff-profile-avatar" ? role === "nurse" && !user.avatar_url ? "Ảnh minh họa điều dưỡng" : `Ảnh đại diện ${user.full_name}` : "" });
      }
    }
    render();
    editButton.addEventListener("click", () => {
      if (form.dataset.busy === "true") return;
      setEditing(true);
      form.querySelector('[role="status"]').textContent = "";
      form.elements.full_name.focus();
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
      const data = profileChanges(user, Object.fromEntries(editableKeys.map(key => [key, form.elements[key]])));
      const introduction = form.elements.introduction?.value.trim();
      const introductionChanged = doctor && introduction !== undefined && introduction !== (doctor.introduction || "").trim();
      if (!form.reportValidity()) return;
      if (!Object.keys(data).length && !introductionChanged) { setEditing(false); form.querySelector('[role="status"]').textContent = "Thông tin chưa thay đổi."; editButton.focus(); return; }
      editButton.disabled = true;
      submit(form, async () => {
        let accountSaved = false;
        if (Object.keys(data).length) {
          const fresh = (await updateMe(data)).user;
          if (fresh?.user_id !== user.user_id || fresh.role_name !== user.role_name) throw new Error("Phản hồi hồ sơ không hợp lệ. Vui lòng thử lại.");
          user = { ...fresh, avatar_url: user.avatar_url }; accountSaved = true;
        }
        if (introductionChanged) {
          try {
            const fresh = (await updateOwnProfile({ introduction })).doctor;
            if (fresh?.doctor_profile_id !== doctor.doctor_profile_id) throw new Error("Phản hồi hồ sơ bác sĩ không hợp lệ.");
            doctor = fresh;
          } catch (error) {
            if (accountSaved) throw new Error(`Đã lưu thông tin cá nhân, nhưng chưa xác nhận lưu giới thiệu chuyên môn: ${error.message}`);
            throw error;
          }
        }
        commitForm(form);render();
      })
        .finally(() => { editButton.disabled = false; if (!editing) editButton.focus(); });
    });
    form.addEventListener("input", event => {
      if (editableKeys.includes(event.target.name)) event.target.setCustomValidity("");
    });
    bindAvatarForm({ form: $("#avatar-form"), input: $("#avatar-file"), button: $("#avatar-choose"), feedback: $("#avatar-feedback"), getUser: () => user,
      onSaved: fresh => { user = { ...user, avatar_url: fresh.avatar_url }; renderAvatar(); } });
    bindPasswordChange();
  });
}

function bindPasswordChange() {
  const modal = $("#staff-password-dialog"), form = $("#staff-password-form"), feedback = $("#staff-password-feedback");
  const open = $("#staff-password-open"), close = $("#staff-password-close"), save = $("#staff-password-submit");
  const current = form.elements.current_password, fresh = form.elements.new_password, confirm = form.elements.confirm_password;
  let busy = false, version = 0, controller;
  enhanceDialogDismiss(modal, { closeButtons: [close], canClose: () => !busy });
  function setBusy(active) {
    busy = active;
    for (const field of [current, fresh, confirm, close, save]) field.disabled = active;
    save.textContent = active ? "Đang đổi mật khẩu…" : "Xác nhận đổi mật khẩu";
  }
  function clear() {
    version++; controller?.abort(); controller = null; setBusy(false);
    form.reset(); feedback.textContent = "";
    feedback.dataset.error = "false";
    for (const field of [current, fresh, confirm]) field.setCustomValidity("");
  }
  open.addEventListener("click", () => { if (!busy) { clear(); modal.showModal(); current.focus(); } });
  close.addEventListener("click", () => { if (!busy) modal.close(); });
  modal.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
  modal.addEventListener("close", () => { clear(); open.focus(); });
  window.addEventListener("pagehide", () => { clear(); modal.close(); });
  window.addEventListener("neu:auth-change", () => { clear(); modal.close(); });
  for (const field of [current, fresh, confirm]) field.addEventListener("input", () => { field.setCustomValidity(""); feedback.textContent = ""; });
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (busy) return;
    current.setCustomValidity(current.value ? "" : "Vui lòng nhập mật khẩu hiện tại.");
    fresh.setCustomValidity(""); confirm.setCustomValidity("");
    if (fresh.value.length < 12 || fresh.value.length > 128 || !/[A-Za-z]/.test(fresh.value) || !/\d/.test(fresh.value)) fresh.setCustomValidity("Mật khẩu mới cần từ 12 đến 128 ký tự, gồm chữ cái và chữ số.");
    if (fresh.value === current.value) fresh.setCustomValidity("Mật khẩu mới cần khác mật khẩu hiện tại.");
    if (confirm.value !== fresh.value) confirm.setCustomValidity("Mật khẩu nhập lại chưa khớp.");
    if (!form.reportValidity()) return;
    const request = version; controller = new AbortController(); setBusy(true);
    feedback.dataset.error = "false"; feedback.textContent = "Đang xử lý yêu cầu…";
    try {
      await changeOwnPassword({ current_password: current.value, new_password: fresh.value }, { signal: controller.signal });
      if (request !== version) return;
      form.reset();
      feedback.textContent = "Đã đổi mật khẩu thành công.";
      setBusy(false);modal.close();
    } catch (error) {
      if (request !== version) return;
      feedback.dataset.error = "true";
      feedback.textContent = error.message || "Chưa đổi được mật khẩu. Vui lòng thử lại.";
      if (error.status === 401 || error.status === 403) clearSession();
      else if (!error.status) feedback.textContent += " Nếu mất kết nối sau khi gửi, hãy kiểm tra đăng nhập trước khi thử lại.";
    } finally {
      if (request === version) { controller = null; setBusy(false); }
    }
  });
}
