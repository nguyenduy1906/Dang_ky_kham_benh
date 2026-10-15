import { updateMe } from "../api/auth.js";
import { clearSession, getSessionUser, hasSession, loginUrl } from "../core/session.js";

const $ = selector => document.querySelector(selector);
const main = $("#main"), status = $("#profile-auth-status"), details = $("#profile-details");
const form = $("#profile-form"), editButton = $("#profile-edit"), saveButton = $("#profile-save");
const cancelButton = $("#profile-cancel"), message = $("#profile-message");
const fields = ["id", "full-name", "phone", "email", "created", "status"];
const editable = { full_name: $("#profile-edit-full-name"), phone: $("#profile-edit-phone"), email: $("#profile-edit-email") };
let version = 0, user = null, editing = false, saving = false, pendingSave;

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
    $(`#profile-${key.replace("_", "-")}`).hidden = active;
  }
}

function suspend() {
  version++;
  pendingSave?.abort();
  pendingSave = undefined;
  user = null;
  setBusy(false);
  setEditing(false);
  notify();
  editButton.disabled = true;
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
  };
  for (const [field, value] of Object.entries(values)) {
    $(`#profile-${field}`).textContent = value == null || value === "" ? "Chưa cập nhật" : String(value);
  }
  setEditing(false);
  editButton.disabled = false;
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
    render(fresh);
  } catch (error) {
    if (current !== version) return;
    status.querySelector("p").textContent = `${error.message} Vui lòng thử lại.`;
    status.querySelector("button").hidden = false;
  }
}
function normalized(key, value) {
  let text = String(value || "").trim();
  if (key === "email") return text.toLowerCase();
  if (key === "phone") {
    text = text.replace(/[\s.\-]/g, "");
    if (/^\+?84[35789]\d{8}$/.test(text)) text = `0${text.replace(/^\+?84/, "")}`;
  }
  return text;
}
function changes() {
  const data = {};
  for (const [key, input] of Object.entries(editable)) {
    input.setCustomValidity("");
    const value = normalized(key, input.value);
    if (value === normalized(key, user[key])) continue;
    // Empty fields that were already absent are omitted; PATCH /me cannot clear an identity.
    if (!value) input.setCustomValidity(`${({ full_name: "Họ và tên", phone: "Số điện thoại", email: "Email" })[key]} không được để trống.`);
    else if (key === "full_name" && value.length > 150) input.setCustomValidity("Họ và tên tối đa 150 ký tự.");
    else if (key === "phone" && !/^\+?\d{9,15}$/.test(value)) input.setCustomValidity("Số điện thoại cần có từ 9 đến 15 chữ số.");
    else if (key === "email" && (value.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))) input.setCustomValidity("Vui lòng nhập email hợp lệ.");
    data[key] = value;
  }
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
    render(result.user);
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
window.addEventListener("pagehide", suspend);
window.addEventListener("pageshow", event => { if (event.persisted) load(); });
window.addEventListener("neu:auth-change", () => { if (hasSession()) load(); else signIn(); });
load();
