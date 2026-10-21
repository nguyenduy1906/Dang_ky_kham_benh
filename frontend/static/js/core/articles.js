import { API_CONFIG } from "../config.js";
import { ApiError } from "./api.js";
import { listArticles } from "../api/article.js";
import { displayText } from "./display_text.js";

const publicPages = new URL("../../../templates/public/", import.meta.url);
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Saigon",
});

export function articleUrl(slug) {
  const url = new URL("article.html", publicPages);
  url.searchParams.set("slug", slug);
  return url.href;
}

export function publishedDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

export function thumbnailUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value, API_CONFIG.baseUrl);
    const uploaded = value.startsWith("/uploads/") && url.pathname.startsWith("/uploads/");
    if ((uploaded || /^https?:\/\//i.test(value)) &&
        ["http:", "https:"].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch { /* Missing/unsupported image URLs use a neutral placeholder. */ }
  return null;
}

export function articleThumbnail(article, description = "") {
  const holder = document.createElement("span");
  holder.className = "article-thumbnail";
  const placeholder = document.createElement("span");
  placeholder.className = "article-image-missing";
  placeholder.textContent = "Chưa có ảnh";
  holder.append(placeholder);
  const src = thumbnailUrl(article.thumbnail_url);
  if (src) {
    const image = document.createElement("img");
    image.alt = description;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("load", () => { placeholder.hidden = true; });
    image.addEventListener("error", () => { image.remove(); placeholder.hidden = false; });
    image.src = src;
    holder.append(image);
  }
  return holder;
}

export function articleCard(article) {
  const link = document.createElement("a");
  link.className = "article-card";
  link.href = articleUrl(article.slug);
  const body = document.createElement("span");
  body.className = "article-body";
  if (article.category) {
    const category = document.createElement("small");
    category.className = "article-card-category";
    category.textContent = article.category;
    body.append(category);
  }
  const title = document.createElement("strong");
  title.textContent = displayText(article.title);
  const date = document.createElement("time");
  date.className = "article-date";
  date.textContent = publishedDate(article.published_at);
  if (date.textContent) date.dateTime = article.published_at;
  body.append(title, date);
  link.append(articleThumbnail(article, displayText(article.title)), body);
  return link;
}

export async function articlePage(params = {}, options = {}) {
  const result = await listArticles(params, options);
  if (!Array.isArray(result?.items) || !Number.isInteger(result.total) || result.total < 0 ||
      !Number.isInteger(result.page) || result.page < 1 || !Number.isInteger(result.page_size) || result.page_size < 1 ||
      result.items.some(item => !item || typeof item.slug !== "string" || !item.slug || typeof item.title !== "string")) {
    throw new ApiError("Phản hồi danh sách bài viết không hợp lệ.", { code: "CLIENT_INVALID_RESPONSE" });
  }
  return { ...result, items: result.items.map(item => ({ ...item, title: displayText(item.title), summary: displayText(item.summary) })) };
}

// The existing API has no category endpoint. Read categories from published summaries.
export async function articleCategories(options = {}) {
  const categories = new Set();
  let page = 1;
  let result;
  do {
    result = await articlePage({ page, page_size: 100 }, options);
    for (const article of result.items) if (article.category) categories.add(article.category);
    page++;
  } while (result.items.length && (page - 1) * result.page_size < result.total);
  return [...categories].sort((a, b) => a.localeCompare(b, "vi"));
}

function inlineText(node, value) {
  // Small Markdown subset built with DOM nodes; HTML from the API stays literal text.
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^\s)]+\))/g;
  let offset = 0;
  for (const match of value.matchAll(pattern)) {
    node.append(document.createTextNode(value.slice(offset, match.index)));
    const token = match[0];
    let child;
    if (token.startsWith("**")) {
      child = document.createElement("strong"); child.textContent = token.slice(2, -2);
    } else if (token.startsWith("*")) {
      child = document.createElement("em"); child.textContent = token.slice(1, -1);
    } else if (token.startsWith("`")) {
      child = document.createElement("code"); child.textContent = token.slice(1, -1);
    } else {
      const parts = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      try {
        const url = new URL(parts[2], location.href);
        if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) {
          child = document.createElement("a"); child.href = url.href; child.textContent = parts[1];
          if (url.origin !== location.origin) { child.target = "_blank"; child.rel = "noopener noreferrer"; }
        }
      } catch { /* Invalid Markdown links remain readable text. */ }
    }
    node.append(child || document.createTextNode(token));
    offset = match.index + token.length;
  }
  node.append(document.createTextNode(value.slice(offset)));
}

export function articleContent(container, value) {
  container.replaceChildren();
  const lines = displayText(value).replaceAll("<!-- article-section -->", "").replace(/\r\n?/g, "\n").split("\n");
  const block = line => /^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s?|```|!\[)/.test(line);
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const photo = line.match(/^!\[([^\]\n]*)\]\((\S+?)(?:\s+"([^"\n]*)")?\)\s*$/);
    if (photo && thumbnailUrl(photo[2])) {
      const figure = document.createElement("figure"); figure.className = "article-figure";
      figure.append(articleThumbnail({ thumbnail_url: photo[2] }, photo[1]));
      const label = photo[3] ?? photo[1];
      if (label) { const caption = document.createElement("figcaption"); caption.textContent = label; figure.append(caption); }
      container.append(figure); index++; continue;
    }
    if (line.startsWith("```")) {
      const body = []; index++;
      while (index < lines.length && !lines[index].startsWith("```")) body.push(lines[index++]);
      index++;
      const pre = document.createElement("pre"); const code = document.createElement("code");
      code.textContent = body.join("\n"); pre.append(code); container.append(pre); continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const node = document.createElement(`h${Math.max(2, heading[1].length)}`);
      inlineText(node, heading[2]); container.append(node); index++; continue;
    }
    const ordered = /^\d+\.\s+\S/.test(line);
    if (ordered || /^[-*+]\s+\S/.test(line)) {
      const list = document.createElement(ordered ? "ol" : "ul");
      const pattern = ordered ? /^\d+\.\s+(.+)$/ : /^[-*+]\s+(.+)$/;
      while (index < lines.length && pattern.test(lines[index])) {
        const item = document.createElement("li"); inlineText(item, lines[index++].replace(pattern, "$1")); list.append(item);
      }
      container.append(list); continue;
    }
    const quote = /^>\s?/.test(line);
    const text = []; const node = document.createElement(quote ? "blockquote" : "p");
    do { text.push(quote ? lines[index].replace(/^>\s?/, "") : lines[index]); index++; }
    while (index < lines.length && lines[index].trim() && (quote ? /^>\s?/.test(lines[index]) : !block(lines[index])));
    const value = text.join("\n");
    if (!container.children.length && /^\*(?!\*)[^*]+\*$/.test(value)) node.className = "article-lead";
    if (value.startsWith("Nguồn:")) node.className = "article-source";
    inlineText(node, value); container.append(node);
  }
}
