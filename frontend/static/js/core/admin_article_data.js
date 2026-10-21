import * as api from "../api/article.js";
import { allPages } from "./admin_ui.js";
import { thumbnailUrl } from "./articles.js";

export function articleRow(row) {
  return { ...row, id: String(row.article_id), mode: !row.is_active || !row.published_at ? "draft" : Date.parse(row.published_at) > Date.now() ? "scheduled" : "published", thumbnail_url: thumbnailUrl(row.thumbnail_url) || "" };
}
export async function readAdminArticles(options = {}) {
  return (await allPages(api.listAdminArticles, {}, options.signal)).map(articleRow);
}
export async function readAdminArticle(id) {
  const result = await api.listAdminArticles({article_id: id, page_size: 1});
  if (!result.items?.[0]) throw new Error("Không tìm thấy bài viết.");
  return articleRow(result.items[0]);
}
export function serializeArticleSections(sections) {
  return sections.map(s => ["<!-- article-section -->", s.title ? `## ${s.title}` : "", s.text, s.image ? `![${(s.caption || "").replace(/[\[\]\n]/g, " ")}](${s.image})` : ""].filter(Boolean).join("\n\n")).join("\n\n");
}
export async function saveAdminArticle(row, files = new Map()) {
  const uploaded = new Map();
  async function image(url) {
    if (!url?.startsWith("blob:")) return url || "";
    const file = files.get(url);
    if (!file) throw new Error("Ảnh đã hết hiệu lực. Vui lòng chọn lại ảnh.");
    if (!uploaded.has(url)) {
      const result = await api.uploadImage(file);
      if (!result.url) throw new Error("Không nhận được đường dẫn ảnh đã tải.");
      uploaded.set(url, result.url);
    }
    return uploaded.get(url);
  }
  const sections = [];
  for (const section of row.sections) sections.push({...section, image: await image(section.image)});
  const content = serializeArticleSections(sections);
  if (content.length > 100000) throw new Error("Nội dung bài viết không được vượt quá 100.000 ký tự.");
  if (row.mode === "scheduled" && !(Date.parse(row.published_at) > Date.now())) throw new Error("Chọn thời điểm hẹn đăng sau thời gian hiện tại.");
  const payload = {title: row.title.trim(), slug: row.slug, category: row.category, thumbnail_url: await image(row.thumbnail_url), content, is_active: row.mode !== "draft", published_at: row.mode === "draft" ? null : row.published_at};
  const result = row.article_id ? await api.updateArticle(row.article_id, payload) : await api.createArticle(payload);
  if (!result.article?.article_id) throw new Error("Chưa xác minh được kết quả lưu bài viết. Kiểm tra danh sách trước khi thử lại.");
  return articleRow({...result.article, author_name: result.article.author_name || row.author_name});
}
