import { API_CONFIG } from "../config.js";
import { uploadMyAvatar } from "../api/auth.js";
import { hasSession, clearSession } from "./session.js";

// Account avatars share the same storage path and file limits across roles.
export function avatarUrl(value) {
  if (typeof value !== "string" || !/^\/uploads\/avatars\/[0-9a-f]{32}\.(jpg|png|webp)$/.test(value)) return "";
  return new URL(value, API_CONFIG.baseUrl).href;
}

export function isValidAvatar(file) {
  return Boolean(file && ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 2 * 1024 * 1024);
}

// Existing illustrations stay visible if a replacement avatar cannot load.
export function replaceAvatarImages(images, src) {
  images.forEach(image => {
    const previous = image.src;
    image.addEventListener("error", () => { image.src = previous; }, { once: true });
    image.src = src;
  });
}

export function renderAccountAvatar(node, user, { initials = "TK", alt = "", className = "account-avatar-image", fallback = "" } = {}) {
  if (!node) return;
  node.textContent = initials;
  const src = avatarUrl(user?.avatar_url) || fallback;
  if (!src) return;
  const image = document.createElement("img");
  image.alt = alt; image.className = className;
  image.addEventListener("error", () => { if (image.parentNode === node) node.textContent = initials; }, { once: true });
  image.src = src;
  node.replaceChildren(image);
}

export function bindAvatarForm({ form, input, button, feedback, getUser, onSaved }) {
  let version = 0, pending, busy = false;
  const controls = [...form.querySelectorAll("button, input")];
  function reset() {
    version++; pending?.abort(); pending = null; busy = false;
    controls.forEach(node => { node.disabled = false; });
    form.reset(); input.setCustomValidity(""); feedback.textContent = ""; button.textContent = "Chọn ảnh đại diện";
  }
  button.addEventListener("click", () => { if (!busy && getUser()) input.click(); });
  form.addEventListener("submit", event => event.preventDefault());
  input.addEventListener("change", async () => {
    const user = getUser();
    if (busy || !user) return;
    if (!hasSession()) { clearSession(); return; }
    const file = input.files[0];
    if (!file) return;
    const valid = isValidAvatar(file);
    input.setCustomValidity(valid ? "" : "Chọn ảnh JPEG, PNG hoặc WebP, tối đa 2 MB.");
    if (!valid) { feedback.dataset.error = "true"; feedback.textContent = "Chọn ảnh JPEG, PNG hoặc WebP, tối đa 2 MB."; input.value = ""; return; }
    const current = version;
    pending = new AbortController(); busy = true;
    controls.forEach(node => { node.disabled = true; });
    feedback.dataset.error = "false"; feedback.textContent = "Đang cập nhật ảnh…"; button.textContent = "Đang cập nhật…";
    try {
      const result = await uploadMyAvatar(file, { signal: pending.signal });
      if (current !== version || !getUser() || !hasSession()) return;
      if (result?.user?.user_id !== user.user_id || result.user.role_name !== user.role_name || !avatarUrl(result.user.avatar_url)) throw new Error("Phản hồi ảnh đại diện không hợp lệ. Vui lòng thử lại.");
      onSaved(result.user);
      form.reset(); feedback.textContent = "Đã cập nhật ảnh đại diện.";
    } catch (error) {
      if (current !== version) return;
      if (error.status === 401 || error.status === 403) { clearSession(); return; }
      feedback.dataset.error = "true"; feedback.textContent = error.message || "Chưa cập nhật được ảnh. Vui lòng thử lại.";
    } finally {
      if (current === version) { pending = null; busy = false; input.value = ""; button.textContent = "Chọn ảnh đại diện"; controls.forEach(node => { node.disabled = false; }); }
    }
  });
  window.addEventListener("pagehide", reset);
  window.addEventListener("neu:auth-change", reset);
  return { reset };
}
