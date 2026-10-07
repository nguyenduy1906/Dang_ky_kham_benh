# Đăng ký và đặt lịch khám bệnh

Backend Flask + Gunicorn và PostgreSQL 17 chạy bằng Docker Compose.
Hiện có 20 bảng, dữ liệu mẫu và endpoint `/health`; chưa có giao diện hoặc API
nghiệp vụ hoàn chỉnh.

## Chạy dự án

Mở Docker Desktop. Từ thư mục gốc, chạy:

```powershell
docker compose up --build -d
```

Cấu hình `docker-compose.yml` và mẫu `backend/.env.example` được chia sẻ cùng mã nguồn.
Sau khi clone, chạy `Copy-Item backend/.env.example backend/.env`, rồi thay
`CHANGE_ME` ở cả hai dòng bằng cùng một mật khẩu bạn chọn.
Chỉ `backend/.env` chứa mật khẩu thật được Git bỏ qua.
Xem các bước chuẩn bị và nhập dữ liệu tại
[Hướng dẫn chạy dự án](docs/HUONG_DAN_CHAY_DU_AN.md).

- Backend: http://localhost:5000/health
- Tài liệu và thử API (Swagger): http://localhost:5000/docs/
- PostgreSQL: `127.0.0.1:5433`; database và tài khoản: `medical`.

## Các file chính

Danh sách API, phân công và vị trí viết code:
[Kế hoạch backend](docs/DANH_SACH_API_VA_PHAN_CONG_BACKEND.md).

| File | Chức năng |
|---|---|
| `docker-compose.yml` | Chạy backend và PostgreSQL |
| `backend/.env` | Mật khẩu database, không đưa lên Git |
| `backend/.env.example` | Mẫu cấu hình |
| `backend/Dockerfile` | Build image, tạo bảng, seed vai trò và chạy backend |
| `backend/app/main.py` | Tạo ứng dụng Flask |
| `database/init_db.sql` | Tạo cấu trúc database |
| `database/sample_data.sql` | Nạp dữ liệu mẫu thủ công, xóa dữ liệu cũ trước khi nạp |
| `database/erd.html` | Sơ đồ database |

## Dừng và xem log

```powershell
docker compose stop
docker compose logs -f backend
```

Dữ liệu lưu trong volume. **Không chạy `docker compose down -v` nếu muốn giữ dữ liệu.**

Phạm vi nghiệp vụ và phân công theo 5 gói: [Kế hoạch backend](docs/DANH_SACH_API_VA_PHAN_CONG_BACKEND.md).
