/**
 * main.js — Global JavaScript for PhòngKhámOnline
 */

// ─── Mobile Nav Toggle ─────────────────────────────────────
function toggleNav() {
  const links = document.getElementById("navLinks");
  if (links) links.classList.toggle("open");
}

// Đóng nav khi click ngoài
document.addEventListener("click", function (e) {
  const nav = document.getElementById("navLinks");
  const toggle = document.querySelector(".nav-toggle");
  if (nav && toggle && !nav.contains(e.target) && !toggle.contains(e.target)) {
    nav.classList.remove("open");
  }
});

// ─── Auto dismiss flash messages ──────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  const alerts = document.querySelectorAll(".alert");
  alerts.forEach((alert) => {
    setTimeout(() => {
      alert.style.transition = "opacity .4s";
      alert.style.opacity = "0";
      setTimeout(() => alert.remove(), 400);
    }, 4000);
  });
});

// ─── Confirm on delete / cancel ───────────────────────────
document.querySelectorAll("[data-confirm]").forEach((el) => {
  el.addEventListener("click", function (e) {
    if (!confirm(this.dataset.confirm)) {
      e.preventDefault();
    }
  });
});

// ─── Active nav link highlight ─────────────────────────────
(function () {
  const path = window.location.pathname;
  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === path) {
      link.style.color = "var(--primary)";
      link.style.fontWeight = "700";
    }
  });
})();
