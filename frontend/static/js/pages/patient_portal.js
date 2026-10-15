import { verifySession, loginUrl } from "../core/session.js";

const status = document.querySelector("#portal-auth-status");
let checking = false;
async function checkAccess() {
  if (checking) return;
  checking = true;
  document.body.classList.add("auth-pending");
  document.querySelector("#main").inert = true;
  status.hidden = false;
  status.querySelector("p").textContent = "Đang kiểm tra đăng nhập…";
  status.querySelector("button").hidden = true;
  try {
    if (!await verifySession()) { location.replace(loginUrl(new URL(location.href)).href); return; }
    document.body.classList.remove("auth-pending");
    document.querySelector("#main").inert = false;
    status.hidden = true;
  } catch (error) {
    status.querySelector("p").textContent = `${error.message} Vui lòng kiểm tra kết nối rồi thử lại.`;
    status.querySelector("button").hidden = false;
  } finally { checking = false; }
}
status.querySelector("button").addEventListener("click", checkAccess);
window.addEventListener("pageshow", event => { if (event.persisted) checkAccess(); });
window.addEventListener("pagehide", () => {
  document.body.classList.add("auth-pending");
  document.querySelector("#main").inert = true;
});
checkAccess();

// Preserve a selected doctor when entering the booking page from the public directory.
const chosenDoctor = new URLSearchParams(location.search).get("doctor");
if (chosenDoctor && /^\d+$/.test(chosenDoctor)) {
  document.querySelector('[data-feature="booking"]').href = `booking.html?doctor=${chosenDoctor}`;
}
