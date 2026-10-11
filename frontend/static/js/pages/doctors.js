const directorySearch = document.querySelector("#directory-search");
const directoryDepartment = document.querySelector("#directory-department");
const directoryCards = [...document.querySelectorAll(".directory-card")];
const directoryNormalize = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
let directoryPage = 1;
const directoryPageSize = 8;
function renderDirectory() {
  const matches = directoryCards.filter(
    (card) =>
      directoryNormalize(card.dataset.directoryName).includes(
        directoryNormalize(directorySearch.value),
      ) &&
      (!directoryDepartment.value ||
        card.dataset.directoryDepartment === directoryDepartment.value),
  );
  const totalPages = Math.max(1, Math.ceil(matches.length / directoryPageSize));
  directoryPage = Math.min(directoryPage, totalPages);
  const visible = new Set(
    matches.slice((directoryPage - 1) * directoryPageSize, directoryPage * directoryPageSize),
  );
  directoryCards.forEach((card) => (card.hidden = !visible.has(card)));
  document.querySelector("#directory-result").textContent =
    `Hiển thị ${visible.size} / ${matches.length} bác sĩ minh họa`;
  document.querySelector("#directory-empty").hidden = matches.length > 0;
  document.querySelector(".directory-pagination").hidden = matches.length === 0;
  document.querySelector("#directory-prev").disabled = directoryPage === 1;
  document.querySelector("#directory-next").disabled = directoryPage === totalPages;
  const pages = document.querySelector("#directory-pages");
  pages.replaceChildren();
  for (let page = 1; page <= totalPages; page++) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(page);
    button.setAttribute("aria-label", `Trang ${page}`);
    if (page === directoryPage) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => {
      directoryPage = page;
      renderDirectory();
    });
    pages.append(button);
  }
  document.querySelectorAll("[data-doctor-chip]").forEach((button) => {
    const active = button.dataset.doctorChip === directoryDepartment.value;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
function resetDirectory() {
  directoryPage = 1;
  renderDirectory();
}
directorySearch.addEventListener("input", resetDirectory);
directoryDepartment.addEventListener("change", resetDirectory);
document.querySelector("#directory-filter").addEventListener("submit", (event) => {
  event.preventDefault();
  resetDirectory();
});
document.querySelectorAll("[data-doctor-chip]").forEach((button) =>
  button.addEventListener("click", () => {
    directoryDepartment.value = button.dataset.doctorChip;
    resetDirectory();
  }),
);
document.querySelector("#directory-prev").addEventListener("click", () => {
  if (directoryPage > 1) {
    directoryPage--;
    renderDirectory();
  }
});
document.querySelector("#directory-next").addEventListener("click", () => {
  directoryPage++;
  renderDirectory();
});
const requestedDirectoryDepartment = new URLSearchParams(location.search).get("department");
if (
  [...directoryDepartment.options].some((option) => option.value === requestedDirectoryDepartment)
)
  directoryDepartment.value = requestedDirectoryDepartment;
renderDirectory();
