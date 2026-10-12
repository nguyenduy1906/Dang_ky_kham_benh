const detailDepartments = [
  "Nội tổng quát",
  "Tim mạch",
  "Da liễu",
  "Nhi",
  "Sản phụ khoa",
  "Tai Mũi Họng",
  "Mắt",
  "Răng Hàm Mặt",
];
const rawId = new URLSearchParams(location.search).get("id");
const doctorId = /^[1-8]$/.test(rawId || "") ? Number(rawId) : 1;
const doctorLabel = `Bác sĩ ${String(doctorId).padStart(2, "0")}`;
document.querySelector("#detail-name").textContent = doctorLabel;
document.title = `${doctorLabel} | NEU Medical`;
const photo = document.querySelector("#detail-photo");
photo.src = `../../static/assets/doctors/doctors_${doctorId}.jpg`;
photo.alt = `Ảnh minh họa ${doctorLabel}`;
document.querySelector("#detail-specialty").textContent = detailDepartments[doctorId - 1];
document.querySelector("#schedule-specialty").textContent = detailDepartments[doctorId - 1];
for (const id of ["detail-booking", "schedule-booking"])
  document.getElementById(id).href = `../(patient)/portal.html?doctor=${doctorId}`;
