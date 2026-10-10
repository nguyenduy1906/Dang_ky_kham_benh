# Hướng dẫn chạy backend và database

**Schema thống nhất 09/10/2026:** `database/init_db.sql` định nghĩa đầy đủ 20 bảng của 5 gói API. Các cột bổ sung đã gộp vào `CREATE TABLE`, không còn `ALTER TABLE` để nâng cấp bảng cũ. Chủ đồ án chọn khởi tạo lại từ đầu theo mục 2; chỉ rebuild trên database cũ sẽ không bổ sung cột. Lần sửa này chưa thực hiện reset, nạp mẫu, rebuild hoặc kiểm thử API.
Danh sách cột đã gộp và phần đã đối chiếu: [BAO_CAO_THONG_NHAT_DATABASE.md](BAO_CAO_THONG_NHAT_DATABASE.md).

Gói 4 có cột audit/liên kết hoàn tiền, khóa chống thông báo lặp và nguyên nhân hủy trong schema mới. API `/demo/payments/{id}/result` chỉ hoạt động khi `SEND_EMAIL=1`; file `backend/.env.example` đặt sẵn `SEND_EMAIL=1`, khi thiếu biến hoặc khác `1` thì tắt. Biến này cũng bật log OTP/mã xác minh email giả lập. Worker chạy thêm nhắc lịch trong ứng dụng, không gửi email/ngân hàng thật. Chính sách và ví dụ: [BAO_CAO_TRIEN_KHAI_GOI_4.md](BAO_CAO_TRIEN_KHAI_GOI_4.md).

Gói 3 có `work_schedule.last_queue_number`; gói 5 có `medical_record.version` và `revision_history` ngay trong định nghĩa bảng. Docker Compose có `encounter-worker` chạy job mỗi 30 giây, chờ backend khỏe; worker tự tạo tài khoản hệ thống LOCKED riêng với email `medical_booking@gmail.com`. Email này dành riêng cho worker. Chạy riêng: `python -m backend.app.utils.worker --once` hoặc bỏ `--once` để chạy liên tục. Tác vụ nhắc lịch nằm trong `backend/app/utils/worker.py`. Quy tắc: [QUY_TAC_GOI_3_DA_CHOT.md](QUY_TAC_GOI_3_DA_CHOT.md), [BAO_CAO_TRIEN_KHAI_GOI_5.md](BAO_CAO_TRIEN_KHAI_GOI_5.md).

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
Đặt SECRET_KEY riêng trong backend/.env để ký token đăng nhập. Nếu đang có
`SECRET_KEY=CHANGE_ME_SECRET_KEY_SAMPLE_ONLY`, đây chỉ là giá trị mẫu để tự sửa;
thay bằng chuỗi ngẫu nhiên dài và giữ ổn định giữa các lần chạy. Đổi khóa làm các
access token đã cấp mất hiệu lực. Sau khi sửa .env, chạy
`docker compose up -d --force-recreate backend encounter-worker` để các container
nhận cấu hình mới (không xóa volume).
Không đưa backend/.env lên Git. Với volume cũ, sửa .env không tự đổi mật khẩu
PostgreSQL; phải đổi mật khẩu tài khoản database tương ứng trước.

## 2. Tạo mới hoặc đặt lại toàn bộ dữ liệu đồ án

**down -v xóa các volume của dự án, gồm dữ liệu PostgreSQL và file ảnh trong uploads_data.** Bỏ qua lệnh đó nếu đang khởi tạo lần đầu. Schema cuối cùng nằm trong init_db.sql.

```powershell
docker compose down -v
docker compose up --build -d db backend
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
Các lượt khám mẫu là lịch sử tháng 09/2026 với snapshot cọc 30%; lượt đặt mới dùng cọc 100% và hạn đặt trước ca ít nhất 5 giờ. Bộ đếm số đã cấp trong từng ca khớp các lượt mẫu; bệnh án mẫu bắt đầu version=0/history=[].

Sau khi nạp mẫu (hoặc bỏ qua mẫu để dùng database trống), khởi động worker:

```powershell
docker compose up -d --build encounter-worker
```

Khi nạp lại sample_data.sql ở những lần sau, dừng worker bằng `docker compose stop encounter-worker` trước khi nạp và chạy lại sau đó, để job không xử lý dữ liệu trong lúc seed.

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
- Trang / chưa có giao diện. API của 5 gói đã có code; kết quả kiểm thử từng gói xem báo cáo tương ứng.

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

Luồng tạo admin ban đầu đã thống nhất trong `seed_db.py` và `db_service.py`.
Email phải hợp lệ, họ tên không rỗng và tối đa 150 ký tự; mật khẩu 12–128 ký tự,
có chữ và số. Email đã tồn tại được giữ nguyên, không đổi vai trò hoặc mật khẩu.
Email chưa được tự đánh dấu xác minh. Có thể cung cấp `ADMIN_EMAIL`, `ADMIN_NAME`,
`ADMIN_PASSWORD` qua môi trường thay cho nhập tương tác.

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
