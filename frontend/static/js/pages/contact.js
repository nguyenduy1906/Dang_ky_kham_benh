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
consultation.addEventListener("submit", (event) => {
  event.preventDefault();
  consultationName.setCustomValidity(consultationName.value.trim() ? "" : "Vui lòng nhập họ tên.");
  const phone = consultationPhone.value.replace(/[\s.-]/g, "");
  consultationPhone.setCustomValidity(/^\+?\d{9,15}$/.test(phone) ? "" : "Vui lòng nhập số điện thoại hợp lệ (9–15 chữ số).");
  if (!consultation.reportValidity()) return;
  consultationStatus.textContent = "Biểu mẫu đang là bản xem trước. Thông tin chưa được gửi tới bệnh viện.";
});
[consultationName, consultationPhone].forEach((input) => {
  input.addEventListener("input", () => {
    input.setCustomValidity("");
    consultationStatus.textContent = "";
  });
});
