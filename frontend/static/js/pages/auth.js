// Interface only: no API calls, account creation or simulated login sessions.
const card = document.querySelector("#auth-card");
const params = new URLSearchParams(location.search);
function setMode(mode, focus = true) {
  const register = mode === "register";
  card.classList.toggle("is-register", register);
  for (const [id, active] of [["login-panel", !register], ["register-panel", register]]) {
    const panel = document.getElementById(id);
    panel.classList.toggle("auth-panel-inactive", !active);
    panel.inert = !active;
    panel.setAttribute("aria-hidden", String(!active));
  }
  document.title = `${register ? "Đăng ký" : "Đăng nhập"} | NEU Medical`;
  const url = new URL(location.href);
  if (register) url.searchParams.set("mode", "register"); else url.searchParams.delete("mode");
  history.replaceState(null, "", url);
  if (focus) document.getElementById(register ? "register-title" : "login-title").focus({ preventScroll: true });
}
document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.authMode)));
setMode(params.get("mode"), false);
document.querySelectorAll("[data-password]").forEach((button) => button.addEventListener("click", () => {
  const field = document.getElementById(button.dataset.password);
  const show = field.type === "password";
  field.type = show ? "text" : "password";
  button.setAttribute("aria-pressed", String(show));
  button.setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
}));
const validPhone = (value) => /^\+?\d{9,15}$/.test(value.replace(/[\s.-]/g, ""));
const validEmail = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
const validIdentity = (value) => value.includes("@") ? validEmail(value) : validPhone(value);
const validPassword = (value) => value.length >= 8 && value.length <= 128 && /[A-Za-z]/.test(value) && /\d/.test(value);
function message(node, text, preview = false) { node.textContent = text; node.dataset.success = String(preview); }
document.querySelector("#login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const status = document.querySelector("#login-status");
  const identifier = document.querySelector("#login-identifier").value.trim();
  if (!validIdentity(identifier)) { message(status, "Vui lòng nhập email hợp lệ hoặc số điện thoại gồm 9–15 chữ số."); return; }
  message(status, "Đây là bản xem trước giao diện. Chức năng đăng nhập chưa được kết nối.", true);
});
document.querySelector("#register-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const status = document.querySelector("#register-status");
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  data.full_name = data.full_name.trim(); data.phone = data.phone.trim(); data.email = data.email.trim();
  if (!data.full_name) { message(status, "Vui lòng nhập họ và tên."); return; }
  if (!data.phone && !data.email) { message(status, "Vui lòng cung cấp số điện thoại hoặc email."); return; }
  if ((data.phone && !validPhone(data.phone)) || (data.email && !validEmail(data.email))) { message(status, "Số điện thoại hoặc email chưa đúng định dạng."); return; }
  if (!validPassword(data.password)) { message(status, "Mật khẩu cần từ 8 đến 128 ký tự, gồm chữ và số."); return; }
  if (data.password !== document.querySelector("#register-confirm").value) { message(status, "Mật khẩu nhập lại chưa khớp."); return; }
  message(status, "Thông tin hợp lệ về định dạng. Bản xem trước chưa tạo tài khoản.", true);
});
const recoveryDialog = document.querySelector("#recovery-dialog");
const recoveryForm = document.querySelector("#recovery-form");
const recoveryStatus = document.querySelector("#recovery-status");
document.querySelector("#forgot-password").addEventListener("click", () => {
  recoveryForm.reset(); message(recoveryStatus, "");
  document.querySelector("#recovery-identifier").value = document.querySelector("#login-identifier").value;
  recoveryDialog.showModal();
});
document.querySelector("#recovery-close").addEventListener("click", () => recoveryDialog.close());
recoveryDialog.addEventListener("close", () => recoveryForm.reset());
recoveryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const identifier = document.querySelector("#recovery-identifier").value.trim();
  if (!validIdentity(identifier)) { message(recoveryStatus, "Vui lòng nhập số điện thoại hoặc email hợp lệ."); return; }
  message(recoveryStatus, "Đây là bản xem trước giao diện. Chưa gửi mã xác minh hoặc thay đổi mật khẩu.", true);
});
