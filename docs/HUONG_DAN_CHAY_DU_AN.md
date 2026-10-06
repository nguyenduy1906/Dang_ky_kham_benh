# Hướng dẫn chạy dự án bằng Docker

## 1. Chuẩn bị

- Docker Desktop đang chạy, dùng Linux containers và Docker Compose v2 trở lên.
- Có cổng 5000 cho backend và 5433 cho PostgreSQL trên Windows.
- pgAdmin 4 nếu muốn xem hoặc sửa dữ liệu qua giao diện.
- Không cần cài Python hay PostgreSQL riêng để chạy dự án bằng Docker.

Mở terminal ở thư mục gốc chứa `backend`, `database` và `compose.yaml`:

```powershell
cd "D:\Đăng ký và lên lịch khám bệnh"
docker compose version
docker info
```

Nếu dự án nằm ở vị trí khác, thay đường dẫn tương ứng.

## 2. Cấu hình Docker Compose

Trên máy hiện tại đã có `compose.yaml`; không chép đè cấu hình đang dùng.
File này bị Git bỏ qua vì chứa mật khẩu thật. Khi clone trên máy mới, tạo
`compose.yaml` ở thư mục gốc theo mẫu dưới đây. Thay cả hai giá trị
`CHANGE_ME` bằng cùng một mật khẩu do bạn chọn, trước khi chạy.

```yaml
name: medical-booking
services:
  db:
    image: postgres:17-bookworm
    restart: unless-stopped
    environment:
      POSTGRES_DB: medical
      POSTGRES_USER: medical
      POSTGRES_PASSWORD: "CHANGE_ME"
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \"$$POSTGRES_USER\" -d \"$$POSTGRES_DB\""]
      interval: 5s
      timeout: 5s
      retries: 20
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    restart: unless-stopped
    environment:
      DB_HOST: db
      DB_PORT: "5432"
      DB_NAME: medical
      DB_USER: medical
      DB_PASSWORD: "CHANGE_ME"
    ports:
      - "127.0.0.1:5000:5000"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=3)"]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 20s
volumes:
  postgres_data:
```

`context: .` cho phép Dockerfile lấy cả `backend` và `database` từ thư mục gốc.
`DB_HOST: db` là tên service PostgreSQL trong mạng Docker, không phải username
hay tên database. Cổng 5433 trên Windows được chuyển tới cổng 5432 trong container.

Trong cấu hình hiện tại, thông tin được điền trực tiếp vào YAML. Không cần
`--env-file`, không cần sao chép `backend/.env.example` để chạy. Sửa
`backend/.env` không thay đổi các giá trị được điền trực tiếp trong YAML.

## 3. Khởi động và kiểm tra

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Lần đầu cần tải image và cài thư viện. Chờ cả `db` và `backend` báo `healthy`.
Dockerfile tự chạy khởi tạo SQL, seed 5 vai trò và mở Gunicorn ở cổng 5000.
Không cần chạy Python, tạo bảng hoặc seed riêng.

Mở http://localhost:5000/health. Kết quả thành công:

```json
{"database":"postgresql","status":"ok"}
```

Trang `/` chưa có giao diện, nên có thể trả về 404. Endpoint `/health` là API
kiểm tra kết nối. Tùy chọn định dạng JSON của trình duyệt không thuộc code dự án.

## 4. Chạy, dừng và cập nhật

```powershell
# Chạy với image hiện có:
docker compose up -d
# Dừng nhưng giữ container và dữ liệu:
docker compose stop
# Khi sửa code hoặc YAML:
docker compose up --build -d
# Xem log (Ctrl+C để thoát xem log):
docker compose logs -f backend
docker compose logs -f db
```

Có thể mở Docker Desktop → Containers → `medical-booking` và Start cả nhóm
container đã tạo. Sau khi sửa code hoặc YAML, cần lệnh build/up để cập nhật;
bấm Start không thay đổi image hoặc biến môi trường của container cũ.

## 5. Kết nối pgAdmin 4

Chuột phải **Servers → Register → Server…**.

Tab **General**: Name = `Medical Docker`.

Tab **Connection**:

| Ô | Giá trị |
|---|---|
| Host name/address | `127.0.0.1` |
| Port | `5433` |
| Maintenance database | `medical` |
| Username | `medical` |
| Password | Mật khẩu thật của tài khoản medical; phải khớp DB_PASSWORD |
| Save password? | Bật nếu muốn lưu trên máy |
| Role | Để trống |

Bấm Save. Mở **Databases → medical → Schemas → public → Tables** và Refresh.
Chuột phải **medical → Query Tool**, chạy bằng F5:

```sql
SELECT * FROM public.role;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Có 18 bảng và 5 vai trò USER, DOCTOR, RECEPTIONIST, NURSE, ADMIN. Bảng nghiệp vụ
có thể trống vì chưa nhập dữ liệu. Database cũ `dat_lich_kham_benh`, nếu còn,
không tự chuyển dữ liệu sang `medical`.

## 6. Dữ liệu nền và tài khoản admin

Vai trò được seed tự động. Tạo admin khi cần:

```powershell
docker compose exec backend python -m backend.app.db.seed_db --admin
```

Nhập email, họ tên và mật khẩu ít nhất 12 ký tự khi được hỏi. Mật khẩu được băm;
seed lại không đổi mật khẩu hoặc nâng quyền tài khoản đã tồn tại.

Thêm bài viết DEMO nếu cần:

```powershell
docker compose exec backend python -m backend.app.db.seed_db --demo
```

Demo chỉ thêm tác giả bị khóa và bài viết chưa kích hoạt, không tạo bệnh nhân,
lượt khám hoặc thanh toán giả.

## 7. Kiểm thử PostgreSQL

```powershell
docker compose exec -e RUN_POSTGRES_TESTS=1 backend python -m unittest discover -s backend/tests -v
```

Kiểm thử dùng schema tạm riêng rồi dọn schema, không sửa bảng `public`.
Tài khoản kiểm thử cần quyền CREATE schema trong database. Nếu chưa bật
RUN_POSTGRES_TESTS, các bài kiểm thử tích hợp sẽ bị bỏ qua.

## 8. Giữ dữ liệu và đổi tài khoản

Dữ liệu lưu trong volume `medical-booking_postgres_data`.

- `docker compose stop`: dừng, giữ dữ liệu.
- `docker compose down`: gỡ container và mạng, giữ volume.
- **`docker compose down -v`: xóa volume và dữ liệu database.**

POSTGRES_USER, POSTGRES_PASSWORD và POSTGRES_DB chỉ khởi tạo khi volume rỗng.
Sửa YAML không tự đổi tài khoản, mật khẩu hoặc tên database trong volume đã có.

Nếu đổi mật khẩu, kết nối bằng tài khoản có quyền thích hợp trong pgAdmin và
chạy (thay giá trị mẫu bằng mật khẩu đã chọn):

```sql
ALTER ROLE medical WITH PASSWORD 'MAT_KHAU_MOI';
```

Cập nhật cùng mật khẩu trong POSTGRES_PASSWORD và DB_PASSWORD của YAML, sau đó
chạy `docker compose up -d` để backend nhận cấu hình mới. Cập nhật mật khẩu lưu
trong pgAdmin nếu có. Tài khoản PostgreSQL khác tài khoản đăng nhập ứng dụng.

SQL khởi tạo nằm trong `database/postgres_schema.sql`. CREATE TABLE IF NOT EXISTS
không sửa cột của bảng đã tồn tại; thay đổi cấu trúc cần migration/ALTER TABLE.
Sao lưu trước khi thay đổi dữ liệu hoặc schema quan trọng.

## 9. Lỗi thường gặp

| Lỗi | Kiểm tra và xử lý |
|---|---|
| Docker Engine không kết nối được | Mở Docker Desktop và chờ Engine chạy |
| Cổng 5433 hoặc 5000 bị chiếm | Kiểm tra ứng dụng khác; đổi cổng bên trái của ánh xạ YAML và cập nhật URL/pgAdmin |
| Backend Restarting | Đọc `docker compose logs --tail 60 backend` |
| Password authentication failed | Đúng username và mật khẩu thực tế trong PostgreSQL; tạo lại container không đổi mật khẩu trong volume |
| Database medical does not exist | Tạo database medical với owner medical trên đúng server Docker, hoặc sửa DB_NAME theo database cần dùng |
| Không tìm thấy backend/Dockerfile khi build | YAML ở gốc, build.context phải là `.`, dockerfile là `backend/Dockerfile` |
| Không phân giải được host | DB_HOST phải là `db`, backend kết nối cổng 5432 |
| pgAdmin timeout qua localhost | Dùng `127.0.0.1` và cổng 5433 |
| Sửa code nhưng chạy vẫn như cũ | Chạy `docker compose up --build -d` |

Không xóa volume để thử sửa lỗi đăng nhập. Giữ mật khẩu thật, upload và bản sao
lưu ngoài Git. `compose.yaml` hiện bị Git bỏ qua, nên cần tự chuẩn bị file này
trên máy mới theo mục 2.
