// Fictional data for the presentation only. No API calls or persistent storage.
export const reviewPreview = [
  [8,5,"Bác sĩ giải thích rõ ràng, hướng dẫn chăm sóc sau khám dễ hiểu.","Bác sĩ mẫu A","Nội tổng quát","2026-10-21T08:20:00+07:00"],
  [7,4,"Khám cẩn thận, tuy nhiên thời gian chờ tiếp nhận hơi lâu.","Bác sĩ mẫu B","Nhi khoa","2026-10-20T15:10:00+07:00"],
  [6,2,"Cần hướng dẫn rõ hơn về vị trí phòng khám khi đến bệnh viện.","Bác sĩ mẫu A","Nội tổng quát","2026-10-20T10:40:00+07:00"],
  [5,5,"Được tư vấn đầy đủ và giải đáp các câu hỏi sau khám.","Bác sĩ mẫu C","Da liễu","2026-10-19T16:30:00+07:00"],
  [4,3,"Phần khám tốt, mong cải thiện hướng dẫn tại quầy tiếp đón.","Bác sĩ mẫu B","Nhi khoa","2026-10-19T09:15:00+07:00"],
  [3,1,"Thời gian chờ lâu, chưa được thông báo khi có thay đổi.","Bác sĩ mẫu C","Da liễu","2026-10-18T14:00:00+07:00"],
  [2,4,"Nhân viên hỗ trợ chu đáo, phòng khám dễ tìm.","Bác sĩ mẫu A","Nội tổng quát","2026-10-17T11:20:00+07:00"],
  [1,5,"", "Bác sĩ mẫu B","Nhi khoa","2026-10-16T08:45:00+07:00"],
].map(([id,rating,comment,doctor,department,created_at])=>({id,rating,comment,doctor,department,created_at}));

export const notificationPreview = [
  [8,"STAFF_LEAVE","Đơn xin nghỉ mới cần xem xét","Nhân viên mẫu A đã gửi đơn xin nghỉ buổi sáng ngày 23/10/2026. Vui lòng xem đơn và kiểm tra lịch làm việc trước khi xét duyệt.",false,"2026-10-21T09:15:00+07:00","NP_008"],
  [7,"STAFF_LEAVE","Nhân viên cập nhật đơn xin nghỉ","Nhân viên mẫu B đã cập nhật lý do trong đơn xin nghỉ ngày 24/10/2026. Nội dung chi tiết nằm trong hồ sơ đơn xin nghỉ.",false,"2026-10-21T08:40:00+07:00","NP_007"],
  [6,"SYSTEM","Hướng dẫn sử dụng thông báo","Thông báo trong ứng dụng giúp theo dõi các sự kiện liên quan đến tài khoản của bạn. Bạn có thể lọc thông báo chưa đọc và mở chi tiết để xem nội dung.",false,"2026-10-20T15:30:00+07:00",""],
  [5,"STAFF_LEAVE","Đơn xin nghỉ của nhân viên","Nhân viên mẫu C đã gửi đơn xin nghỉ buổi chiều ngày 22/10/2026. Kiểm tra các ca được phân công trước khi đưa ra quyết định.",true,"2026-10-20T10:05:00+07:00","NP_006"],
  [4,"STAFF_LEAVE","Nhân viên hủy đơn xin nghỉ","Nhân viên mẫu A đã hủy đơn xin nghỉ ngày 21/10/2026. Kiểm tra lại thông tin đơn khi sắp xếp nhân sự.",true,"2026-10-19T16:00:00+07:00","NP_005"],
  [3,"SYSTEM","Tra cứu lịch sử hoạt động","Bạn có thể xem các lịch sử nghiệp vụ đang được hỗ trợ tại trang Nhật ký hoạt động.",true,"2026-10-19T09:10:00+07:00",""],
  [2,"STAFF_LEAVE","Đơn xin nghỉ mới cần xem xét","Nhân viên mẫu D đã gửi đơn xin nghỉ cả ngày 20/10/2026. Nội dung này là ví dụ bố cục thông báo dành cho quản trị viên.",true,"2026-10-18T14:30:00+07:00","NP_004"],
  [1,"SYSTEM","Chào mừng đến không gian quản trị","Theo dõi thông báo dành cho tài khoản quản trị viên tại đây. Toàn bộ nội dung trên bản giao diện này là dữ liệu minh họa.",true,"2026-10-16T08:00:00+07:00",""],
].map(([id,type,title,content,is_read,created_at,reference])=>({id,type,title,content,is_read,created_at,reference}));
