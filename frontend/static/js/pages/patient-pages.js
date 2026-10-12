document.querySelectorAll("[data-tab-group]").forEach((group) => {
  const tabs = [...group.querySelectorAll('[role="tab"]')];
  const activate = (selected) => {
    tabs.forEach((tab) => {
      const active = tab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !active;
    });
    group.dispatchEvent(new CustomEvent("patient-tab-change", { detail: selected }));
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab));
    tab.addEventListener("keydown", (event) => {
      let target;
      if (event.key === "ArrowRight") target = tabs[(index + 1) % tabs.length];
      else if (event.key === "ArrowLeft") target = tabs[(index + tabs.length - 1) % tabs.length];
      else if (event.key === "Home") target = tabs[0];
      else if (event.key === "End") target = tabs.at(-1);
      if (target) {
        event.preventDefault();
        activate(target);
        target.focus();
      }
    });
  });
});

const recordLookup = document.querySelector("#record-lookup-dialog");
if (recordLookup) {
  const form = document.querySelector("#record-lookup-form");
  const patient = document.querySelector("#lookup-patient");
  const identifier = document.querySelector("#lookup-identifier");
  const status = document.querySelector("#record-lookup-status");
  document.querySelectorAll("[data-open-record-lookup]").forEach((button) => {
    button.addEventListener("click", () => recordLookup.showModal());
  });
  document.querySelector("#record-lookup-close").addEventListener("click", () => recordLookup.close());
  recordLookup.addEventListener("click", (event) => {
    if (event.target === recordLookup) {
      const rect = recordLookup.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) recordLookup.close();
    }
  });
  patient.addEventListener("change", () => {
    document.querySelector("#lookup-identifier-field").hidden = !patient.value;
    identifier.required = Boolean(patient.value);
    status.textContent = "";
  });
  recordLookup.querySelector("[data-tab-group]").addEventListener("patient-tab-change", (event) => {
    const cccd = event.detail.dataset.lookupMethod === "cccd";
    document.querySelector("#lookup-identifier-label").textContent = cccd ? "Số CCCD *" : "Mã người bệnh *";
    identifier.pattern = cccd ? "(?:[0-9]{9}|[0-9]{12})" : "[A-Za-z0-9-]{1,30}";
    identifier.maxLength = cccd ? 12 : 30;
    identifier.inputMode = cccd ? "numeric" : "text";
    identifier.title = cccd ? "CCCD gồm 9 hoặc 12 chữ số" : "Mã người bệnh gồm chữ, số hoặc dấu gạch ngang";
    identifier.value = "";
    status.textContent = "";
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    status.textContent = "Biểu mẫu đang là bản xem trước, chưa kết nối dữ liệu kết quả khám.";
  });
}
