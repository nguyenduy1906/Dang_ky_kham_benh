import { listDepartments } from "../api/catalog.js";

const contactTabs = [...document.querySelectorAll('[data-contact-view]')];
const selectView = (selected) => {
  contactTabs.forEach((tab) => {
    const active = tab === selected;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !active;
  });
};
contactTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectView(tab));
  tab.addEventListener("keydown", (event) => {
    let target;
    if (event.key === "ArrowRight") target = contactTabs[(index + 1) % contactTabs.length];
    else if (event.key === "ArrowLeft") target = contactTabs[(index + contactTabs.length - 1) % contactTabs.length];
    else if (event.key === "Home") target = contactTabs[0];
    else if (event.key === "End") target = contactTabs.at(-1);
    if (target) {
      event.preventDefault();
      selectView(target);
      target.focus();
    }
  });
});
const consultation = document.querySelector("#consultation-form");
const consultationName = document.querySelector("#consultation-name");
const consultationPhone = document.querySelector("#consultation-phone");
const consultationStatus = document.querySelector("#consultation-status");
const specialty = document.querySelector("#consultation-specialty");
const specialtyStatus = document.querySelector("#consultation-specialty-status");
const specialtyRetry = document.querySelector("#consultation-specialty-retry");
let specialtyRequest, specialtyVersion = 0;
async function loadSpecialties() {
  const current = ++specialtyVersion;
  specialtyRequest?.abort(); specialtyRequest = new AbortController();
  const option = document.createElement("option");
  option.value = ""; option.textContent = "Đang tải chuyên khoa…";
  specialty.replaceChildren(option); specialty.disabled = true; specialtyRetry.hidden = true;
  specialtyStatus.textContent = "";
  try {
    const result = await listDepartments({}, { auth: false, signal: specialtyRequest.signal });
    if (current !== specialtyVersion) return;
    if (!Array.isArray(result?.items) || result.items.some(item =>
      !Number.isInteger(item.department_id) || item.department_id < 1 || typeof item.name !== "string" || !item.name.trim())) {
      throw new Error("Danh sách chuyên khoa không hợp lệ.");
    }
    option.textContent = "Lựa chọn chuyên khoa";
    specialty.replaceChildren(option, ...result.items.map(item => {
      const node = document.createElement("option");
      node.value = String(item.department_id); node.textContent = item.name; return node;
    }));
    specialty.disabled = result.items.length === 0;
    if (!result.items.length) specialtyStatus.textContent = "Hiện chưa có chuyên khoa đang hoạt động.";
  } catch (error) {
    if (current !== specialtyVersion || specialtyRequest.signal.aborted) return;
    option.textContent = "Chưa tải được chuyên khoa";
    specialtyStatus.textContent = `${error.message} Bạn có thể thử lại.`;
    specialtyRetry.hidden = false;
  }
}
specialtyRetry.addEventListener("click", loadSpecialties);
window.addEventListener("pagehide", () => { ++specialtyVersion; specialtyRequest?.abort(); });
window.addEventListener("pageshow", event => { if (event.persisted) loadSpecialties(); });
loadSpecialties();
consultation.addEventListener("submit", (event) => {
  event.preventDefault();
  consultationName.setCustomValidity(consultationName.value.trim() ? "" : "Vui lòng nhập họ tên.");
  const phone = consultationPhone.value.replace(/[\s.-]/g, "");
  consultationPhone.setCustomValidity(/^\+?\d{9,15}$/.test(phone) ? "" : "Vui lòng nhập số điện thoại hợp lệ (9–15 chữ số).");
  if (!consultation.reportValidity()) return;
  consultationStatus.textContent = "Yêu cầu chưa được gửi. Vui lòng liên hệ lễ tân qua số điện thoại chăm sóc khách hàng để được tư vấn.";
});
consultation.addEventListener("input", (event) => {
  event.target.setCustomValidity?.("");
  consultationStatus.textContent = "";
});
consultation.addEventListener("change", () => { consultationStatus.textContent = ""; });
if (location.hash === "#consultation") {
  const showConsultation = () => requestAnimationFrame(() => {
    document.querySelector("#consultation").scrollIntoView({ block: "start", behavior: "instant" });
    consultationName.focus({ preventScroll: true });
  });
  if (document.readyState === "complete") showConsultation();
  else window.addEventListener("load", showConsultation, { once: true });
}
