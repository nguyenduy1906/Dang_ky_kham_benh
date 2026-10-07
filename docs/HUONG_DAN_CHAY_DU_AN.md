# Hướng dẫn chạy backend và database

Chạy PowerShell tại thư mục gốc. Dự án dùng docker-compose.yml, Flask/Gunicorn
và PostgreSQL 17. Mở Docker Desktop trước khi chạy.

## 1. Chuẩn bị lần đầu

```powershell
cd "D:\Đăng ký và lên lịch khám bệnh"
```

Nếu chưa có backend/.env, tạo từ mẫu (không chép đè file đang dùng):

```powershell
Copy-Item backend/.env.example backend/.env
```

Thay CHANGE_ME ở POSTGRES_PASSWORD và DB_PASSWORD bằng cùng một mật khẩu.
Không đưa backend/.env lên Git. Với volume cũ, sửa .env không tự đổi mật khẩu
PostgreSQL; phải đổi mật khẩu tài khoản database tương ứng trước.

## 2. Tạo mới hoặc đặt lại toàn bộ dữ liệu đồ án

**down -v xóa volume PostgreSQL và toàn bộ dữ liệu cũ.** Bỏ qua lệnh đó nếu đang
khởi tạo lần đầu hoặc muốn giữ dữ liệu. Schema cuối cùng nằm trong init_db.sql.

```powershell
docker compose down -v
docker compose up --build -d
docker compose ps
```

Đợi db và backend đều healthy. Backend tự tạo 20 bảng và seed 5 vai trò;
chưa tự nạp toàn bộ dữ liệu mẫu. Muốn có dữ liệu mẫu, chạy:

```powershell
Get-Content -Raw -Encoding UTF8 database/sample_data.sql | docker compose exec -T db psql -U medical -d medical -v ON_ERROR_STOP=1
```

**sample_data.sql xóa dữ liệu trong các bảng trước khi nạp lại**, dù không xóa
volume. File chạy trong transaction; nếu có lỗi, không tiếp tục các bước khác.
Có 15 tài khoản mẫu, mật khẩu chung Demo-password-123!, lưu bằng hash hợp lệ.
Thanh toán, mã QR và thông báo trong file chỉ là dữ liệu giả lập cho đồ án.

## 3. Quy trình khi thay đổi cấu trúc database

Dự án sử dụng một schema cuối cùng trong database/init_db.sql, không lưu các
file cập nhật database riêng. Khi sửa cấu trúc, cập nhật đồng bộ init_db.sql,
sample_data.sql và erd.html; sau đó tạo lại database theo mục 2.
Không dùng init_db.sql để nâng cấp database cũ: CREATE TABLE IF NOT EXISTS
không sửa cấu trúc bảng đã tồn tại. Việc khởi động lại backend trên cùng phiên
bản schema vẫn giữ dữ liệu.

## 4. Kiểm tra kết quả

- Health: http://localhost:5000/health
- Swagger: http://localhost:5000/docs/
- Trang / chưa có giao diện. API nghiệp vụ trong kế hoạch chưa được triển khai.

Kết quả health mong đợi:

```json
{"database":"postgresql","status":"ok"}
```

```powershell
docker compose exec -T db psql -U medical -d medical -c "SELECT user_id, full_name, email, account_status FROM users ORDER BY user_id;"
docker compose exec -T db psql -U medical -d medical -c "SELECT encounter_id, encounter_type, encounter_status FROM encounter ORDER BY encounter_id;"
```

DBeaver/pgAdmin trên Windows: host 127.0.0.1, port 5433, database medical,
user medical, password theo backend/.env. Backend trong Docker dùng db:5432.

## 5. Lệnh dùng hằng ngày

| Việc | Lệnh |
|---|---|
| Chạy lại | docker compose up -d |
| Sau khi sửa code/dependencies | docker compose up --build -d |
| Dừng, giữ dữ liệu | docker compose stop |
| Xóa container, giữ volume | docker compose down |
| Xóa container và dữ liệu | docker compose down -v |
| Xem trạng thái | docker compose ps |
| Xem lỗi backend | docker compose logs --tail 60 backend |
| Xem lỗi database | docker compose logs --tail 60 db |

Tạo admin bằng thông tin nhập tương tác:

```powershell
docker compose exec backend python -m backend.app.db.seed_db --admin
```

Backend hiện đã có kiểm thử tích hợp PostgreSQL trong schema tạm. Sau khi build
image chứa mã mới, có thể chạy kiểm thử mà không sửa bảng dữ liệu chính:

```powershell
docker compose exec -e RUN_POSTGRES_TESTS=1 backend python -m unittest backend.tests.test_postgres
```

Lệnh này cần database hoạt động và tài khoản có quyền tạo schema.

## 6. Quy ước schema khi triển khai API

- Tên thống nhất: encounter, encounter_id, encounter_type, encounter_status;
  encounter_status_log và encounter_transfer_log. Thông báo dùng ENCOUNTER.
- Chỉ USER tự đăng ký. ADMIN tạo nhân viên sau khi kiểm tra hợp đồng bên ngoài;
  không xây luồng xin đổi vai trò. role_request vẫn có trong schema hiện tại nhưng
  chưa sử dụng; không tự xóa bảng hoặc triển khai API cho nó.
- patient.archived_at chỉ ngừng dùng cho lượt khám mới; không xóa lịch sử.
- Y tá chỉ thao tác trong ca được phân công và chưa thu hồi ở nurse_assignment.
- Chỉ bác sĩ có avatar, dùng doctor_profile.avatar_url.
- Giá và cọc trên encounter được server chốt khi tạo. Walk-in không cọc ghi 0.
  Tổng tiền thu = tiền cọc + phần phí còn lại; không cộng hai lần toàn bộ giá khám.
- ONLINE và WALK_IN dùng chung bảng nhưng có endpoint/luồng riêng. Quy ước đề xuất
  cho đồ án: lễ tân/hệ thống gắn ca cho walk-in trước khi tiếp nhận.
  encounter.schedule_id bắt buộc cho cả ONLINE và WALK_IN.
