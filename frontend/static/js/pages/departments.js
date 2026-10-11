const specialtySearch = document.querySelector("#specialty-search");
const specialtyCards = [...document.querySelectorAll("[data-specialty]")];
let specialtyGroup = "all";
const normalizeSpecialty = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
function filterSpecialties() {
  let count = 0;
  for (const card of specialtyCards) {
    const match =
      (specialtyGroup === "all" || card.dataset.group === specialtyGroup) &&
      normalizeSpecialty(card.dataset.specialty).includes(
        normalizeSpecialty(specialtySearch.value),
      );
    card.hidden = !match;
    if (match) count++;
  }
  document.querySelector("#specialty-result").textContent = `${count} chuyên khoa`;
  document.querySelector("#specialty-empty").hidden = count !== 0;
}
specialtySearch.addEventListener("input", filterSpecialties);
document.querySelectorAll("[data-specialty-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    specialtyGroup = button.dataset.specialtyFilter;
    document.querySelectorAll("[data-specialty-filter]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("selected", active);
      item.setAttribute("aria-pressed", String(active));
    });
    filterSpecialties();
  }),
);
filterSpecialties();
