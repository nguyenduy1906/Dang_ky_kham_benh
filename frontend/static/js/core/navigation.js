// Shared navigation motion for the public HTML pages.
(() => {
  const nav = document.querySelector(".site-header #main-nav");
  const main = document.querySelector("main");
  if (!nav || !main) return;

  const links = [...nav.querySelectorAll("a[href]")];
  const active = nav.querySelector('a[aria-current="page"]');
  const indicator = nav.querySelector(".nav-indicator");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const desktop = matchMedia("(min-width: 761px)");
  const prefetched = new Set();
  let navigationTimer;
  let navigationIntent = 0;
  const session = () => import("./session.js");

  function moveIndicator(link, animate = true) {
    if (!indicator || !link || !desktop.matches) return;
    // Disable motion before reading layout, especially on a freshly loaded page.
    nav.classList.toggle("nav-static", !animate);
    const bounds = link.getBoundingClientRect();
    const navBounds = nav.getBoundingClientRect();
    nav.style.setProperty("--nav-x", `${bounds.left - navBounds.left}px`);
    nav.style.setProperty("--nav-width", `${bounds.width}px`);
    if (!animate) {
      // Commit the final position with transitions off; never animate from x = 0.
      indicator.getBoundingClientRect();
      requestAnimationFrame(() => nav.classList.remove("nav-static"));
    }
  }

  function resetNavigation() {
    clearTimeout(navigationTimer);
    navigationTimer = undefined;
    main.classList.remove("page-leaving", "page-entering");
    nav.classList.remove("is-navigating");
    links.forEach(link => link.classList.remove("nav-pending"));
    moveIndicator(active, false);
  }

  if (indicator && active) {
    nav.classList.add("nav-sliding", "nav-static");
    nav.append(indicator);
    moveIndicator(active, false);
  }

  function isCurrentPage(url) {
    return url.origin === location.origin && url.pathname === location.pathname &&
      url.search === location.search && (!url.hash || url.hash === location.hash);
  }

  function localPage(anchor) {
    if (!anchor || anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")) return null;
    const url = new URL(anchor.href, location.href);
    return url.origin === location.origin && /^(https?:|file:)$/.test(url.protocol) &&
      url.pathname.endsWith(".html") ? url : null;
  }

  function prefetch(anchor) {
    const url = localPage(anchor);
    if (!url || isCurrentPage(url) || url.protocol === "file:" || prefetched.has(url.href)) return;
    prefetched.add(url.href);
    const hint = document.createElement("link");
    hint.rel = "prefetch";
    hint.href = url.href;
    document.head.append(hint);
  }

  nav.addEventListener("pointerover", event => prefetch(event.target.closest("a[href]")));
  nav.addEventListener("focusin", event => prefetch(event.target.closest("a[href]")));

  async function navigate(url, anchor) {
    const intent = ++navigationIntent;
    // Cancel queued motion while checking access; an older response cannot win.
    if (navigationTimer !== undefined) resetNavigation();
    if (url.pathname.endsWith("/(patient)/portal.html")) {
      try {
        const auth = await session();
        const allowed = await auth.verifySession();
        if (intent !== navigationIntent) return;
        if (!allowed) url = auth.loginUrl(url);
      } catch (error) {
        if (intent !== navigationIntent) return;
        const dialog = document.querySelector("#info-dialog");
        document.querySelector("#dialog-title").textContent = "Chưa thể kiểm tra đăng nhập";
        document.querySelector("#dialog-content").textContent = `${error.message} Vui lòng thử lại.`;
        if (!dialog.open) dialog.showModal();
        return;
      }
    }
    if (isCurrentPage(url)) {
      return;
    }
    if (reducedMotion.matches ||
        (url.pathname === location.pathname && url.search === location.search)) {
      location.assign(url.href);
      return;
    }
    clearTimeout(navigationTimer);
    main.classList.remove("page-entering");
    main.classList.add("page-leaving");
    const destination = links.find(link => {
      const target = new URL(link.href, location.href);
      return target.pathname === url.pathname && target.search === url.search;
    });
    links.forEach(link => link.classList.toggle("nav-pending", link === destination));
    nav.classList.toggle("is-navigating", Boolean(destination));
    if (destination) moveIndicator(destination);
    if (anchor) prefetch(anchor);
    navigationTimer = setTimeout(() => location.assign(url.href), desktop.matches ? 220 : 140);
  }

  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest("a[href]");
    const url = localPage(anchor);
    if (!url) return;
    event.preventDefault();
    navigate(url, anchor);
  });
  document.addEventListener("neu:navigate", event => {
    const url = new URL(event.detail.href, location.href);
    if (url.origin !== location.origin || !url.pathname.endsWith(".html")) return;
    event.preventDefault();
    navigate(url);
  });

  function alignIndicator() {
    moveIndicator(nav.querySelector(".nav-pending") || active, false);
  }
  window.addEventListener("resize", alignIndicator);
  document.fonts?.ready.then(alignIndicator);
  window.addEventListener("pagehide", () => clearTimeout(navigationTimer));
  window.addEventListener("pageshow", event => {
    if (event.persisted) resetNavigation();
  });

  main.classList.add("page-entering");
  main.addEventListener("animationend", event => {
    if (event.target === main && event.animationName === "page-content-in") {
      main.classList.remove("page-entering");
    }
  });
})();
