# Tổng hợp thay đổi backend — cập nhật 11/10/2026

**Cấu trúc hiện tại đã được chủ đồ án duyệt:** tổ chức theo 12 nhóm chức năng, mỗi nhóm có `routes.py`, `validators.py`, `service.py`, `queries.py`. Xem [CAU_TRUC_BACKEND.md](CAU_TRUC_BACKEND.md) và mục 19 bên dưới. Mã ứng dụng có 80 file Python. Các phần 1–18 ghi lịch sử những đợt trước; tên/vị trí module ở các ghi chú cũ phía dưới không thay thế bảng hiện tại.

**Tên tiện ích hiện tại theo quyết định mới nhất:** `backend/app/utils/database_helpers.py`, `backend/app/utils/mail.py`, `backend/app/utils/date.py` lần lượt thay `_sql.py`, `mail_adapter.py`, `time_utils.py`. Xem mục 17 cho phạm vi và kiểm tra. Tên/vị trí trong các mục trước là lịch sử của từng đợt.

**Tên mới nhất của helper Swagger:** `backend/app/utils/swagger_helpers.py`, đổi từ `utils/package5_docs.py` theo yêu cầu chủ đồ án; xem mục 16. `_sql.py` và `worker.py` chưa đổi tên. Các tên ở mục 14/15 ghi lại lịch sử trước lần đổi này.

**Bổ sung vị trí hiện tại của bốn tiện ích:** `utils/time_utils.py`, `utils/validation.py`, `utils/uploads.py`, `utils/mail_adapter.py` đã nhận nguyên nội dung từ các vị trí cũ trong `core`/`schemas`. Xem mục 15 cho phạm vi và kiểm tra riêng. Các dòng mô tả sửa mail adapter ở đợt trước bên dưới dùng vị trí cũ để ghi lịch sử; đường dẫn hiện tại là `backend/app/utils/mail_adapter.py`.

**Cập nhật cấu trúc mới theo yêu cầu chủ đồ án:** `models/user_model.py` đổi thành `models/auth_model.py`; `models/_sql.py` và `routes/package5_docs.py` chuyển lần lượt sang `utils/_sql.py`, `utils/package5_docs.py`. Các đường dẫn đều thuộc `backend/app`. Quyết định này thay thế vị trí module trước đây; nguồn lịch sử trong bảng chuyển/gộp vẫn ghi tên ở thời điểm cũ. Phạm vi và kiểm tra của lần đổi này nằm ở mục 14.

## 1. Phạm vi báo cáo

Báo cáo này tập hợp toàn bộ thay đổi của đợt làm việc 10–11/10/2026 trong cuộc trao đổi, gồm các tên/giá trị chủ đồ án đã sửa, phần đồng bộ theo các tên mới, các lần gộp file đã duyệt và trạng thái cuối cùng ngày 11/10/2026. Đây là một tài liệu tổng hợp để tra cứu toàn bộ đợt thay đổi, thay thế nội dung báo cáo A/B/C và D1/D2 trước đây trong chính file này.

Nguồn đối chiếu: yêu cầu/phê duyệt trong cuộc trao đổi, code hiện tại, `git status`, diff so với HEAD và kết quả công cụ kiểm thử đã chạy. Các sửa đổi có từ lúc bắt đầu được ghi riêng; không coi toàn bộ diff là do lần gộp cuối cùng tạo ra.

Trong lần viết báo cáo này chỉ sửa tài liệu, không sửa code ứng dụng, không chạy lại kiểm thử, không build hoặc thao tác database.

## 2. Kết quả cuối cùng của đợt gộp ban đầu

| Nội dung | Kết quả |
|---|---|
| File Python trong `backend/app` so với HEAD đầu đợt | 95 → 75, giảm 20 file |
| File Python mới ở trạng thái cuối | 6 file |
| File Python cũ không còn tồn tại so với HEAD | 26 file; chức năng cần giữ đã chuyển/gộp sang nơi khác |
| Folder tác vụ nền | `backend/app/utils/`, chỉ có `worker.py` |
| Cấu hình giả lập | `SEND_EMAIL=1` cho log email/OTP và API kết quả thanh toán giả lập |
| Email tài khoản worker | `medical_booking@gmail.com` |
| Bộ kiểm thử lưu trong dự án | 23 ca, lần chạy cuối đạt 23/23 |
| Import ứng dụng ở trạng thái cuối | 75 module import thành công |
| Đối chiếu nội dung hàm trong các đợt A/B/C và D1/D2 | 437 hàm/lớp, gồm decorator và code kiểm thử, giữ nguyên nội dung |
| Database | Không đổi `database/init_db.sql` hoặc `database/sample_data.sql`; không reset dữ liệu dự án |
| Dịch vụ chính | Chưa rebuild/khởi động lại để áp dụng code mới trong các lượt gộp |

Số file tính cả `__init__.py`, chỉ tính file `.py` trong `backend/app`, không tính test, bytecode hoặc file tạm. Lộ trình kiểm tra import là 95 module trước gộp, 84 sau đợt gộp đầu, 77 sau A/B/C, 75 sau D1/D2. Không dùng các con số này để suy ra đã nghiệm thu mọi API.

## 3. Bảng chuyển/gộp file đầy đủ

Các đường dẫn dưới đây tính từ thư mục gốc dự án. Cột cuối là vị trí hiện tại cần sửa hoặc import khi tiếp tục phát triển.

| Nhóm/đợt | File nguồn trước khi gộp | File đích hiện tại | Nội dung chuyển/gộp |
|---|---|---|---|
| Cặp đầu 1, sau đó C1 | `backend/app/models/medical_record_model.py`, `backend/app/models/prescription_model.py`, `backend/app/models/review_model.py` | `backend/app/models/medical_record_model.py` | SQL bệnh án, lịch sử sửa, đọc/thay thuốc, tạo và đọc đánh giá công khai |
| Cặp đầu 2, sau đó C2 | `backend/app/schemas/medical_record_schema.py`, `backend/app/schemas/prescription_schema.py`, `backend/app/schemas/review_schema.py` | `backend/app/schemas/medical_record_schema.py` | `validate_record()`, `validate_items()`, `validate_review()` |
| Cặp đầu 3 | `backend/app/models/encounter_model.py`, `backend/app/models/encounter_log_model.py` | `backend/app/models/encounter_model.py` | SQL lượt khám và `add_status()`, `add_transfer()`, `list_logs()` |
| Cặp đầu 4, sau đó D2 | `backend/app/schemas/encounter_schema.py`, `backend/app/schemas/reception_schema.py`, `backend/app/schemas/payment_schema.py` | `backend/app/schemas/encounter_schema.py` | Validator online, hủy, walk-in, chuyển bác sĩ và thanh toán; `METHODS`, `_object()`, `validate_method()`, `validate_result()`, `validate_refund()` |
| Danh mục — model | `backend/app/models/department_model.py`, `backend/app/models/room_model.py` | `backend/app/models/catalog_model.py` | SQL chuyên khoa và phòng |
| Danh mục — schema | `backend/app/schemas/department_schema.py`, `backend/app/schemas/room_schema.py` | `backend/app/schemas/catalog_schema.py` | Validator tạo/sửa chuyên khoa và phòng |
| Danh mục — service | `backend/app/services/department_service.py`, `backend/app/services/room_service.py` | `backend/app/services/catalog_service.py` | Nghiệp vụ chuyên khoa/phòng và kiểm tra chuyên khoa còn hoạt động |
| Danh mục — route | `backend/app/routes/department_routes.py`, `backend/app/routes/room_routes.py` | `backend/app/routes/catalog_routes.py` | Giữ hai Blueprint `department_bp`, `room_bp`, các endpoint hiện có |
| Tác vụ nền | `backend/app/jobs/encounter_jobs.py`, `backend/app/jobs/payment_jobs.py`; tên trung gian từng dùng là `backend/app/scheduled_tasks/encounter_jobs.py`, `backend/app/scheduled_tasks/appointment_reminders.py` | `backend/app/utils/worker.py` | `system_actor()`, `expire_holds()`, `enqueue_reminders()`, `main()` |
| Admin ban đầu | `backend/app/db/create_admin.py` và luồng admin trong `backend/app/db/seed_db.py` | `backend/app/db/seed_db.py`, `backend/app/db/db_service.py` | Một luồng tạo admin qua `seed_db --admin`; quy tắc cụ thể ở mục 6 |
| A1 | `backend/app/models/user_model.py`, `backend/app/models/auth_token_model.py` | `backend/app/models/auth_model.py` | SQL users/role và OTP/token reset mật khẩu/xác minh email; đích đổi tên theo yêu cầu mới 11/10/2026 |
| A2 | `backend/app/schemas/auth_schema.py`, `backend/app/schemas/user_admin_schema.py` | `backend/app/schemas/auth_schema.py` | Validator xác thực, hồ sơ cá nhân và quản trị tài khoản |
| A3 | `backend/app/services/auth_service.py`, `backend/app/services/user_admin_service.py` | `backend/app/services/auth_service.py` | Xác thực, OTP, `/me`, đổi mật khẩu và quản trị tài khoản |
| B1 | `backend/app/services/schedule_service.py`, `backend/app/services/nurse_assignment_service.py` | `backend/app/services/schedule_service.py` | Nghiệp vụ lịch và tạo/xem/thu hồi phân công y tá |
| B2 | `backend/app/routes/schedule_routes.py`, `backend/app/routes/nurse_assignment_routes.py` | `backend/app/routes/schedule_routes.py` | Giữ hai Blueprint `schedule_bp`, `nurse_assignment_bp` và endpoint cũ |
| D1 | `backend/app/schemas/doctor_schema.py`, `backend/app/schemas/nurse_assignment_schema.py` | `backend/app/schemas/staff_schema.py` | Validator hồ sơ bác sĩ, phân công y tá và query phân công |

Ở đợt danh mục, các tên trùng đã được phân biệt thành `department_name_exists()`/`room_name_exists()` trong model và `validate_department_create()`/`validate_department_update()`/`validate_room_create()`/`validate_room_update()` trong schema. Khi gộp thuốc ở đợt đầu, hằng số cột thuốc được đặt tên `PRESCRIPTION_COLUMNS`. Các đổi tên này có từ đợt gộp đầu, trước yêu cầu chuyển nguyên nội dung hàm cho A/B/C và D1/D2.

## 4. Sáu file mới và danh sách file cũ đã bỏ

### 4.1. File mới đang tồn tại

| File mới | Vai trò |
|---|---|
| `backend/app/models/catalog_model.py` | SQL danh mục chuyên khoa/phòng |
| `backend/app/schemas/catalog_schema.py` | Kiểm tra dữ liệu chuyên khoa/phòng |
| `backend/app/services/catalog_service.py` | Nghiệp vụ danh mục |
| `backend/app/routes/catalog_routes.py` | Route danh mục |
| `backend/app/schemas/staff_schema.py` | Validator bác sĩ và phân công y tá |
| `backend/app/utils/worker.py` | Worker hết hạn giữ chỗ và nhắc lịch |

### 4.2. Hai mươi sáu file cũ không còn ở cấu trúc cuối

```text
backend/app/db/create_admin.py
backend/app/jobs/__init__.py
backend/app/jobs/encounter_jobs.py
backend/app/jobs/payment_jobs.py
backend/app/models/auth_token_model.py
backend/app/models/department_model.py
backend/app/models/encounter_log_model.py
backend/app/models/prescription_model.py
backend/app/models/review_model.py
backend/app/models/room_model.py
backend/app/routes/department_routes.py
backend/app/routes/nurse_assignment_routes.py
backend/app/routes/room_routes.py
backend/app/schemas/department_schema.py
backend/app/schemas/doctor_schema.py
backend/app/schemas/nurse_assignment_schema.py
backend/app/schemas/payment_schema.py
backend/app/schemas/prescription_schema.py
backend/app/schemas/reception_schema.py
backend/app/schemas/review_schema.py
backend/app/schemas/room_schema.py
backend/app/schemas/user_admin_schema.py
backend/app/services/department_service.py
backend/app/services/nurse_assignment_service.py
backend/app/services/room_service.py
backend/app/services/user_admin_service.py
```

Folder `scheduled_tasks` là tên trung gian trong workspace, đã được thay bằng `utils`; nó không phải một folder bổ sung cần giữ lại. `utils` không có file `utils.py` riêng: file chạy worker là `utils/worker.py`. Chỉ bỏ các module nguồn sau khi đã chuyển chức năng sang file đích và cập nhật nơi sử dụng.

## 5. Những thay đổi tên/cấu hình có sẵn và phần đã đồng bộ

### 5.1. Các sửa đổi chủ đồ án đã có lúc bắt đầu

| File | Thay đổi ghi nhận |
|---|---|
| `backend/.env.example` | `DEMO_MODE=0` được thay bằng `SEND_EMAIL=1` |
| `backend/app/core/constants.py` | `SYSTEM_WORKER_EMAIL` đổi từ `system.encounter-worker@internal.invalid` sang `medical_booking@gmail.com` |
| `backend/app/core/mail_adapter.py` | `_demo_enabled()` → `send_email_enabled()`, `_deliver()` → `deliver()`; dùng `SEND_EMAIL`, log `[SEND MAIL]` |
| `backend/app/core/security.py` | `_fingerprint()` → `fingerprint()`, `_serializer()` → `serializer()`; thông báo thiếu khóa đổi thành “Thiếu khóa bí mật, đợi ADMIN cập nhật lại” |
| `backend/app/core/errors.py` | Thông báo mặc định `unauthorized()` đổi thành “Bạn chưa đăng nhập hoặc phiên đăng nhập của bạn đã hết hạn” |
| `database/erd.html` | Bỏ đoạn mô tả schema ngày 09/10/2026 phía dưới tiêu đề; không thay định nghĩa entity của ERD trong diff này |
| Worker/Docker/tài liệu | Ban đầu đã có việc đổi `jobs` → `scheduled_tasks`, `payment_jobs.py` → `appointment_reminders.py`; vị trí cuối là `utils/worker.py` theo phê duyệt sau đó |

`backend/app/core/config.py` từng có một dòng trắng thừa được dọn; hiện không có diff so với HEAD. Không đổi tùy chọn kết nối PostgreSQL trong file đó.

### 5.2. Đồng bộ theo tên/giá trị mới của chủ đồ án

- `backend/app/routes/auth_routes.py`: mô tả Swagger của OTP/xác minh email dùng `SEND_EMAIL`.
- `backend/app/core/mail_adapter.py`: docstring dùng `SEND_EMAIL`; chỉnh thụt lề lời gọi `deliver()` trong `send_email_verification()`.
- `backend/app/routes/payment_routes.py`, `backend/app/services/payment_service.py`: điều kiện mở kết quả thanh toán giả lập dùng `SEND_EMAIL`, cả ở route và service. Swagger cũng cập nhật tên biến.
- `backend/tests/test_encounter_workflow.py`: kiểm tra tài khoản worker bằng hằng số `SYSTEM_WORKER_EMAIL` thay cho email cũ viết trực tiếp trong query.
- Tài liệu gói 4 và hướng dẫn chạy đã dùng tên biến, email worker và vị trí module mới.

`SEND_EMAIL=1` hiện bật log nội dung email/OTP giả lập và API `/demo/payments/{id}/result`. Khi thiếu biến hoặc khác `1`, các phần đó tắt. Biến này không tích hợp nhà cung cấp email hoặc ngân hàng thật. Mẫu `.env.example` đặt sẵn `1`. Không ghi mật khẩu database, khóa bí mật hoặc nội dung `.env` vào báo cáo này.

Email `medical_booking@gmail.com` là định danh riêng của tài khoản worker LOCKED, không phải cấu hình hộp thư gửi email. Luồng xác thực và worker dùng chung hằng số đó. Không coi tài khoản người dùng trùng email này là tài khoản đăng nhập thông thường.

## 6. Thống nhất tạo admin ban đầu

Chức năng riêng ở `backend/app/db/create_admin.py` đã được thay bằng một luồng qua:

```powershell
docker compose exec backend python -m backend.app.db.seed_db --admin
```

Trong `backend/app/db/db_service.py`, dữ liệu admin được kiểm tra bằng các helper xác thực hiện có trước khi ghi:

- Email hợp lệ, trim và chuyển chữ thường.
- Họ tên bắt buộc, trim, tối đa 150 ký tự.
- Mật khẩu 12–128 ký tự, có chữ và số.
- Email đã tồn tại: giữ nguyên bản ghi, vai trò và mật khẩu; không ghi đè.
- Tài khoản mới mang vai trò ADMIN, trạng thái duyệt APPROVED; không tự đánh dấu email đã xác minh.

`backend/app/db/seed_db.py` cập nhật lời nhắc mật khẩu và bắt thêm `AppError` để báo lỗi đầu vào. Vẫn hỗ trợ `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` qua môi trường và tùy chọn `--demo` như trước.

Đây là phần thống nhất/hợp nhất cách kiểm tra admin ở đợt đầu. Không mô tả nó là chỉ chuyển nguyên hàm: trước đó hai luồng có quy tắc kiểm tra khác nhau. Yêu cầu chuyển nguyên nội dung hàm cho A/B/C và D1/D2 được áp dụng ở các đợt sau.

## 7. Import, Blueprint, Docker và các file gọi đã cập nhật

| File | Cập nhật |
|---|---|
| `backend/app/main.py` | Lấy `department_bp`, `room_bp` từ `catalog_routes`; lấy `schedule_bp`, `nurse_assignment_bp` từ `schedule_routes`; vẫn đăng ký các Blueprint |
| `backend/app/routes/catalog_routes.py` | Dùng model/service/schema danh mục qua các tầng tương ứng, giữ đường dẫn chuyên khoa/phòng |
| `backend/app/routes/doctor_routes.py` | Import `staff_schema as doctor_schema` |
| `backend/app/routes/schedule_routes.py` | Import `staff_schema as schema`; phần phân công gọi `schedule_service as service` |
| `backend/app/routes/payment_routes.py` | Import `encounter_schema as payment_schema` |
| `backend/app/routes/user_admin_routes.py` | Import `auth_schema as user_admin_schema`, `auth_service as user_admin_service` |
| `backend/app/routes/encounter_routes.py` | Validator walk-in/chuyển bác sĩ lấy từ `encounter_schema` |
| `backend/app/routes/medical_record_routes.py` | Validator bệnh án/thuốc lấy từ `medical_record_schema` |
| `backend/app/routes/review_routes.py` | Import `validate_review` từ `medical_record_schema` |
| `backend/app/services/auth_service.py` | Token dùng `auth_model as auth_token_model`; chứa thêm nghiệp vụ hồ sơ/quản trị |
| `backend/app/services/doctor_service.py` | SQL chuyên khoa lấy từ `catalog_model` |
| `backend/app/services/schedule_service.py` | SQL phòng lấy từ `catalog_model`; giữ model phân công riêng với alias `model` |
| `backend/app/services/encounter_service.py` | Ghi/đọc log qua `encounter_model` |
| `backend/app/services/reception_service.py` | Ghi log tiếp nhận/chuyển qua `encounter_model` |
| `backend/app/services/medical_record_service.py` | Đọc/thay thuốc qua `medical_record_model` |
| `backend/app/services/review_service.py` | Import `medical_record_model as model` cho SQL đánh giá |
| `backend/tests/test_nurse_assignment.py` | Import `schedule_service as nurse_assignment_service` |
| `backend/tests/test_encounter_workflow.py` | Import worker từ `backend.app.utils.worker`; mock rollback trỏ `encounter_model.add_status` |
| `docker-compose.yml` | Lệnh `encounter-worker` chạy `python -m backend.app.utils.worker` |

Các alias có tên cũ là tên cục bộ trỏ module mới, không phải import module nguồn đã bị xóa. Giữ alias giúp không sửa nội dung các hàm gọi trong A/B/C và D1/D2.

Worker vẫn chạy process riêng, chu kỳ 30 giây, không tạo scheduler trong mỗi Gunicorn worker. `expire_holds()` và `enqueue_reminders()` vẫn dùng transaction riêng như trước khi gộp. Không thay lệnh khởi tạo/seed backend trong `backend/Dockerfile` ở đợt này.

## 8. Các file kiểm thử đã sửa/bổ sung

| File | Nội dung |
|---|---|
| `backend/tests/test_encounter_workflow.py` | Cập nhật import worker/model log; dùng email hệ thống qua hằng số; reset `last_queue_number=0` trong fixture ca trống; thêm 4 ca về bật/tắt kết quả thanh toán bằng `SEND_EMAIL`, xử lý lặp, lịch sử bệnh án/thuốc và nhắc lịch chống lặp |
| `backend/tests/test_nurse_assignment.py` | Đổi import service theo B1, giữ nguyên hàm kiểm thử |
| `backend/tests/test_package2_fixes.py` | Thêm ca CRUD chuyên khoa/phòng, quyền ADMIN/USER, trùng tên và dữ liệu ngừng hoạt động |
| `backend/tests/test_postgres.py` | Thêm ca kiểm tra dữ liệu admin trước khi ghi và trạng thái tài khoản sau seed |
| `backend/tests/test_encounter_reads.py` | Không sửa trong đợt này; vẫn được chạy trong bộ hồi quy |

Hai test cấp số từng thất bại vì fixture đặt `booked_count=0` nhưng giữ bộ đếm `last_queue_number` từ dữ liệu mẫu. Đã sửa fixture, không sửa quy tắc cấp số trong service để ép test đạt. Test worker từng lỗi do tìm email hệ thống cũ; đã đổi query sang hằng số hiện tại.

## 9. Kết quả kiểm tra đã thực hiện

| Giai đoạn | Kết quả và phạm vi |
|---|---|
| Rà soát ban đầu sau đổi tên | 100 file Python parse được, 95 module ứng dụng import được. 17 test trên PostgreSQL tạm: 14 đạt, 2 thất bại fixture số thứ tự, 1 lỗi email worker cũ |
| Đồng bộ tên/cấu hình và sửa fixture | 19/19 test đạt; kiểm tra bật/tắt log email bằng `SEND_EMAIL` đạt |
| Gộp đợt đầu, danh mục, worker và admin | 23/23 test đạt; 84 module ứng dụng import được; lệnh worker mới `--help` chạy được |
| A/B/C | 23/23 test đạt; 2 ca tích hợp bổ sung đạt; 77 module import được; đối chiếu 437 hàm/lớp/decorator giữ nguyên. Script bổ sung cũng chạy lại 2 test y tá đã có và đều đạt |
| D1/D2, trạng thái code cuối | 23/23 test đạt; 1 ca tích hợp hồ sơ bác sĩ bổ sung đạt; 75 module import được; đối chiếu 437 hàm/lớp/decorator giữ nguyên |
| Kiểm tra tĩnh | Đích import nội bộ tồn tại, không có tên hàm trùng trong các module sau gộp; kiểm tra diff không phát hiện lỗi whitespace |

### 9.1. Nội dung các ca tích hợp bổ sung bằng script tạm

**A/B/C — tài khoản và OTP:** đăng ký không tự nâng quyền; login và `/me`; sửa hồ sơ; ADMIN tạo/xem tài khoản NURSE; USER bị chặn quản trị; OTP và reset token dùng một lần; reset mật khẩu làm token truy cập cũ mất hiệu lực; đăng nhập bằng mật khẩu mới.

**A/B/C — đánh giá:** sai vai trò bị từ chối; rating 0 bị từ chối; tạo đánh giá; gọi lại cùng nội dung không tạo thêm; đổi nội dung sau đã đánh giá trả xung đột; kết quả công khai chỉ gồm `review_id`, `rating`, `comment`, `created_at`, không trả ID bệnh án/lượt khám hoặc dữ liệu bệnh nhân.

**D1/D2 — bác sĩ:** ADMIN tạo tài khoản DOCTOR và hồ sơ chuyên môn, sửa phí khám; bác sĩ tự sửa thông tin chuyên môn; bác sĩ tự sửa phí bị từ chối và giá không đổi; USER sửa hồ sơ bác sĩ bị từ chối.

Các script/compose/audit tạm đã được xóa sau xác minh; các ca bổ sung tạm không được tính vào 23 test lưu trong dự án. Không cộng các lượt chạy khác nhau thành số lượng test thường trực.

### 9.2. Môi trường và giới hạn

- Kiểm thử dùng image Docker sẵn có, bind mã hiện tại vào container ở chế độ đọc và PostgreSQL 17 tạm trong RAM; mỗi ca dùng schema riêng.
- Không reset/nạp mẫu database dự án. Dữ liệu mẫu được dùng trong schema kiểm thử tạm, không phải dữ liệu chính.
- Python trên máy ban đầu thiếu thư viện `psycopg`/`PIL`, nên việc chạy test bằng Python máy không thành công; kiểm thử thực tế hoàn tất trong Docker.
- Container/network kiểm thử A/B/C và D1/D2 đã được dọn. Có một lượt dọn môi trường kiểm thử ở đợt đầu bị từ chối; không khẳng định đã dọn mọi container cũ trên máy. Không kiểm tra lại inventory Docker trong lần viết báo cáo này.
- Chưa kiểm thử trực tiếp bản dịch vụ chính sau rebuild; chưa chạy mọi ca đồng thời intent/result/refund, mọi boundary hoàn tiền hoặc mọi nghiệp vụ của cả 5 gói.
- Kết quả 23/23 xác minh bộ test hiện có và phạm vi refactor; không phải tuyên bố nghiệm thu toàn bộ hệ thống.

## 10. Những phần giữ nguyên hoặc không duyệt gộp tại đợt trước

- `package5_docs.py` từng được giữ trong `routes` ở đợt gộp trước; theo yêu cầu mới 11/10/2026, file đã chuyển sang `backend/app/utils/package5_docs.py`. Nó vẫn phục vụ Swagger cho route bệnh án, đánh giá, bài viết, cấu hình và thống kê.
- D3 (`notification_model.py` vào model tài khoản, hiện tên `auth_model.py`) chưa được duyệt, không thực hiện. Model thông báo vẫn riêng.
- Tài khoản và bệnh nhân vẫn là hai loại hồ sơ riêng; không gộp `patient_*` vào tài khoản, không gộp bảng `patient` và `users`.
- Hồ sơ bác sĩ, nghiệp vụ tiếp nhận/lượt khám vẫn có service/model riêng; chỉ schema bác sĩ/phân công chuyển vào `staff_schema`.
- `backend/app/models/nurse_assignment_model.py` và `backend/app/models/schedule_model.py` vẫn riêng.
- `backend/app/schemas/schedule_schema.py` vẫn riêng; validator phân công ở `staff_schema.py`.
- Route quản trị tài khoản vẫn ở `backend/app/routes/user_admin_routes.py`; service đã ở `auth_service.py`.
- Service/route đánh giá vẫn ở `backend/app/services/review_service.py`, `backend/app/routes/review_routes.py`; chỉ model/schema đánh giá đã gộp.
- Các endpoint vẫn dùng đường dẫn trực tiếp, không thêm `/api/v1` hoặc `/v1`.
- Không chỉnh frontend, `database/init_db.sql`, `database/sample_data.sql` hoặc dependency trong `backend/requirements.txt` ở đợt này.

## 11. Các tài liệu đã cập nhật trong đợt

| Tài liệu | Nội dung cập nhật |
|---|---|
| `docs/BAO_CAO_NGHIEP_VU.md` | Ghi nhận tên mới, cấu trúc gộp và kết quả xác minh các đợt |
| `docs/TONG_HOP_PHAN_TICH_NGHIEP_VU.txt` | Ghi nhận tương ứng để tránh dùng quy ước/module cũ |
| `docs/DANH_SACH_API_VA_PHAN_CONG_BACKEND.md` | Đường dẫn file phụ trách mới, vị trí validator, worker, cấu hình và các kết quả kiểm tra |
| `docs/HUONG_DAN_CHAY_DU_AN.md` | `SEND_EMAIL`, email worker, lệnh worker mới, lệnh tạo admin và quy tắc kiểm tra admin; phần SECRET_KEY có sửa từ đầu phiên |
| `docs/QUY_TAC_GOI_3_DA_CHOT.md` | Lệnh chạy worker theo module mới |
| `docs/BAO_CAO_TRIEN_KHAI_GOI_4.md` | Tên cấu hình và tác vụ nhắc lịch, kết quả hồi quy phạm vi liên quan |
| `docs/BAO_CAO_TRIEN_KHAI_GOI_5.md` | Ghi nhận hồi quy bệnh án/thuốc/version/lịch sử sau gộp |
| `docs/BAO_CAO_GOP_MODULE_ABC.md` | Chính báo cáo tổng hợp đầy đủ này; giữ tên file để các liên kết trước đó vẫn đúng |

Một số tài liệu, gồm folder `docs`, được `.gitignore` loại khỏi việc tự thêm file mới vào Git. Báo cáo đã lưu trong workspace; việc không hiện như file mới trong `git status` không có nghĩa file chưa được tạo. Không sửa `.gitignore`, không stage hoặc commit trong lần viết báo cáo.

## 12. Cách áp dụng code mới

Không cần xóa database cho các thay đổi file/module này. Sau khi kiểm tra cấu hình `backend/.env`, áp dụng mã mới bằng:

```powershell
docker compose up -d --build backend encounter-worker
```

Worker chạy riêng một chu kỳ:

```powershell
python -m backend.app.utils.worker --once
```

Trong môi trường Docker đã build mã mới và PostgreSQL hoạt động, chạy bộ kiểm thử thường trực:

```powershell
docker compose exec -e RUN_POSTGRES_TESTS=1 backend python -m unittest discover -s backend/tests -v
```

Không dùng `docker compose down -v` hoặc nạp lại `sample_data.sql` chỉ để áp dụng việc gộp/đổi tên file. Những lệnh đó có thể xóa dữ liệu. Báo cáo không xác nhận các lệnh áp dụng dịch vụ chính đã được thực hiện.


## 13. Đối chiếu chức năng với commit df9a334 — 11/10/2026

Mốc so sánh là HEAD gần nhất `df9a334` (`add venv`), không phải chỉ snapshot ngay trước A/B/C hoặc D1/D2. Đã bỏ qua đường dẫn module, tên hàm/biến được đổi, alias import, tên cấu hình/email đã được chủ đồ án chốt và docstring khi đối chiếu AST. Các câu SQL, điều kiện, tham số, lời gọi hàm và decorator vẫn được đối chiếu.

### 13.1. Phần giữ được

- 433 khai báo hàm cấp module ở commit cũ, 431 ở hiện tại. Giảm một khai báo do hai hàm `_present()` chuyên khoa/phòng giống nhau dùng chung sau gộp; giảm một do `db/create_admin.py:main()` không còn là hàm riêng.
- 427 khai báo cũ có nội dung AST tương đương sau chuẩn hóa tên/vị trí. Năm khác biệt còn lại gồm bốn thay đổi câu chữ/mô tả/log đã biết và một thay đổi thực tế trong kiểm tra đầu vào của `seed_database()`.
- Bốn thay đổi câu chữ nằm ở thông báo `unauthorized()`, tiền tố log email, thông báo thiếu SECRET_KEY và summary Swagger kết quả thanh toán. Chúng không làm mất chức năng tương ứng.
- Các biến/hằng số cấp module đều có vị trí tương ứng; không phát hiện giá trị bị mất sau chuẩn hóa tên cấu hình/email và các tên đã đổi.
- Class `AppError` và các phương thức giữ nguyên AST.
- Khởi tạo riêng hai phiên bản trong container và so registry thực tế: cả 98 rule có cùng đường dẫn, phương thức và tên endpoint; Swagger có cùng 82 path/phương thức. Hai truy vấn kiểm tra role lúc tạo app được mock, không kết nối database. Đây là kiểm tra đăng ký API/tài liệu, không phải chạy lại toàn bộ luồng nghiệp vụ.
- Không phát hiện thiếu hàm/SQL/điều kiện trong API xác thực, hồ sơ/tài khoản, bệnh nhân, bác sĩ, danh mục, lịch/phân công, lượt khám/tiếp nhận, thanh toán, thông báo, bệnh án/thuốc, đánh giá, nội dung/cấu hình/thống kê hoặc worker.

### 13.2. Phần chưa bảo toàn đầy đủ ở luồng tạo admin ban đầu

Chức năng tạo admin vẫn còn qua `seed_db --admin`, nhưng không bảo toàn toàn bộ hành vi của lệnh riêng `create_admin` trong commit cũ:

| Hành vi cũ của create_admin | Trạng thái hiện tại | Kết luận |
|---|---|---|
| Nhập mật khẩu rồi nhập lại để đối chiếu; sai thì dừng | CLI seed chỉ hỏi mật khẩu một lần | Bước xác nhận mật khẩu đã mất |
| Tạo tài khoản với `email_verified=1` | Seed không truyền trường này, database mặc định 0 | Hành vi tự đánh dấu xác minh email không còn |
| Email đã tồn tại thì báo lỗi và trả mã 1 | Seed giữ tài khoản cũ, bỏ qua tạo mới và kết thúc thành công | Cách báo kết quả trùng email đã thay đổi; kiểm tra tồn tại vẫn có |
| Mật khẩu hợp lệ theo auth_schema, cho phép 8–128 ký tự có chữ/số | Seed yêu cầu thêm tối thiểu 12 ký tự | Lệnh mới không còn nhận mật khẩu 8–11 ký tự hợp lệ theo lệnh riêng cũ |

`seed_database()` đã có mốc 12 ký tự ở commit cũ; điểm khác ở đây là thay thế lệnh `create_admin` vốn cho phép 8 ký tự bằng luồng seed có ngưỡng khác. Đợt hợp nhất admin còn làm kiểm tra email/họ tên/mật khẩu ở seed chặt hơn trước. Những thay đổi này là khác biệt hành vi thực tế, không chỉ đổi tên hoặc chuyển file.

Các snapshot 437 hàm/lớp được ghi ở mục trước là so trước/sau A/B/C và D1/D2, sau khi việc hợp nhất admin đã xảy ra; chúng không chứng minh mọi hành vi của commit df9a334 được giữ nguyên.

### 13.3. Phạm vi xử lý lần đối chiếu

Chỉ phân tích và bổ sung báo cáo. Không tự sửa lại hành vi admin hoặc sửa code ứng dụng. Bộ 23 test và các ca bổ sung của các lượt trước vẫn là bằng chứng hồi quy đã có; lần này không chạy lại toàn bộ test PostgreSQL. Script AST, snapshot commit và container kiểm tra registry là tài nguyên tạm của lần audit.

## 14. Đổi tên model và chuyển helper vào utils — 11/10/2026

Theo yêu cầu mới của chủ đồ án, đã đổi/chuyển ba module:

| Vị trí cũ | Vị trí hiện tại | Chức năng |
|---|---|---|
| `backend/app/models/user_model.py` | `backend/app/models/auth_model.py` | SQL tài khoản, vai trò và OTP/token xác thực |
| `backend/app/models/_sql.py` | `backend/app/utils/_sql.py` | INSERT/UPDATE dùng chung, chuyển kiểu JSON và cờ boolean |
| `backend/app/routes/package5_docs.py` | `backend/app/utils/package5_docs.py` | Helper mô tả tham số, body, bảo mật và phản hồi Swagger gói 5 |

Đã cập nhật tham chiếu/import trong 32 file Python, gồm ứng dụng và bốn file kiểm thử có import model tài khoản. Không tạo module tương thích ở vị trí cũ. Folder `utils` sau đợt này, trước phần bổ sung ở mục 15, có `_sql.py`, `package5_docs.py` và `worker.py`; Python dùng namespace package cho folder này. Tổng số file Python ứng dụng vẫn là 75.

Tiêu chí của lần thay đổi: ba module có vị trí mới đúng yêu cầu; không còn tham chiếu vị trí cũ trong mã Python; bảo toàn hàm, SQL, hằng số, decorator, quyền, transaction và endpoint sau khi chuẩn hóa tên/đường dẫn module. Chỉ tổ chức lại module, không thay nghiệp vụ hoặc cấu trúc database.

Kiểm tra đã thực hiện:

- 80/80 file Python, gồm 75 file ứng dụng và 5 file kiểm thử, compile/parse thành công mà không ghi bytecode.
- Kiểm tra tĩnh các đường dẫn import module nội bộ: không có module bị thiếu; không còn tham chiếu `user_model`, `backend.app.models._sql` hoặc `backend.app.routes.package5_docs` trong mã Python.
- Đối chiếu AST của toàn bộ 80 file với snapshot ngay trước lần đổi này, sau khi chuẩn hóa đúng ba tên/đường dẫn được đổi: không khác biệt; không thêm hoặc mất file Python.
- Nội dung byte của cả ba file được chuyển/đổi tên giống hệt trước khi chuyển.
- Import thực tế `backend.app.models.auth_model`, `backend.app.utils._sql`, `backend.app.utils.package5_docs` thành công. Kiểm tra chuyển date/time/Decimal sang JSON, cờ boolean và mô tả Swagger công khai/cần đăng nhập đều đạt.
- `git diff --check` đạt.

Giới hạn: chưa chạy lại bộ kiểm thử tích hợp PostgreSQL hoặc toàn bộ import ứng dụng. Docker daemon không hoạt động; Python trong `.venv` thiếu Flask, psycopg, flasgger và Pillow. Kết quả 23/23 ở các mục trước thuộc đợt cũ, không phải kết quả chạy lại sau lần đổi này. Chưa rebuild dịch vụ chính; không khởi tạo lại, seed hoặc thao tác database dự án trong lần này.

## 15. Chuyển bốn file tiện ích bổ sung — 11/10/2026

Chủ đồ án chọn chuyển đúng bốn file đầu trong đề xuất rà soát, chưa chọn tách hàm tiện ích nằm trong các file nghiệp vụ:

| Vị trí cũ | Vị trí hiện tại |
|---|---|
| `backend/app/core/utils.py` | `backend/app/utils/time_utils.py` |
| `backend/app/schemas/common_schema.py` | `backend/app/utils/validation.py` |
| `backend/app/core/uploads.py` | `backend/app/utils/uploads.py` |
| `backend/app/core/mail_adapter.py` | `backend/app/utils/mail_adapter.py` |

Đã cập nhật import/tham chiếu trong 22 file Python. Khi import cũ cùng dòng với `constants`, giữ `constants` trong `core` và chuyển import `uploads`/`mail_adapter` sang `utils`. Không tách thêm hàm khỏi `auth_schema.py`, `encounter_service.py` hoặc `payment_routes.py`. Ba file tiện ích đã có `_sql.py`, `package5_docs.py`, `worker.py` chưa đổi tên; yêu cầu tìm tên khác chỉ được trả lời bằng đề xuất.

Folder `utils` hiện có bảy file: `_sql.py`, `package5_docs.py`, `worker.py`, `time_utils.py`, `validation.py`, `uploads.py`, `mail_adapter.py`. Tổng file Python ứng dụng vẫn là 75. Nội dung nghiệp vụ, endpoint, schema database và cấu hình chạy giữ nguyên.

Tiêu chí và kiểm tra đã thực hiện:

- Đúng bốn file được chuyển; nội dung byte của từng file giống hệt trước khi chuyển.
- 80/80 file Python compile/parse thành công; không ghi bytecode.
- Kiểm tra tĩnh module và tên được import trong nội bộ: không phát hiện đích bị thiếu. Không còn import bốn vị trí cũ trong mã Python.
- Đối chiếu AST của 80 file với snapshot ngay trước đợt này sau khi chuẩn hóa đường dẫn và tách đúng ba import gộp: không khác biệt; không thêm/mất file Python.
- Import thực tế `utils.time_utils` và `utils.mail_adapter` thành công. Múi giờ UTC+7 và ngày Việt Nam đúng; với `SEND_EMAIL=1` adapter ghi nội dung OTP/token giả lập, với `SEND_EMAIL=0` không ghi mã OTP/token.
- `git diff --check` đạt. Đã đồng bộ vị trí mới trong ba tài liệu nghiệp vụ/API, báo cáo này và tham chiếu code avatar trong báo cáo kiểm thử gói 2.

Giới hạn: chưa import thực tế `utils.validation`/`utils.uploads`, chưa import toàn bộ ứng dụng hoặc chạy lại kiểm thử PostgreSQL. Docker daemon vẫn không hoạt động; Python `.venv` thiếu Flask, psycopg, flasgger và Pillow. Chưa rebuild hoặc sửa dữ liệu dịch vụ chính. Các kết quả kiểm thử tích hợp ở những mục trước không phải kết quả chạy lại cho đợt này.

## 16. Đổi riêng tên helper Swagger — 11/10/2026

Đã đổi `backend/app/utils/package5_docs.py` thành `backend/app/utils/swagger_helpers.py` và cập nhật import ở năm route: bài viết, cấu hình, bệnh án, đánh giá, thống kê. Nội dung byte của helper giữ nguyên. `_sql.py` và `worker.py` không đổi tên theo yêu cầu chủ đồ án.

Kiểm tra: 80 file Python compile/parse đạt; đối chiếu AST trước/sau khi chuẩn hóa tên module không khác biệt, không thêm/mất file Python; không còn import đường dẫn helper cũ trong mã Python. Import helper mới và kiểm tra mô tả path/body, Swagger công khai/cần đăng nhập đều đạt. Không chạy lại kiểm thử tích hợp PostgreSQL hoặc rebuild dịch vụ chính trong lần này; giữ nguyên giới hạn môi trường đã ghi ở mục 15.

## 17. Chốt tên tiện ích SQL, email và thời gian — 11/10/2026

Theo yêu cầu chủ đồ án, đã đổi ba file trong `backend/app/utils`:

| Tên trước | Tên hiện tại |
|---|---|
| `_sql.py` | `database_helpers.py` |
| `mail_adapter.py` | `mail.py` |
| `time_utils.py` | `date.py` |

Đã cập nhật import/tham chiếu trong 24 file Python; lời gọi `mail_adapter` trong `auth_service.py` dùng tên `mail`. Không đổi tên hoặc tách thêm các file khác. Tổng số file ứng dụng vẫn là 75; folder `utils` có `database_helpers.py`, `mail.py`, `date.py`, `swagger_helpers.py`, `validation.py`, `uploads.py`, `worker.py`.

Tiêu chí kiểm tra và kết quả:

- Cả ba file giữ nguyên nội dung byte; chỉ đổi tên file và tham chiếu module.
- 80/80 file Python compile/parse thành công; đối chiếu AST với snapshot ngay trước lần đổi sau khi chuẩn hóa đúng tên/đường dẫn mới không có khác biệt, không thêm/mất file.
- Kiểm tra tĩnh các module và tên import nội bộ không phát hiện đích bị thiếu; không còn tham chiếu ba tên cũ trong mã Python.
- Import thực tế ba module mới đạt. Kiểm tra chuyển ngày/Decimal sang JSON, chuyển cờ boolean, múi giờ UTC+7 và ngày Việt Nam đạt. Bật/tắt `SEND_EMAIL` vẫn ghi/ẩn mã OTP và token xác minh đúng như trước.
- `git diff --check` đạt; đã cập nhật ba tài liệu nghiệp vụ/API và báo cáo này.

Chưa chạy lại kiểm thử tích hợp PostgreSQL hoặc import toàn bộ ứng dụng trong đợt này; giới hạn môi trường đã ghi ở mục 15. Không rebuild, seed hoặc sửa dữ liệu dịch vụ chính. Các kết quả kiểm thử tích hợp ở đợt trước không phải kết quả chạy lại cho lần đổi tên này.

## 18. Chuẩn hóa tên nhóm ở bốn tầng — 11/10/2026

Chủ đồ án chọn giữ cấu trúc theo tầng và hậu tố `_routes`, `_schema`, `_service`, `_model`, sau đó duyệt thực hiện đủ năm mục đã đề xuất. Không chuyển sang cấu trúc folder theo nhóm chức năng. Bảng 12 nhóm/file hiện tại nằm trong [CAU_TRUC_BACKEND.md](CAU_TRUC_BACKEND.md).

### 18.1. Các thay đổi

- Bốn validator hồ sơ bác sĩ từ `staff_schema.py` vào `doctor_schema.py`. Hai validator phân công vào `schedule_schema.py`, với tên `validate_assignment_create`, `parse_assignment_query`; bỏ module `staff_schema`.
- SQL phân công y tá từ `nurse_assignment_model.py` vào `schedule_model.py`, đổi hằng `_SELECT` của phân công thành `_ASSIGNMENT_SELECT` để không ghi đè truy vấn ca. Service dùng `schedule_model` cho cả hai nhóm truy vấn.
- Các route `/me` và quản trị tài khoản từ `user_admin_routes.py` vào `auth_routes.py`. Giữ hai Blueprint `auth_bp`, `user_admin_bp`. Hai hàm `_body` giống hệt dùng một hàm chung; chỉ giảm helper trùng, không giảm API.
- Năm hàm tiếp nhận/điều phối từ `reception_service.py` vào `encounter_service.py`. Tham chiếu helper của service lượt khám được đổi thành lời gọi trong cùng module; giữ nguyên transaction và thứ tự khóa.
- Hằng `METHODS` và bốn hàm `_object`, `validate_method`, `validate_result`, `validate_refund` từ `encounter_schema.py` vào `payment_schema.py`.
- Phần đánh giá đã được gộp trước khi chủ đồ án yêu cầu chờ duyệt, sau đó được giữ trong phương án đã duyệt: service có `create_review`, `list_public_reviews`; route nằm trong `medical_record_routes.py`, giữ `review_bp` cùng tên endpoint cũ. Hai file review riêng đã bỏ.
- Cập nhật import, lời gọi và đăng ký Blueprint; các file tiện ích đã chốt giữ nguyên. Không thay SQL, schema database, chính sách, dependency của dự án hoặc frontend.

Sau gộp review và năm mục trên, file ứng dụng từ 75 xuống 71. Mỗi tầng có đúng 12 file nhóm nghiệp vụ ngoài `__init__.py`.

### 18.2. Tiêu chí và bằng chứng kiểm tra

- 76/76 file Python hiện tại compile/parse được, gồm 71 file ứng dụng và 5 file kiểm thử. Tất cả 71 module ứng dụng import thành công trong runtime kiểm tra.
- Snapshot ngay trước năm mục còn lại: chuẩn hóa vị trí, tên validator/hằng và alias; 436 khai báo hàm/lớp cấp module, toàn bộ hằng/assignment và 63 file không liên quan giữ nguyên AST. Chỉ bỏ một `_body` trùng sau khi xác nhận hai bản giống hệt. Phần review trước đó đã đối chiếu 437 khai báo trước/sau và không mất nội dung sau chuẩn hóa.
- Kiểm tra tĩnh các module/tên import nội bộ và tham chiếu module cũ đạt; không có tên hàm/lớp trùng trong các file gộp.
- Khởi tạo hai phiên bản trước/sau trong tiến trình riêng: 98 rule Flask có cùng URL, phương thức và endpoint; toàn bộ JSON Swagger giống nhau, gồm 82 path. Chỉ mock hai truy vấn sẵn sàng của bảng role khi tạo app, không dùng kết quả này để khẳng định kiểm thử database.
- 10 nhóm kiểm tra runtime trên mỗi phiên bản đạt: validator bác sĩ/ca/phân công/thanh toán, tách đúng hai SELECT ca và phân công; quyền route USER/ADMIN; route bác sĩ, phân công, walk-in, chuyển ca và review gọi đúng service/validator. Các thao tác service/database trong nhóm kiểm tra kết nối route được mock rõ ràng.
- 23/23 test thường trực đạt trên PostgreSQL 18 tạm, gồm quyền/phân công, luồng khám/quota/log, thanh toán lặp/muộn, check-in/no-show, chuyển ca, tranh chấp chỗ cuối/rollback, bệnh án/thuốc, nhắc lịch, danh mục, avatar, seed và ràng buộc schema.
- Hai ca tích hợp bổ sung trên schema tạm đạt. Ca tài khoản/bác sĩ kiểm tra đăng ký không tự nâng quyền, login/me, USER bị chặn quản trị, ADMIN tạo DOCTOR/hồ sơ, bác sĩ tự sửa chuyên môn nhưng không sửa phí, ADMIN sửa phí. Ca đánh giá chạy đặt–trả cọc–check-in–khám–bệnh án–hoàn tất–review; gửi lặp không tạo thêm, đổi nội dung trả xung đột, rating sai/role sai bị chặn, dữ liệu công khai chỉ có bốn trường đánh giá.
- `git diff --check` đạt; cập nhật tài liệu nghiệp vụ, phân công API và bảng cấu trúc hiện tại.

### 18.3. Môi trường và giới hạn

Runtime kiểm tra là Python 3.12.14, Flask/Werkzeug 3.0.3, psycopg 3.2.10, flasgger 0.9.7.1, Pillow 12.3.0. Thư viện kiểm tra được đặt trong thư mục tạm riêng, không cài vào `.venv` hay thay `requirements.txt`.

Docker daemon không hoạt động, nên dùng PostgreSQL 18 sẵn có trên máy để tạo cluster tạm mới trên cổng loopback riêng; mỗi test dùng schema riêng. Không kết nối database của dự án, không reset/nạp mẫu/rebuild dịch vụ chính. Lượt thử trong sandbox bị chặn TCP 10013; đã chạy lại bộ test với quyền kết nối tới cluster tạm và đạt. Một ResourceWarning về tempfile xuất hiện trong bộ test nhưng không làm test thất bại; không sửa ngoài phạm vi refactor để xử lý cảnh báo đó.

Database tạm đã dừng và không còn tiến trình PostgreSQL/initdb thuộc lần kiểm tra. Script, snapshot, thư viện và dữ liệu kiểm tra tạm được dọn sau xác minh. Hai ca bổ sung và các kiểm tra runtime không được cộng vào 23 test thường trực.

Chưa rebuild hoặc kiểm thử bản Docker/PostgreSQL 17 của dự án sau thay đổi. Bằng chứng trên xác minh các ca đã chạy và phạm vi refactor; không tuyên bố nghiệm thu toàn bộ mọi nghiệp vụ của năm gói API.


## 19. Chuyển từ các folder theo tầng sang folder theo chức năng

### 19.1. Yêu cầu và phạm vi

Chủ đồ án yêu cầu chuyển bốn folder `routes`, `schemas`, `services`, `models` thành các folder chức năng có tên dễ hiểu; cho phép đặt tên khác ERD và tạo thêm folder khi cần. Các folder khác giữ tên, vị trí và chức năng. Quyết định mới thay yêu cầu giữ cấu trúc theo tầng ở mục 18.

- 48 file nghiệp vụ chuyển vào 12 package: `accounts`, `patients`, `doctors`, `clinics`, `schedules`, `visits`, `medical_records`, `payments`, `notifications`, `articles`, `reports`, `settings`.
- Mỗi nhóm dùng `routes.py`, `validators.py`, `service.py`, `queries.py`; phần SQL dùng tên queries vì mã thực tế dùng truy vấn psycopg trực tiếp.
- `routes/__init__.py` chứa `/health` chuyển sang `health.py`. Bốn folder tầng cũ đã bỏ sau khi xác nhận mọi file có chức năng đã được chuyển.
- `core`, `db`, `utils` giữ toàn bộ tên/vị trí file và nhiệm vụ. Chỉ sửa import trong security, seed và worker để trỏ tới module mới. Main và test/mock cũng cập nhật đường dẫn import.
- Thêm mô tả đầu file và package cho biết phạm vi/nhiệm vụ. Hàm, SQL, hằng số, quyền, transaction và chính sách giữ nguyên; không thay database, API, dependency của dự án hoặc frontend.
- `visits` bao gồm online và trực tiếp, nhưng bảng/cột/URL vẫn là `encounter`. Bệnh án/thuốc/đánh giá tiếp tục cùng nhóm `medical_records`. Dữ liệu thống kê cho dashboard ở `reports`; chưa có chức năng xét nghiệm hay dashboard độc lập để tạo folder riêng.
- Mã ứng dụng từ 71 thành 80 file Python: tăng file đánh dấu package do chuyển từ bốn tầng sang 12 nhóm và tách health khỏi package init. Có 15 file `__init__.py` trong app; 5 file test giữ nguyên số lượng.

### 19.2. Tiêu chí và bằng chứng

- 85 file Python ứng dụng/kiểm thử compile/parse được; tất cả 80 module ứng dụng import thành công.
- Snapshot ngay trước khi chuyển: đối chiếu 73 file trước/sau (68 file ứng dụng có vị trí tương ứng và 5 test), chuẩn hóa đường dẫn import và mô tả module. AST giữ nguyên, bao gồm 436 khai báo hàm/lớp cấp module, các hàm lồng nhau, decorator, SQL, hằng/assignment. Ba package init cũ không có xử lý nghiệp vụ đã bỏ; 12 package init mới chỉ chứa mô tả.
- Kiểm tra tĩnh đạt: mỗi nhóm có đúng bộ năm file; tên file trong core/db/utils giống trước; không còn import/đường dẫn mock về bốn folder tầng cũ.
- Khởi tạo hai phiên bản trong tiến trình riêng: 98 rule Flask giống URL, phương thức và endpoint; toàn bộ JSON Swagger giống nhau, gồm 82 path. Chỉ mock hai truy vấn kiểm tra bảng role khi so sánh registry; kiểm tra này không thay thế test database.
- 23/23 test thường trực đạt trong 50,013 giây trên PostgreSQL 18 tạm. Bao gồm quyền/phân công, lượt khám/quota/log, tranh chấp chỗ cuối và rollback, hủy/check-in/no-show/chuyển ca, thanh toán lặp/muộn, bệnh án/thuốc/version/lịch sử, thông báo/nhắc lịch, danh mục, avatar, seed và ràng buộc schema.
- Hai ca tích hợp bổ sung qua Flask test client trên schema tạm đạt. Tài khoản/bác sĩ: đăng ký không nâng quyền, login/me, USER bị chặn quản trị, ADMIN tạo DOCTOR/hồ sơ, bác sĩ tự sửa chuyên môn nhưng không sửa phí, ADMIN sửa phí. Bệnh án/đánh giá: đặt–trả cọc–check-in–bắt đầu–ghi bệnh án–hoàn tất–review; gửi lặp không tạo thêm, đổi nội dung trả xung đột, rating/role sai bị chặn, dữ liệu public chỉ có bốn trường đánh giá.
- Tài liệu cấu trúc, nghiệp vụ, tổng hợp, phân công API, hướng dẫn chạy và README đã cập nhật. Các đường dẫn File chính trong kế hoạch API dùng vị trí mới; lịch sử các đợt trước vẫn được ghi riêng.

### 19.3. Môi trường và giới hạn

Runtime kiểm tra: Python 3.12.14; Flask/Werkzeug 3.0.3, psycopg 3.2.10, flasgger 0.9.7.1; Pillow 12.3.0 từ runtime sẵn có. Thư viện kiểm tra nằm trong thư mục tạm riêng, không cài vào .venv và không sửa requirements.txt. PostgreSQL 18 chạy cluster mới trên cổng loopback riêng, mỗi ca dùng schema riêng; không kết nối database dự án.

Không reset/nạp mẫu/rebuild dịch vụ chính. Chưa kiểm thử bản Docker/PostgreSQL 17 sau thay đổi. Các bằng chứng trên xác minh việc tổ chức lại mã và những ca đã chạy, không là nghiệm thu toàn bộ mọi tiêu chí của năm gói API. Hai ca bổ sung không cộng vào 23 test thường trực.

Cluster kiểm tra đã dừng, không còn tiến trình PostgreSQL/initdb thuộc lần kiểm tra và dữ liệu tạm của cluster đã dọn. Script, snapshot và thư viện kiểm tra tạm trong dự án cũng đã dọn; `git diff --check` đạt sau cập nhật tài liệu.
