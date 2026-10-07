# Danh sách API và phân công backend

Đề xuất dựa trên tài liệu nghiệp vụ được cung cấp, đối chiếu mã nguồn hiện tại.
Đây là danh sách cần triển khai, không phải danh sách API đã hoàn thành.
Hiện mới có GET /health, Swagger /docs/ và khởi tạo/seed PostgreSQL.
Các đường dẫn nghiệp vụ dưới đây dùng tiền tố /api/v1.

## 1. Các điểm phải thống nhất trước khi làm

| Tài liệu | Schema hiện tại | Quyết định cần chốt |
|---|---|---|
| PENDING_PAYMENT, BOOKED, WAITING_EXAM, IN_EXAM | HOLDING, CONFIRMED, CHECKED_IN, IN_PROGRESS | Đề xuất dùng tên schema hiện tại và ánh xạ ý nghĩa; nếu đổi tên, migration cả bảng, log, index và dữ liệu mẫu |
| max_patients | max_quota | Đề xuất dùng max_quota trong API và code |
| amount DECIMAL | amount BIGINT | Chốt dùng số nguyên VND hay NUMERIC; không dùng float |
| ID BIGINT | INTEGER identity | Chốt giữ INTEGER hoặc migrate; không đổi chỉ trong init_db.sql |
| APPOINTMENT_TRANSFER_LOG | visit_transfer_log | Đề xuất thống nhất visit_transfer_log |
| REVIEW liên kết visit_id | review.record_id | Đề xuất giữ record_id, suy ra visit qua medical_record; API có thể đặt dưới visits |
| Soft delete nhiều thực thể | users có deleted_at, patient có archived_at; một số danh mục có is_active | Chốt archive bệnh nhân, lịch sử không xóa vật lý; migration nếu cần cột archive |
| Y tá cập nhật thông tin theo quyền | Có nurse_assignment theo ca; chưa chốt danh sách trường được sửa | Chốt phạm vi và trường được sửa trước khi viết endpoint cập nhật |
| Yêu cầu vai trò mới | Có role_request lưu yêu cầu và kết quả duyệt riêng | Dùng requested_role_id trong role_request; chỉ đổi role hiện tại khi duyệt |

Chốt thêm: walk-in có gắn ca không; walk-in có thu EXAM_FEE không; cổng thanh toán;
đặt cọc cố định hay phần trăm; no-show tính từ đầu ca hay estimated_exam_at và thời gian
ân hạn; quy tắc hàng chờ khi schedule_id NULL; quyền xem lịch sử bệnh nhân của bác sĩ/y tá;
đổi bác sĩ khác giá khám; quyền sửa hồ sơ sau COMPLETED; phương thức gửi OTP và xác thực
bằng session hay token. Các nội dung này chưa đủ rõ để thành viên tự suy đoán.

## 2. Quy ước dùng chung

- USER chỉ xem/sửa hồ sơ bệnh nhân mình quản lý và visit liên quan; không chỉ kiểm tra role.
- DOCTOR chỉ thao tác visit được phân công. NURSE xem theo phạm vi được giao, không mặc định
  được đọc mọi hồ sơ. ADMIN cũng kiểm tra quyền nghiệp vụ cho thao tác nhạy cảm.
- API danh sách có phân trang, lọc theo ngày/trạng thái/khoa/bác sĩ khi phù hợp.
- Chuẩn hóa lỗi 400, 401, 403, 404, 409; thống nhất response trước khi frontend tích hợp.
- Thời gian lưu UTC, hiển thị Asia/Saigon. Quy tắc 24 giờ dùng thời điểm khám đã thống nhất.
- Thao tác đặt lịch/thanh toán dùng idempotency key; không nhận giá tiền hoặc user_id
  của người thao tác từ client để quyết định quyền/tiền. Các PATCH có danh sách trường cho phép.
- Không cung cấp API PATCH status tùy ý; chuyển trạng thái qua các action hợp lệ.
- Không trả password_hash, token_hash, OTP hoặc thông tin bệnh nhân trong API public.
- Mỗi thành viên thêm schema đầu vào/đầu ra, kiểm tra quyền, Swagger và kiểm thử nghiệp vụ.

## 3. Danh sách API theo module

### A. Xác thực và hồ sơ tài khoản

| Method và đường dẫn | Chức năng | Người dùng |
|---|---|---|
| POST /auth/register | Đăng ký tài khoản USER | Public |
| POST /auth/login | Đăng nhập, kiểm tra khóa/xóa/phê duyệt | Public |
| POST /auth/logout | Kết thúc hoặc thu hồi phiên | Đã đăng nhập |
| POST /auth/refresh | Làm mới token nếu chọn mô hình token | Đã xác thực refresh token |
| POST /auth/forgot-password | Gửi OTP/token đặt lại mật khẩu | Public |
| POST /auth/verify-otp | Kiểm tra OTP, cấp quyền đặt lại mật khẩu hạn chế | Public |
| POST /auth/reset-password | Đổi mật khẩu bằng token hợp lệ một lần | Có reset token |
| POST /auth/email-verification/request | Gửi xác minh email | Theo luồng xác minh |
| POST /auth/email-verification/confirm | Xác minh email bằng token | Có token |
| GET /me | Xem tài khoản hiện tại | Đã đăng nhập |
| PATCH /me | Sửa thông tin cá nhân cho phép | Đã đăng nhập |
| POST /me/change-password | Đổi mật khẩu với xác thực mật khẩu cũ | Đã đăng nhập |
| POST /me/role-requests | Yêu cầu vai trò nghiệp vụ | Theo chính sách |

Cần: băm/kiểm tra mật khẩu Werkzeug, token lưu hash, TTL/used_at, giới hạn thử OTP,
chống dò tài khoản, thu hồi phiên khi khóa/đổi mật khẩu. AUTH_TOKEN hiện không tự giải quyết
lưu phiên/refresh token; nếu chọn JWT cần thiết kế cách thu hồi. Nếu chọn cookie session,
thiết kế CSRF và thuộc tính cookie. Role đặc quyền phải được admin phê duyệt.

### B. Quản lý người dùng và quyền

| Method và đường dẫn | Chức năng | Quyền |
|---|---|---|
| GET /admin/users | Danh sách tài khoản | ADMIN |
| GET /admin/users/{id} | Chi tiết tài khoản | ADMIN |
| POST /admin/users | Tạo tài khoản nhân viên | ADMIN |
| PATCH /admin/users/{id} | Sửa thông tin theo trường cho phép | ADMIN |
| PATCH /admin/users/{id}/account-status | Khóa/kích hoạt | ADMIN |
| DELETE /admin/users/{id} | Soft delete, giữ lịch sử | ADMIN |
| GET /admin/roles | Danh sách 5 vai trò | ADMIN |
| GET /admin/role-requests | Danh sách yêu cầu quyền | ADMIN |
| POST /admin/role-requests/{id}/approve | Phê duyệt | ADMIN |
| POST /admin/role-requests/{id}/reject | Từ chối kèm lý do | ADMIN |

Không tạo/xóa tùy ý role: CHECK hiện chỉ cho 5 vai trò. Phê duyệt DOCTOR cần phối hợp
với module hồ sơ bác sĩ; không cho tài khoản tự sửa role_id hoặc approval_status.

### C. Bệnh nhân và người thân

| Method và đường dẫn | Chức năng | Quyền |
|---|---|---|
| GET /patients | Hồ sơ của USER; tìm kiếm giới hạn cho nhân viên | USER/RECEPTIONIST/ADMIN theo scope |
| POST /patients | Tạo hồ sơ bản thân/người thân hoặc walk-in | USER/RECEPTIONIST/ADMIN |
| GET /patients/{id} | Xem hồ sơ trong phạm vi | Người có quyền |
| PATCH /patients/{id} | Sửa thông tin được phép | Người có quyền |
| POST /patients/{id}/archive | Ngừng sử dụng hồ sơ, giữ lịch sử | Theo quyền và migration |
| GET /patients/{id}/visits | Lịch sử khám có lọc trạng thái | Người có quyền |

Không bắt buộc patient.user_id cho walk-in; user_id của hồ sơ người thân là tài khoản
quản lý. Không gán hồ sơ walk-in cho tài khoản chỉ vì trùng số điện thoại. Bác sĩ/y tá
xem bệnh nhân qua visit được phân công. Không có API xóa vật lý bệnh án.

### D. Khoa, bác sĩ, phòng và lịch làm việc

| Method và đường dẫn | Chức năng | Quyền |
|---|---|---|
| GET /departments | Khoa đang hoạt động | Public |
| GET /departments/{id} | Chi tiết khoa | Public |
| POST /admin/departments | Tạo khoa | ADMIN |
| PATCH /admin/departments/{id} | Sửa/ngừng hoạt động | ADMIN |
| GET /doctors | Tìm bác sĩ theo khoa/chuyên môn | Public |
| GET /doctors/{id} | Hồ sơ công khai và tổng hợp đánh giá | Public |
| POST /admin/doctors | Tạo DoctorProfile từ tài khoản DOCTOR | ADMIN |
| PATCH /admin/doctors/{id} | Quản lý khoa, giá, trạng thái | ADMIN |
| GET /doctor/profile | Hồ sơ của bác sĩ hiện tại | DOCTOR |
| PATCH /doctor/profile | Sửa chuyên môn/giới thiệu theo quyền | DOCTOR |
| GET /rooms | Danh sách phòng trong phạm vi vận hành | Nhân viên có quyền |
| POST /admin/rooms | Tạo phòng theo khoa | ADMIN |
| PATCH /admin/rooms/{id} | Sửa/ngừng hoạt động | ADMIN |
| GET /doctors/{id}/schedules | Ca còn nhận bệnh và số chỗ khả dụng | Public |
| GET /doctor/schedules | Ca của bác sĩ hiện tại | DOCTOR |
| GET /admin/schedules | Danh sách quản trị | ADMIN |
| POST /admin/schedules | Tạo ca | ADMIN |
| PATCH /admin/schedules/{id} | Sửa ca/quota/trạng thái | ADMIN |
| POST /doctor/schedules/{id}/unavailability | Báo nghỉ kèm lý do | DOCTOR của ca |
| GET /staff/schedules/{id}/affected-visits | Danh sách visit cần xử lý khi ca thay đổi | Nhân viên có quyền |

Kiểm tra khoảng thời gian chồng lấn bác sĩ/phòng (UNIQUE giờ bắt đầu chưa đủ), khoa
của phòng và bác sĩ, quota không thấp hơn booked_count. Sửa ca có visit phải có chính
sách xử lý, thông báo và log; không tự hủy toàn bộ lịch khi bác sĩ báo nghỉ.

### E. VISIT online, walk-in, tiếp nhận và hàng chờ

| Method và đường dẫn | Chức năng | Quyền |
|---|---|---|
| POST /visits/online | Giữ chỗ 10 phút, tạo visit và payment deposit | USER |
| GET /visits | Danh sách theo tài khoản/phân công, có lọc | Đã đăng nhập theo scope |
| GET /visits/{id} | Chi tiết lượt khám | Người có quyền |
| POST /visits/{id}/cancel | Hủy, trả quota, xác định hoàn cọc | USER sở hữu/nhân viên theo quyền |
| GET /visits/{id}/status-history | Lịch sử trạng thái | Người có quyền |
| GET /visits/{id}/transfer-history | Lịch sử chuyển bác sĩ | Người có quyền |
| POST /staff/visits/walk-in | Tiếp nhận trực tiếp, cấp hàng chờ | RECEPTIONIST/ADMIN |
| POST /staff/visits/{id}/check-in | Check-in đúng ca, cấp số thứ tự | RECEPTIONIST/ADMIN |
| GET /staff/queues | Hàng chờ theo ca/bác sĩ/phòng | Nhân viên theo scope |
| GET /staff/visits/{id}/transfer-options | Ca/bác sĩ phù hợp còn quota | RECEPTIONIST/ADMIN |
| POST /staff/visits/{id}/transfer | Chuyển bác sĩ, quota, log và thông báo | RECEPTIONIST/ADMIN |
| POST /staff/visits/{id}/no-show | Ghi nhận no-show theo thời điểm hợp lệ | Nhân viên được cấp quyền |
| POST /doctor/visits/{id}/start | Gọi bệnh nhân/bắt đầu khám | DOCTOR phụ trách |

Một service chung sở hữu chuyển trạng thái và quota cho ONLINE/WALK_IN. Các module
khác gọi service đó, không tự sửa booked_count. Dùng transaction/khóa hàng ca để chống
vượt quota và double booking. Check-in idempotent; queue_number duy nhất trong phạm vi
đã chốt. Chuyển bác sĩ khóa ca cũ/mới theo thứ tự cố định, giữ chỗ mới và trả chỗ cũ
cùng transaction, ghi visit_transfer_log, không tự thay đổi payment.

### F. Thanh toán và hoàn tiền

| Method và đường dẫn | Chức năng | Quyền |
|---|---|---|
| POST /visits/{id}/payment-intents | Khởi tạo/thử lại phiên thanh toán cho payment pending | Chủ visit |
| GET /visits/{id}/payments | Lịch sử deposit/exam fee/refund | Người có quyền |
| GET /payments/{id} | Trạng thái giao dịch | Người có quyền |
| POST /payments/webhooks/{provider} | Nhận kết quả từ nhà cung cấp | Xác minh chữ ký nhà cung cấp |
| POST /staff/visits/{id}/exam-fees | Ghi nhận thu phí khám, nếu trong phạm vi | Nhân viên được cấp quyền |
| POST /admin/payments/{id}/refund | Xử lý/yêu cầu hoàn tiền đủ điều kiện | Quyền tài chính đã chốt |

Không có API để frontend tự báo thanh toán SUCCESS. Server tính tiền, đối chiếu số tiền,
đơn vị tiền và mã giao dịch. Callback lặp không thu/hoàn hoặc trả quota lần hai. Callback
muộn sau EXPIRED phải có chính sách, không tự xác nhận ca đã hết chỗ. Hủy có quyền hoàn
không đồng nghĩa ngân hàng đã hoàn thành; lưu refund transaction riêng và đối soát.
Nếu cần liên kết refund với payment gốc/provider intent, bổ sung schema phù hợp.

### G. Kết quả khám và đơn thuốc

| Method và đường dẫn | Chức năng | Quyền |
|---|---|---|
| GET /visits/{id}/medical-record | Xem kết quả khám | Chủ hồ sơ/bác sĩ và nhân viên theo quyền |
| PUT /doctor/visits/{id}/medical-record | Tạo/cập nhật kết quả trong khi khám | DOCTOR phụ trách |
| GET /medical-records/{id}/prescription-items | Xem danh sách thuốc | Người có quyền |
| PUT /doctor/medical-records/{id}/prescription-items | Lưu danh sách thuốc trong khi khám | DOCTOR phụ trách |
| POST /doctor/visits/{id}/complete | Hoàn tất khám, kiểm tra record/đơn thuốc, log, thông báo | DOCTOR phụ trách |

Một visit có một medical_record; không nhập lại patient/doctor/department vào record.
Số lượng thuốc dương; chỉ sửa trước khi hoàn tất trừ khi có quy trình sửa bệnh án đã chốt.
Không xóa vật lý hồ sơ hoàn thành. Y tá chưa được sửa chẩn đoán/đơn thuốc nếu chưa có
quyền rõ ràng. Nếu cần ghi chú chăm sóc riêng, chốt trường dữ liệu/migration trước.

### H. Đánh giá và thông báo

| Method và đường dẫn | Chức năng | Quyền |
|---|---|---|
| POST /visits/{id}/review | Đánh giá sau COMPLETED và có medical_record | Chủ hồ sơ |
| GET /doctors/{id}/reviews | Đánh giá công khai, không lộ bệnh án | Public |
| GET /notifications | Thông báo của tài khoản hiện tại | Đã đăng nhập |
| GET /notifications/unread-count | Đếm chưa đọc | Đã đăng nhập |
| PATCH /notifications/{id}/read | Đánh dấu đã đọc | Chủ thông báo |
| POST /notifications/read-all | Đánh dấu tất cả đã đọc | Đã đăng nhập |

Rating 1–5, một review/record theo schema. Không cho người khác đánh giá thay.
Thông báo do backend phát sinh từ nghiệp vụ, không có API public gửi tùy ý cho user khác.
Lưu đúng reference_type/reference_id; khi mở thông báo vẫn kiểm tra quyền tài nguyên.

### I. Tin tức, upload, cấu hình và thống kê

| Method và đường dẫn | Chức năng | Quyền |
|---|---|---|
| GET /articles | Bài đã xuất bản, có lọc/phân trang | Public |
| GET /articles/{slug} | Chi tiết bài đã xuất bản | Public |
| GET /admin/articles | Danh sách gồm bản nháp | ADMIN |
| POST /admin/articles | Tạo bài | ADMIN |
| PATCH /admin/articles/{id} | Sửa/xuất bản/ẩn bài | ADMIN |
| POST /uploads/images | Upload ảnh bác sĩ/bài viết | DOCTOR/ADMIN theo loại ảnh |
| GET /admin/configurations | Xem cấu hình nghiệp vụ | ADMIN |
| PATCH /admin/configurations/{key} | Sửa cấu hình trong whitelist | ADMIN |
| GET /admin/statistics/visits | ONLINE/WALK_IN, hủy, no-show, hoàn thành | ADMIN |
| GET /admin/statistics/payments | Thu/hoàn theo kỳ, tránh tính trùng deposit/exam fee | ADMIN |
| GET /admin/statistics/reviews | Tổng hợp đánh giá | ADMIN |
| GET /admin/audit/visits | Tra cứu lịch sử trạng thái/chuyển bác sĩ | ADMIN |

Upload kiểm tra loại/nội dung/kích thước, sinh tên file, tránh path traversal; cấu hình
lưu bền vững qua volume và cách phục vụ /uploads. Cấu hình hệ thống không chứa mật khẩu.
Các audit hiện có chỉ bao phủ visit; muốn truy vết đổi quyền/config/bệnh án cần thêm cơ
chế audit. Bài viết không hiển thị HTML chưa kiểm soát. Thống kê dùng khoảng thời gian
và định nghĩa chỉ số thống nhất, không lấy mọi payment SUCCESS cộng tùy ý.

## 4. Phần backend không phải API

| Hạng mục | Việc cần làm |
|---|---|
| Tác vụ hết hạn | Quét HOLDING hết 10 phút, EXPIRED, trả quota và log đúng một lần |
| Tác vụ no-show | Theo thời gian/ân hạn đã chốt, ghi NO_SHOW và log; tránh chạy trùng với check-in |
| Nhắc lịch | Gửi nhắc theo thời điểm cấu hình, chống gửi lặp |
| Thanh toán nền | Retry/đối soát thanh toán và hoàn tiền; không giữ DB transaction trong lúc gọi nhà cung cấp |
| Gửi email/OTP | Adapter email, timeout/retry, không log mã hoặc mật khẩu |
| Xác thực/phân quyền | Decorator/middleware dùng chung, scope tài nguyên, xử lý khóa tài khoản |
| Quy tắc trạng thái | Một bảng chuyển trạng thái dùng chung và service chịu trách nhiệm log/quota |
| Hạ tầng upload | Volume lưu ảnh, endpoint phục vụ file và kiểm tra quyền cho dữ liệu riêng |
| Migration | Có phiên bản nâng cấp schema, không chỉ CREATE TABLE IF NOT EXISTS |
| Swagger/kiểm thử | Mô tả request/response/quyền/lỗi, test rollback và cạnh tranh đồng thời |

Tác vụ nền chạy qua worker/scheduler riêng, không tạo một scheduler trong mỗi Gunicorn
worker vì sẽ chạy lặp. Tác vụ tự động cần tài khoản hệ thống hợp lệ do changed_by_id
trong visit_status_log bắt buộc; ghi danh tính tác vụ rõ ràng và không cho đăng nhập
bằng tài khoản hệ thống. Thông báo/email gửi sau commit hoặc qua outbox.

## 5. Phân công gợi ý theo 5 gói

Chưa biết số thành viên, đây là 5 gói trách nhiệm có thể ghép/tách.

| Gói | Module | Phụ thuộc |
|---|---|---|
| 1. Tài khoản & nền tảng | A, B; xác thực/quyền, chuẩn lỗi, đăng ký Blueprint | Chốt cơ chế xác thực và role request |
| 2. Danh mục & bệnh nhân | C, D; upload hồ sơ bác sĩ | Gói 1, schema migration |
| 3. Lượt khám & điều phối | E; service trạng thái/quota, hết hạn/no-show | Gói 1–2, hợp đồng thanh toán |
| 4. Tài chính & thông báo | F, notification của H; email và đối soát | Gói 1, API nội bộ của gói 3 |
| 5. Khám & nội dung | G, review của H, I trừ upload bác sĩ | Gói 1–3 và định nghĩa thống kê với gói 4 |

Gói 3 là chủ sở hữu service chuyển trạng thái/quota. Gói 4 gọi service để xác nhận
thanh toán/hủy; gói 5 gọi để start/complete, tránh mỗi người viết logic riêng.
Người phụ trách tích hợp quản lý main.py, dependencies và migrations; thống nhất trước
khi nhiều người sửa cùng file. Mỗi gói tạo routes/<module>_routes.py,
services/<module>_service.py, models/<module>_model.py (truy vấn psycopg),
schemas/<module>_schema.py và tests/test_<module>.py khi cần. Không bắt buộc đủ 4 file
cho module nhỏ; tránh tạo tầng chỉ chuyển tiếp mà không có trách nhiệm.

## 6. Thứ tự triển khai và nghiệm thu

1. Chốt schema, scope USER/DOCTOR/NURSE, vòng đời visit và hợp đồng API.
2. Đăng ký/đăng nhập/quyền + bệnh nhân + khoa/bác sĩ/phòng/ca.
3. ONLINE giữ chỗ → đặt cọc → CONFIRMED; job hết hạn; WALK_IN và check-in.
4. Hàng chờ → bắt đầu khám → record/thuốc → hoàn tất.
5. Hủy/hoàn tiền/no-show/chuyển bác sĩ, review và thông báo.
6. Tin tức, cấu hình, thống kê và kiểm thử xuyên suốt.

Không coi xong khi chỉ có CRUD. Mỗi gói phải có Swagger, validation, kiểm tra quyền
và các test chứng minh nghiệp vụ. Các ca tích hợp bắt buộc: hai người đặt chỗ cuối;
callback lặp; callback muộn; hủy lặp; check-in cùng lúc no-show; chuyển bác sĩ hết quota;
user xem bệnh án người khác; bác sĩ sửa visit không được giao; rollback giữ nguyên
visit/quota/log; job chạy lặp không phát sinh thay đổi lặp.

## 7. Viết code ở đâu

Các đường dẫn dưới đây tính từ thư mục gốc dự án. Các file chưa có cần tạo mới.
Mỗi dòng áp dụng cho các API tương ứng ở mục 3; không tạo cả module trong main.py.

| Module | File nhận API | File nghiệp vụ | File truy vấn PostgreSQL | File kiểm tra dữ liệu |
|---|---|---|---|---|
| A: auth, /me, gửi yêu cầu role | backend/app/routes/auth_routes.py | backend/app/services/auth_service.py | backend/app/models/user_model.py, auth_token_model.py, role_request_model.py | backend/app/schemas/auth_schema.py |
| B: admin users, role approval | backend/app/routes/user_admin_routes.py | backend/app/services/user_admin_service.py | backend/app/models/user_model.py, role_request_model.py | backend/app/schemas/user_admin_schema.py |
| C: patients | backend/app/routes/patient_routes.py | backend/app/services/patient_service.py | backend/app/models/patient_model.py | backend/app/schemas/patient_schema.py |
| D: departments | backend/app/routes/department_routes.py | backend/app/services/department_service.py | backend/app/models/department_model.py | backend/app/schemas/department_schema.py |
| D: doctors/profile | backend/app/routes/doctor_routes.py | backend/app/services/doctor_service.py | backend/app/models/doctor_model.py | backend/app/schemas/doctor_schema.py |
| D: rooms | backend/app/routes/room_routes.py | backend/app/services/room_service.py | backend/app/models/room_model.py | backend/app/schemas/room_schema.py |
| D: schedules/unavailability | backend/app/routes/schedule_routes.py | backend/app/services/schedule_service.py | backend/app/models/schedule_model.py | backend/app/schemas/schedule_schema.py |
| E: online/list/detail/cancel/logs | backend/app/routes/visit_routes.py | backend/app/services/visit_service.py | backend/app/models/visit_model.py, visit_log_model.py | backend/app/schemas/visit_schema.py |
| E: walk-in/check-in/queue/transfer/no-show | backend/app/routes/reception_routes.py | backend/app/services/reception_service.py, visit_service.py | backend/app/models/visit_model.py, schedule_model.py, visit_log_model.py | backend/app/schemas/reception_schema.py |
| E/G: start/complete, record/thuốc | backend/app/routes/medical_record_routes.py | backend/app/services/medical_record_service.py, visit_service.py | backend/app/models/medical_record_model.py, prescription_model.py | backend/app/schemas/medical_record_schema.py |
| F: payment intent/status/webhook/fee/refund | backend/app/routes/payment_routes.py | backend/app/services/payment_service.py | backend/app/models/payment_model.py | backend/app/schemas/payment_schema.py |
| H: reviews | backend/app/routes/review_routes.py | backend/app/services/review_service.py | backend/app/models/review_model.py | backend/app/schemas/review_schema.py |
| H: notifications | backend/app/routes/notification_routes.py | backend/app/services/notification_service.py | backend/app/models/notification_model.py | backend/app/schemas/notification_schema.py |
| I: articles | backend/app/routes/article_routes.py | backend/app/services/article_service.py | backend/app/models/article_model.py | backend/app/schemas/article_schema.py |
| I: upload | backend/app/routes/upload_routes.py | backend/app/services/upload_service.py | Không cần model nếu chỉ lưu ảnh/URL qua doctor/article | backend/app/schemas/upload_schema.py |
| I: configurations | backend/app/routes/configuration_routes.py | backend/app/services/configuration_service.py | backend/app/models/configuration_model.py | backend/app/schemas/configuration_schema.py |
| I: statistics/audit | backend/app/routes/statistics_routes.py | backend/app/services/statistics_service.py | backend/app/models/statistics_model.py, visit_log_model.py | backend/app/schemas/statistics_schema.py |

Phần dùng chung:

| Việc | Viết ở đâu |
|---|---|
| Đọc cấu hình môi trường | backend/app/core/config.py |
| Xác thực phiên/token, decorator kiểm tra quyền | backend/app/core/security.py (tạo mới) |
| Quy tắc trạng thái visit/quyền thao tác | backend/app/core/constants.py (tạo mới); logic thực thi ở visit_service.py |
| Chuẩn lỗi và exception nghiệp vụ | backend/app/core/errors.py (tạo mới), đăng ký handler trong main.py |
| Đăng ký Blueprint của từng module, Swagger, CLI | backend/app/main.py |
| Kết nối và transaction PostgreSQL | backend/app/db/database.py |
| Khởi tạo/seed hiện tại | backend/app/db/db_service.py, init_db.py, seed_db.py |
| Cấu trúc database gốc | database/init_db.sql |
| Nâng cấp schema đã có | database/migrations/ (tạo mới, có số phiên bản và cách chạy) |
| Dữ liệu mẫu | database/sample_data.sql; không đưa nghiệp vụ vào file này |
| Hết hạn giữ chỗ, no-show, nhắc lịch | backend/app/jobs/visit_jobs.py (thư mục/file mới), gọi visit_service/notification_service |
| Retry/đối soát payment | backend/app/jobs/payment_jobs.py (tạo mới) |
| Entry point worker/scheduler | backend/app/jobs/worker.py (tạo mới); service riêng trong docker-compose.yml |
| Kết nối cổng thanh toán | backend/app/integrations/payment_gateway.py (thư mục/file mới) |
| Kết nối dịch vụ email | backend/app/integrations/email_provider.py (tạo mới) |
| Hàm xử lý thời gian/tên file dùng chung | backend/app/utils/ (dùng tên utils, không phải utlis) |
| File upload thực tế | backend/uploads/; cấu hình volume trong docker-compose.yml |
| Thư viện mới | backend/requirements.txt; thống nhất người phụ trách tích hợp |
| Test từng module | backend/tests/test_<module>.py |
| Test toàn bộ luồng online/walk-in | backend/tests/test_visit_flow.py |
| Test tranh chấp quota/callback lặp | backend/tests/test_booking_concurrency.py, test_payment_idempotency.py |

Models hiện dùng psycopg/SQL trực tiếp, không bắt buộc ORM. Khi một service làm nhiều
bước phải cùng transaction, các model nhận cùng connection do service quản lý;
không mở/commit connection riêng cho từng câu lệnh khiến cập nhật bị tách rời.
Các tên file là đề xuất phân công, không phải file đã được tạo hoặc chức năng đã xong.

Schema đã bổ sung role_request, patient.archived_at, nurse_assignment theo ca và
visit.consultation_fee_snapshot/deposit_amount_snapshot. Xem mục 6 trong
HUONG_DAN_CHAY_DU_AN.md để chạy migration và áp dụng quy ước. Thanh toán/email
trong đồ án là mô phỏng, không yêu cầu tích hợp ngân hàng hoặc nhà cung cấp email.
