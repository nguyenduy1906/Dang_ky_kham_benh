import { readAdminArticles, readAdminArticle, saveAdminArticle } from "./admin_article_data.js";
import { thumbnailUrl } from "./articles.js";
import { articleContent } from "./articles.js";
import { esc, table, facts, stamp } from "./admin_ui.js";

const modes = { draft: "Bản nháp", scheduled: "Hẹn đăng", published: "Đã xuất bản" };
const stateBadge = mode => `<span class="badge ${mode === "draft" ? "blue" : mode === "scheduled" ? "amber" : "green"}" data-article-status="${Object.hasOwn(modes,mode)?mode:'draft'}">${modes[mode] || modes.draft}</span>`;
const field = (name, title, value = "", type = "text", extra = "") => ["slug", "thumbnail_url", "section_image"].includes(name) ? `<input type="hidden" name="${name}" value="${esc(value)}" ${extra}>` : `<label>${title}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const safeImage = value => {
  try { const url = new URL(value.startsWith("/uploads/") ? thumbnailUrl(value) : value, location.href); return ["http:", "https:", "blob:"].includes(url.protocol) && !url.username && !url.password ? url.href : ""; } catch { return ""; }
};
const imageMarkup = (url, title) => {
  const src = url && safeImage(url);
  return `<div class="admin-article-image">${src ? `<img src="${esc(src)}" alt="${esc(title)}" referrerpolicy="no-referrer">` : ""}<span ${src ? "hidden" : ""}>Chưa có ảnh</span></div>`;
};

export function articleSections(row = {}) {
  if (Array.isArray(row.sections)) return row.sections;
  if (!row.content?.trim()) return [{ title: "", text: "", image: "", caption: "" }];
  return (row.content.includes("<!-- article-section -->") ? row.content.split("<!-- article-section -->").filter(part => part.trim()).map(part => part.trim()) : row.content.split(/\n(?=##\s)/)).map(content => {
    const heading = content.match(/^##\s+([^\n]+)\n?/);
    const photo = content.match(/^!\[([^\]\n]*)\]\((\S+?)(?:\s+"([^"\n]*)")?\)\s*$/m);
    return { title: heading?.[1] || "", text: content.replace(/^##\s+[^\n]+\n?/, "").replace(photo?.[0] || /$^/, "").trim(), image: photo?.[2] || "", caption: photo?.[3] || photo?.[1] || "" };
  });
}

export function articleSectionMarkup(section = {}, index = 0) {
  return `<section class="admin-article-section" data-article-section><div class="admin-article-section-heading"><h4>Mục <span data-section-number>${index + 1}</span></h4><button type="button" class="secondary" data-article-action="remove-section" aria-label="Xóa mục ${index + 1}">Xóa mục</button></div><div class="admin-article-section-grid"><div>${field("section_title", "Tiêu đề mục", section.title, "text", 'data-block-field="title" maxlength="255"')}<label>Đoạn nội dung<textarea data-block-field="text" rows="7" maxlength="100000">${esc(section.text || "")}</textarea></label></div><div class="admin-article-section-photo"><div class="admin-article-section-image-field"><span class="admin-article-section-image-label">Ảnh của mục</span>${imageMarkup(section.image, section.caption || "Ảnh trong mục")}${field("section_image", "Đường dẫn ảnh", section.image, "text", 'data-block-field="image" maxlength="2000"')}</div><div class="actions"><button type="button" class="secondary" data-article-action="choose-section-image">Chọn ảnh</button><button type="button" class="secondary" data-article-action="remove-section-image">Bỏ ảnh</button></div><input type="file" data-section-file accept="image/jpeg,image/png,image/webp" hidden>${field("section_caption", "Chú thích ảnh", section.caption, "text", 'data-block-field="caption" maxlength="500"')}</div></div></section>`;
}

function sectionEditorMarkup(row) {
  return `<div class="admin-article-sections" data-article-sections>${articleSections(row).map(articleSectionMarkup).join("")}</div><button type="button" class="secondary admin-article-add-section" data-article-action="add-section">+ Thêm mục</button>`;
}

export function articleDetailMarkup(row) {
  return `<div class="admin-article-detail"><article class="admin-article-reading"><div class="admin-article-hero"><header><div class="admin-article-kicker">${esc(row.category || "Chưa phân loại")} ${stateBadge(row.mode)}</div><h2>${esc(row.title || "Bài viết chưa có tiêu đề")}</h2><p class="admin-article-byline">${esc(row.author_name || "Quản trị viên")} · ${row.published_at ? stamp(row.published_at) : "Chưa đăng"}</p></header>${imageMarkup(row.thumbnail_url, row.title)}</div><div class="admin-article-prose" data-article-content></div></article><aside class="admin-article-metadata"><h3>Thông tin bài viết</h3>${facts([["Mã bài viết", row.id || "Chưa cấp"], ["Tiêu đề", row.title || "—"], ["Danh mục", row.category || "—"], ["Tác giả", row.author_name || "Quản trị viên"], ["Trạng thái", modes[row.mode]], ["Ngày tạo", row.created_at ? stamp(row.created_at) : "—"], ["Cập nhật lần cuối", row.updated_at ? stamp(row.updated_at) : "—"], [row.mode === "scheduled" ? "Thời điểm hẹn đăng" : "Thời điểm đăng", row.published_at ? stamp(row.published_at) : "Chưa đăng"]])}</aside></div>`;
}

export function articleEditorMarkup(row = {}) {
  const mode = row.mode || "draft";
  return `<form id="article-editor" autocomplete="off"><div data-article-settings><div class="admin-article-editor-grid"><section><h3>Thông tin bài viết</h3><div class="admin-contact-fields">${field("title", "Tiêu đề bài viết", row.title, "text", 'required maxlength="255"')}${field("slug", "Đường dẫn bài viết", row.slug, "text", 'required maxlength="200" pattern="[a-z0-9]+(?:-[a-z0-9]+)*"')}${field("category", "Danh mục", row.category, "text", 'list="article-category-options" maxlength="100"')}<datalist id="article-category-options"><option value="Hướng dẫn"><option value="Kiến thức sức khỏe"><option value="Thông báo"><option value="Tin bệnh viện"></datalist></div><div class="admin-article-cover-editor">${imageMarkup(row.thumbnail_url, "Ảnh đại diện bài viết")}<div class="admin-article-cover-controls"><strong>Ảnh đại diện</strong><div class="actions">${field("thumbnail_url", "Đường dẫn ảnh đại diện", row.thumbnail_url, "text", 'maxlength="2000"')}<button type="button" class="secondary" data-article-action="choose-cover">Chọn ảnh từ máy</button><input type="file" id="article-cover-file" accept="image/jpeg,image/png,image/webp" hidden><button type="button" class="secondary" data-article-action="remove-cover">Bỏ ảnh</button></div></div></div></section><section class="admin-article-publishing"><h3>Thiết lập đăng bài</h3><label>Trạng thái<select name="mode">${Object.entries(modes).map(([value, title]) => `<option value="${value}" ${value === mode ? "selected" : ""}>${value === "published" ? "Đăng ngay" : title}</option>`).join("")}</select></label><div data-article-schedule ${mode === "scheduled" ? "" : "hidden"}>${field("published_at", "Thời điểm hẹn đăng (giờ Việt Nam)", row.mode === "scheduled" ? localDateTime(row.published_at) : "", "datetime-local", mode === "scheduled" ? "required" : "disabled")}</div><dl class="admin-article-editor-facts"><div><dt>Tác giả</dt><dd>${esc(row.author_name || "Quản trị viên")}</dd></div><div><dt>Mã bài viết</dt><dd>${esc(row.id || "Chưa cấp")}</dd></div></dl></section></div><div class="admin-article-content-entry"><div><h3>Nội dung bài viết</h3></div><button type="button" data-article-action="open-content" aria-controls="article-content-editor" aria-expanded="false">Nội dung bài viết →</button></div></div><section id="article-content-editor" hidden><div class="admin-article-content-heading"><button type="button" class="secondary" data-article-action="back-settings">← Quay lại</button><h3>Nội dung bài viết</h3></div>${sectionEditorMarkup(row)}</section><div class="actions admin-article-editor-actions"><button type="submit">Xem trước bài viết</button><button type="button" class="secondary" data-article-action="close">Đóng</button></div><p class="form-feedback" role="status" id="article-editor-feedback"></p></form>`;
}

function localDateTime(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)).replace(" ", "T");
}

export async function initArticlePresentation(administrator) {
  const body = document.querySelector("#page-body"), modal = document.querySelector("#admin-dialog"), modalBody = document.querySelector("#admin-dialog-body"), title = document.querySelector("#admin-dialog-title");
  let rows = [];
  const imageFiles = new Map();
  let saving = false;
  let currentRow, editorNodes, returnTrigger, pendingRow;
  const headerBack = document.createElement("button");
  headerBack.type = "button";
  headerBack.className = "secondary admin-article-header-back";
  headerBack.textContent = "← Quay lại";
  headerBack.hidden = true;
  title.before(headerBack);
  function syncHeaderBack() {
    const preview = modalBody.querySelector('[data-article-action="back-editor"]');
    const content = modalBody.querySelector("#article-content-editor");
    headerBack.hidden = !preview && (!content || content.hidden);
  }
  headerBack.addEventListener("click", () => {
    const target = modalBody.querySelector('[data-article-action="back-editor"]') || modalBody.querySelector('[data-article-action="back-settings"]');
    target?.click();
    syncHeaderBack();
    if (!headerBack.hidden) headerBack.focus(); else title.focus();
  });
  title.tabIndex = -1;
  new MutationObserver(syncHeaderBack).observe(modalBody, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  const objectUrls = new Set();
  const heading = document.querySelector("#page-header");
  heading.insertAdjacentHTML("beforeend", '<button type="button" data-article-action="create">+ Viết bài mới</button>');
  body.innerHTML = `<section class="admin-card admin-articles-list"><div class="admin-panel-heading"><h2>Danh sách tin tức</h2></div><form id="article-filters" class="admin-toolbar"><label>Tiêu đề / nội dung<input type="search" name="q" placeholder="Tìm bài viết…"></label><label>Danh mục<select name="category"><option value="">Tất cả danh mục</option>${[...new Set(rows.map(row => row.category))].map(item => `<option>${esc(item)}</option>`).join("")}</select></label><label>Trạng thái<select name="mode"><option value="">Tất cả trạng thái</option>${Object.entries(modes).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label></form><div id="article-results"></div><div class="admin-pagination" id="article-count" role="status"></div></section>`;
  const filters = document.querySelector("#article-filters");
  let articlePage=1;
  const pageSize=10;
  function renderList() {
    const query = filters.elements.q.value.trim().toLocaleLowerCase("vi");
    const items = rows.filter(row => (!query || `${row.title} ${row.content}`.toLocaleLowerCase("vi").includes(query)) && (!filters.elements.category.value || filters.elements.category.value === row.category) && (!filters.elements.mode.value || filters.elements.mode.value === row.mode));
    const pages=Math.max(1,Math.ceil(items.length/pageSize));
    articlePage=Math.min(articlePage,pages);
    document.querySelector("#article-results").innerHTML = table(["Mã bài", "Bài viết", "Danh mục", "Tác giả", "Ngày đăng", "Trạng thái", "Thao tác"], items.slice((articlePage-1)*pageSize,articlePage*pageSize).map(row => [esc(row.id), `<div class="admin-article-list-title"><img src="${esc(row.thumbnail_url)}" alt=""><div><strong>${esc(row.title)}</strong></div></div>`, esc(row.category), esc(row.author_name), row.published_at ? stamp(row.published_at) : "—", stateBadge(row.mode), `<div class="admin-row-actions"><button class="row-action" type="button" data-article-action="detail" data-id="${row.id}">Chi tiết</button><button class="row-action" type="button" data-article-action="edit" data-id="${row.id}">Chỉnh sửa</button></div>`]), "Danh sách tin tức");
    document.querySelector("#article-count").innerHTML = `<span>${items.length} bài viết · Trang ${articlePage} / ${pages}</span><div><button type="button" class="secondary" data-article-page="-1" ${articlePage<=1?"disabled":""}>Trang trước</button><button type="button" class="secondary" data-article-page="1" ${articlePage>=pages?"disabled":""}>Trang sau</button></div>`;
  }
  filters.addEventListener("submit", event => event.preventDefault());
  const applyFilters=()=>{articlePage=1;renderList();};
  filters.addEventListener("input", applyFilters);
  filters.addEventListener("change", applyFilters);
  document.querySelector("#article-count").addEventListener("click",event=>{
    const button=event.target.closest("[data-article-page]");if(!button||button.disabled)return;
    const step=button.dataset.articlePage;articlePage+=Number(step);renderList();
    document.querySelector(`#article-count [data-article-page="${step}"]:not(:disabled)`)?.focus();
  });
  function open(label, markup) {
    title.textContent = label; modalBody.innerHTML = markup;
    if (!modal.open) { returnTrigger = document.activeElement; modal.showModal(); }
    modal.scrollTop = 0;
    modalBody.querySelector('[data-article-action="back-editor"]')?.focus();
  }
  function renderContent(row) {
    const target = modalBody.querySelector("[data-article-content]");
    if (row.sections) {
      target.replaceChildren();
      for (const section of row.sections) {
        const block = document.createElement("section");
        if (section.title) { const heading = document.createElement("h3"); heading.textContent = section.title; block.append(heading); }
        const text = document.createElement("div"); articleContent(text, section.text); block.append(text);
        if (section.image) {
          const figure = document.createElement("figure"); figure.className = "article-figure";
          figure.innerHTML = imageMarkup(section.image, section.caption || section.title || "Ảnh trong bài viết");
          if (section.caption) { const caption = document.createElement("figcaption"); caption.textContent = section.caption; figure.append(caption); }
          block.append(figure);
        }
        target.append(block);
      }
      return;
    }
    articleContent(target, row.content || "Chưa có nội dung bài viết.");
  }
  function edit(row = {}) { row = {author_name: administrator.full_name, ...row}; currentRow = row; editorNodes = null; open(row.id ? "Chỉnh sửa bài viết" : "Viết bài mới", articleEditorMarkup(row)); }
  modal.addEventListener("close", () => { editorNodes = null; pendingRow = null; returnTrigger?.focus(); });
  window.addEventListener("pagehide", () => objectUrls.forEach(url => URL.revokeObjectURL(url)), { once: true });
  modalBody.addEventListener("error", event => {
    if (event.target.matches(".admin-article-image img")) { const holder = event.target.parentElement; event.target.remove(); holder.querySelector("span").hidden = false; }
  }, true);
  function refreshCover(form) {
    const holder = form.querySelector(".admin-article-cover-editor .admin-article-image");
    holder.outerHTML = imageMarkup(form.elements.thumbnail_url.value, "Ảnh đại diện bài viết");
  }
  modalBody.addEventListener("input", event => {
    if (event.target.name === "title" && !currentRow.id) {
      event.target.form.elements.slug.value = event.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    if (event.target.name === "thumbnail_url") refreshCover(event.target.form);
    if (event.target.dataset.blockField === "image") {
      event.target.closest("[data-article-section]").querySelector(".admin-article-image").outerHTML = imageMarkup(event.target.value, "Ảnh trong mục");
    }
  });
  modalBody.addEventListener("invalid", event => {
    const form = event.target.closest("#article-editor");
    if (form && event.target.closest("[data-article-settings]")) {
      form.querySelector("[data-article-settings]").hidden = false;
      form.querySelector("#article-content-editor").hidden = true;
      form.querySelector('[data-article-action="open-content"]').setAttribute("aria-expanded", "false");
      title.textContent = currentRow.id ? "Chỉnh sửa bài viết" : "Viết bài mới";
    }
  }, true);
  modalBody.addEventListener("change", event => {
    const form = modalBody.querySelector("#article-editor"); if (!form) return;
    if (event.target.name === "mode") {
      const scheduled = event.target.value === "scheduled";
      form.querySelector("[data-article-schedule]").hidden = !scheduled;
      form.elements.published_at.disabled = !scheduled; form.elements.published_at.required = scheduled;
      form.elements.published_at.min = localDateTime(new Date(Date.now() + 60000).toISOString());
    }
    if (event.target.id === "article-cover-file" && event.target.files[0]) {
      const file = event.target.files[0], feedback = form.querySelector("[role=status]");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { feedback.textContent = "Chọn ảnh JPEG, PNG hoặc WebP không quá 5 MB."; event.target.value = ""; return; }
      feedback.textContent = "";
      const url = URL.createObjectURL(file); objectUrls.add(url); imageFiles.set(url, file); form.elements.thumbnail_url.value = url; refreshCover(form);
    }
    if (event.target.matches("[data-section-file]") && event.target.files[0]) {
      const file = event.target.files[0], feedback = form.querySelector("[role=status]");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { feedback.textContent = "Chọn ảnh JPEG, PNG hoặc WebP không quá 5 MB."; event.target.value = ""; return; }
      const url = URL.createObjectURL(file); objectUrls.add(url); imageFiles.set(url, file);
      const section = event.target.closest("[data-article-section]");
      section.querySelector('[data-block-field="image"]').value = url;
      section.querySelector(".admin-article-image").outerHTML = imageMarkup(url, "Ảnh trong mục"); feedback.textContent = "";
    }
  });
  document.querySelector("#main-content").addEventListener("click", async event => {
    const button = event.target.closest("[data-article-action]"); if (!button) return;
    if (button.dataset.articleAction === "create") edit();
    if (!button.dataset.id) return;
    button.disabled = true;
    let row;
    try { row = await readAdminArticle(button.dataset.id); }
    catch (error) { open("Bài viết", `<p role="alert">${esc(error.message)}</p>`); return; }
    finally { button.disabled = false; }
    if (button.dataset.articleAction === "edit") edit(row);
    if (button.dataset.articleAction === "detail") { open("Chi tiết bài viết", articleDetailMarkup(row)); renderContent(row); }
  });
  modalBody.addEventListener("click", async event => {
    const button = event.target.closest("[data-article-action]"); if (!button) return;
    const action = button.dataset.articleAction, form = modalBody.querySelector("#article-editor");
    if (action === "confirm-article" && pendingRow) {
      if (saving) return;
      saving = true; button.disabled = true; headerBack.disabled = true;
      modal.setAttribute("aria-busy", "true");
      const close = document.querySelector("#dialog-close"); close.disabled = true;
      try {
        const saved = await saveAdminArticle(pendingRow, imageFiles);
        const index = rows.findIndex(item => item.id === saved.id);
        if (index < 0) rows.unshift(saved); else rows[index] = saved;
        const category = saved.category;
        if (category && ![...filters.elements.category.options].some(option => option.value === category)) filters.elements.category.add(new Option(category, category));
        pendingRow = null; renderList(); modal.close();
      } catch (error) {
        let feedback = modalBody.querySelector(".article-save-error");
        if (!feedback) { feedback = document.createElement("p"); feedback.className = "form-feedback article-save-error"; feedback.setAttribute("role", "alert"); button.parentElement.append(feedback); }
        feedback.textContent = error.message;
      } finally { saving = false; modal.removeAttribute("aria-busy"); button.disabled = false; headerBack.disabled = false; close.disabled = false; }
      return;
    }
    if (action === "close") modal.close();
    if (action === "back-editor" && editorNodes) { modalBody.replaceChildren(...editorNodes); title.textContent = !modalBody.querySelector("#article-content-editor").hidden ? "Nội dung bài viết" : currentRow.id ? "Chỉnh sửa bài viết" : "Viết bài mới"; modal.scrollTop = 0; modalBody.querySelector('button[type="submit"]').focus(); return; }
    if (!form) return;
    if (action === "add-section") {
      const container = form.querySelector("[data-article-sections]");
      container.insertAdjacentHTML("beforeend", articleSectionMarkup({}, container.children.length));
      container.lastElementChild.querySelector("input").focus();
    }
    if (action === "remove-section") {
      const section = button.closest("[data-article-section]");
      const next = section.nextElementSibling || section.previousElementSibling;
      section.remove();
      form.querySelectorAll("[data-article-section]").forEach((item, index) => {
        item.querySelector("[data-section-number]").textContent = index + 1;
        item.querySelector('[data-article-action="remove-section"]').setAttribute("aria-label", `Xóa mục ${index + 1}`);
      });
      (next?.querySelector("input") || form.querySelector('[data-article-action="add-section"]')).focus();
    }
    if (action === "choose-section-image") button.closest("[data-article-section]").querySelector("[data-section-file]").click();
    if (action === "remove-section-image") {
      const section = button.closest("[data-article-section]");
      section.querySelector('[data-block-field="image"]').value = "";
      section.querySelector("[data-section-file]").value = "";
      section.querySelector(".admin-article-image").outerHTML = imageMarkup("", "");
    }
    if (action === "choose-cover") form.querySelector("#article-cover-file").click();
    if (action === "remove-cover") { form.elements.thumbnail_url.value = ""; form.querySelector("#article-cover-file").value = ""; refreshCover(form); }
    if (action === "open-content" || action === "back-settings") {
      const contentView = action === "open-content";
      form.querySelector("[data-article-settings]").hidden = contentView;
      form.querySelector("#article-content-editor").hidden = !contentView;
      form.querySelector('[data-article-action="open-content"]').setAttribute("aria-expanded", String(contentView));
      title.textContent = contentView ? "Nội dung bài viết" : currentRow.id ? "Chỉnh sửa bài viết" : "Viết bài mới";
      modal.scrollTop = 0;
      form.querySelector(contentView ? '[data-article-action="back-settings"]' : '[data-article-action="open-content"]').focus();
    }
  });
  modalBody.addEventListener("submit", event => {
    if (event.target.id !== "article-editor") return; event.preventDefault();
    const form = event.target, feedback = form.querySelector("[role=status]");
    const sections = [...form.querySelectorAll("[data-article-section]")].map(section => Object.fromEntries([...section.querySelectorAll("[data-block-field]")].map(input => [input.dataset.blockField, input.value.trim()]))).filter(section => section.title || section.text || section.image || section.caption);
    if (!sections.some(section => section.text)) {
      form.querySelector('[data-article-action="open-content"]').click();
      feedback.textContent = "Nhập đoạn nội dung cho bài viết trước khi xem trước."; form.querySelector('[data-block-field="text"]')?.focus(); return;
    }
    if (sections.some(section => section.image && !safeImage(section.image))) { form.querySelector('[data-article-action="open-content"]').click(); feedback.textContent = "Kiểm tra lại đường dẫn ảnh trong các mục."; return; }
    const published = form.elements.mode.value === "scheduled" ? `${form.elements.published_at.value}:00+07:00` : form.elements.mode.value === "published" ? currentRow.mode === "published" ? currentRow.published_at : new Date().toISOString() : "";
    if (form.elements.mode.value === "scheduled" && new Date(published) <= new Date()) { feedback.textContent = "Chọn thời điểm hẹn đăng sau thời gian hiện tại."; return; }
    const row = { ...currentRow, ...Object.fromEntries(new FormData(form)), sections, published_at: published };
    pendingRow = row;
    editorNodes = [...modalBody.childNodes];
    const confirmation = row.mode === "scheduled" ? "Xác nhận hẹn đăng" : row.mode === "published" ? currentRow.mode === "published" ? "Xác nhận cập nhật" : "Xác nhận đăng tin" : "Lưu bản nháp";
    open("Xem trước bài viết", '<div class="admin-article-preview"><button type="button" class="secondary" data-article-action="back-editor">← Quay lại chỉnh sửa</button>' + articleDetailMarkup(row) + '<div class="actions admin-article-preview-footer"><button type="button" data-article-action="confirm-article">' + confirmation + '</button></div></div>');
    modalBody.querySelector(".admin-article-metadata")?.remove();
    renderContent(row);
  });
  modal.addEventListener("cancel", event => { if (saving) event.preventDefault(); });
  body.querySelector("#article-results").textContent = "Đang tải bài viết…";
  try {
    rows = await readAdminArticles();
    for (const category of [...new Set(rows.map(row => row.category).filter(Boolean))]) filters.elements.category.add(new Option(category, category));
    renderList();
    const linked=new URLSearchParams(location.search).get("article_id");
    if(linked&&/^[1-9]\d*$/.test(linked)){const row=await readAdminArticle(linked);open("Chi tiết bài viết",articleDetailMarkup(row));renderContent(row);}
  } catch (error) {
    body.querySelector("#article-results").innerHTML = `<p role="alert">${esc(error.message)}</p><button type="button" data-article-retry>Thử lại</button>`;
    body.querySelector("[data-article-retry]").addEventListener("click", () => location.reload());
  }
}
