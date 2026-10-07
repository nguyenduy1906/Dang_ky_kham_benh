# Cách chạy dự án

Chạy các lệnh dưới đây trong terminal PowerShell, tại thư mục gốc dự án.
Mở Docker Desktop trước khi chạy.

## 1. Chuẩn bị cấu hình (chỉ lần đầu)

Sau khi clone code, `docker-compose.yml` ở thư mục gốc đã có sẵn trong repository.
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

Xem và thử API tại http://localhost:5000/docs/. Mở GET `/health`, chọn
Try it out → Execute để gọi API. Khi thêm route mới, viết mô tả YAML trong
docstring của hàm (tham khảo `backend/app/routes/__init__.py`) rồi đăng ký
Blueprint trong `app/main.py`; Flasgger sẽ đưa API có mô tả vào Swagger.

## 3. Nạp dữ liệu mẫu (khi cần)

Chạy trong PowerShell từ thư mục gốc:

```powershell
Get-Content -Raw -Encoding UTF8 database/sample_data.sql | docker compose exec -T db psql -U medical -d medical -v ON_ERROR_STOP=1
```

Lệnh đọc file trên máy và nhập vào database Docker, không cần build lại.
**File này xóa dữ liệu hiện có rồi nạp lại dữ liệu mẫu.** Máy hiện tại đã nạp dữ
liệu; chỉ chạy lại nếu muốn đặt lại dữ liệu mẫu. Tài khoản mẫu dùng mật khẩu `Demo-password-123!`, được lưu dưới dạng hash
hợp lệ. Chỉ dùng mật khẩu chung này cho dữ liệu đồ án.

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

## 6. Nâng cấp database từ 18 lên 20 bảng

Mở Docker Desktop, chạy database và migration trước khi build lại backend:

```powershell
docker compose up -d db
Get-Content -Raw -Encoding UTF8 database/migrations/001_extend_booking_schema.sql | docker compose exec -T db psql -U medical -d medical -v ON_ERROR_STOP=1
docker compose up --build -d
```

Migration không xóa bản ghi cũ và có thể chạy lại. Database mới dùng init_db.sql
đã có đủ 20 bảng; không cần migration này. CREATE TABLE IF NOT EXISTS không tự
thêm cột vào các bảng cũ, nên chỉ build lại không thay thế bước migration.

Quy ước cho API sẽ triển khai:

- role_request lưu yêu cầu riêng, không thay role_id của users khi mới gửi yêu cầu.
  Mỗi tài khoản có tối đa một yêu cầu PENDING. Backend kiểm tra người duyệt là ADMIN,
  vai trò xin cấp hợp lệ và khác vai trò hiện tại; duyệt và đổi role cùng transaction.
  Từ chối cần review_note. Nếu cấp DOCTOR, phải xử lý doctor_profile phù hợp.
- patient.archived_at NULL nghĩa là đang sử dụng. Archive chỉ ngừng dùng cho lượt
  khám mới, không xóa hồ sơ và lịch sử; vẫn kiểm tra quyền khi xem lịch sử.
- nurse_assignment gắn y tá với ca. Backend kiểm tra nurse_id có vai trò NURSE và
  người phân công có quyền ADMIN; không suy ra quyền chỉ từ khóa ngoại users.
  Chỉ phân công có revoked_at NULL mới cấp quyền thao tác trong ca; thu hồi phải
  lưu cả revoked_at và revoked_by_id. Có thể phân công lại bằng bản ghi mới.
- visit.consultation_fee_snapshot và deposit_amount_snapshot lưu số nguyên VND.
  Khi tạo lượt khám mới, backend phải ghi cả hai từ giá/chính sách phía server;
  không nhận giá do client quyết định. Walk-in không cọc ghi deposit bằng 0.
  Không cập nhật hai giá đã chốt khi đổi giá bác sĩ. Chuyển bác sĩ giữ giá đã chốt
  trong phạm vi đồ án. Database kiểm tra số tiền không âm, cọc không vượt giá khám.
- Với lượt khám cũ chưa biết giá đã chốt, cả hai snapshot để NULL (chưa biết),
  không coi là miễn phí và không tự suy ra từ giá hiện tại. File sample_data.sql mới
  đã có giá snapshot và thanh toán cọc/phần còn lại giả lập. API thu tiền vẫn phải
  xử lý trường hợp dữ liệu cũ chưa có giá.

Thanh toán và email vẫn là mô phỏng; các thay đổi này không tích hợp dịch vụ ngoài.

## 7. Bắt buộc mật khẩu tài khoản

Schema mới yêu cầu users.password_hash NOT NULL và không rỗng. Database cũ chạy:

```powershell
Get-Content -Raw -Encoding UTF8 database/migrations/002_require_password_hash.sql | docker compose exec -T db psql -U medical -d medical -v ON_ERROR_STOP=1
```

Nếu chưa chạy migration 001, chạy 001 trước 002. Sau đó build lại backend.
Migration 002 giữ nguyên hash đang có, trừ NULL, chuỗi rỗng hoặc placeholder
`demo_hash_*` cũ: các tài khoản đó nhận hash của mật khẩu ngẫu nhiên không được
công bố và bị LOCKED. Cần đặt lại mật khẩu hợp lệ trước khi kích hoạt lại.
Migration không tự mở khóa tài khoản. Có thể chạy lại an toàn.

sample_data.sql mới có 15 hash hợp lệ cho mật khẩu `Demo-password-123!`.
Nạp lại file mẫu sẽ xóa dữ liệu cũ; không dùng cách này để nâng cấp dữ liệu thật.
Tác giả tạo bởi seed_db --demo vẫn bị khóa, có mật khẩu ngẫu nhiên riêng.
