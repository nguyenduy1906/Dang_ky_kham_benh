import * as authApi from "../api/auth.js";
import { signIn, clearSession, returnUrl } from "../core/session.js";

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
document.querySelectorAll("[data-auth-mode]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.authMode)));
setMode(params.get("mode"), false);
document.querySelectorAll("[data-password]").forEach(button => button.addEventListener("click", () => {
  const field = document.getElementById(button.dataset.password);
  const show = field.type === "password";
  field.type = show ? "text" : "password";
  button.setAttribute("aria-pressed", String(show));
  button.setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
}));
const validPhone = value => /^\+?\d{9,15}$/.test(value.replace(/[\s.-]/g, ""));
const validEmail = value => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
const validIdentity = value => value.includes("@") ? validEmail(value) : validPhone(value);
const validPassword = value => value.length >= 8 && value.length <= 128 && /[A-Za-z]/.test(value) && /\d/.test(value);
function message(node, text, success = false) {
  node.textContent = text;
  node.dataset.success = String(success);
}
function busy(form, pending, label) {
  form.dataset.busy = String(pending);
  form.setAttribute("aria-busy", String(pending));
  // Freeze submitted values, but keep the recovery close button available.
  form.querySelectorAll("input, button").forEach(field => field.disabled = pending);
  form.querySelector('[type="submit"]').textContent = label;
  document.querySelectorAll("[data-auth-mode]").forEach(button => button.disabled = pending);
}
const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (loginForm.dataset.busy === "true") return;
  const identifier = document.querySelector("#login-identifier").value.trim();
  const password = document.querySelector("#login-password").value;
  if (!validIdentity(identifier)) { message(loginStatus, "Vui lòng nhập email hợp lệ hoặc số điện thoại gồm 9–15 chữ số."); return; }
  busy(loginForm, true, "Đang đăng nhập…");
  message(loginStatus, "");
  try {
    const user = await signIn({ identifier, password });
    document.querySelector("#login-password").value = "";
    location.replace(returnUrl(params.get("next"), user.role_name).href);
  } catch (error) {
    message(loginStatus, error.message);
  } finally { busy(loginForm, false, "Đăng nhập"); }
});
const registerForm = document.querySelector("#register-form");
registerForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (registerForm.dataset.busy === "true") return;
  const status = document.querySelector("#register-status");
  const data = Object.fromEntries(new FormData(registerForm));
  data.full_name = data.full_name.trim(); data.phone = data.phone.trim(); data.email = data.email.trim();
  if (!data.full_name) { message(status, "Vui lòng nhập họ và tên."); return; }
  if (!data.phone && !data.email) { message(status, "Vui lòng cung cấp số điện thoại hoặc email."); return; }
  if ((data.phone && !validPhone(data.phone)) || (data.email && !validEmail(data.email))) { message(status, "Số điện thoại hoặc email chưa đúng định dạng."); return; }
  if (!validPassword(data.password)) { message(status, "Mật khẩu cần từ 8 đến 128 ký tự, gồm chữ và số."); return; }
  if (data.password !== document.querySelector("#register-confirm").value) { message(status, "Mật khẩu nhập lại chưa khớp."); return; }
  busy(registerForm, true, "Đang đăng ký…");
  message(status, "");
  try {
    await authApi.register(data);
    registerForm.reset();
    document.querySelector("#login-identifier").value = data.phone || data.email;
    document.querySelector("#login-password").value = "";
    setMode("login");
    message(loginStatus, "Đăng ký thành công. Vui lòng đăng nhập để tiếp tục.", true);
  } catch (error) { message(status, error.message); }
  finally { busy(registerForm, false, "Đăng ký"); }
});

const recoveryDialog = document.querySelector("#recovery-dialog");
const recoveryForm = document.querySelector("#recovery-form");
const recoveryStatus = document.querySelector("#recovery-status");
let recoveryStep = "identity";
let recoveryIdentity = "";
let resetToken = null;
let recoveryRequest;
let recoveryVersion = 0;
const stepLabels = { identity: "Gửi mã xác minh", otp: "Xác minh mã", password: "Đặt lại mật khẩu" };
function recoveryMode(step, focus = true) {
  recoveryStep = step;
  for (const [name, id] of [["identity", "identifier"], ["otp", "otp"], ["password", "password"]]) {
    document.querySelector(`#recovery-${name === "identity" ? "identity" : name}-field`).hidden = name !== step;
    const input = document.querySelector(`#recovery-${id}`);
    input.required = name === step;
    input.disabled = name !== step;
  }
  document.querySelector("#recovery-restart").hidden = step === "identity";
  recoveryForm.querySelector('[type="submit"]').textContent = stepLabels[step];
  if (focus) document.querySelector(`#recovery-${step === "identity" ? "identifier" : step}`).focus();
}
function resetRecovery() {
  recoveryVersion++;
  recoveryRequest?.abort();
  recoveryRequest = undefined;
  resetToken = null;
  recoveryIdentity = "";
  recoveryForm.reset();
  busy(recoveryForm, false, stepLabels.identity);
  recoveryMode("identity", false);
  message(recoveryStatus, "");
}
document.querySelector("#forgot-password").addEventListener("click", () => {
  resetRecovery();
  document.querySelector("#recovery-identifier").value = document.querySelector("#login-identifier").value;
  recoveryDialog.showModal();
});
document.querySelector("#recovery-close").addEventListener("click", () => recoveryDialog.close());
recoveryDialog.addEventListener("close", resetRecovery);
document.querySelector("#recovery-restart").addEventListener("click", () => {
  const identity = recoveryIdentity;
  resetRecovery();
  document.querySelector("#recovery-identifier").value = identity;
  recoveryMode("identity");
});
recoveryForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (recoveryForm.dataset.busy === "true") return;
  const step = recoveryStep;
  const identifier = document.querySelector("#recovery-identifier").value.trim();
  const otp = document.querySelector("#recovery-otp").value.trim();
  const password = document.querySelector("#recovery-password").value;
  if (step === "identity" && !validIdentity(identifier)) { message(recoveryStatus, "Vui lòng nhập số điện thoại hoặc email hợp lệ."); return; }
  if (step === "otp" && !/^\d{6}$/.test(otp)) { message(recoveryStatus, "Mã xác minh cần đúng 6 chữ số."); return; }
  if (step === "password" && !validPassword(password)) { message(recoveryStatus, "Mật khẩu cần từ 8 đến 128 ký tự, gồm chữ và số."); return; }
  const version = ++recoveryVersion;
  recoveryRequest = new AbortController();
  const options = { signal: recoveryRequest.signal };
  busy(recoveryForm, true, "Đang xử lý…");
  document.querySelector("#recovery-restart").disabled = true;
  message(recoveryStatus, "");
  try {
    if (step === "identity") {
      const result = await authApi.forgotPassword({ identifier }, options);
      if (version !== recoveryVersion) return;
      recoveryIdentity = identifier;
      recoveryMode("otp", false);
      message(recoveryStatus, result.message, true);
    } else if (step === "otp") {
      const result = await authApi.verifyOtp({ identifier: recoveryIdentity, otp }, options);
      if (version !== recoveryVersion) return;
      if (!result?.reset_token) throw new Error("Phản hồi xác minh không hợp lệ.");
      resetToken = result.reset_token;
      document.querySelector("#recovery-otp").value = "";
      recoveryMode("password", false);
      message(recoveryStatus, "Mã xác minh hợp lệ. Vui lòng nhập mật khẩu mới.", true);
    } else {
      const result = await authApi.resetPassword({ reset_token: resetToken, new_password: password }, options);
      if (version !== recoveryVersion) return;
      const identity = recoveryIdentity;
      clearSession();
      recoveryDialog.close();
      setMode("login");
      document.querySelector("#login-identifier").value = identity;
      document.querySelector("#login-password").value = "";
      message(loginStatus, result.message, true);
    }
  } catch (error) {
    if (version !== recoveryVersion) return;
    if (error.code === "INVALID_RESET_TOKEN") {
      resetToken = null;
      document.querySelector("#recovery-password").value = "";
      recoveryMode("identity", false);
    }
    message(recoveryStatus, error.message);
  } finally {
    if (version === recoveryVersion) {
      recoveryRequest = undefined;
      busy(recoveryForm, false, stepLabels[recoveryStep]);
      recoveryMode(recoveryStep);
      document.querySelector("#recovery-restart").disabled = false;
    }
  }
});
// Enable submits only after the API controller has attached all handlers.
busy(loginForm, false, "Đăng nhập");
busy(registerForm, false, "Đăng ký");
busy(recoveryForm, false, stepLabels.identity);
recoveryMode("identity", false);
