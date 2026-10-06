# Đăng ký và đặt lịch khám bệnh

Backend Flask + Gunicorn và PostgreSQL 17 chạy bằng Docker Compose.
Hiện dự án có cấu trúc database 18 bảng, seed 5 vai trò và endpoint `/health`;
chưa có giao diện hoặc API nghiệp vụ đăng ký, đăng nhập và đặt lịch hoàn chỉnh.

## Chạy nhanh

Mở Docker Desktop với Linux containers, sau đó chạy từ thư mục gốc dự án:

```powershell
docker compose up --build -d
docker compose ps
```

Cần có `compose.yaml` tại thư mục gốc trước khi chạy. File này chứa cấu hình
riêng và đang được `.gitignore` bỏ qua; khi clone trên máy mới, tạo file theo
mẫu trong [hướng dẫn chạy dự án](docs/HUONG_DAN_CHAY_DU_AN.md).

- Backend: http://localhost:5000/health
- PostgreSQL trên Windows: `127.0.0.1:5433`
- Database: `medical`; tài khoản: `medical`.
- Backend kết nối nội bộ Docker bằng `db:5432`.

## Cấu trúc

```text
backend/
  app/
    core/          # Cấu hình PostgreSQL
    db/            # Kết nối, khởi tạo và seed
    routes/        # Các endpoint HTTP
    models/
    schemas/
    services/
    main.py        # Tạo ứng dụng Flask
  tests/           # Kiểm thử PostgreSQL
  uploads/
  Dockerfile       # Build image và tự init/seed/chạy Gunicorn
  requirements.txt
database/
  postgres_schema.sql
  erd.html
frontend/
  static/
  templates/
docs/
  HUONG_DAN_CHAY_DU_AN.md
compose.yaml       # Cấu hình chạy cục bộ, không đưa lên Git
```

## Các lệnh thường dùng

```powershell
docker compose up -d          # Chạy với image đã có
docker compose stop           # Dừng, giữ dữ liệu
docker compose logs -f backend
# Sau khi sửa code hoặc YAML:
docker compose up --build -d
```

Chi tiết thiết lập trên máy mới, kết nối pgAdmin, tạo admin, kiểm thử và xử lý
lỗi nằm trong [docs/HUONG_DAN_CHAY_DU_AN.md](docs/HUONG_DAN_CHAY_DU_AN.md).

## Lưu ý dữ liệu và cấu hình

Database lưu trong volume `medical-booking_postgres_data`. `docker compose down`
giữ volume; **`docker compose down -v` xóa dữ liệu database**.

Cấu hình kết nối hiện được điền trực tiếp trong `compose.yaml`. `backend/.env`
không được Compose tự đọc trong cấu hình hiện tại; không có cơ chế `include`.
Mật khẩu thật, file upload và bản sao lưu không đưa lên Git.

Backend tự tạo bảng và seed vai trò mỗi khi khởi động, không tự tạo admin hoặc
bệnh nhân. Sửa cấu trúc bảng đã tồn tại cần migration/`ALTER TABLE`; khởi động
lại không tự thêm hoặc sửa cột.
