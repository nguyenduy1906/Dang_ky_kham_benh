import { getBySlug } from "../api/article.js";
import { articlePage, articleUrl, articleThumbnail, articleContent, publishedDate } from "../core/articles.js";
import { ApiError } from "../core/api.js";
import { displayText } from "../core/display-text.js";

const slug = new URLSearchParams(location.search).get("slug");
const title = document.querySelector("#article-title");
const status = document.querySelector("#article-status");
const retry = document.querySelector("#article-retry");
const content = document.querySelector("#article-content");
const metadata = document.querySelector("#article-metadata");
const author = document.querySelector("#article-author");
const related = document.querySelector("#related-news");
const relatedStatus = document.querySelector("#related-status");
const relatedRetry = document.querySelector("#related-retry");
let detailRequest, relatedRequest, currentArticle;
let version = 0, relatedVersion = 0;

async function loadRelated(article) {
  const current = ++relatedVersion;
  relatedRequest?.abort(); relatedRequest = new AbortController();
  const options = { signal: relatedRequest.signal };
  related.hidden = false; relatedRetry.hidden = true; relatedStatus.textContent = "Đang tải bài viết liên quan…";
  document.querySelector("#related-feature").replaceChildren();
  document.querySelector("#related-list").replaceChildren();
  try {
    let result = await articlePage({ category: article.category || "", page_size: 6 }, options);
    let items = result.items.filter(item => item.article_id !== article.article_id);
    let sameCategory = Boolean(article.category);
    if (!items.length && article.category) {
      result = await articlePage({ page_size: 6 }, options);
      items = result.items.filter(item => item.article_id !== article.article_id);
      sameCategory = false;
    }
    if (current !== relatedVersion) return;
    if (!items.length) { related.hidden = true; return; }
    document.querySelector("#related-title").textContent = sameCategory ? "Tin tức cùng chuyên mục" : "Tin tức khác";
    const first = items[0];
    const feature = document.createElement("a");
    feature.href = articleUrl(first.slug); feature.className = "related-feature";
    const copy = document.createElement("div"); copy.className = "related-feature-content";
    const category = document.createElement("small"); category.textContent = first.category || "";
    const headline = document.createElement("h3"); headline.textContent = first.title;
    copy.append(category, headline); feature.append(articleThumbnail(first), copy);
    document.querySelector("#related-feature").append(feature);
    items.slice(1, 5).forEach(item => {
      const link = document.createElement("a"); link.href = articleUrl(item.slug);
      const heading = document.createElement("h3"); heading.textContent = item.title;
      const date = document.createElement("time"); date.textContent = publishedDate(item.published_at);
      if (date.textContent) date.dateTime = item.published_at;
      link.append(heading, date); document.querySelector("#related-list").append(link);
    });
    relatedStatus.textContent = "";
  } catch (error) {
    if (current !== relatedVersion || error.code === "CLIENT_ABORTED") return;
    relatedStatus.textContent = error.message; relatedRetry.hidden = false;
  }
}

async function loadArticle() {
  const current = ++version;
  detailRequest?.abort(); relatedRequest?.abort(); relatedVersion++;
  detailRequest = new AbortController();
  metadata.hidden = true; author.hidden = true; related.hidden = true;
  content.replaceChildren(); content.setAttribute("aria-busy", "true");
  title.textContent = "Đang tải bài viết…"; status.textContent = "Đang tải bài viết…"; retry.hidden = true;
  if (!slug) {
    title.textContent = "Không tìm thấy bài viết";
    status.textContent = "Vui lòng chọn một bài viết trong mục Tin tức.";
    document.title = "Không tìm thấy bài viết | NEU Medical";
    content.setAttribute("aria-busy", "false");
    return;
  }
  try {
    const result = await getBySlug(slug, { signal: detailRequest.signal });
    if (current !== version) return;
    const article = result?.article;
    if (!article || typeof article.title !== "string" || typeof article.content !== "string" || article.slug !== slug) {
      throw new ApiError("Phản hồi nội dung bài viết không hợp lệ.", { code: "CLIENT_INVALID_RESPONSE" });
    }
    currentArticle = article;
    title.textContent = displayText(article.title); document.title = `${displayText(article.title)} | NEU Medical`;
    const date = document.querySelector("#article-date");
    date.textContent = publishedDate(article.published_at);
    if (date.textContent) date.dateTime = article.published_at;
    document.querySelector("#article-date-wrap").hidden = !date.textContent;
    const category = document.querySelector("#article-category");
    category.textContent = article.category || ""; category.hidden = !article.category;
    metadata.hidden = !date.textContent && !article.category;
    articleContent(content, article.content);
    author.textContent = article.author_name ? `Người đăng: ${article.author_name}` : "";
    author.hidden = !article.author_name;
    status.textContent = "";
    loadRelated(article);
  } catch (error) {
    if (current !== version || error.code === "CLIENT_ABORTED") return;
    const missing = error.status === 404;
    title.textContent = missing ? "Không tìm thấy bài viết" : "Chưa tải được bài viết";
    document.title = `${title.textContent} | NEU Medical`;
    status.textContent = error.message; retry.hidden = missing;
  } finally { if (current === version) content.setAttribute("aria-busy", "false"); }
}
retry.addEventListener("click", loadArticle);
relatedRetry.addEventListener("click", () => { if (currentArticle) loadRelated(currentArticle); });
window.addEventListener("pagehide", () => { detailRequest?.abort(); relatedRequest?.abort(); });
window.addEventListener("pageshow", event => { if (event.persisted) loadArticle(); });
loadArticle();
