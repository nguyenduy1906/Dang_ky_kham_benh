// Shared presentation preference; independent from authentication and API state.
export function initializeSidebarCollapse(role) {
  const sidebar = document.querySelector("#staff-sidebar");
  if (!sidebar || sidebar.querySelector(".staff-collapse-toggle")) return;
  const preferenceKey = `neu:sidebar-collapsed:${role}`;
  const scrollKey = `neu:sidebar-scroll:${role}`;
  const widthKey = `neu:sidebar-width:${role}`;
  let restoring = true;
  document.body.classList.add("staff-sidebar-restoring");
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "staff-collapse-toggle";
  toggle.setAttribute("aria-controls", "staff-sidebar");
  toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  const header = document.createElement("div");
  header.className = "staff-sidebar-header";
  header.append(toggle);
  const brand = sidebar.querySelector(".staff-brand");
  if (brand) header.append(brand);
  sidebar.prepend(header);
  const resizer = document.createElement("div");
  resizer.className = "staff-sidebar-resizer";
  resizer.tabIndex = 0;
  resizer.setAttribute("role", "separator");
  resizer.setAttribute("aria-label", "Kéo để thay đổi độ rộng thanh menu");
  resizer.setAttribute("aria-orientation", "vertical");
  resizer.setAttribute("aria-valuemin", "80");
  resizer.setAttribute("aria-valuemax", "320");
  resizer.setAttribute("aria-controls", "staff-sidebar");
  sidebar.after(resizer);
  let expandedWidth;
  try {
    const saved = Number(localStorage.getItem(widthKey));
    if (saved >= 220 && saved <= 380) expandedWidth = Math.min(saved, 320);
  } catch { /* Optional UI preference. */ }
  if (expandedWidth) document.body.style.setProperty("--staff-sidebar-width", `${expandedWidth}px`);
  function persist() {
    try {
      localStorage.setItem(preferenceKey, String(document.body.classList.contains("staff-sidebar-collapsed")));
      if (expandedWidth) localStorage.setItem(widthKey, String(expandedWidth));
    } catch { /* Optional UI preference. */ }
  }
  sidebar.querySelectorAll("nav a, .staff-brand, .staff-sidebar-bottom a, .staff-sidebar-bottom button").forEach(link => {
    link.title = link.textContent.trim().replace(/\s+/g, " ");
  });
  function setCollapsed(collapsed) {
    document.body.classList.toggle("staff-sidebar-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Mở rộng thanh menu" : "Thu gọn thanh menu");
    toggle.title = collapsed ? "Mở rộng thanh menu" : "Thu gọn thanh menu";
    resizer.setAttribute("aria-valuenow", String(collapsed ? 80 : expandedWidth || (role === "admin" ? 270 : 248)));
  }
  function resize(width) {
    const next = Math.max(80, Math.min(320, width));
    if (next < 160) setCollapsed(true);
    else {
      expandedWidth = Math.max(220, Math.round(next));
      document.body.style.setProperty("--staff-sidebar-width", `${expandedWidth}px`);
      setCollapsed(false);
    }
  }
  let dragStart;
  resizer.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragStart = { x: event.clientX, width: sidebar.getBoundingClientRect().width };
    resizer.setPointerCapture(event.pointerId);
    document.body.classList.add("staff-sidebar-resizing");
  });
  resizer.addEventListener("pointermove", event => {
    if (dragStart) resize(dragStart.width + event.clientX - dragStart.x);
  });
  function finishResize() {
    if (!dragStart) return;
    dragStart = null;
    document.body.classList.remove("staff-sidebar-resizing");
    persist();
  }
  resizer.addEventListener("pointerup", finishResize);
  resizer.addEventListener("pointercancel", finishResize);
  resizer.addEventListener("lostpointercapture", finishResize);
  resizer.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const width = sidebar.getBoundingClientRect().width;
    resize(event.key === "Home" ? 80 : event.key === "End" ? 320 : event.key === "ArrowRight" && width < 160 ? 220 : width + (event.key === "ArrowLeft" ? -24 : 24));
    persist();
  });
  let initial = false;
  try { initial = localStorage.getItem(preferenceKey) === "true"; } catch { /* Optional UI preference. */ }
  setCollapsed(initial);
  function saveScroll() {
    if (restoring) return;
    try { sessionStorage.setItem(scrollKey, String(sidebar.scrollTop)); } catch { /* Optional UI preference. */ }
  }
  // Staff shells may still be hidden until their existing access check finishes.
  // Restore after layout, without replaying the collapse animation on every page.
  requestAnimationFrame(() => {
    try {
      const saved = Number(sessionStorage.getItem(scrollKey));
      if (Number.isFinite(saved) && saved >= 0) sidebar.scrollTop = saved;
    } catch { /* Keep navigation usable when storage is unavailable. */ }
    requestAnimationFrame(() => {
      document.body.classList.remove("staff-sidebar-restoring");
      restoring = false;
    });
  });
  sidebar.addEventListener("scroll", saveScroll, { passive: true });
  sidebar.addEventListener("click", saveScroll, { capture: true });
  window.addEventListener("pagehide", saveScroll);
  toggle.addEventListener("click", () => {
    const collapsed = !document.body.classList.contains("staff-sidebar-collapsed");
    setCollapsed(collapsed);
    persist();
  });
}
