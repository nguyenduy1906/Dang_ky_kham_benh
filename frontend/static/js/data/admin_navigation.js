// Shared navigation for the admin preview and the administrator's personal profile.
export const adminPageHref = key => key === "profile" ? "../components/profile.html?role=admin" : `${key}.html`;

export const adminSections = [
  ["TỔNG QUAN", [["home", "Bảng điều khiển", "grid"]]],
  ["NHÂN SỰ & TÀI KHOẢN", [["users", "Tài khoản & phân quyền", "people"], ["doctors", "Bác sĩ", "doctor"], ["assignments", "Phân công y tá", "person"]]],
  ["DANH MỤC & LỊCH KHÁM", [["departments", "Chuyên khoa", "building"], ["rooms", "Phòng khám", "door"], ["schedule", "Lịch làm việc", "calendar"]]],
  ["QUẢN LÝ KHÁM BỆNH", [["encounters", "Lượt khám", "record"], ["patients", "Bệnh nhân", "people"], ["payments", "Thanh toán", "card"]]],
  ["NỘI DUNG & TƯƠNG TÁC", [["articles", "Tin tức", "record"], ["reviews", "Đánh giá", "star"], ["notifications", "Thông báo", "bell"]]],
  ["BÁO CÁO", [["statistics", "Thống kê & báo cáo", "chart"]]],
  ["HỆ THỐNG", [["configuration", "Cấu hình hệ thống", "settings"], ["audit", "Nhật ký hoạt động", "history"]]],
  ["CÁ NHÂN", [["profile", "Hồ sơ cá nhân", "person"]]],
];
