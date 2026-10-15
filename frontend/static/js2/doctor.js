const searchInput = document.querySelector("#patient-search");
const encounterRows = document.querySelectorAll("#encounter-list tr");
const resultText = document.querySelector("#search-result");

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}

const statusFilter = document.querySelector("#status-filter");
function filterEncounters() {
  const keyword = normalizeText(searchInput.value);
  let visibleCount = 0;

  encounterRows.forEach((row) => {
    const ticket = row.cells[0].textContent;
    const patient = row.cells[1].textContent;
    const matches = normalizeText(`${ticket} ${patient}`).includes(keyword)
      && (!statusFilter.value || row.cells[3].textContent.trim() === statusFilter.value);

    row.hidden = !matches;

    if (matches) {
      visibleCount += 1;
    }
  });

  resultText.textContent = visibleCount === 0
    ? "Không tìm thấy lượt khám phù hợp."
    : `Hiển thị ${visibleCount} lượt khám minh họa.`;
}
searchInput.addEventListener("input", filterEncounters);
statusFilter.addEventListener("change", filterEncounters);

const roomSection = document.querySelector("#schedule");
const encounterSection = document.querySelector("#encounters");
const clinicalSection = document.querySelector("#clinical");
document.querySelector("#enter-room").addEventListener("click", () => {
  roomSection.hidden = true;
  encounterSection.hidden = false;
  searchInput.value = ""; statusFilter.value = "";
  filterEncounters();
  document.querySelector("#encounters-title").focus();
});
document.querySelector("#back-to-rooms").addEventListener("click", () => {
  encounterSection.hidden = true;
  clinicalSection.hidden = true;
  roomSection.hidden = false;
  document.querySelector("#enter-room").focus();
});
document.querySelector('.sidebar a[href="#schedule"]').addEventListener("click", () => {
  document.querySelector("#back-to-rooms").click();
});

const dialog = document.querySelector("#preview-dialog");
const dialogContent = document.querySelector("#dialog-content");
function openPreview(title, content) {
  document.querySelector("#dialog-title").textContent = title;
  dialogContent.replaceChildren(content);
  dialog.showModal();
}
function paragraph(text) {
  const element = document.createElement("p");
  element.textContent = text;
  return element;
}
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());

const actionHeading = document.createElement("th");
actionHeading.scope = "col";
actionHeading.textContent = "Chi tiết";
document.querySelector("#encounters thead tr").append(actionHeading);
encounterRows.forEach((row) => {
  const cell = row.insertCell();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.textContent = "Xem chi tiết";
  button.setAttribute("aria-label", `Xem chi tiết ${row.cells[1].textContent}`);
  button.addEventListener("click", () => {
    const content = document.createElement("div");
    ["Mã phiếu", "Bệnh nhân", "Khung giờ", "Trạng thái"].forEach((label, index) => {
      content.append(paragraph(`${label}: ${row.cells[index].textContent.trim()}`));
    });
    content.append(paragraph("Phòng 201 · Nội tổng quát · Lượt khám minh họa được giao"));
    content.append(paragraph("Triệu chứng và hồ sơ liên quan: chưa có dữ liệu thật."));
    const clinicalButton = document.createElement("button");
    clinicalButton.type = "button";
    clinicalButton.textContent = "Mở biểu mẫu bệnh án minh họa";
    clinicalButton.addEventListener("click", () => {
      dialog.close();
      clinicalForm.reset();
      document.querySelector("#clinical-encounter").selectedIndex = [...encounterRows].indexOf(row);
      clinicalSection.hidden = false;
      clinicalSection.scrollIntoView({ block: "start" });
      document.querySelector("#clinical-encounter").focus({ preventScroll: true });
    });
    content.append(clinicalButton);
    openPreview("Chi tiết lượt khám minh họa", content);
  });
  cell.append(button);
});

const medications = document.querySelector("#medications");
function renumberMedications() {
  medications.querySelectorAll("legend").forEach((legend, index) => {
    legend.textContent = `Thuốc ${index + 1}`;
  });
}
document.querySelector("#add-medication").addEventListener("click", () => {
  const row = document.querySelector("#medication-template").content.cloneNode(true);
  const fieldset = row.querySelector("fieldset");
  row.querySelector(".remove-medication").addEventListener("click", () => {
    fieldset.remove();
    renumberMedications();
    document.querySelector("#add-medication").focus();
  });
  medications.append(row);
  renumberMedications();
  fieldset.querySelector("input").focus();
});
const clinicalForm = document.querySelector("#clinical-form");
clinicalForm.addEventListener("reset", () => medications.replaceChildren());
clinicalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const fields = new FormData(clinicalForm);
  const content = document.createElement("div");
  content.append(paragraph(`Lượt khám: ${fields.get("encounter")}`));
  for (const [name, label] of [["diagnosis", "Chẩn đoán"], ["treatment", "Hướng điều trị"], ["notes", "Ghi chú bác sĩ"]]) {
    content.append(paragraph(`${label}: ${fields.get(name).trim() || "Chưa nhập"}`));
  }
  const rows = medications.querySelectorAll("fieldset");
  content.append(paragraph(rows.length ? "Đơn thuốc minh họa:" : "Không có thuốc trong bản xem trước."));
  rows.forEach((row, index) => {
    const getValue = (name) => row.querySelector(`[data-field="${name}"]`).value.trim();
    content.append(paragraph(`${index + 1}. ${getValue("name")} · Số lượng: ${getValue("quantity")} · Liều dùng: ${getValue("dosage") || "Chưa nhập"} · Hướng dẫn: ${getValue("instructions") || "Chưa nhập"}`));
  });
  openPreview("Xem trước bệnh án & đơn thuốc", content);
});

document.querySelector("#leave-preview").addEventListener("click", () => {
  const form = document.createElement("form");
  form.innerHTML = `<div class="form-grid"><label>Ngày nghỉ *<input type="date" name="date" required></label><label>Ca minh họa<select><option>08:00 – 11:30 · Phòng 201</option></select></label><label class="full-width">Lý do *<textarea name="reason" rows="3" maxlength="1000" required></textarea></label></div><button type="submit">Xem trước thông tin</button><p role="status"></p>`;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = new FormData(form);
    const [year, month, day] = fields.get("date").split("-");
    form.querySelector('[role="status"]').textContent = `Ngày ${day}/${month}/${year} · Lý do: ${fields.get("reason").trim()}. Đây là bản xem trước, chưa gửi yêu cầu báo nghỉ.`;
  });
  openPreview("Biểu mẫu báo nghỉ minh họa", form);
});

const navLinks = document.querySelectorAll(".sidebar nav a");
const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting);
  if (!visible.length) return;
  const id = visible[0].target.id;
  navLinks.forEach((link) => {
    if (link.hash === `#${id}`) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}, { rootMargin: "-10% 0px -60% 0px" });
document.querySelectorAll("main section[id]").forEach((section) => observer.observe(section));

// Hidden room views must be entered through a room card first.
document.querySelectorAll('.sidebar nav a').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.hash);
    if (target?.hidden) {
      event.preventDefault();
      document.querySelector('#schedule').hidden = false;
      document.querySelector('#schedule').scrollIntoView({ block: 'start' });
      document.querySelector('#enter-room').focus({ preventScroll: true });
    }
  });
});
