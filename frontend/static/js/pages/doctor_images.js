import { getDoctor } from "../api/doctor.js";
import { thumbnailUrl } from "../core/articles.js";

// Use uploaded backend portraits as they become available; keep the existing demo layout.
const photos = new Map();
function collect(id, image) {
  if (!image || !/^\d+$/.test(String(id))) return;
  if (!photos.has(id)) photos.set(id, []);
  photos.get(id).push(image);
}
document.querySelectorAll('a[href*="doctor_detail.html?id="] img').forEach(image => {
  collect(new URL(image.closest("a").href).searchParams.get("id"), image);
});
document.querySelectorAll("img[data-doctor-photo]").forEach(image => collect(image.dataset.doctorPhoto, image));
for (const [id, images] of photos) {
  getDoctor(id, { auth: false }).then(({ doctor }) => {
    if (!doctor.avatar_url?.startsWith("/uploads/avatars/")) return;
    const src = thumbnailUrl(doctor.avatar_url);
    if (!src) return;
    images.forEach(image => {
      const previous = image.src;
      image.addEventListener("error", () => { image.src = previous; }, { once: true });
      image.src = src;
    });
  }).catch(() => { /* Preserve preview portraits while the rest of the doctor API UI is unfinished. */ });
}
