# Đăng ký và đặt lịch khám bệnh — Python + SQLite

Dự án dùng một backend `backend` và một database mặc định `backend/data/medical_booking.db`.
Không cần server database riêng, tệp SQL ngoài hoặc database cung cấp sẵn.
Cấu trúc 18 bảng dựa trên `backend/data/erd.html` (ERD v2), không dùng bảng khách sạn.

## Cấu trúc và trách nhiệm

| Tệp/thư mục | Trách nhiệm |
|---|---|
| `backend/app/core/config.py` | BASE_DIR, DB_PATH; mặc định data/medical_booking.db, hỗ trợ biến môi trường DB_PATH |
| `backend/app/database/database.py` | get_db_connection(): Row, khóa ngoại trên mỗi kết nối, timeout, commit/rollback/close |
| `backend/app/database/db_service.py` | Tạo 18 bảng, index, trigger qua init_database(); thêm dữ liệu nền/demo/admin qua seed_database() |
| `backend/app/database/init_db.py` | Lệnh khởi tạo bảng; không tự seed |
| `backend/app/database/seed_db.py` | Lệnh seed; --demo hoặc --admin khi cần |
| `backend/data/medical_booking.db` | Dữ liệu SQLite thật; sinh được từ đầu, không đưa lên Git |
| `backend/app/routes/__init__.py` | Route HTTP GET /health; không chứa seed |
| `backend/main.py` | Tạo Flask app, đăng ký route; yêu cầu init/seed trước, không tự thêm demo |
| `backend/tests/test_database.py` | Kiểm thử database tạm, không dùng database thật |
| `backend/data/erd.html` | Sơ đồ nghiệp vụ tham chiếu |

## Chạy lần đầu (từ thư mục gốc)

```powershell
python -m pip install -r backend/requirements.txt
python -m backend.app.database.init_db
python -m backend.app.database.seed_db
python -m backend.main
```

Mở http://127.0.0.1:5000/health để kiểm tra kết nối. Đây là backend khung;
chưa có giao diện hoặc API đăng ký, đặt lịch, thanh toán. Trang `/` chưa được xây dựng.
Python cần SQLite 3.37+ cho bảng STRICT (kiểm tra bằng `python -c "import sqlite3; print(sqlite3.sqlite_version)"`).

Database cũ `database/clinic.db` được chuyển nguyên trạng sang `backend/data/medical_booking.db`;
không tạo bản dữ liệu hoạt động thứ hai. Chạy `init_db.py` để tạo bảng còn thiếu sau khi kiểm tra cấu trúc tương thích; thao tác giữ dữ liệu.

## Dữ liệu nền, demo và admin

```powershell
python -m backend.app.database.seed_db
python -m backend.app.database.seed_db --demo
python -m backend.app.database.seed_db --admin
```

- Seed thường chỉ thêm 5 vai trò được ERD xác định. Không tự đặt khoa/cấu hình nghiệp vụ chưa được thống nhất.
- `--demo` thêm một tác giả bị khóa, không có mật khẩu, và một bài viết DEMO chưa kích hoạt.
  Không tạo bệnh nhân, lượt khám hay giao dịch giả. Có thể sửa nội dung demo; chạy seed lại không ghi đè.
- `--admin` hỏi email, họ tên và mật khẩu ẩn (ít nhất 12 ký tự). Có thể dùng ADMIN_EMAIL,
  ADMIN_NAME, ADMIN_PASSWORD từ môi trường. Không truyền mật khẩu bằng tham số CLI hay đưa lên Git.
- Mật khẩu được băm bằng Werkzeug. Email admin đã tồn tại sẽ được giữ nguyên, không đổi mật khẩu,
  không tự nâng quyền tài khoản đã có. Email admin mới được chuẩn hóa chữ thường.
- Seed và init có thể chạy lại; không xóa dữ liệu. Tìm quan hệ qua role_name, email, slug, không dựa vào ID cố định.

## Đường dẫn và kết nối

```powershell
$env:DB_PATH = 'D:\duong-dan-rieng\clinic.db'
python -m backend.app.database.init_db
python -m backend.app.database.seed_db
python -m backend.main
```

DB_PATH tương đối được tính từ `backend`, không phụ thuộc thư mục đang chạy.
`init_db.py` và `seed_db.py` còn nhận `--db <đường-dẫn>` cho từng lần gọi.
Thư mục cha được tạo nếu thiếu. Kết nối thông thường không tự sinh database trống;
chỉ init được phép tạo tệp mới. Xóa biến môi trường để dùng lại mặc định:

```powershell
Remove-Item Env:DB_PATH
```

Trong code backend:

```python
from backend.app.database.database import get_db_connection

with get_db_connection() as db:
    rows = db.execute('SELECT role_id, role_name FROM role').fetchall()
    # SQL có dữ liệu đầu vào phải dùng placeholder ? và tuple tham số.
```

Thoát `with` thành công sẽ commit; lỗi sẽ rollback rồi được báo lại; kết nối luôn đóng.
Dữ liệu đăng ký/đặt lịch phát sinh sẽ được lưu qua service và route tương ứng, không đưa vào seed.

## Thay đổi cấu trúc sau này

Khởi tạo dùng CREATE TABLE IF NOT EXISTS trong một transaction. Chạy lại không
xóa bản ghi; lỗi tạo bảng sẽ rollback. Không dùng hệ thống quản lý phiên bản.
CREATE TABLE IF NOT EXISTS chỉ tạo bảng thiếu, không tự thêm/sửa cột đã tồn tại.
Nếu cấu trúc hiện tại khác định nghĩa Python, init báo lỗi rõ ràng. Khi cần đổi
cấu trúc, sao lưu dữ liệu và chạy lệnh ALTER TABLE phù hợp trước khi chạy lại init.

## Bảng, cột và quan hệ

ID số nguyên là INTEGER PRIMARY KEY tự sinh. Có 18 bảng nghiệp vụ dưới đây.

| Bảng | Các cột theo ERD |
|---|---|
| `role` | `role_id`, `role_name`, `description`, `requires_approval` |
| `users` | `user_id`, `role_id`, `full_name`, `phone`, `email`, `password_hash`, `approval_status`, `account_status`, `email_verified`, `deleted_at`, `created_at`, `updated_at` |
| `auth_token` | `token_id`, `user_id`, `token_type`, `token_hash`, `expires_at`, `used_at`, `created_at` |
| `patient` | `patient_id`, `user_id`, `full_name`, `dob`, `gender`, `id_card`, `address`, `phone`, `health_insurance`, `relationship`, `created_at`, `updated_at` |
| `department` | `department_id`, `name`, `description`, `is_active`, `created_at`, `updated_at` |
| `doctor_profile` | `doctor_profile_id`, `user_id`, `department_id`, `academic_degree`, `specialization`, `experience_years`, `introduction`, `consultation_fee`, `avatar_url`, `is_active`, `created_at`, `updated_at` |
| `room` | `room_id`, `department_id`, `room_name`, `description`, `is_active`, `created_at`, `updated_at` |
| `work_schedule` | `schedule_id`, `doctor_profile_id`, `room_id`, `work_date`, `start_time`, `end_time`, `max_quota`, `booked_count`, `schedule_status`, `unavailable_reason`, `created_at`, `updated_at` |
| `visit` | `visit_id`, `visit_type`, `patient_id`, `doctor_profile_id`, `schedule_id`, `room_id`, `created_by_id`, `symptoms`, `visit_status`, `queue_number`, `estimated_exam_at`, `qr_code`, `hold_expires_at`, `checked_in_at`, `cancelled_by_id`, `cancel_reason`, `cancelled_at`, `created_at`, `updated_at` |
| `visit_status_log` | `log_id`, `visit_id`, `old_status`, `new_status`, `changed_by_id`, `note`, `changed_at` |
| `visit_transfer_log` | `log_id`, `visit_id`, `old_doctor_id`, `new_doctor_id`, `transferred_by_id`, `reason`, `transferred_at` |
| `payment` | `payment_id`, `visit_id`, `payment_type`, `amount`, `payment_method`, `transaction_status`, `transaction_code`, `paid_at`, `refunded_at`, `created_at`, `updated_at` |
| `medical_record` | `record_id`, `visit_id`, `diagnosis`, `treatment`, `doctor_notes`, `examined_at`, `created_at`, `updated_at` |
| `prescription_item` | `item_id`, `record_id`, `medication_name`, `dosage`, `quantity`, `instructions` |
| `review` | `review_id`, `record_id`, `rating`, `comment`, `created_at`, `updated_at` |
| `notification` | `notification_id`, `user_id`, `notification_type`, `title`, `content`, `reference_type`, `reference_id`, `is_read`, `created_at` |
| `article` | `article_id`, `author_id`, `title`, `slug`, `category`, `thumbnail_url`, `content`, `is_active`, `published_at`, `created_at`, `updated_at` |
| `system_configuration` | `config_key`, `config_value`, `description`, `updated_at` |

Các quan hệ chính:

- role → users; users → auth_token, patient, notification, article.
- users → doctor_profile là một–không hoặc một (user_id UNIQUE).
- department → doctor_profile và room; bác sĩ/phòng → work_schedule.
- patient, doctor_profile → visit; schedule và room của visit có thể NULL theo ERD.
- visit.created_by_id/cancelled_by_id và người thao tác trong log tham chiếu users.
- visit → visit_status_log, visit_transfer_log, payment; log chuyển bác sĩ trỏ doctor_profile.
- visit → medical_record một–không hoặc một; medical_record → prescription_item nhiều,
  và review một–không hoặc một.
- UNIQUE (doctor_profile_id, work_date, start_time), (room_id, work_date, start_time),
  (schedule_id, queue_number); email, phone, transaction_code, slug là UNIQUE.

## Quy ước và phần nghiệp vụ cần triển khai tiếp

- Tiền lưu INTEGER VND, boolean 0/1. Timestamp UTC `YYYY-MM-DD HH:MM:SS.SSS`, ngày
  `YYYY-MM-DD`, giờ `HH:MM:SS`; backend phải chuẩn hóa định dạng, chuyển múi giờ khi hiển thị.
- Trigger tự cập nhật updated_at. CHECK kiểm soát trạng thái, quota, thời gian ca,
  số lượng thuốc, tiền không âm và rating 1–5.
- gender và notification_type chưa có enum trong ERD nên dùng TEXT.
- Backend còn phải kiểm tra vai trò của bác sĩ, bác sĩ/phòng khớp ca, lịch chồng lấn,
  chuyển trạng thái hợp lệ, cập nhật booked_count bằng transaction và ghi log.
- notification.reference_id là tham chiếu đa hình, backend kiểm tra theo reference_type.
- changed_by_id trong log bắt buộc theo ERD; tác vụ tự động cần tài khoản hệ thống hợp lệ.
- Chưa có tác vụ tự động hết hạn giữ chỗ, đăng nhập, gửi email hoặc xử lý thanh toán.

## Kiểm thử

```powershell
python -m unittest discover -s backend/tests -v
```

Kiểm thử dùng thư mục tạm riêng: tạo từ rỗng; init/seed lặp; đối chiếu ERD; dữ liệu demo;
mật khẩu băm/không bị thay; FK, UNIQUE, CHECK, timestamp; khởi tạo lỗi rollback;
nhận quản lý schema cũ; HTTP /health không seed lúc khởi động. Không sửa database thật.
