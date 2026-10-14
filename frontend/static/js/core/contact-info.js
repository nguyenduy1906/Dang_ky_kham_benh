import { getContactInfo } from "../api/configuration.js";

const fields = ["hospital_name", "support_phone", "support_email", "exam_hours"];

export function contactInfo(payload) {
  if (!payload || fields.some(key => payload[key] !== null && typeof payload[key] !== "string")) {
    throw new Error("Thông tin liên hệ từ hệ thống không hợp lệ.");
  }
  return Object.fromEntries(fields.map(key => [key, payload[key]?.trim() || null]));
}

export function renderContactInfo(root, values, placeholder = "Đang cập nhật") {
  root.querySelectorAll("[data-contact-field]").forEach(node => {
    node.textContent = values[node.dataset.contactField] || placeholder;
  });
  root.querySelectorAll("[data-contact-missing]").forEach(node => {
    node.hidden = Boolean(values[node.dataset.contactMissing]);
  });
}

export function initContactInfo(root = document) {
  if (!root.querySelector("[data-contact-field]")) return;
  const statuses = [...root.querySelectorAll("[data-contact-status]")];
  const retries = [...root.querySelectorAll("[data-contact-retry]")];
  let request, version = 0;
  async function load() {
    const current = ++version;
    request?.abort(); request = new AbortController();
    renderContactInfo(root, {}, "Đang tải…");
    retries.forEach(node => { node.hidden = true; });
    statuses.forEach(node => { node.hidden = true; node.textContent = ""; });
    try {
      const values = contactInfo(await getContactInfo({ signal: request.signal }));
      if (current !== version) return;
      renderContactInfo(root, values);
    } catch (error) {
      if (current !== version || request.signal.aborted) return;
      renderContactInfo(root, {}, "Chưa tải được");
      statuses.forEach(node => { node.hidden = false; node.textContent = `Chưa tải được thông tin liên hệ. ${error.message}`; });
      retries.forEach(node => { node.hidden = false; });
    }
  }
  retries.forEach(node => node.addEventListener("click", load));
  window.addEventListener("pagehide", () => { ++version; request?.abort(); });
  window.addEventListener("pageshow", event => { if (event.persisted) load(); });
  load();
}
