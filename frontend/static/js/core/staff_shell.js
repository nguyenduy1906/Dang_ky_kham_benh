import { initializeSidebarCollapse } from "./sidebar_collapse.js";
import { adminSections } from "../data/admin_navigation.js";

// A local illustration for nurses; it does not represent a stored profile photo.
export const nursePortraitUrl = new URL("../../assets/nurses/dieu_duong_01.jpg", import.meta.url).href;

export const staffRoles = Object.freeze({
  doctor: { label: "Bác sĩ", initials: "BS", description: "Chăm sóc tận tâm, chuyên môn vững vàng", pages: [
    ["overview", "Tổng quan", "home.html", "overview"],
    ["work_calendar", "Lịch làm việc", "work_calendar.html", "calendar"],
    ["schedule", "Phòng được phân công", "schedule.html", "calendar"],
    ["encounters", "Lượt khám được giao", "encounters.html", "people"],
    ["clinical", "Bệnh án & đơn thuốc", "clinical.html", "record"],
    ["history", "Lịch sử khám", "history.html", "history"],
  ] },
  nurse: { label: "Y tá", initials: "YT", description: "Đồng hành cùng bác sĩ, chăm sóc người bệnh", pages: [
    ["overview", "Tổng quan", "home.html", "overview"],
    ["work_calendar", "Lịch làm việc", "work_calendar.html", "calendar"],
    ["assignments", "Phòng được phân công", "assignments.html", "calendar"],
    ["patients", "Bệnh nhân trong ca", "patients.html", "people"],
  ] },
  reception: { label: "Lễ tân", initials: "LT", description: "Tiếp đón chu đáo, điều phối thuận tiện", pages: [
    ["overview", "Tổng quan", "home.html", "overview"],
    ["work_calendar", "Lịch làm việc", "work_calendar.html", "calendar"],
    ["encounters", "Tra cứu & tiếp nhận", "encounters.html", "people"],
    ["walk_in", "Khách khám trực tiếp", "walk_in.html", "record"],
    ["patients", "Hồ sơ bệnh nhân", "patients.html", "badge"],
    ["coordination", "Chọn phòng / ca", "coordination.html", "calendar"],
  ] },
  admin: { label: "Quản trị viên", initials: "QT", description: "Không gian quản trị bệnh viện", pages:
    adminSections.flatMap(([, items]) => items.map(([key, label]) => [key, label, `${key}.html`,
      ({ home: "overview", encounters: "record", patients: "people", schedule: "calendar", assignments: "calendar", doctors: "badge", users: "people", audit: "history" })[key] || "record"])),
  },
});

export function resolveStaffRole(value) {
  return Object.hasOwn(staffRoles, value) ? value : null;
}

export function getStaffRole() {
  return resolveStaffRole(document.body.dataset.role || new URLSearchParams(location.search).get("role"));
}

const iconPaths = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>',
  record: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/>',
  history: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
  badge: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M14 11h4M14 15h4"/><circle cx="8" cy="11" r="2"/><path d="M5 18v-1a3 3 0 0 1 6 0v1"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  logout: '<path d="M9 3H3v18h6M10 12h11M17 8l4 4-4 4"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
}

export function mountStaffWorkspace() {
  const sidebar = document.querySelector("#staff-sidebar"), topbar = document.querySelector("#staff-topbar");
  if (!sidebar || !topbar) return;
  const role = getStaffRole(), configuration = staffRoles[role];
  if (role) document.body.dataset.role = role;
  const templates = new URL("../../../templates/", import.meta.url);
  const workspaceHome = new URL(role ? `(${role})/home.html` : "components/profile.html", templates).href;
  const profileUrl = new URL("components/profile.html", templates);
  if (role) profileUrl.searchParams.set("role", role);
  const current = document.body.dataset.page;
  const navigation = (configuration?.pages || []).map(([key, label, file, symbol]) => {
    const url = new URL(`(${role})/${file}`, templates).href;
    return `<a href="${url}"${key === current ? ' aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span></a>`;
  }).join("");
  sidebar.innerHTML = `
    <a class="staff-brand" href="${workspaceHome}"><img src="${new URL("../../assets/bieu_trung_neu.png", import.meta.url).href}" width="44" height="44" alt="Logo NEU Medical"><span><strong>NEU MEDICAL</strong><small>BỆNH VIỆN NEU MEDICAL</small></span></a>
    <p class="staff-nav-label">KHÔNG GIAN LÀM VIỆC</p>
    <nav aria-label="Điều hướng ${configuration?.label.toLocaleLowerCase("vi") || "nhân viên"}">${navigation}
      <a href="${profileUrl.href}"${current === "profile" ? ' aria-current="page"' : ""}>${icon("profile")}<span>Hồ sơ cá nhân</span></a>
    </nav>
    <div class="staff-sidebar-bottom"><p>${configuration?.description || "Thông tin cá nhân dành cho nhân viên bệnh viện"}</p><button id="staff-signout" type="button" class="secondary">${icon("logout")}<span>Đăng xuất</span></button><span>NEU Medical</span></div>`;
  const activeTitle = current === "profile" ? "Hồ sơ cá nhân" : configuration?.pages.find(([key]) => key === current)?.[1] || "Không gian nhân viên";
  topbar.innerHTML = `<div class="staff-topbar-left"><button class="staff-menu-toggle" type="button" id="staff-menu-toggle" aria-label="Mở điều hướng" aria-controls="staff-sidebar" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><span class="staff-breadcrumb">${configuration?.label || "Nhân viên"}<span aria-hidden="true">/</span><strong>${activeTitle}</strong></span></div><div class="staff-topbar-right"><a class="staff-account" href="${profileUrl.href}" aria-label="Hồ sơ cá nhân"><span class="staff-initials" aria-hidden="true">${role === "nurse" ? `<img src="${nursePortraitUrl}" width="33" height="33" alt="">` : configuration?.initials || "NV"}</span><span id="staff-account-name">${configuration?.label || "Nhân viên"}</span>${icon("profile")}</a></div>`;
  const toggle = document.querySelector("#staff-menu-toggle");
  initializeSidebarCollapse(role || "staff");
  const backdrop = document.createElement("button");
  backdrop.type = "button"; backdrop.className = "staff-menu-backdrop";
  backdrop.setAttribute("aria-label", "Đóng điều hướng"); backdrop.hidden = true;
  sidebar.after(backdrop);
  function setOpen(open) {
    document.body.classList.toggle("staff-menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Đóng điều hướng" : "Mở điều hướng");
    backdrop.hidden = !open;
    if (open) requestAnimationFrame(() => {
      if (toggle.getAttribute("aria-expanded") === "true") sidebar.querySelector("a")?.focus({ preventScroll: true });
    });
  }
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  backdrop.addEventListener("click", () => { setOpen(false); toggle.focus(); });
  document.addEventListener("keydown", event => {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    if (event.key === "Escape") { setOpen(false); toggle.focus(); }
    if (event.key === "Tab") {
      const links = [...sidebar.querySelectorAll("a[href], button:not([disabled])")];
      const first = links[0], last = links.at(-1);
      if (!sidebar.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      }
    }
  });
  const desktop = matchMedia("(min-width: 961px)");
  desktop.addEventListener("change", () => setOpen(false));
}

