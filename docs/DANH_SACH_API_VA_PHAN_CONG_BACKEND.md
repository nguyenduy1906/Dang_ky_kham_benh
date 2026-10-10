# Kế hoạch API và phân công backend

**Kiểm thử sau gộp module 10/10/2026:** 23/23 test đạt trên PostgreSQL 17 tạm.
Bao gồm hồi quy lượt khám/quota/log/quyền, luồng bệnh án–thuốc–hoàn tất–bổ sung
với version và lịch sử trước/sau, CRUD danh mục chuyên khoa/phòng và quyền xem
ngừng hoạt động, nhắc lịch lặp không tạo thêm thông báo, kiểm tra đầu vào admin
và seed không ghi đè tài khoản. Bộ test hiện có chưa bao phủ mọi tiêu chí của cả
5 gói. Không reset database hoặc rebuild dịch vụ chính trong lần này.

**Database 09/10/2026:** schema 20 bảng của cả 5 gói đã gộp đầy đủ vào database/init_db.sql; không còn ALTER TABLE nâng cấp bảng cũ. Người dùng chọn khởi tạo lại từ đầu theo [hướng dẫn chạy](HUONG_DAN_CHAY_DU_AN.md). Lần sửa file này chưa reset, nạp mẫu hay rebuild.

**Gói 3:** 14 route đã được triển khai theo [quy tắc đã chốt](QUY_TAC_GOI_3_DA_CHOT.md). Thanh toán xác nhận dùng adapter cùng transaction cho gói 4; bệnh án/hoàn tất thuộc gói 5. Trạng thái xác minh xem [báo cáo triển khai gói 3](BAO_CAO_TRIEN_KHAI_GOI_3.md), không suy ra nghiệm thu chỉ từ việc có route.

Hiện đã có khởi tạo/seed PostgreSQL, 20 bảng, GET /health và Swagger /docs/.
Các API dưới đây là kế hoạch cần triển khai, chưa phải chức năng đã hoàn thành.
Chỉ làm backend và database. Cả 5 gói dùng trực tiếp các đường dẫn nghiệp vụ
ghi bên dưới (ví dụ /auth/login, /me, /patients, /encounters), không thêm tiền tố
/api/v1 hoặc /v1. Đây là quy ước đã chốt ngày 08/10/2026.

## 1. Phạm vi đã thống nhất

- Chỉ USER tự đăng ký; backend tự gán USER, không nhận role từ client.
- ADMIN tạo tài khoản DOCTOR/RECEPTIONIST/NURSE sau khi kiểm tra hợp đồng bên ngoài.
  Không lưu hợp đồng và không triển khai luồng USER xin đổi vai trò. role_request
  đã có trong schema nhưng chưa sử dụng; chưa xóa bảng trong lần cập nhật này.
- Các tài khoản dùng profile chung trong users; bác sĩ có doctor_profile bổ sung.
  Chỉ bác sĩ có avatar. Hồ sơ bệnh nhân là patient, khác hồ sơ tài khoản.
- BHYT chỉ lưu mã thẻ trong patient.health_insurance, không tính quyền lợi BHYT.
- Thanh toán, hoàn tiền, email/OTP là giả lập; không tích hợp ngân hàng/email thật.
- Cấu hình thống nhất 10/10/2026: `SEND_EMAIL=1` bật log email/OTP và API kết quả thanh toán giả lập. Mẫu `.env.example` đặt `1`; thiếu biến hoặc khác `1` thì tắt. Worker dùng email riêng `medical_booking@gmail.com` (LOCKED, không đăng nhập).
- encounter là lượt khám chung cho ONLINE và WALK_IN; hai luồng xử lý riêng.

## 2. Cách chia việc

Đề xuất 5 gói tương ứng 5 người nếu nhóm có 5 thành viên. Nếu ít người hơn có thể
kiêm gói, nhưng mỗi module vẫn chỉ có một người chịu trách nhiệm chính.
Các file ghi bên dưới là vị trí cần tạo, không có nghĩa file/API đã tồn tại.

| Gói | Trách nhiệm chính | Bảng phụ trách | Phụ thuộc |
|---|---|---|---|
| 1 | Tài khoản, quyền và tích hợp nền tảng | users, role, auth_token | Làm trước; cung cấp xác thực/quyền cho các gói |
| 2 | Hồ sơ bệnh nhân, danh mục và ca làm việc | patient, department, doctor_profile, room, work_schedule, nurse_assignment | Gói 1 |
| 3 | Đặt lịch, tiếp nhận và điều phối | encounter, encounter_status_log, encounter_transfer_log | Gói 1–2; phối hợp gói 4 |
| 4 | Thanh toán giả lập và thông báo | payment, notification | Gói 1; dùng service lượt khám của gói 3 |
| 5 | Khám bệnh, nội dung và báo cáo | medical_record, prescription_item, review, article, system_configuration | Gói 1–3; thống kê tiền phối hợp gói 4 |

### Gói 1 — Tài khoản và nền tảng

**API:**

- POST /auth/register, /auth/login, /auth/logout.
- POST /auth/forgot-password, /auth/verify-otp, /auth/reset-password.
- POST /auth/email-verification/request, /auth/email-verification/confirm.
- GET/PATCH /me; POST /me/change-password.
- GET/POST /admin/users; GET/PATCH /admin/users/{id}.
- PATCH /admin/users/{id}/account-status; DELETE /admin/users/{id} (soft delete).
- GET /admin/roles. Thêm /auth/refresh nếu nhóm chọn cơ chế refresh token.

**File chính:** routes/auth_routes.py, routes/user_admin_routes.py;
services/auth_service.py (xác thực, hồ sơ và quản trị tài khoản);
models/user_model.py (users, role và auth_token); schemas/auth_schema.py
(xác thực, hồ sơ và quản trị tài khoản).
Các đường dẫn này nằm trong backend/app/.

**Phần dùng chung do gói 1 tích hợp:** core/security.py, core/errors.py,
core/constants.py, đăng ký Blueprint/error handler/Swagger trong main.py,
requirements.txt và quy trình khởi tạo database. Thống nhất session hoặc JWT trước
khi viết login; thiết kế logout/thu hồi phiên theo lựa chọn, không để mỗi người tự làm.

**Nghiệm thu:** đăng ký không nâng quyền; mật khẩu hash; tài khoản khóa/xóa không
đăng nhập; OTP hết hạn/đã dùng bị từ chối; email và OTP không lộ qua API public.
Cung cấp adapter giả lập chỉ dùng môi trường demo để lấy mã/link thử nghiệm.

### Gói 2 — Bệnh nhân, danh mục, lịch và phân công

**API:**

- GET/POST /patients; GET/PATCH /patients/{id}; POST /patients/{id}/archive.
- GET /patients/{id}/encounters.
- GET /departments, /departments/{id}; POST /admin/departments;
  PATCH /admin/departments/{id}.
- GET /doctors, /doctors/{id}; POST /admin/doctors; PATCH /admin/doctors/{id}.
- GET/PATCH /doctor/profile; POST /doctor/profile/avatar.
- GET /rooms; POST /admin/rooms; PATCH /admin/rooms/{id}.
- GET /doctors/{id}/schedules, /doctor/schedules, /admin/schedules.
- POST /admin/schedules; PATCH /admin/schedules/{id}.
- POST /doctor/schedules/{id}/unavailability.
- GET/POST /admin/nurse-assignments; POST /admin/nurse-assignments/{id}/revoke.
- GET /nurse/assignments.

**File chính:** routes/{patient,catalog,doctor,schedule}_routes.py;
services/{patient,catalog,doctor,schedule}_service.py;
models/{patient,catalog,doctor,schedule,nurse_assignment}_model.py;
schemas patient/catalog/schedule tương ứng; hồ sơ bác sĩ và phân công y tá
dùng chung `schemas/staff_schema.py`. Dùng thư mục backend/app/.

**Nghiệm thu:** USER chỉ quản lý hồ sơ mình sở hữu; walk-in không cần tài khoản;
archive không mất bệnh án; BHYT được lưu/cập nhật; bác sĩ/phòng không chồng ca;
không hạ quota dưới booked_count; y tá được giao phải có vai trò NURSE.
Upload avatar kiểm tra nội dung/kích thước, sinh tên file, lưu bền vững qua volume.
Ca có lượt khám không được sửa tùy ý làm sai lịch; phối hợp gói 3 xử lý ca báo nghỉ.

**Trạng thái đối chiếu ngày 08/10/2026:** đã có route cho đủ 30 API gói 2.
Nhóm phân công y tá đã bổ sung route/service/model/schema và kiểm thử PostgreSQL:
ADMIN tạo/xem/thu hồi; chỉ nhận tài khoản NURSE đang hoạt động, đã duyệt;
phân công đang hiệu lực trùng trả 409 kể cả hai yêu cầu đồng thời; thu hồi giữ
người/thời điểm và cho phép tạo phân công mới. NURSE chỉ xem phân công của mình,
mặc định chưa thu hồi; include_revoked=true cho phép xem lịch sử.
Kiểm thử: backend/tests/test_nurse_assignment.py và bộ hồi quy test_postgres.py,
7 test đạt trên PostgreSQL tạm. Chưa nghiệm thu toàn bộ 30 API: còn cần kiểm tra
quyền xem bệnh nhân/lịch sử theo phân công, phân trang lịch công khai, xác minh
ảnh avatar hợp lệ và tích hợp xử lý ca báo nghỉ với gói 3.

Cập nhật sau kiểm thử Swagger: đã sửa quyền NURSE theo ca chưa thu hồi (cả
danh sách/chi tiết patient và lịch sử encounter), tổng số/phân trang lịch công
khai bỏ CLOSED trong SQL, và xác minh/giải mã avatar bằng Pillow. 10 test hồi quy
đạt; thử lại Swagger lần lượt trả 404 khi hết quyền, total=0 khi lọc CLOSED,
400 INVALID_IMAGE với PNG giả. Mục tham số page/page_size trong Swagger lịch
công khai chưa sửa theo yêu cầu người dùng. Chi tiết và giới hạn còn lại xem
BAO_CAO_KIEM_THU_GOI_2_SWAGGER.md; chưa nghiệm thu tích hợp ca báo nghỉ gói 3.

Ví dụ body POST /admin/nurse-assignments (Bearer token ADMIN):
`{"nurse_id": 12, "schedule_id": 1, "note": "Hỗ trợ trong ca"}`.
ID phải lấy từ dữ liệu thực tế; assigned_by_id/assigned_at/revoked_by_id/revoked_at
do server xác định, không nhận từ body. Thu hồi dùng
POST /admin/nurse-assignments/{id}/revoke, không cần body; thu hồi lặp trả 409.
Danh sách hỗ trợ schedule_id, page, page_size, include_revoked; ADMIN lọc thêm
nurse_id. GET /nurse/assignments luôn dùng ID y tá đăng nhập.

Chạy toàn bộ kiểm thử trong môi trường Docker đã có backend và PostgreSQL:
`docker compose exec -e RUN_POSTGRES_TESTS=1 backend python -m unittest discover -s backend/tests -v`.
Kiểm thử dùng schema tạm và tự dọn; không cần thay schema chính để thêm các API này.

### Gói 3 — Đặt lịch và tiếp nhận

**API:**

- POST /encounters/online; GET /encounters, /encounters/{id}.
- POST /encounters/{id}/cancel.
- GET /encounters/{id}/status-history, /encounters/{id}/transfer-history.
- POST /staff/encounters/walk-in; POST /staff/encounters/{id}/check-in.
- GET /staff/queues; GET /staff/encounters/{id}/transfer-options.
- POST /staff/encounters/{id}/transfer, /staff/encounters/{id}/no-show.
- GET /staff/schedules/{id}/affected-encounters.
- POST /doctor/encounters/{id}/start (dùng chung với gói 5).

**File chính:** routes/encounter_routes.py;
services/encounter_service.py, reception_service.py; models/encounter_model.py
(gồm SQL lượt khám và log trạng thái/chuyển bác sĩ); schemas/encounter_schema.py
(gồm online, walk-in và chuyển bác sĩ); utils/worker.py.
Tất cả nằm trong backend/app/.

**Luồng online:** HOLDING → thanh toán cọc giả lập → CONFIRMED → CHECKED_IN
→ IN_PROGRESS → COMPLETED. HOLDING quá hạn → EXPIRED, trả chỗ đúng một lần.
Lịch gồm ca sáng/chiều; POST /encounters/online chỉ nhận khi còn ít nhất 5 giờ trước giờ bắt đầu ca (Asia/Saigon), đúng mốc được nhận, sau mốc và trong ca trả 409/SCHEDULE_TOO_LATE. Lượt đã HOLDING vẫn có 10 phút thanh toán. Cập nhật này theo quyết định 09/10/2026.

**Luồng trực tiếp:** bệnh nhân không tự chọn ca; lễ tân/hệ thống chọn ca còn chỗ,
tạo WALK_IN với CHECKED_IN và số sau các lịch online đã dành trong ca
→ IN_PROGRESS → COMPLETED. Ca hiện tại đầy/đóng thì xếp người mới vào ca sau. Không giữ chỗ chờ cọc.
Người đã đặt online đến check-in vẫn dùng encounter cũ, không tạo WALK_IN mới.

**Nghiệm thu:** hai người đặt chỗ cuối chỉ một người thành công; giữ/hủy/hết hạn
cùng transaction với quota và log; check-in lặp không cấp thêm số; chuyển bác sĩ
khóa ca cũ/mới theo thứ tự cố định và không vượt quota. Gói 3 sở hữu mọi thay đổi
encounter_status/booked_count; các gói khác gọi service, không tự UPDATE các trường đó.
Job nền chạy worker riêng, không tạo scheduler trong mỗi Gunicorn worker.

### Gói 4 — Thanh toán giả lập và thông báo

**Trạng thái code:** đã triển khai 10 API, Swagger, xử lý tiền cùng transaction gói 3 và thông báo/nhắc lịch chống lặp. Người dùng chốt: hủy trước từ 12 giờ hoàn 50% cọc, dưới 12 giờ mất cọc; nguyên nhân bệnh viện/bác sĩ hoàn toàn bộ. Đối chiếu [báo cáo gói 4](BAO_CAO_TRIEN_KHAI_GOI_4.md). Chưa chạy kiểm thử theo yêu cầu chỉ viết code.

**API:**

- GET /encounters/{id}/payments; GET /payments/{id}.
- POST /encounters/{id}/payment-intents (phiên thanh toán mô phỏng).
- POST /demo/payments/{id}/result (mô phỏng SUCCESS/FAILED, chỉ môi trường demo,
  kiểm tra người thao tác và payment; không nhận số tiền tùy ý).
- POST /staff/encounters/{id}/exam-fees.
- POST /admin/payments/{id}/refund (giả lập).
- GET /notifications, /notifications/unread-count.
- PATCH /notifications/{id}/read; POST /notifications/read-all.

**File chính:** routes/payment_routes.py, notification_routes.py;
services/payment_service.py, notification_service.py; models/payment_model.py,
notification_model.py; validator thanh toán dùng schemas/encounter_schema.py,
thông báo dùng schemas/notification_schema.py;
utils/worker.py để tạo thông báo nhắc lịch. Dùng backend/app/.

**Nghiệm thu:** server chốt tiền, lưu snapshot; deposit + EXAM_FEE phần còn lại
bằng giá khám; walk-in deposit = 0; mô phỏng kết quả lặp không thu hai lần hoặc
xác nhận hai lần; thanh toán muộn sau EXPIRED không tự giữ lại ca đã hết chỗ.
Hủy và hoàn tiền là hai thao tác riêng. Thông báo dùng reference_type ENCOUNTER;
người dùng chỉ đọc thông báo của mình; nhắc lịch không gửi lặp.
Không xây webhook ngân hàng hay kết nối nhà cung cấp email thật.

### Gói 5 — Khám, nội dung và thống kê

**Trạng thái code:** đã triển khai 18 API, Swagger và tích hợp complete với gói 3. Người dùng đồng ý bổ sung/sửa bệnh án đã hoàn tất trên cùng bệnh án, bắt buộc lý do/lịch sử trước-sau, giữ COMPLETED; lần khám mới tạo encounter mới. Version chống sửa từ dữ liệu cũ; thống kê tiền dùng số REFUND thực tế. Xem [báo cáo gói 5](BAO_CAO_TRIEN_KHAI_GOI_5.md). Chưa kiểm thử/rebuild theo yêu cầu chỉ viết code.

**API:**

- GET /encounters/{id}/medical-record.
- PUT /doctor/encounters/{id}/medical-record.
- GET /medical-records/{id}/prescription-items.
- PUT /doctor/medical-records/{id}/prescription-items.
- POST /doctor/encounters/{id}/complete.
- POST /encounters/{id}/review; GET /doctors/{id}/reviews.
- GET /articles, /articles/{slug}; GET/POST /admin/articles;
  PATCH /admin/articles/{id}.
- GET /admin/configurations; PATCH /admin/configurations/{key}.
- GET /admin/statistics/encounters, /admin/statistics/payments,
  /admin/statistics/reviews, /admin/audit/encounters.

**File chính:** routes/{medical_record,review,article,configuration,statistics}_routes.py;
services và schemas tương ứng; models/medical_record_model.py (gồm bệnh án và thuốc),
article_model.py, configuration_model.py,
statistics_model.py. Dùng backend/app/.

**Gộp A/B/C ngày 11/10/2026:** tài khoản/token dùng model `user_model`, dữ liệu
xác thực/quản trị dùng schema `auth_schema`, nghiệp vụ xác thực/quản trị dùng
service `auth_service`. Phân công y tá dùng chung route/service `schedule`,
model/schema phân công vẫn riêng. SQL và validator đánh giá đặt trong
`medical_record_model.py` và `medical_record_schema.py`, service/route đánh giá
vẫn riêng. Chỉ chuyển nguyên hàm và cập nhật import/đăng ký Blueprint; giữ nguyên
tên hàm, SQL, quyền, transaction và endpoint. Không thay schema database.

**Gộp D1/D2 ngày 11/10/2026 (thay vị trí schema ghi ở mục A/B/C):** hồ sơ bác sĩ
và phân công y tá dùng `staff_schema.py`; validator thanh toán đặt trong
`encounter_schema.py` cùng validator lượt khám. Giữ nguyên nội dung hàm và các
giá trị cấu hình; chỉ cập nhật import. Service/model/route giữ như trước.

**Gộp file 10/10/2026:** SQL bệnh án/thuốc dùng chung `medical_record_model.py`,
kiểm tra body bệnh án/thuốc dùng `medical_record_schema.py`; SQL lượt khám/log dùng
`encounter_model.py`, kiểm tra body online/walk-in/chuyển bác sĩ dùng
`encounter_schema.py`. Giữ nguyên API, schema database, quyền, transaction,
version và lịch sử sửa. Chuyên khoa/phòng dùng các module `catalog_*` tương ứng
trong routes/services/models/schemas. Tác vụ hết hạn giữ chỗ và nhắc lịch gộp vào
`utils/worker.py`; worker vẫn chạy process riêng, mỗi tác vụ giữ transaction riêng.
Tạo admin ban đầu dùng `python -m backend.app.db.seed_db --admin`, xử lý trong
`db/db_service.py`, không ghi đè tài khoản đã có.

**Nghiệm thu:** bác sĩ chỉ sửa lượt khám được giao; mỗi encounter có một bệnh án;
thuốc có số lượng dương; complete qua service của gói 3; chỉ đánh giá sau hoàn tất;
không công khai bệnh án trong review. Thống kê tiền không đếm trùng cọc và giá khám;
đổi giá bác sĩ không làm thay đổi snapshot của lượt khám cũ.

## 3. Quy ước phối hợp và file dùng chung

| File/phần | Người chịu trách nhiệm |
|---|---|
| main.py, requirements.txt, core/security.py, core/errors.py | Gói 1 tích hợp thay đổi của cả nhóm |
| core/constants.py: trạng thái và quyền | Gói 1 phối hợp gói 3; thống nhất một bộ |
| db/database.py: connection/transaction | Gói 1; các model nhận cùng connection trong nghiệp vụ nhiều bước |
| database/init_db.sql, sample_data.sql, erd.html | Một người tích hợp database (đề xuất gói 1); các gói gửi thay đổi cần thiết |
| encounter_service.py và quota/log | Gói 3, duy nhất một đầu mối |
| Dockerfile, docker-compose.yml, hướng dẫn chạy | Gói 1 tích hợp; gói 2 gửi yêu cầu volume avatar |
| Kiểm thử từng module | Người phụ trách gói đó |
| Kiểm thử xuyên suốt | Cả nhóm, gói 1 chạy kiểm tra tích hợp |

- Thống nhất response và lỗi 400/401/403/404/409 trước khi chia module.
- Danh sách có phân trang; thời gian lưu UTC, hiển thị Asia/Saigon.
- Kiểm tra quyền trên từng tài nguyên, không chỉ role. NURSE cần phân công còn hiệu lực.
- Không trả password_hash/token_hash; PATCH có danh sách trường được sửa.
- Không cung cấp PATCH trạng thái tùy ý. Action gọi service chuyển trạng thái.
- Không commit connection riêng cho mỗi query trong nghiệp vụ nhiều bước.
- Models dùng psycopg/SQL trực tiếp; không bắt buộc ORM hoặc tạo tầng chỉ chuyển tiếp.
- Mỗi người đăng ký Blueprint qua gói 1, không dồn toàn bộ API vào main.py.
- Sau đổi SQL, cập nhật schema cuối cùng, ERD và dữ liệu mẫu; kiểm tra trên database tạo mới.

## 4. Thứ tự triển khai và đầu ra bàn giao

1. Gói 1 chốt xác thực, quyền, lỗi/response; nhóm chốt các quy tắc mục 5.
2. Gói 1 làm tài khoản; gói 2 làm hồ sơ/danh mục/ca và cung cấp dữ liệu hợp lệ.
3. Gói 3 làm online/walk-in/check-in; gói 4 nối mô phỏng cọc, hủy và thông báo.
4. Gói 5 làm khám/thuốc/hoàn tất; gói 3 và 5 cùng kiểm tra hàng chờ → khám.
5. Hoàn thiện báo cáo, tin tức, avatar, nhắc lịch và kiểm thử tích hợp.

Mỗi gói bàn giao: code trong file phụ trách, mô tả Swagger request/response/quyền,
kiểm thử nghiệp vụ, ví dụ gọi API và hướng dẫn tạo lại database nếu có thay đổi schema.
Không coi module hoàn thành chỉ vì CRUD chạy được.

Ca tích hợp bắt buộc: tranh chấp chỗ cuối; thanh toán mô phỏng lặp/muộn; hủy lặp;
check-in cùng lúc no-show; chuyển sang ca hết quota; USER xem bệnh án người khác;
bác sĩ/y tá thao tác ngoài phân công; rollback giữ nguyên encounter/quota/log;
job chạy lặp không trả quota hoặc gửi thông báo nhiều lần.

## 5. Quy tắc cần nhóm chốt trước khi code

- Mức cọc: dữ liệu mẫu dùng 30%, chưa coi là chính sách bắt buộc của hệ thống.
- Hoàn cọc đã chốt ở gói 4: bệnh nhân hủy từ 12 giờ trước giờ hẹn hoàn 50%; dưới 12 giờ/no-show không hoàn; nguyên nhân bệnh viện/bác sĩ hoàn toàn bộ. Giờ tham chiếu lưu tại thời điểm hủy.
- Check-in sớm/trễ và thời điểm tính no-show.
- Walk-in đã chốt được hệ thống gắn ca. Online dành số khi xác nhận, check-in giữ
  số đó. Cần chốt việc chuyển người đang chờ sang ca sau và nhận online muộn.
  Schema bắt buộc schedule_id NOT NULL; API mới phải gắn ca theo luồng đã chốt.
- Y tá được sửa những trường/thao tác nào; chưa cho sửa chẩn đoán và đơn thuốc.
- Bệnh án đã chốt ở gói 5: bác sĩ phụ trách bổ sung/sửa cùng record, có lý do/version và lưu trước-sau; không mở lại COMPLETED. Lần khám mới tạo encounter mới.
- Chuyển bác sĩ khác giá: đề xuất giữ giá đã chốt cho phạm vi đồ án.
- Job tự động dùng danh tính hệ thống thế nào: changed_by_id hiện bắt buộc users;
  chưa có tài khoản hệ thống trong dữ liệu mẫu. Không giả danh người thao tác.

Hướng dẫn chạy và nâng cấp: HUONG_DAN_CHAY_DU_AN.md.
