import {commitForm,confirmDiscard} from "../core/form_workflow.js";
import * as authApi from "../api/auth.js";
import { signIn, clearSession, returnUrl } from "../core/session.js";

const card = document.querySelector("#auth-card");
const params = new URLSearchParams(location.search);
function setMode(mode, focus = true) {
  const register = mode === "register";
  const outgoing=document.querySelector(register?'#login-form':'#register-form');
  if(!confirmDiscard(outgoing))return;
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
    const destination = returnUrl(params.get("next"), user.role_name);
    commitForm(loginForm);location.replace(destination.href);
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
  if (!data.email) { message(status, "Vui lòng cung cấp email để nhận thư xác minh tài khoản."); return; }
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
    commitForm(registerForm);registerForm.reset();setMode("login");
    message(loginStatus, "Đăng ký thành công. Hãy kiểm tra Gmail hoặc hộp thư của bạn và mở liên kết xác minh email.", true);
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
const countdown = document.querySelector('#recovery-countdown');
let otpDeadline = 0;
let otpTimer;
function stopOtpCountdown() {
  clearInterval(otpTimer);
  otpTimer = undefined;
  otpDeadline = 0;
  countdown.hidden = true;
  countdown.textContent = '';
}
function updateOtpCountdown() {
  const seconds = Math.max(0, Math.ceil((otpDeadline - Date.now()) / 1000));
  countdown.textContent = seconds > 0 ? `Mã OTP còn hiệu lực ${seconds} giây.` : 'Mã OTP đã hết hạn. Vui lòng gửi lại mã.';
  if (recoveryForm.dataset.busy !== 'true') {
    document.querySelector('#recovery-otp').disabled = seconds === 0;
    recoveryForm.querySelector('[type="submit"]').disabled = seconds === 0;
  }
  if (seconds === 0) clearInterval(otpTimer);
}
function startOtpCountdown(seconds) {
  stopOtpCountdown();
  otpDeadline = Date.now() + seconds * 1000;
  countdown.hidden = false;
  updateOtpCountdown();
  otpTimer = setInterval(updateOtpCountdown, 250);
}
const stepLabels = { identity: "Gửi mã xác minh", otp: "Xác minh mã", password: "Đặt lại mật khẩu" };
function recoveryMode(step, focus = true) {
  recoveryStep = step;
  for (const [name, id] of [["identity", "identifier"], ["otp", "otp"], ["password", "password"]]) {
    document.querySelector(`#recovery-${name === "identity" ? "identity" : name}-field`).hidden = name !== step;
    const input = document.querySelector(`#recovery-${id}`);
    input.required = name === step;
    input.disabled = name !== step;
  }
  const confirmation = document.querySelector('#recovery-password-confirm');
  document.querySelector('#recovery-password-confirm-field').hidden = step !== 'password';
  confirmation.required = step === 'password';
  confirmation.disabled = step !== 'password';
  document.querySelector("#recovery-restart").hidden = step === "identity";
  recoveryForm.querySelector('[type="submit"]').textContent = stepLabels[step];
  if (step === "otp" && otpDeadline) updateOtpCountdown();
  if (focus) document.querySelector(`#recovery-${step === "identity" ? "identifier" : step}`).focus();
}
function resetRecovery() {
  stopOtpCountdown();
  recoveryVersion++;
  recoveryRequest?.abort();
  recoveryRequest = undefined;
  resetToken = null;
  recoveryIdentity = "";
  recoveryForm.reset();
  document.querySelector('#recovery-password-confirm').removeAttribute('aria-invalid');
  busy(recoveryForm, false, stepLabels.identity);
  recoveryMode("identity", false);
  message(recoveryStatus, "");
}
document.querySelector("#forgot-password").addEventListener("click", () => {
  resetRecovery();
  const identity = document.querySelector("#login-identifier").value.trim();
  document.querySelector("#recovery-identifier").value = /^[^@\s]+@gmail\.com$/i.test(identity) ? identity : "";
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
  if (step === "identity" && !/^[^@\s]+@gmail\.com$/i.test(identifier)) { message(recoveryStatus, "Vui lòng nhập địa chỉ @gmail.com đã đăng ký."); return; }
  if (step === "otp" && Date.now() >= otpDeadline) { updateOtpCountdown(); return; }
  if (step === "otp" && !/^\d{6}$/.test(otp)) { message(recoveryStatus, "Mã xác minh cần đúng 6 chữ số."); return; }
  if (step === "password" && !validPassword(password)) { message(recoveryStatus, "Mật khẩu cần từ 8 đến 128 ký tự, gồm chữ và số."); return; }
  if (step === 'password' && password !== document.querySelector('#recovery-password-confirm').value) {
    message(recoveryStatus, 'Mật khẩu xác nhận chưa khớp. Vui lòng nhập lại.');
    document.querySelector('#recovery-password-confirm').setAttribute('aria-invalid', 'true');
    document.querySelector('#recovery-password-confirm').focus();
    return;
  }
  document.querySelector('#recovery-password-confirm').removeAttribute('aria-invalid');
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
      if (!(result?.expires_in > 0)) throw new Error("Phản hồi thời hạn OTP không hợp lệ.");
      recoveryIdentity = identifier;
      recoveryMode("otp", false);
      startOtpCountdown(result.expires_in);
      message(recoveryStatus, result.message, true);
    } else if (step === "otp") {
      const result = await authApi.verifyOtp({ identifier: recoveryIdentity, otp }, options);
      if (version !== recoveryVersion) return;
      if (!result?.reset_token) throw new Error("Phản hồi xác minh không hợp lệ.");
      stopOtpCountdown();
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
      document.querySelector("#recovery-password-confirm").value = "";
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
