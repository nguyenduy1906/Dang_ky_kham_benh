import {apiRequest, pathSegment} from "./api.js";
import {allPages} from "./admin_ui.js";
export const listAdminReviews = (params = {}, options = {}) => apiRequest("/admin/reviews", {...options, params});
export async function readAdminReviews() {
  return (await allPages(listAdminReviews)).map(row => ({...row,id:row.review_id}));
}
export async function readAdminReview(id) {
  const result = await listAdminReviews({review_id:id,page_size:1});
  if(!result.items?.[0])throw new Error("Không tìm thấy đánh giá.");
  return {...result.items[0],id:result.items[0].review_id};
}
export async function setReviewVisibility(id, hidden) {
  const result = await apiRequest(`/admin/reviews/${pathSegment(id)}/visibility`, {method:"PATCH",data:{is_hidden:hidden}});
  if(result.review?.review_id !== Number(id) || result.review.is_hidden !== hidden)throw new Error("Chưa xác minh được trạng thái đánh giá. Vui lòng tải lại danh sách.");
  return result.review;
}
