import { changeOwnPassword, getSessionUser, hasSession, clearSession, loginUrl } from "../core/session.js";

const $ = selector => document.querySelector(selector);
const dialog = $("#change-password-dialog"), form = $("#change-password-form");
const open = $("#profile-change-password"), close = $("#change-password-close"), submit = $("#change-password-submit");
const current = $("#password-current"), fresh = $("#password-new"), confirm = $("#password-confirm");
const status = $("#change-password-status"), message = $("#profile-password-message");
let version = 0, busy = false, controller;
function reset() {
  version++; controller?.abort(); controller = null; busy = false;
  for (const field of [current, fresh, confirm]) { field.value = ""; field.disabled = false; field.setCustomValidity(""); }
  status.textContent = ""; close.disabled = submit.disabled = false; submit.textContent = "Xác nhận đổi mật khẩu";
}
open.addEventListener("click", async () => {
  if (busy || open.disabled) return;
  reset(); message.hidden = true; const request = version;
  try {
    const user = await getSessionUser();
    if (request !== version) return;
    if (!user || user.role_name !== "USER") { location.replace(loginUrl(location.href).href); return; }
    dialog.showModal(); current.focus();
  } catch (error) { message.textContent = error.message; message.dataset.state = "error"; message.hidden = false; }
});
close.addEventListener("click", () => { if (!busy) dialog.close(); });
dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
dialog.addEventListener("close", () => { reset(); if (hasSession()) open.focus(); });
for (const field of [current, fresh, confirm]) field.addEventListener("input", () => { fresh.setCustomValidity(""); confirm.setCustomValidity(""); status.textContent = ""; });
form.addEventListener("submit", async event => {
  event.preventDefault(); if (busy) return;
  fresh.setCustomValidity(""); confirm.setCustomValidity("");
  if (!/[A-Za-z]/.test(fresh.value) || !/\d/.test(fresh.value)) fresh.setCustomValidity("Mật khẩu mới cần có chữ cái và chữ số.");
  if (fresh.value.length < 12 || fresh.value.length > 128) fresh.setCustomValidity("Mật khẩu mới phải từ 12 đến 128 ký tự.");
  if (fresh.value === current.value) fresh.setCustomValidity("Mật khẩu mới cần khác mật khẩu hiện tại.");
  if (confirm.value !== fresh.value) confirm.setCustomValidity("Mật khẩu nhập lại chưa khớp.");
  if (!form.reportValidity()) return;
  if (!hasSession()) { clearSession(); return; }
  const request = version; controller = new AbortController(); busy = true;
  for (const field of [current, fresh, confirm]) field.disabled = true;
  close.disabled = submit.disabled = true; submit.textContent = "Đang đổi mật khẩu…"; status.textContent = "Đang xử lý yêu cầu…";
  try {
    await changeOwnPassword({ current_password: current.value, new_password: fresh.value }, { signal: controller.signal });
    if (request !== version) return;
    dialog.close();
    message.textContent = "Đã đổi mật khẩu thành công. Phiên đăng nhập hiện tại đã được cập nhật.";
    message.dataset.state = "success"; message.hidden = false;
  } catch (error) {
    if (request !== version) return;
    status.textContent = error.message || "Chưa đổi được mật khẩu. Vui lòng thử lại.";
    if (error.status === 401 || error.status === 403) clearSession();
    else if (!error.status) status.textContent += " Nếu mất kết nối sau khi gửi, hãy kiểm tra đăng nhập trước khi thử lại.";
  } finally {
    if (request === version) {
      busy = false; close.disabled = submit.disabled = false; submit.textContent = "Xác nhận đổi mật khẩu";
      for (const field of [current, fresh, confirm]) field.disabled = false;
    }
  }
});
function suspend() { reset(); dialog.close(); message.textContent = ""; message.hidden = true; }
window.addEventListener("pagehide", suspend);
window.addEventListener("neu:auth-change", suspend);
