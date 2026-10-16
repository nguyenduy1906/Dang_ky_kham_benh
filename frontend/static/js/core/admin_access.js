import { getSessionUser, loginUrl, workspaceUrl } from "./session.js";

export async function requireAdmin() {
  const main = document.querySelector("#main-content");
  const status = document.querySelector("#staff-access");
  document.body.classList.add("staff-auth-pending");
  main.inert = true;
  let active = true;
  window.addEventListener("pagehide", () => { active = false; }, { once: true });
  try {
    const user = await getSessionUser();
    if (!active) return null;
    if (!user) { location.replace(loginUrl(new URL(location.href)).href); return null; }
    if (user.role_name !== "ADMIN") { location.replace(workspaceUrl(user.role_name).href); return null; }
    document.body.classList.remove("staff-auth-pending");
    main.inert = false;
    status.hidden = true;
    return user;
  } catch (error) {
    if (!active) return null;
    status.textContent = error.message || "Không thể kiểm tra quyền quản trị. Vui lòng thử lại.";
    const retry = document.createElement("button");
    retry.type = "button"; retry.textContent = "Thử lại";
    retry.addEventListener("click", () => location.reload());
    status.append(retry);
    return null;
  }
}
