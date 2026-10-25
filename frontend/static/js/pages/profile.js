import {commitForm} from "../core/form_workflow.js";
import { updateMe } from "../api/auth.js";
import { clearSession, getSessionUser, hasSession, loginUrl, workspaceUrl } from "../core/session.js";
import { personalFields, editableProfileKeys, todayVN, profileChanges } from "../core/profile.js";
import { bindAvatarForm, renderAccountAvatar } from "../core/avatar.js";

const $ = selector => document.querySelector(selector);
const main = $("#main"), status = $("#profile-auth-status"), details = $("#profile-details");
const form = $("#profile-form"), editButton = $("#profile-edit"), saveButton = $("#profile-save");
const cancelButton = $("#profile-cancel"), message = $("#profile-message");
const fields = ["id", "full-name", "phone", "email", "created", "status", ...personalFields.map(field => field.key.replaceAll("_", "-"))];
const editable = Object.fromEntries(editableProfileKeys.map(key => [key, $(`#profile-edit-${key.replaceAll("_", "-")}`)]));
editable.dob.max = todayVN();
let version = 0, user = null, editing = false, saving = false, pendingSave;
let avatarEditor;

function renderAvatar() {
  renderAccountAvatar($("#profile-avatar"), user, { alt: user ? `Ảnh đại diện ${user.full_name}` : "" });
  $("#profile-avatar-name").textContent = user?.full_name || "";
}

function notify(text = "", state = "success") {
  message.textContent = text;
  message.dataset.state = state;
  message.hidden = !text;
}
function setBusy(busy) {
  saving = busy;
  saveButton.disabled = busy;
  cancelButton.disabled = busy;
  for (const input of Object.values(editable)) input.disabled = busy;
  saveButton.textContent = busy ? "Đang lưu…" : "Lưu thông tin";
  form.setAttribute("aria-busy", String(busy));
}
function setEditing(active) {
  editing = active;
  editButton.hidden = active;
  $("#profile-edit-actions").hidden = !active;
  for (const [key, input] of Object.entries(editable)) {
    input.hidden = !active;
    input.value = user?.[key] || "";
    input.setCustomValidity("");
    $(`#profile-${key.replaceAll("_", "-")}`).hidden = active;
  }
}

function suspend() {
  version++;
  pendingSave?.abort();
  pendingSave = undefined;
  user = null;
  avatarEditor?.reset(); renderAvatar();
  setBusy(false);
  setEditing(false);
  notify();
  editButton.disabled = true;
  const passwordButton = $("#profile-change-password");
  if (passwordButton) passwordButton.disabled = true;
  document.body.classList.add("auth-pending");
  main.inert = true;
  details.hidden = true;
  for (const field of fields) $(`#profile-${field}`).textContent = "";
}
function signIn() {
  suspend();
  location.replace(loginUrl(new URL(location.href)).href);
}
function render(fresh) {
  user = fresh;
  const date = new Date(user.created_at);
  const values = {
    id: user.user_id,
    "full-name": user.full_name,
    phone: user.phone,
    email: user.email,
    created: user.created_at && Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeZone: "Asia/Saigon" }).format(date) : null,
    status: ({ ACTIVE: "Đang hoạt động", LOCKED: "Đã khóa" })[user.account_status] || user.account_status,
    ...Object.fromEntries(personalFields.map(({ key }) => [key.replaceAll("_", "-"), key === "dob" && user.dob ? user.dob.split("-").reverse().join("/") : user[key]])),
  };
  for (const [field, value] of Object.entries(values)) {
    $(`#profile-${field}`).textContent = value == null || value === "" ? "Chưa cập nhật" : String(value);
  }
  $("#profile-status").dataset.active = String(user.account_status === "ACTIVE");
  setEditing(false);
  renderAvatar();
  editButton.disabled = false;
  const passwordButton = $("#profile-change-password");
  if (passwordButton) passwordButton.disabled = false;
  details.hidden = false;
  status.hidden = true;
  main.inert = false;
  document.body.classList.remove("auth-pending");
}
async function load() {
  suspend();
  const current = version;
  status.hidden = false;
  status.querySelector("p").textContent = "Đang tải thông tin cá nhân…";
  status.querySelector("button").hidden = true;
  try {
    const fresh = await getSessionUser();
    if (current !== version) return;
    if (!fresh) { signIn(); return; }
    if (fresh.role_name !== "USER") { location.replace(workspaceUrl(fresh.role_name).href); return; }
    render(fresh);
  } catch (error) {
    if (current !== version) return;
    status.querySelector("p").textContent = `${error.message} Vui lòng thử lại.`;
    status.querySelector("button").hidden = false;
  }
}
function changes() {
  const data = profileChanges(user, editable);
  return form.reportValidity() ? data : null;
}
async function save(event) {
  event.preventDefault();
  if (!editing || saving || !user) return;
  if (!hasSession()) { signIn(); return; }
  const data = changes();
  if (!data) return;
  if (!Object.keys(data).length) {
    setEditing(false);
    notify("Thông tin chưa có thay đổi.");
    editButton.focus();
    return;
  }
  const current = version, expectedId = user.user_id;
  pendingSave = new AbortController();
  setBusy(true);
  notify("Đang lưu thông tin…");
  try {
    const result = await updateMe(data, { signal: pendingSave.signal });
    if (current !== version) return;
    if (!hasSession()) { signIn(); return; }
    if (result?.user?.user_id !== expectedId || result.user.role_name !== "USER") {
      throw new Error("Phản hồi cập nhật thông tin không hợp lệ. Vui lòng thử lại.");
    }
    commitForm(form);
    render({ ...result.user, avatar_url: user.avatar_url });
    notify("Đã lưu thông tin cá nhân.");
    editButton.focus();
  } catch (error) {
    if (current !== version) return;
    if (error.status === 401 || error.status === 403) { clearSession(); return; }
    notify(error.message || "Chưa lưu được thông tin. Vui lòng thử lại.", "error");
  } finally {
    if (current === version) {
      pendingSave = undefined;
      setBusy(false);
    }
  }
}
status.querySelector("button").addEventListener("click", load);
editButton.addEventListener("click", () => {
  if (!user || saving) return;
  if (!hasSession()) { signIn(); return; }
  notify();
  setEditing(true);
  editable.full_name.focus();
});
cancelButton.addEventListener("click", () => {
  if (saving) return;
  setEditing(false);
  notify();
  editButton.focus();
});
for (const input of Object.values(editable)) input.addEventListener("input", () => input.setCustomValidity(""));
form.addEventListener("submit", save);
avatarEditor = bindAvatarForm({
  form: $("#avatar-form"), input: $("#avatar-file"), button: $("#avatar-choose"), feedback: $("#avatar-feedback"), getUser: () => user,
  onSaved: fresh => { user = { ...user, avatar_url: fresh.avatar_url }; renderAvatar(); },
});
window.addEventListener("pagehide", suspend);
window.addEventListener("pageshow", event => { if (event.persisted) load(); });
window.addEventListener("neu:auth-change", () => { if (hasSession()) load(); else signIn(); });
load();
