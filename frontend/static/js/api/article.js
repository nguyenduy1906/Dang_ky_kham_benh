import { apiRequest, pathSegment } from "../core/api.js";

/** Bộ lọc: q, category, page, page_size; admin thêm is_active/article_id. Chi tiết dùng slug. Body: title, slug, category, thumbnail_url, content, is_active, published_at; không tự render nội dung. */

/** GET /articles */
export function listArticles(params = {}, options = {}) {
  return apiRequest("/articles", { ...options, method: "GET", params, auth: false });
}

/** GET /articles/<string:slug> */
export function getBySlug(slug, options = {}) {
  return apiRequest(`/articles/${pathSegment(slug)}`, { ...options, method: "GET", auth: false });
}

/** GET /admin/articles */
export function listAdminArticles(params = {}, options = {}) {
  return apiRequest("/admin/articles", { ...options, method: "GET", params });
}

/** POST /admin/articles */
export function createArticle(data, options = {}) {
  return apiRequest("/admin/articles", { ...options, method: "POST", data });
}

/** PATCH /admin/articles/<int:article_id> */
export function updateArticle(articleId, data, options = {}) {
  return apiRequest(`/admin/articles/${pathSegment(articleId)}`, { ...options, method: "PATCH", data });
}

/** POST /admin/articles/images — returns { url } for thumbnail_url/content. */
export function uploadImage(file, options = {}) {
  const data = new FormData(); data.append("file", file);
  return apiRequest("/admin/articles/images", { ...options, method: "POST", data });
}

/** GET /uploads/articles/<filename> */
export function getImage(filename, options = {}) {
  return apiRequest(`/uploads/articles/${pathSegment(filename)}`, { ...options, method: "GET", auth: false, responseType: "blob" });
}

