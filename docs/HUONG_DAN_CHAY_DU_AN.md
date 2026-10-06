# Cách chạy dự án

Chạy các lệnh dưới đây trong terminal PowerShell, tại thư mục gốc dự án.
Mở Docker Desktop trước khi chạy.

## 1. Chuẩn bị cấu hình (chỉ lần đầu)

Sau khi clone code, `compose.yaml` ở thư mục gốc đã có sẵn trong repository.
File này không chứa mật khẩu thật; Docker đọc mật khẩu từ `backend/.env`.

Tạo file `.env` trong thư mục `backend`, hoặc dùng:

```powershell
Copy-Item backend/.env.example backend/.env
```

Không chép đè nếu đã có `.env`. Dán vào `backend/.env`:

```dotenv
POSTGRES_PASSWORD=mat_khau_cua_ban
DB_PASSWORD=mat_khau_cua_ban
```

Thay `mat_khau_cua_ban` bằng cùng một mật khẩu ở cả hai dòng.
Máy hiện tại đã có `.env` với mật khẩu đang dùng, không cần tạo lại.
Compose đã có `env_file: ./backend/.env` cho cả database và backend.
Database và tài khoản là `medical`; PostgreSQL mở cổng 5433, backend mở cổng 5000.
Không đưa `.env` lên Git.

## 2. Chạy dự án trên Docker

```powershell
docker compose up --build -d
docker compose ps
```

Docker tự tạo bảng từ `database/init_db.sql`, thêm 5 vai trò và chạy backend.
Chờ cả hai container báo `healthy`.

Mở http://localhost:5000/health. Kết quả đúng:

```json
{"database":"postgresql","status":"ok"}
```

Trang `/` chưa có giao diện.

## 3. Nạp dữ liệu mẫu (khi cần)

Chạy trong PowerShell từ thư mục gốc:

```powershell
Get-Content -Raw -Encoding UTF8 database/sample_data.sql | docker compose exec -T db psql -U medical -d medical -v ON_ERROR_STOP=1
```

Lệnh đọc file trên máy và nhập vào database Docker, không cần build lại.
**File này xóa dữ liệu hiện có rồi nạp lại dữ liệu mẫu.** Máy hiện tại đã nạp dữ
liệu; chỉ chạy lại nếu muốn đặt lại dữ liệu mẫu. Mật khẩu tài khoản mẫu chưa phải
hash hợp lệ để đăng nhập bằng backend.

## 4. Các lệnh thường dùng

```powershell
# Chạy lại:
docker compose up -d
# Khi sửa code hoặc cấu hình:
docker compose up --build -d
# Dừng:
docker compose stop
# Xem log backend:
docker compose logs -f backend
# Tạo admin, nhập email, họ tên và mật khẩu khi được hỏi:
docker compose exec backend python -m backend.app.db.seed_db --admin
```

Có thể Start cả nhóm `medical-booking` trong Docker Desktop nếu container đã
được tạo. Sau khi sửa code hoặc cấu hình, dùng lệnh up/build ở trên.

## 5. Lưu ý

- Backend kết nối `db:5432`; công cụ trên Windows kết nối `127.0.0.1:5433`.
- Dừng container không xóa dữ liệu. **`docker compose down -v` xóa dữ liệu database.**
- Với volume đã có, sửa mật khẩu trong `.env` không tự đổi mật khẩu PostgreSQL;
  cần đổi bằng `ALTER ROLE` trước rồi cập nhật cả hai dòng trong `.env`.
- Khi backend không chạy, xem `docker compose logs --tail 60 backend`.
