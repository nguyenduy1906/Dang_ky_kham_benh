# Đăng ký và đặt lịch khám bệnh — NEU Medical

Frontend HTML/CSS/JavaScript chạy bằng Node.js; backend Flask/Gunicorn và PostgreSQL 17 chạy bằng Docker Compose. Compose có hai dịch vụ `db`, `backend`; tác vụ nền chạy cùng container backend.

## 1. Chạy nhanh hằng ngày

Cần **Docker Desktop đang chạy** và **Node.js 20 trở lên**. Các lệnh bên dưới dùng PowerShell.

Nếu đã có `backend/.env` và database đã khởi tạo, mở PowerShell tại thư mục gốc rồi chạy:

```powershell
cd "D:\Đăng ký và lên lịch khám bệnh"
docker compose up -d --build --remove-orphans
docker compose ps
npm --prefix frontend start
```

Đợi `db` và `backend` báo `healthy`. Giữ cửa sổ PowerShell chạy frontend. Không cần `npm install` vì server frontend chỉ dùng thư viện có sẵn của Node.js.

| Chức năng | Địa chỉ |
|---|---|
| Trang chủ | http://127.0.0.1:3000/frontend/templates/public/home.html |
| Đăng nhập | http://127.0.0.1:3000/frontend/templates/auth/login.html |
| Kiểm tra backend/database | http://127.0.0.1:5000/health |
| Swagger — tài liệu và thử API | http://127.0.0.1:5000/docs/ |

Đăng nhập nhanh: **`admin@medicare.vn` / `Demo-password-123!`** nếu database đã nạp dữ liệu mẫu. Các tài khoản khác xem mục 3.

Nếu chỉ xem giao diện, chạy riêng `npm --prefix frontend start`. Đăng nhập và các trang đã gọi API cần backend/database hoạt động; mức độ tích hợp tùy trang, không phải mọi chức năng nghiệp vụ đều đã hoàn thiện.

## 2. Chuẩn bị lần đầu

### Tạo cấu hình

Tại thư mục gốc dự án:

```powershell
if (-not (Test-Path backend/.env)) {
    Copy-Item backend/.env.example backend/.env
}
```

Mở `backend/.env`, đặt `POSTGRES_PASSWORD` và `DB_PASSWORD` **giống nhau**, đồng thời đặt `SECRET_KEY` riêng. File mẫu hiện có sẵn giá trị demo, không dùng các giá trị đó khi triển khai thật. Giữ `backend/.env` ngoài Git.

Với database đã tồn tại, đổi mật khẩu trong `.env` không tự đổi mật khẩu PostgreSQL. Không chép đè cấu hình đang dùng.

### Khởi tạo database mới và nạp tài khoản mẫu

**Chỉ nạp mẫu với database mới hoặc dữ liệu được phép thay thế: `sample_data.sql` xóa dữ liệu cũ trước khi nạp.** Nếu đã có dữ liệu cần giữ, dùng mục 1 và bỏ qua bước này.

```powershell
docker compose up -d db
docker compose ps
```

Đợi `db` báo `healthy`, sau đó tạo bảng khi API/worker chưa chạy:

```powershell
docker compose run --rm --build --no-deps --entrypoint python backend -m backend.app.db.init_db
```

Khi khởi tạo thành công, nạp mẫu bằng cách chép nguyên file UTF-8 vào container:

```powershell
docker compose cp database/sample_data.sql db:/tmp/medical-sample-data.sql
docker compose exec -T db psql -U medical -d medical -v ON_ERROR_STOP=1 -f /tmp/medical-sample-data.sql
```

Chỉ tiếp tục khi SQL thành công và có `COMMIT`. Nếu báo schema cũ/thiếu cột, dừng tại đây: rebuild backend không nâng cấp bảng đã tồn tại. Đọc [hướng dẫn database](docs/HUONG_DAN_CHAY_DU_AN.md) trước khi quyết định tạo lại dữ liệu.

Khởi động hệ thống:

```powershell
docker compose up -d --build --remove-orphans
docker compose ps
npm --prefix frontend start
```

Nếu cần nạp lại mẫu về sau, phải `docker compose stop backend` trước khi nạp để API/worker không xử lý dữ liệu cùng lúc; chỉ bật lại backend sau khi nạp thành công. Không cần nạp mẫu mỗi lần chạy.

## 3. Tài khoản người dùng mẫu

Mỗi vai trò dùng một tài khoản đại diện dưới đây. **Mật khẩu chung: `Demo-password-123!`** — phân biệt chữ hoa/chữ thường, có dấu `!` cuối.

| Vai trò | Họ tên | Email hoặc số điện thoại đăng nhập |
|---|---|---|
| Quản trị — ADMIN | Nguyễn Minh Quản | admin@medicare.vn |
| Lễ tân — RECEPTIONIST | Trần Thu Hà | reception@medicare.vn |
| Bác sĩ — DOCTOR | BS. Nguyễn Hoàng Minh | minh.nguyen@medicare.vn |
| Điều dưỡng — NURSE | Lê Ngọc Anh | nurse@medicare.vn |
| Người dùng/bệnh nhân — USER | Phạm Văn Nam | 0911000001 |

Các tài khoản này chỉ có khi database đã nạp dữ liệu mẫu và chưa bị đổi mật khẩu/khóa/xóa. Backend khởi động thông thường chỉ seed vai trò, không tự nạp tài khoản mẫu. Mật khẩu trên chỉ dùng cho demo đồ án.

## 4. Dừng, xem log và xử lý nhanh

Dừng frontend bằng **Ctrl+C** tại cửa sổ đang chạy. Mở PowerShell khác tại thư mục gốc để quản lý Docker:

```powershell
# Dừng backend/database, giữ dữ liệu
docker compose stop

# Chạy lại, không cần build nếu mã nguồn không đổi
docker compose up -d

# Xem trạng thái và log
docker compose ps
docker compose logs --tail 80 backend
docker compose logs --tail 80 db
```

- Cổng frontend 3000 đang bận: chạy `npm --prefix frontend start -- --port 5500`, rồi mở http://127.0.0.1:5500/frontend/templates/public/home.html.
- Không gọi được API: kiểm tra Docker Desktop, trạng thái `healthy` và http://127.0.0.1:5000/health. Kết quả mong đợi: `{"database":"postgresql","status":"ok"}`.
- API frontend mặc định ở `http://127.0.0.1:5000`, cấu hình tại `frontend/static/js/config.js`. Mẫu backend cho phép frontend ở cổng 3000 và 5500 trên `localhost`/`127.0.0.1`.
- Sai tài khoản/mật khẩu: kiểm tra database đã nạp mẫu, định danh ở mục 3 và mật khẩu có dấu `!`. Không nạp lại mẫu nếu cần giữ dữ liệu hiện tại.
- Thay đổi `.env`: cần tạo lại container backend bằng `docker compose up -d --force-recreate backend` để nhận cấu hình mới.

PostgreSQL cho DBeaver/pgAdmin: host `127.0.0.1`, port `5433`, database `medical`, user `medical`, mật khẩu theo `backend/.env`. Đây là tài khoản kết nối database, khác tài khoản đăng nhập website.

**Không chạy `docker compose down -v` nếu muốn giữ dữ liệu PostgreSQL.** Ảnh tải lên hiện được bind mount tại `backend/uploads`.

## 5. Cấu trúc và tài liệu

| Đường dẫn | Chức năng |
|---|---|
| `frontend/` | Trang HTML, CSS, JavaScript và server giao diện |
| `docker-compose.yml` | Chạy backend và PostgreSQL |
| `backend/.env.example` | Mẫu cấu hình |
| `backend/app/main.py` | Ứng dụng Flask |
| `backend/app/utils/server.py` | Khởi tạo database/vai trò, chạy API và worker |
| `database/init_db.sql` | Schema hiện tại; không tự nâng cấp bảng cũ |
| `database/sample_data.sql` | Dữ liệu và tài khoản demo; xóa dữ liệu cũ khi nạp |
| `database/erd.html` | Sơ đồ database |

API dùng đường dẫn trực tiếp như `/auth/login`, `/me`, `/admin/users`, `/patients`, `/encounters`; không thêm `/api/v1` hoặc `/v1`.

- [Hướng dẫn chạy và quản lý database](docs/HUONG_DAN_CHAY_DU_AN.md)
- [Báo cáo nghiệp vụ](docs/BAO_CAO_NGHIEP_VU.md)
- [Tổng hợp phân tích nghiệp vụ](docs/TONG_HOP_PHAN_TICH_NGHIEP_VU.txt)
- [Hướng dẫn frontend](frontend/README.md)

Một số mô tả cũ trong tài liệu còn ghi 15/23 tài khoản hoặc chưa có frontend. Hướng dẫn nhanh và danh sách ở README này dựa trên cấu hình, mã nguồn và seed hiện tại. File `docs/DANH_SACH_API_VA_PHAN_CONG_BACKEND.md` được tài liệu cũ nhắc đến nhưng hiện không có trong checkout này.
