import { verifySession, hasSession, clearSession, loginUrl } from "./session.js";

// Shared protection for pages that display the signed-in patient's data.
export function protectPatientPage({ status, main, onAccess, onSuspend = () => {} }) {
  let checking = false;
  function suspend() {
    document.body.classList.add("auth-pending");
    main.inert = true;
    onSuspend();
  }
  function signIn() {
    suspend();
    for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
    location.replace(loginUrl(new URL(location.href)).href);
  }
  async function checkAccess() {
    if (checking) return;
    checking = true;
    suspend();
    status.hidden = false;
    status.querySelector("p").textContent = "Đang kiểm tra đăng nhập…";
    status.querySelector("button").hidden = true;
    try {
      if (!await verifySession()) { signIn(); return; }
      document.body.classList.remove("auth-pending");
      main.inert = false;
      status.hidden = true;
      await onAccess();
    } catch (error) {
      status.querySelector("p").textContent = error.message;
      status.querySelector("button").hidden = false;
    } finally { checking = false; }
  }
  status.querySelector("button").addEventListener("click", checkAccess);
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", event => { if (event.persisted) checkAccess(); });
  window.addEventListener("neu:auth-change", () => { if (!hasSession()) signIn(); });
  checkAccess();
  return error => {
    if (error.status === 401) { clearSession(); return "Phiên đăng nhập đã hết hạn."; }
    return error.message || "Không thể kết nối hệ thống.";
  };
}
