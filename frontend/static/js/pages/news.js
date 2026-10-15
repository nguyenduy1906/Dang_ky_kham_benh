import { articlePage, articleCategories, articleCard } from "../core/articles.js";

const root = document.querySelector("[data-article-feed]");
const home = root.dataset.articleFeed === "home";
// Three columns: the news directory shows four rows instead of two.
const pageSize = home ? 6 : 12;
const grid = document.querySelector("#news-grid");
const status = document.querySelector("#news-status");
const retry = document.querySelector("#news-retry");
const pager = document.querySelector("#news-pagination");
const previous = document.querySelector("#news-prev");
const next = document.querySelector("#news-next");
const pages = document.querySelector("#news-pages");
const form = document.querySelector("#news-filter-form");
const filters = document.querySelector("#news-filters");
const params = new URLSearchParams(location.search);
const requestedPage = Number(params.get("page"));
let page = !home && Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000 ? requestedPage : 1;
let query = home ? "" : (params.get("q") || "").trim();
let category = home ? "" : (params.get("category") || "").trim();
let request;
let version = 0;
let categoryRequest;
let otherRequest;
let otherVersion = 0;
let loading = false, totalPages = 1;
let searchTimer;

if (form) { form.elements.q.value = query; form.elements.category.value = category; }
function saveFilters() {
  if (home) return;
  const url = new URL(location.href);
  for (const [key, value] of [["q", query], ["category", category], ["page", page > 1 ? page : ""]]) {
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  }
  history.replaceState(null, "", url);
  // Clicking the active nav item must keep search/pagination and avoid reloading images.
  const activeLink = document.querySelector('.site-header #main-nav a[aria-current="page"]');
  if (activeLink) activeLink.href = url.href;
}
async function load() {
  clearTimeout(searchTimer);
  const current = ++version;
  loading = true;
  request?.abort(); request = new AbortController();
  grid.replaceChildren(); grid.setAttribute("aria-busy", "true");
  status.textContent = "Đang tải bài viết…"; retry.hidden = true; pager.hidden = true;
  try {
    const result = await articlePage({ page, page_size: pageSize, q: query, category }, { signal: request.signal });
    if (current !== version) return;
    const lastPage = Math.max(1, Math.ceil(result.total / result.page_size));
    // A removed article or an old bookmark can leave the requested page out of range.
    if (page > lastPage) { page = lastPage; saveFilters(); return load(); }
    grid.replaceChildren(...result.items.map(articleCard));
    status.textContent = result.total
      ? (home ? "" : `${result.total} bài viết${category ? ` · ${category}` : ""}`)
      : "Chưa có bài viết phù hợp.";
    totalPages = lastPage;
    pages.replaceChildren();
    for (let number = Math.max(1, result.page - 2); number <= Math.min(lastPage, result.page + 2); number++) {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = String(number);
      button.setAttribute("aria-label", `Trang ${number}`);
      if (number === result.page) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => {
        if (loading || page === number) return;
        page = number; load();
      });
      pages.append(button);
    }
    previous.disabled = result.page <= 1; next.disabled = result.page >= lastPage;
    pager.hidden = lastPage <= 1;
    saveFilters();
  } catch (error) {
    if (current !== version || error.code === "CLIENT_ABORTED") return;
    status.textContent = error.message; retry.hidden = false;
  } finally { if (current === version) { loading = false; grid.setAttribute("aria-busy", "false"); } }
}
async function loadCategories() {
  categoryRequest?.abort(); categoryRequest = new AbortController();
  const signal = categoryRequest.signal;
  try {
    const categories = await articleCategories({ signal });
    if (signal.aborted) return;
    if (home) {
      const buttons = categories.map(value => {
        const button = document.createElement("button"); button.type = "button";
        button.dataset.articleCategory = value; button.textContent = value;
        button.classList.toggle("selected", value === category);
        button.setAttribute("aria-pressed", String(value === category));
        return button;
      });
      filters.querySelectorAll('[data-article-category]:not([data-article-category=""])').forEach(button => button.remove());
      filters.append(...buttons);
    } else {
      const options = categories.map(value => { const option = document.createElement("option"); option.value = value; return option; });
      document.querySelector("#news-category-options").replaceChildren(...options);
    }
  } catch { /* The list/search still works when category suggestions cannot load. */ }
}
previous.addEventListener("click", () => { if (!loading && page > 1) { page--; load(); } });
next.addEventListener("click", () => { if (!loading && page < totalPages) { page++; load(); } });
retry.addEventListener("click", () => { load(); loadCategories(); });
function applyFilters() {
  clearTimeout(searchTimer);
  query = form.elements.q.value.trim(); category = form.elements.category.value.trim();
  page = 1; saveFilters(); load();
}
function queueFilters(event) {
  clearTimeout(searchTimer);
  // Discard older results while typing, including Vietnamese IME input.
  request?.abort(); version++; loading = true; pager.hidden = true;
  status.textContent = "Đang tìm bài viết…";
  if (!event.isComposing) searchTimer = setTimeout(applyFilters, 300);
}
form?.addEventListener("input", queueFilters);
form?.addEventListener("compositionend", queueFilters);
form?.addEventListener("change", applyFilters);
form?.addEventListener("submit", event => { event.preventDefault(); applyFilters(); });
filters?.addEventListener("click", event => {
  const button = event.target.closest("button[data-article-category]");
  if (!button || category === button.dataset.articleCategory) return;
  category = button.dataset.articleCategory; page = 1;
  filters.querySelectorAll("button").forEach(item => {
    const active = item === button; item.classList.toggle("selected", active); item.setAttribute("aria-pressed", String(active));
  });
  load();
});

// The API has no event/featured flag; use the next published articles as other news.
const otherNews = document.querySelector("#other-news");
async function loadOtherNews() {
  if (!otherNews) return;
  const current = ++otherVersion;
  otherRequest?.abort(); otherRequest = new AbortController();
  const otherStatus = document.querySelector("#other-news-status");
  const otherRetry = document.querySelector("#other-news-retry");
  otherStatus.textContent = "Đang tải bài viết…"; otherRetry.hidden = true;
  try {
    const result = await articlePage({ page: 2, page_size: 6 }, { signal: otherRequest.signal });
    if (current !== otherVersion) return;
    document.querySelector(".event-track").replaceChildren(...result.items.map(articleCard));
    otherStatus.textContent = result.items.length ? "" : "Chưa có bài viết khác.";
  } catch (error) {
    if (current !== otherVersion || error.code === "CLIENT_ABORTED") return;
    otherStatus.textContent = error.message; otherRetry.hidden = false;
  }
}
document.querySelector("#other-news-retry")?.addEventListener("click", loadOtherNews);
window.addEventListener("pagehide", () => { clearTimeout(searchTimer); request?.abort(); categoryRequest?.abort(); otherRequest?.abort(); });
window.addEventListener("pageshow", event => { if (event.persisted) { load(); loadCategories(); loadOtherNews(); } });
load(); loadCategories(); loadOtherNews();
