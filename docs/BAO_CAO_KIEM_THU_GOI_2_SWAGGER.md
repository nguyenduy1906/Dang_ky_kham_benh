# Báo cáo kiểm thử API gói 2 qua Swagger

Ngày kiểm thử: 08/10/2026 (Asia/Saigon).

## Cập nhật sau sửa lỗi 1–3

Theo yêu cầu người dùng, đã sửa lỗi 1–3; mục 4 (tham số Swagger) giữ nguyên.
Các mục lỗi và kết luận ở phần báo cáo ban đầu bên dưới là kết quả trước sửa.

- NURSE: danh sách/chi tiết patient chỉ cho phép hồ sơ có encounter trong ca được
  phân công chưa thu hồi; lịch sử chỉ trả encounter thuộc ca được giao. Thu hồi
  hết phân công liên quan thì chi tiết/lịch sử trả 404 PATIENT_NOT_FOUND.
- Lịch công khai: loại CLOSED ngay trong WHERE dùng chung cho COUNT và phân
  trang. Truy vấn status=CLOSED trả items=[], total=0; danh sách ADMIN vẫn thấy ca đóng.
- Avatar: dùng Pillow 12.3.0 để verify và giải mã các khung ảnh JPEG/PNG/WebP.
  File giả/hỏng bị từ chối trước ghi file và trước cập nhật profile. Giữ giới
  hạn 2 MB và tên ngẫu nhiên; ảnh bị từ chối không xóa avatar cũ.

Kiểm thử tự động: 10/10 test đạt trên PostgreSQL tạm, gồm 7 hồi quy cũ và 3 test
mới trong backend/tests/test_package2_fixes.py. Test mới kiểm tra hồ sơ có lượt
khám ở nhiều ca, thu hồi từng ca, thu hồi hết quyền, tổng số/dữ liệu qua hai trang,
ba định dạng ảnh hợp lệ, magic bytes giả, ảnh bị cắt và giới hạn dung lượng.

Kiểm tra lại bằng Try it out / Execute tại http://localhost:5001/docs/:

| Tình huống sau sửa | Kết quả |
|---|---|
| ADMIN thu hồi phân công ca 2 | 200 |
| NURSE xem lịch sử patient 2 sau thu hồi | 404 PATIENT_NOT_FOUND |
| GET /doctors/1/schedules?status=CLOSED | 200; items=[], total=0 |
| POST /doctor/profile/avatar với file 8 byte chữ ký PNG | 400 INVALID_IMAGE |

Bằng chứng sau sửa: test-evidence/goi-2-swagger/fix-results.json,
nurse-revoked-fixed.jpg, schedule-total-fixed.jpg, avatar-invalid-fixed.jpg.
Không thay schema/database chính. Những giới hạn nghiệm thu khác trong báo cáo
và mục 4 vẫn còn; không suy ra toàn bộ gói 2 đã nghiệm thu chỉ từ ba bản sửa này.

## Phạm vi và môi trường

Đã gọi đủ 30 API theo DANH_SACH_API_VA_PHAN_CONG_BACKEND.md bằng nút
Try it out / Execute trên Swagger UI, và thực hiện các lần gọi bổ sung để kiểm
tra dữ liệu sai, quyền và các điều kiện nghiệp vụ. Mã 2xx ở ca hợp lệ không đồng
nghĩa toàn bộ nghiệp vụ đã đạt nghiệm thu.

Trang http://localhost:5000/docs/ mở được nhưng database chính có 0 tài khoản;
đăng nhập admin mẫu trả 401 INVALID_CREDENTIALS. Không seed hoặc sửa database này.
Kiểm thử có dữ liệu được thực hiện tại http://localhost:5001/docs/ bằng source
hiện tại, image medical-booking-backend, PostgreSQL 17 tạm không gắn volume,
sample_data.sql và SECRET_KEY riêng chỉ dùng kiểm thử. Các tài khoản/thông tin
bệnh nhân là dữ liệu mẫu của đồ án. API đăng nhập cũng được gọi qua Swagger.

Fixture bổ sung qua SQL trong database tạm: tài khoản DOCTOR chưa có profile
(ID 16); dời ca 1 sang 10/10/2026 để kiểm tra điều kiện không sửa ca quá khứ;
đặt max_quota=3, booked_count=2 để kiểm tra guard quota (fixture này chỉ kiểm tra
guard, không chứng minh đồng bộ quota với encounter của gói 3). Những API tạo,
sửa và action trong các bảng dưới đây đều được gọi qua UI Swagger.

## Kết quả 30 API cơ bản

| Nhóm | API | Phản hồi ca hợp lệ |
|---|---|---|
| Bệnh nhân | GET /patients | 200 |
| Bệnh nhân | POST /patients | 201; walk-in user_id=NULL, USER được gán chủ sở hữu từ token |
| Bệnh nhân | GET /patients/{id} | 200 |
| Bệnh nhân | PATCH /patients/{id} | 200; health_insurance đổi sang DN9876543210 |
| Bệnh nhân | POST /patients/{id}/archive | 200; GET lại vẫn tồn tại, is_archived=true |
| Bệnh nhân | GET /patients/{id}/encounters | 200; có lịch sử mẫu; lỗi quyền bên dưới |
| Chuyên khoa | GET /departments | 200 |
| Chuyên khoa | GET /departments/{id} | 200; trả thông tin đã cập nhật |
| Chuyên khoa | POST /admin/departments | 201 |
| Chuyên khoa | PATCH /admin/departments/{id} | 200 |
| Bác sĩ | GET /doctors | 200; public không trả email/phone/user_id |
| Bác sĩ | GET /doctors/{id} | 200 |
| Bác sĩ | POST /admin/doctors | 201; tạo profile cho tài khoản DOCTOR fixture |
| Bác sĩ | PATCH /admin/doctors/{id} | 200; đổi phí khám |
| Bác sĩ | GET /doctor/profile | 200 |
| Bác sĩ | PATCH /doctor/profile | 200; đổi introduction |
| Bác sĩ | POST /doctor/profile/avatar | 200 với PNG; ảnh giả cũng bị chấp nhận, xem lỗi bên dưới |
| Phòng | GET /rooms | 200 |
| Phòng | POST /admin/rooms | 201 |
| Phòng | PATCH /admin/rooms/{id} | 200 |
| Ca | GET /doctors/{id}/schedules | 200; lỗi total khi lọc CLOSED |
| Ca | GET /doctor/schedules | 200 |
| Ca | GET /admin/schedules | 200 |
| Ca | POST /admin/schedules | 201 |
| Ca | PATCH /admin/schedules/{id} | 200 |
| Ca | POST /doctor/schedules/{id}/unavailability | 200; UNAVAILABLE, lý do được lưu, affected_encounters=0 |
| Y tá | GET /admin/nurse-assignments | 200 |
| Y tá | POST /admin/nurse-assignments | 201 |
| Y tá | POST /admin/nurse-assignments/{id}/revoke | 200; lưu revoked_at và revoked_by_id |
| Y tá | GET /nurse/assignments | 200; trả phân công của NURSE đăng nhập |

## Các ca từ chối đã kiểm tra đạt

| Tình huống | Thực tế |
|---|---|
| Hai ca chồng giờ cùng bác sĩ | 409 DOCTOR_SCHEDULE_OVERLAP |
| Hai ca chồng giờ cùng phòng | 409 ROOM_SCHEDULE_OVERLAP |
| Hạ max_quota xuống 1 khi booked_count=2 | 409 QUOTA_BELOW_BOOKED |
| Đổi giờ ca đã có lượt khám | 409 SCHEDULE_HAS_ENCOUNTERS |
| Phân công NURSE trùng cùng ca | 409 DUPLICATE_NURSE_ASSIGNMENT |
| Phân công tài khoản USER làm y tá | 400 NOT_A_NURSE |
| Thu hồi phân công lần hai | 409 ASSIGNMENT_ALREADY_REVOKED |
| Phân công lại sau thu hồi | 201, assignment_id mới |
| NURSE gọi GET /admin/nurse-assignments | 403 FORBIDDEN |
| USER xem/sửa hồ sơ người khác | 404 PATIENT_NOT_FOUND |
| USER gửi user_id=5 lúc tạo patient | 201 nhưng user_id thực tế=4 theo người đăng nhập |

Lần đầu thử quota=1 khi booked_count=1 trả 200 là đúng (bằng quota), sau đó mới
tạo fixture booked_count=2 và xác minh 409. Lần đầu đọc lịch sử bệnh nhân ca 2
bằng NURSE vẫn còn phân công nên 200 là hợp lệ; chỉ ca sau thu hồi phân công ca 2
mới xác nhận lỗi quyền. Hai nhãn ban đầu trong results.json không được hiểu là
kết luận lỗi hoặc kết luận đạt của điều kiện chưa tồn tại.

## Lỗi đã tái hiện cần sửa

### 1. NURSE vẫn xem được lịch sử sau khi thu hồi phân công

- ADMIN thu hồi assignment_id=2 của nurse_id=3, schedule_id=2: 200,
  revoked_at/revoked_by_id được lưu.
- Đăng nhập NURSE 3, gọi GET /patients/2/encounters: vẫn 200, trả encounter_id=2
  thuộc schedule_id=2, doctor_profile_id=2.
- Mong đợi: kiểm tra phân công còn hiệu lực và không trả lượt khám ngoài phạm vi.
- Code liên quan: backend/app/services/patient_service.py (_load_visible,
  list_patients, list_encounters) hiện kiểm tra STAFF_READ theo role.
- Bằng chứng: test-evidence/goi-2-swagger/nurse-revoked-access.jpg.

### 2. Tổng số lịch công khai không khớp bộ lọc hiển thị

- Tạo ca 12, đổi schedule_status=CLOSED.
- GET /doctors/1/schedules?status=CLOSED qua Swagger trả 200,
  items=[], page=1, page_size=20, total=1.
- Lịch công khai có quy tắc ẩn ca CLOSED nhưng COUNT vẫn tính ca này.
- Code liên quan: backend/app/services/schedule_service.py list_doctor_public
  lọc CLOSED sau khi model COUNT/LIMIT/OFFSET.
- Bằng chứng: test-evidence/goi-2-swagger/schedule-total-mismatch.jpg.

### 3. File không phải ảnh hợp lệ vẫn được chấp nhận làm avatar

- Chọn avatar-invalid.png chỉ chứa 8 byte chữ ký PNG, không có cấu trúc ảnh.
- POST /doctor/profile/avatar qua Swagger trả 200 và avatar_url mới.
- Mong đợi: 400 INVALID_IMAGE; cần xác minh ảnh giải mã hợp lệ, không chỉ magic bytes.
- Code liên quan: backend/app/core/uploads.py detect_image_type/save_avatar.
- Bằng chứng: test-evidence/goi-2-swagger/avatar-invalid-accepted.jpg.

### 4. Swagger thiếu tham số phân trang của lịch công khai

GET /doctors/{id}/schedules trên UI chỉ có doctor_profile_id, from_date, to_date,
status; không có page/page_size dù backend hỗ trợ và response trả hai trường này.
Không thể thử page_size=1 bằng form Swagger hiện tại. Cần bổ sung mô tả query
parameters trong backend/app/routes/schedule_routes.py.

## Giới hạn xác minh

- Chưa kiểm thử hết mọi tổ hợp field/filter/role của cả 30 API.
- Chưa kiểm tra avatar >2 MB hoặc tính bền vững sau tạo lại container bằng UI.
- Archive được thử trên hồ sơ mới không có bệnh án; đã xác minh hồ sơ vẫn tồn tại,
  chưa chứng minh bảo toàn một chuỗi bệnh án/thanh toán thực tế trong lần UI này.
- Báo nghỉ thử trên ca không có encounter; chưa tích hợp xử lý lượt khám bị ảnh
  hưởng với gói 3 hoặc thông báo gói 4.
- Chưa chứng minh ca/bệnh nhân archive bị từ chối trong luồng đặt lịch gói 3.
- Tranh chấp phân công đồng thời đã đạt trong unittest PostgreSQL ở lần trước,
  không được coi là đã tái hiện đồng thời bằng Swagger trong lần này.
- Đổi phí bác sĩ đã thử; chưa đối chiếu snapshot giá của encounter cũ bằng UI.

Kết luận: đủ route và gọi được 30/30 API; các ca từ chối ở bảng trên đạt. Chưa
đạt nghiệm thu toàn bộ gói 2 vì còn ba lỗi hành vi và thiếu tham số Swagger.
Lần này chỉ kiểm thử và ghi báo cáo, chưa sửa các lỗi vừa tái hiện.

Kết quả từng lần gọi: test-evidence/goi-2-swagger/results.json (không lưu token).
Database/container kiểm thử đã được dọn; database chính giữ nguyên. Trình duyệt
được trả về http://localhost:5000/docs/.
