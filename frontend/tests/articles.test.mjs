// Test fixtures intercept fetch here only; the website always calls the real backend.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { articlePage, articleCategories, articleCard, articleContent, articleThumbnail,
  articleUrl, thumbnailUrl, publishedDate } from "../static/js/core/articles.js";

class Element {
  constructor(tag = "div") { this.tagName = tag.toUpperCase(); }
  children = []; dataset = {}; attributes = {}; listeners = {}; value = ""; hidden = false; disabled = false;
  classes = new Set(); ownText = "";
  classList = { toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name) };
  get textContent() { return this.ownText + this.children.map(node => node.textContent).join(""); }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children.forEach(node => node.parent = null); this.children = []; this.ownText = ""; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  querySelectorAll(selector) { return this.children.filter(node => selector === "button" || Boolean(node.dataset.articleCategory)); }
  closest() { return this; }
  reset() { Object.values(this.elements || {}).forEach(node => node.value = ""); }
}
let nodes, root, calls, respond, instances = 0;
const fixture = (id, category = "Sức khỏe") => ({ article_id: id, slug: `article-${id}`, title: `Bài viết ${id}`,
  category, thumbnail_url: null, published_at: "2026-10-12T18:00:00+00:00", author_name: "Tác giả", content: "Nội dung API." });
const fixtures = Array.from({ length: 10 }, (_, i) => fixture(10 - i, i < 6 ? "Sức khỏe" : "Tin bệnh viện"));
const tick = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
function pageResponse(url, items = fixtures) {
  const page = Number(url.searchParams.get("page") || 1), size = Number(url.searchParams.get("page_size") || 20);
  const category = url.searchParams.get("category"), query = url.searchParams.get("q");
  let filtered = items.filter(item => (!category || item.category === category) && (!query || item.title.includes(query)));
  return Response.json({ items: filtered.slice((page - 1) * size, page * size), total: filtered.length, page, page_size: size });
}
beforeEach(() => {
  nodes = new Map(); root = new Element(); root.dataset.articleFeed = "news"; calls = [];
  for (const id of ["news-grid", "news-status", "news-retry", "news-pagination", "news-prev", "news-next", "news-page",
    "news-filter-form", "news-clear", "news-category-options", "article-title", "article-status", "article-retry",
    "article-content", "article-metadata", "article-photo", "article-author", "article-date", "article-date-wrap",
    "article-category", "related-news", "related-status", "related-retry", "related-feature", "related-list", "related-title"]) nodes.set(id, new Element());
  nodes.get("news-filter-form").elements = { q: new Element("input"), category: new Element("input") };
  globalThis.document = {
    querySelector: selector => selector === "[data-article-feed]" ? root : nodes.get(selector.slice(1)) || null,
    createElement: tag => new Element(tag),
    createTextNode: value => { const node = new Element("#text"); node.textContent = value; return node; },
  };
  globalThis.location = new URL("http://127.0.0.1:3000/frontend/templates/public/news.html");
  globalThis.history = { replaceState(state, title, url) { location.href = url.href; } };
  globalThis.window = new EventTarget();
  respond = url => url.pathname === "/articles" ? pageResponse(url) : Response.json({ article: fixture(10) });
  globalThis.fetch = async (url, options) => { calls.push({ url: new URL(url), options }); return respond(new URL(url), options); };
});
async function controller(name) {
  const file = new URL(`../static/js/pages/${name}.js`, import.meta.url);
  const source = (await readFile(file, "utf8")).replace(/from "(\.\.[^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
  await import(`data:text/javascript;base64,${Buffer.from(source + `\n// instance ${instances++}`).toString("base64")}`);
  await tick();
}
const click = id => nodes.get(id).listeners.click[0]({ target: nodes.get(id), preventDefault() {} });
const submit = () => nodes.get("news-filter-form").listeners.submit[0]({ preventDefault() {} });

test("article links use slugs, dates use Vietnam time, and upload images use the backend origin", () => {
  assert.equal(new URL(articleUrl("article-10")).searchParams.get("slug"), "article-10");
  assert.equal(publishedDate("2026-10-12T18:00:00Z"), "13/10/2026");
  assert.equal(publishedDate("invalid"), "");
  assert.equal(thumbnailUrl("/uploads/articles/a.jpg"), "http://127.0.0.1:5000/uploads/articles/a.jpg");
  for (const url of ["javascript:alert(1)", "data:image/svg+xml,test", "//unlisted.example/a.jpg", "/uploads/../private", "https://user:pass@example.test/a.jpg"]) assert.equal(thumbnailUrl(url), null);
});
test("missing and failed thumbnails use a neutral placeholder rather than an invented photo", () => {
  const empty = articleThumbnail(fixture(1)); assert.equal(empty.children.length, 1); assert.equal(empty.textContent, "Chưa có ảnh");
  const holder = articleThumbnail({ ...fixture(1), thumbnail_url: "/uploads/articles/missing.jpg" });
  const image = holder.children[1]; image.listeners.load[0](); assert.equal(holder.children[0].hidden, true);
  image.listeners.error[0](); assert.equal(holder.children.length, 1); assert.equal(holder.children[0].hidden, false);
});
test("article content preserves text/Markdown without interpreting HTML or unsafe links", () => {
  const container = new Element();
  articleContent(container, '# Tiêu đề\n\n**Đậm** và `code`\n\n- Một\n- Hai\n\n> Trích dẫn\n\n<img src=x onerror=alert(1)>\n\n[An toàn](https://example.test) [Xấu](javascript:alert(1))\n\n- \n1. \n\n```\n<script>bad()</script>\n```');
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  const all = descendants(container);
  assert.equal(all.filter(node => ["IMG", "SCRIPT"].includes(node.tagName)).length, 0);
  assert.match(container.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(all.filter(node => node.tagName === "A").length, 1);
  assert.equal(all.find(node => node.tagName === "A").rel, "noopener noreferrer");
  assert.ok(all.some(node => node.tagName === "UL")); assert.ok(all.some(node => node.tagName === "PRE"));
});
test("category discovery covers all public summary pages and errors never fall back to sample articles", async () => {
  const items = Array.from({ length: 101 }, (_, i) => fixture(i + 1, i === 100 ? "Chuyên mục cũ" : "Sức khỏe"));
  respond = url => pageResponse(url, items);
  assert.deepEqual(await articleCategories(), ["Chuyên mục cũ", "Sức khỏe"]);
  assert.equal(calls.length, 2); assert.ok(calls.every(call => !call.options.headers.has("Authorization")));
  respond = () => Response.json({ error: { code: "INTERNAL_ERROR", message: "Lỗi máy chủ" } }, { status: 500 });
  await assert.rejects(articlePage(), { message: "Lỗi máy chủ", code: "INTERNAL_ERROR" });
  respond = () => Response.json({ items: [] }); await assert.rejects(articlePage(), { code: "CLIENT_INVALID_RESPONSE" });
});
test("multiple body images preserve their positions and captions, while unsafe image URLs stay text", () => {
  const container = new Element();
  articleContent(container, 'Đoạn đầu.\n\n![Ảnh một](/uploads/articles/one.jpg "Chú thích riêng")\n\nĐoạn giữa.\n\n![Ảnh hai](https://example.test/two.jpg)\n\n![Ảnh sai](javascript:alert(1))');
  assert.deepEqual(container.children.slice(0, 4).map(node => node.tagName), ["P", "FIGURE", "P", "FIGURE"]);
  const first = container.children[1];
  assert.equal(first.children[0].children[1].src, "http://127.0.0.1:5000/uploads/articles/one.jpg");
  assert.equal(first.children[0].children[1].alt, "Ảnh một");
  assert.equal(first.children[1].textContent, "Chú thích riêng");
  assert.equal(container.children[3].children[1].textContent, "Ảnh hai");
  assert.equal(container.children.filter(node => node.tagName === "FIGURE").length, 2);
  assert.match(container.textContent, /javascript:alert/);
});

test("editorial content has an italic lead, proper heading levels and safe emphasis", () => {
  const container = new Element();
  articleContent(container, '*Đoạn mở đầu. *\n\n## Đề mục chính\n\nTên *Taenia saginata* và **thông tin đậm**.\n\n### Đề mục nhỏ\n\n*<script>không chạy</script>*\n\nNguồn: [Bạch Mai](https://bachmai.gov.vn/)');
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  const all = descendants(container);
  assert.equal(container.children[0].className, 'article-lead');
  assert.equal(container.children[0].children[1].tagName, 'EM');
  assert.equal(container.children[1].tagName, 'H2');
  assert.ok(all.some(node => node.tagName === 'H3'));
  assert.ok(all.some(node => node.tagName === 'EM' && node.textContent === 'Taenia saginata'));
  assert.equal(all.filter(node => node.tagName === 'SCRIPT').length, 0);
  assert.match(container.textContent, /<script>không chạy<\/script>/);
  assert.equal(container.children.at(-1).className, 'article-source');
});
test("news pagination/search/category call the backend and persist filters in the URL", async () => {
  const expanded = [...fixtures, ...Array.from({ length: 6 }, (_, i) => fixture(i + 11))];
  respond = url => pageResponse(url, expanded);
  await controller("news");
  assert.equal(nodes.get("news-grid").children.length, 12);
  assert.equal(calls.find(call => call.url.searchParams.get("page_size") !== "100").url.searchParams.get("page_size"), "12");
  assert.equal(nodes.get("news-page").textContent, "Trang 1 / 2");
  click("news-next"); await tick(); assert.equal(nodes.get("news-grid").children.length, 4);
  assert.equal(location.searchParams.get("page"), "2");
  const form = nodes.get("news-filter-form"); form.elements.q.value = "Bài viết 1"; form.elements.category.value = "Tin bệnh viện";
  submit(); await tick();
  assert.equal(nodes.get("news-grid").children.length, 1);
  assert.equal(location.searchParams.get("q"), "Bài viết 1");
  assert.equal(location.searchParams.get("category"), "Tin bệnh viện"); assert.equal(location.searchParams.has("page"), false);
  form.elements.q.value = "Không có kết quả"; submit(); await tick();
  assert.equal(nodes.get("news-grid").children.length, 0); assert.match(nodes.get("news-status").textContent, /Chưa có bài viết/);
  click("news-clear"); await tick(); assert.equal(nodes.get("news-grid").children.length, 12);
});
test("a late response cannot overwrite newer filters, and failed requests offer a working retry", async () => {
  let finish;
  respond = url => url.searchParams.get("page_size") === "100" ? pageResponse(url) : new Promise(resolve => { finish = resolve; });
  await controller("news");
  respond = url => pageResponse(url, [fixture(99)]);
  submit(); await tick(); assert.match(nodes.get("news-grid").textContent, /Bài viết 99/);
  finish(pageResponse(new URL("http://127.0.0.1:5000/articles?page_size=12")));
  await tick(); assert.match(nodes.get("news-grid").textContent, /Bài viết 99/);
  respond = () => { throw new Error("offline"); }; submit(); await tick();
  assert.equal(nodes.get("news-grid").children.length, 0); assert.equal(nodes.get("news-retry").hidden, false);
  respond = url => pageResponse(url); click("news-retry"); await tick(); assert.equal(nodes.get("news-grid").children.length, 10);
});
test("an out-of-range bookmark moves to the final available page", async () => {
  const expanded = [...fixtures, ...Array.from({ length: 6 }, (_, i) => fixture(i + 11))];
  respond = url => pageResponse(url, expanded);
  location.searchParams.set("page", "99"); await controller("news");
  assert.equal(nodes.get("news-page").textContent, "Trang 2 / 2"); assert.equal(location.searchParams.get("page"), "2");
});
test("article detail displays the API content, author/date and real related links", async () => {
  location = new URL("http://127.0.0.1:3000/frontend/templates/public/article.html?slug=article-10");
  await controller("article");
  assert.equal(nodes.get("article-title").textContent, "Bài viết 10");
  assert.equal(nodes.get("article-content").textContent, "Nội dung API.");
  assert.equal(nodes.get("article-author").textContent, "Người đăng: Tác giả");
  assert.equal(nodes.get("article-date").textContent, "13/10/2026");
  assert.equal(new URL(nodes.get("related-feature").children[0].href).searchParams.get("slug"), "article-9");
  assert.equal(nodes.get("related-list").children.length, 4);
});
test("unpublished/missing details show the backend 404 and do not reveal any preview content", async () => {
  location = new URL("http://127.0.0.1:3000/frontend/templates/public/article.html?slug=missing");
  respond = () => Response.json({ error: { code: "ARTICLE_NOT_FOUND", message: "Không tìm thấy bài viết" } }, { status: 404 });
  await controller("article");
  assert.equal(nodes.get("article-title").textContent, "Không tìm thấy bài viết");
  assert.equal(nodes.get("article-content").children.length, 0); assert.equal(nodes.get("related-news").hidden, true);
  assert.equal(nodes.get("article-retry").hidden, true);
});
test("related-news failures do not hide the successfully loaded article", async () => {
  location = new URL("http://127.0.0.1:3000/frontend/templates/public/article.html?slug=article-10");
  respond = url => url.pathname === "/articles" ? Response.json({ error: { message: "Lỗi máy chủ" } }, { status: 500 }) : Response.json({ article: fixture(10) });
  await controller("article");
  assert.equal(nodes.get("article-content").textContent, "Nội dung API.");
  assert.equal(nodes.get("related-retry").hidden, false); assert.equal(nodes.get("related-status").textContent, "Lỗi máy chủ");
});
