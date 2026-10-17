# Đối chiếu API với giao diện quản trị

Ngày đối chiếu: 17/10/2026. Chỉ thay đổi frontend. Không chỉnh backend, schema, SQL, dữ liệu hoặc tài liệu trong docs/.

## Các phần đã nối

| Trang / chức năng | API hiện có được sử dụng |
|---|---|
| Tổng quan, báo cáo, lọc ngày và xuất CSV | GET /admin/statistics/encounters, /admin/statistics/payments, /admin/statistics/reviews; GET /encounters, /departments, /rooms, /doctors, /patients |
| Tài khoản: danh sách, lọc, chi tiết, tạo nhân viên, sửa, khóa/mở khóa, xóa mềm | GET /admin/roles; GET/POST /admin/users; GET/PATCH/DELETE /admin/users/{id}; PATCH /admin/users/{id}/account-status |
| Bệnh nhân: danh sách, chi tiết, thêm, sửa, lưu trữ, lịch sử | GET/POST /patients; GET/PATCH /patients/{id}; POST /patients/{id}/archive; GET /patients/{id}/encounters |
| Bác sĩ: danh sách, chi tiết, tạo/sửa hồ sơ, đổi ảnh | GET /doctors, /doctors/{id}; POST /admin/doctors; PATCH /admin/doctors/{id}; POST /admin/doctors/{id}/avatar |
| Chuyên khoa: danh sách, chi tiết, tạo/sửa nội dung, ảnh bìa, lãnh đạo và lịch sử lãnh đạo | GET /departments, /departments/{id}; POST /admin/departments; PATCH /admin/departments/{id}; POST /admin/departments/{id}/images; GET/PUT /admin/departments/{id}/leadership |
| Phòng khám: danh sách, lọc, thêm/sửa, ngừng hoạt động | GET /rooms; POST /admin/rooms; PATCH /admin/rooms/{id} |
| Ca khám: danh sách, lọc, phân trang, tạo/sửa/đóng ca | GET/POST /admin/schedules; PATCH /admin/schedules/{id} |
| Phân công y tá: danh sách, lọc, thêm và thu hồi | GET/POST /admin/nurse-assignments; POST /admin/nurse-assignments/{id}/revoke |
| Xem lịch nhân viên ở chi tiết tài khoản | GET /admin/staff/{user_id}/work-schedules |
| Xem và xét duyệt đơn nghỉ ở trang Lịch làm việc | GET /admin/leave-requests, /admin/leave-requests/{id}; POST /admin/leave-requests/{id}/review |
| Bài viết: danh sách, bộ lọc, chi tiết kể cả nháp, thêm/sửa/ẩn/xuất bản/hẹn giờ, ảnh | GET/POST /admin/articles; PATCH /admin/articles/{id}; POST /admin/articles/images |
| Thanh toán: tra cứu theo lượt khám hoặc mã giao dịch, chi tiết và hoàn tiền | GET /encounters/{id}/payments; GET /payments/{id}; POST /admin/payments/{id}/refund |
| Đối soát, lịch sử trạng thái, điều phối, thanh toán và bệnh án | GET /admin/audit/encounters; encounter_id để nhận lịch sử chi tiết (tối đa 100 mục mỗi loại theo backend) |
| Cấu hình: danh sách và lưu từng khóa được phép sửa | GET /admin/configurations; PATCH /admin/configurations/{key}. Hiển thị effective_value; khóa read_only không có nút lưu |

Các thao tác chỉ gửi đúng trường được API nhận. Số tiền, điều kiện hoàn, quyền truy cập, sức chứa, trạng thái nghiệp vụ và danh tính người thực hiện do backend quyết định. Không có dữ liệu minh họa làm phương án dự phòng khi API lỗi.

## Chưa có API hoặc trường dữ liệu phù hợp

1. **Danh sách tất cả giao dịch thanh toán của toàn viện**, kèm tìm kiếm/lọc/phân trang chung. Hiện chỉ có danh sách theo encounter_id và chi tiết payment_id. Giao diện yêu cầu một trong hai mã, không ghép quét toàn bộ lượt khám để giả làm danh sách chung.
2. **Nhật ký quản trị tổng quát** cho thay đổi tài khoản, danh mục, bài viết, cấu hình. /admin/audit/encounters chỉ đối soát và trả lịch sử lượt khám. Trang vẫn giữ vị trí trong nav và mô tả đúng phạm vi này.
3. **Khôi phục tài khoản đã xóa mềm / hồ sơ bệnh nhân đã lưu trữ**: chưa có endpoint khôi phục. Có thể xem chúng bằng include_deleted/include_archived, không hiển thị nút khôi phục giả.
4. **Xóa hẳn hoặc khôi phục các danh mục, bài viết, ca khám**: chưa có các endpoint DELETE/restore tương ứng. Dùng is_active cho danh mục/bài viết và OPEN/CLOSED cho ca ở đúng nơi được API hỗ trợ.
5. **Tạo/sửa ca đi làm riêng cho y tá và lễ tân, đăng ký/đổi ca**: API admin/schedules hiện quản lý ca khám của bác sĩ; lịch đi làm cá nhân có API đọc nhưng chưa có API quản lý các ca riêng này. Xét duyệt nghỉ đã có API và đã nối.
6. **Các trường HR không có trong response/schema hiện tại**: mã nhân viên riêng, CCCD/ngày sinh/giới tính của tài khoản nhân viên, chứng chỉ hành nghề, hợp đồng, lương/phụ cấp, liên hệ khẩn cấp và lịch sử công tác. Không lấy thông tin patient thay cho nhân viên hoặc tự lưu ở trình duyệt. Chuyên khoa không có trường mã viết tắt riêng, phòng không có trường vị trí riêng; không tiếp tục hiển thị giá trị minh họa cho các trường này.

## Phạm vi kiểm chứng

- Đã đọc route, schema, service/model hiện có; GET /health của backend đang chạy trả database=postgresql, status=ok. Đã đối chiếu các path admin từ GET /apispec_1.json của backend đang chạy.
- Toàn bộ 226 kiểm thử frontend đạt, trong đó 37 kiểm thử riêng cho tích hợp admin. Kiểm thử dùng phản hồi biệt lập; không gửi thao tác ghi vào backend/database đang chạy.
- Đã kiểm tra trên trình duyệt ở 1440×900 và 390×844: tổng quan, bảng tài khoản, biểu mẫu tạo nhân viên, chỉnh sửa nội dung chuyên khoa/thư viện ảnh, trang lịch. Hộp thoại và nội dung không tràn ngang màn hình.
- Trang kiểm tra giao diện biệt lập: node frontend/tests/admin-preview.mjs. Chỉ lắng nghe 127.0.0.1:3104, dùng dữ liệu kiểm thử, không tạo phiên đăng nhập, chặn mọi thao tác ghi trước khi tới backend.
- Chưa nghiệm thu thao tác quản lý bằng tài khoản admin thật trên dữ liệu thật.
