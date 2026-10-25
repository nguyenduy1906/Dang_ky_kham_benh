// Presentation catalog. Backend event delivery is integrated separately.
export const notificationTypes = {
  APPOINTMENT: "Đặt lịch khám", CANCELLATION: "Hủy lịch khám", PAYMENT: "Thanh toán",
  REFUND: "Hoàn tiền", STAFF_LEAVE: "Đơn xin nghỉ", SCHEDULE: "Lịch làm việc",
  ASSIGNMENT: "Phân công nhân viên", ENCOUNTER: "Tiếp nhận / khám bệnh",
  ARTICLE: "Bài viết", REVIEW: "Đánh giá", ACCOUNT: "Tài khoản",
  CATALOG: "Chuyên khoa / phòng khám", SYSTEM: "Hệ thống",
  DOCTOR: "Bác sĩ", PATIENT: "Hồ sơ bệnh nhân", MEDICAL_RECORD: "Kết quả khám", REMINDER: "Nhắc lịch khám",
};
export const notificationTemplates = {
  BOOKED: ["APPOINTMENT", "Đặt lịch khám thành công", "{patient} đã đặt lịch {reference} với bác sĩ {doctor}, lúc {time} ngày {date} tại {room}."],
  EXPIRED: ["APPOINTMENT", "Lượt đặt lịch hết hạn", "Lượt đặt lịch {reference} của {patient} đã hết thời gian giữ chỗ do chưa hoàn tất thanh toán."],
  CANCELLED: ["CANCELLATION", "Lịch khám đã hủy", "{actor} đã hủy lịch khám {reference} của {patient}. Lý do: {reason}."],
  PAID: ["PAYMENT", "Thanh toán thành công", "{patient} đã thanh toán {amount} cho lượt khám {encounter}. Giao dịch {reference}, phương thức {method}."],
  PAYMENT_FAILED: ["PAYMENT", "Thanh toán thất bại", "Giao dịch {reference} của {patient} chưa thành công. Lý do: {reason}."],
  REFUNDED: ["REFUND", "Hoàn tiền thành công", "Đã hoàn {amount} cho {patient}, lượt khám {encounter}. Mã hoàn tiền {reference}. Lý do: {reason}."],
  LEAVE_SENT: ["STAFF_LEAVE", "Đơn xin nghỉ mới", "{actor} gửi đơn {reference}, nghỉ {session} ngày {date}. Lý do: {reason}."],
  LEAVE_REVIEWED: ["STAFF_LEAVE", "Đơn xin nghỉ đã được xử lý", "{actor} đã {decision} đơn xin nghỉ {reference} của {employee}, ngày {date}."],
  LEAVE_CANCELLED: ["STAFF_LEAVE", "Đơn xin nghỉ đã hủy", "{actor} đã hủy đơn xin nghỉ {reference}, ngày {date}."],
  SHIFT_CHANGED: ["SCHEDULE", "Lịch làm việc thay đổi", "{actor} đã cập nhật ca {reference} của bác sĩ {doctor}: {time} ngày {date}, tại {room}."],
  SHIFT_CLOSED: ["SCHEDULE", "Ca làm việc đã đóng", "Ca {reference} của bác sĩ {doctor}, ngày {date} đã đóng. Lý do: {reason}."],
  ASSIGNED: ["ASSIGNMENT", "Phân công nhân viên", "{actor} đã phân công {employee} vào ca {reference}, {time} ngày {date}, tại {room}."],
  REVOKED: ["ASSIGNMENT", "Thu hồi phân công", "{actor} đã thu hồi phân công của {employee} tại ca {reference}. Lý do: {reason}."],
  CHECKED_IN: ["ENCOUNTER", "Người bệnh đã được tiếp nhận", "{patient} đã được tiếp nhận cho lượt khám {reference}, bác sĩ {doctor}, tại {room}."],
  TRANSFERRED: ["ENCOUNTER", "Lượt khám được điều phối", "Lượt khám {reference} của {patient} được chuyển sang bác sĩ {doctor}, {time} ngày {date}, tại {room}. Lý do: {reason}."],
  COMPLETED: ["ENCOUNTER", "Lượt khám đã hoàn tất", "Bác sĩ {doctor} đã hoàn tất lượt khám {reference} của {patient}."],
  ARTICLE_PUBLISHED: ["ARTICLE", "Bài viết đã xuất bản", "{actor} đã xuất bản bài viết “{title}”, mã {reference}, thuộc danh mục {category}."],
  ARTICLE_SCHEDULED: ["ARTICLE", "Bài viết đã được hẹn đăng", "{actor} đã hẹn đăng bài “{title}”, mã {reference}, lúc {time} ngày {date}."],
  ARTICLE_UPDATED: ["ARTICLE", "Bài viết được cập nhật", "{actor} đã cập nhật bài viết “{title}”, mã {reference}."],
  REVIEW_CREATED: ["REVIEW", "Có đánh giá mới", "Có đánh giá {rating}/5 sao cho bác sĩ {doctor}, mã {reference}. Nội dung: {comment}."],
  ACCOUNT_CHANGED: ["ACCOUNT", "Trạng thái tài khoản thay đổi", "{actor} đã chuyển tài khoản của {employee}, mã {reference}, sang trạng thái {status}."],
  CATALOG_CHANGED: ["CATALOG", "Thông tin danh mục thay đổi", "{actor} đã cập nhật {title}, mã {reference}. Nội dung: {content}."],
  SYSTEM_CHANGED: ["SYSTEM", "Cấu hình hệ thống thay đổi", "{actor} đã cập nhật cấu hình {title}: {content}."],
};
export function notificationFromTemplate(event, values) {
  const template = notificationTemplates[event];
  if (!template) throw new Error("Loại sự kiện thông báo không hợp lệ.");
  const [type, title, pattern] = template;
  const content = pattern.replace(/\{(\w+)\}/g, (_, key) => {
    if (values[key] == null || values[key] === "") throw new Error(`Thiếu thông tin thông báo: ${key}`);
    return String(values[key]);
  });
  return {type,title,content,reference:values.reference || "",details:[...new Set([...pattern.matchAll(/\{(\w+)\}/g)].map(match=>match[1]))].map(key=>[key,values[key]])};
}

const defaults = {patient:"Nguyễn Minh Anh",doctor:"Trần Quang Huy",actor:"Quản trị viên Nguyễn Minh Quân",employee:"Điều dưỡng Lê Thu Hà",time:"08:00",date:"23/10/2026",room:"Phòng Nội 101",reference:"LK_024",encounter:"LK_024",amount:"350.000 ₫",method:"Chuyển khoản",reason:"Thay đổi kế hoạch cá nhân",session:"buổi sáng",decision:"duyệt",title:"Hướng dẫn chuẩn bị trước khi khám",category:"Hướng dẫn khám bệnh",rating:4,comment:"Bác sĩ tư vấn rõ ràng",status:"Đang hoạt động",content:"Cập nhật thời gian tiếp nhận"};
export const systemNotificationPreview = Object.keys(notificationTemplates).map((event,index) => {
  const type=notificationTemplates[event][0];
  const prefix={PAYMENT:"TT",REFUND:"TT",STAFF_LEAVE:"NP",SCHEDULE:"CA",ASSIGNMENT:"CA",ARTICLE:"BV",REVIEW:"DG",ACCOUNT:"TK",CATALOG:"PH",SYSTEM:"CH"}[type] || "LK";
  return {...notificationFromTemplate(event,{...defaults,reference:`${prefix}_${String(index+1).padStart(3,"0")}`}),changes: event==='SYSTEM_CHANGED'?[{field:'Giờ bắt đầu tiếp nhận',before:'07:30',after:'08:00'}]:event==='SHIFT_CHANGED'?[{field:'Giờ bắt đầu ca',before:'07:30',after:'08:00'}]:event==='ARTICLE_UPDATED'?[{field:'Tiêu đề bài viết',before:'Chuẩn bị trước khi khám',after:defaults.title}]:[],event,id:index+1,is_read:index%3===0,created_at:`2026-10-22T${String(8+Math.floor(index/6)).padStart(2,"0")}:${String(index%6*10).padStart(2,"0")}:00+07:00`};
});
