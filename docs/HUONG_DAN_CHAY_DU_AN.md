> Cập nhật 12/10/2026: người dùng đã đổi sang đặt khung giờ và phát phiếu, bỏ cấp số thứ tự. Quy tắc mới có ưu tiên hơn các nội dung cũ bên dưới: [THAY_DOI_PHIEU_KHUNG_GIO_12_10_2026.md](THAY_DOI_PHIEU_KHUNG_GIO_12_10_2026.md).

# Hướng dẫn chạy backend và database

**Cập nhật tài khoản 12/10/2026:** schema hiện có 21 bảng, thêm patient_delegate; seed có 23 tài khoản và 10 hồ sơ bệnh nhân. Tài khoản theo số điện thoại, hồ sơ gia đình và OTP số điện thoại xem [THAY_DOI_TAI_KHOAN_HO_SO_12_10_2026.md](THAY_DOI_TAI_KHOAN_HO_SO_12_10_2026.md). SEND_SMS=1 chỉ in OTP SMS giả lập trong log backend; thêm vào backend/.env nếu cần demo, rồi recreate backend để nhận biến. Không ghi log mật khẩu ngẫu nhiên.

**Schema thống nhất 09/10/2026:** `database/init_db.sql` định nghĩa đầy đủ 20 bảng của 5 gói API. Các cột bổ sung đã gộp vào `CREATE TABLE`, không còn `ALTER TABLE` để nâng cấp bảng cũ. Chủ đồ án chọn khởi tạo lại từ đầu theo mục 2; chỉ rebuild trên database cũ sẽ không bổ sung cột. Lần sửa này chưa thực hiện reset, nạp mẫu, rebuild hoặc kiểm thử API.
Danh sách cột đã gộp và phần đã đối chiếu: [BAO_CAO_THONG_NHAT_DATABASE.md](BAO_CAO_THONG_NHAT_DATABASE.md).

Gói 4 có cột audit/liên kết hoàn tiền, khóa chống thông báo lặp và nguyên nhân hủy trong schema mới. API `/demo/payments/{id}/result` chỉ hoạt động khi `SEND_EMAIL=1`; file `backend/.env.example` đặt sẵn `SEND_EMAIL=1`, khi thiếu biến hoặc khác `1` thì tắt. Biến này cũng bật log OTP/mã xác minh email giả lập. Worker chạy thêm nhắc lịch trong ứng dụng, không gửi email/ngân hàng thật. Chính sách và ví dụ: [BAO_CAO_TRIEN_KHAI_GOI_4.md](BAO_CAO_TRIEN_KHAI_GOI_4.md).

Gói 3 hiện dùng `work_schedule.slot_minutes`, `encounter.estimated_exam_at`, `appointment_end_at` và `ticket_code`; đã bỏ `last_queue_number`/`queue_number`. Gói 5 có `medical_record.version` và `revision_history` ngay trong định nghĩa bảng. Theo yêu cầu 12/10/2026, Docker Compose chỉ có `db` và `backend`. `backend/app/utils/server.py` khởi tạo database/seed vai trò rồi chạy Gunicorn cùng một tiến trình `utils/worker.py` bên trong container backend. Worker hết hạn giữ chỗ và tạo nhắc lịch mỗi 30 giây, không tạo scheduler trong từng Gunicorn worker. Nếu API hoặc worker thoát, tiến trình còn lại được dừng và container thoát lỗi để Docker khởi động lại. Worker tự tạo tài khoản hệ thống LOCKED riêng với email `medical_booking@gmail.com`. Có thể chạy tác vụ một lần: `docker compose exec backend python -m backend.app.utils.worker --once`. Quy tắc hiện tại: [THAY_DOI_PHIEU_KHUNG_GIO_12_10_2026.md](THAY_DOI_PHIEU_KHUNG_GIO_12_10_2026.md), [BAO_CAO_TRIEN_KHAI_GOI_5.md](BAO_CAO_TRIEN_KHAI_GOI_5.md).

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
`docker compose up -d --force-recreate backend` để container backend
nhận cấu hình mới (không xóa volume).
Không đưa backend/.env lên Git. Với volume cũ, sửa .env không tự đổi mật khẩu
PostgreSQL; phải đổi mật khẩu tài khoản database tương ứng trước.

## 2. Tạo mới hoặc đặt lại toàn bộ dữ liệu đồ án

**down -v xóa các volume của dự án, gồm dữ liệu PostgreSQL và file ảnh trong uploads_data.** Bỏ qua lệnh đó nếu đang khởi tạo lần đầu. Schema cuối cùng nằm trong init_db.sql.

```powershell
docker compose down -v
docker compose up -d db
docker compose ps
```

Đợi db healthy. Khởi tạo bảng bằng container chạy một lần, chưa bật API/worker:

```powershell
docker compose run --rm --build --no-deps --entrypoint python backend -m backend.app.db.init_db
```

Muốn có dữ liệu mẫu, chạy trước khi khởi động backend:

```powershell
Get-Content -Raw -Encoding UTF8 database/sample_data.sql | docker compose exec -T db psql -U medical -d medical -v ON_ERROR_STOP=1
```

**sample_data.sql xóa dữ liệu trong các bảng trước khi nạp lại**, dù không xóa
volume. File chạy trong transaction; nếu có lỗi, không tiếp tục các bước khác.
Có 23 tài khoản mẫu, mật khẩu chung Demo-password-123!, lưu bằng hash hợp lệ. Mật khẩu này chỉ dành cho seed; tài khoản tạo tự động qua API có mật khẩu ngẫu nhiên không thông báo.
Thanh toán, mã QR và thông báo trong file chỉ là dữ liệu giả lập cho đồ án.
Các lượt khám mẫu là lịch sử tháng 09/2026 với snapshot cọc 30%; lượt đặt mới dùng cọc 100% và hạn đặt trước ca ít nhất 5 giờ. Lượt mẫu lưu khung giờ và mã phiếu, không còn số thứ tự; bệnh án mẫu bắt đầu version=0/history=[].

Sau khi nạp mẫu (hoặc bỏ qua mẫu để dùng database trống), khởi động backend:

```powershell
docker compose up -d --build --remove-orphans db backend
docker compose ps
```

Backend tự seed 5 vai trò trước khi chạy API và worker. `--remove-orphans` xóa container encounter-worker cũ vì không còn trong Compose; không xóa volume. Đợi db/backend đều healthy. Khi nạp lại sample_data.sql, chạy `docker compose stop backend` trước khi nạp và `docker compose up -d backend` sau khi thành công, để API/worker không xử lý dữ liệu trong lúc seed.

## 3. Quy trình khi thay đổi cấu trúc database

Dự án sử dụng một schema cuối cùng trong database/init_db.sql, không lưu các
file cập nhật database riêng. Khi sửa cấu trúc, cập nhật đồng bộ init_db.sql,
sample_data.sql và erd.html; sau đó tạo lại database theo mục 2.
Không dùng init_db.sql để nâng cấp database cũ: CREATE TABLE IF NOT EXISTS
không sửa cấu trúc bảng đã tồn tại. Việc khởi động lại backend trên cùng phiên
bản schema vẫn giữ dữ liệu.

### Xử lý lỗi nạp mẫu do database cũ hoặc dịch vụ đang dừng

- `service "db" is not running`: chưa thực thi được SQL vì container database đang dừng. Chạy `docker compose up -d db`, kiểm tra `docker compose ps -a`; nếu db vẫn dừng, xem `docker compose logs --tail 80 db`. Chỉ từ thông báo này chưa xác định được nguyên nhân container dừng.
- `column "slot_minutes" of relation "work_schedule" does not exist`: database đích vẫn dùng cấu trúc trước thay đổi khung giờ. Rebuild không nâng cấp bảng cũ; không bỏ cột khỏi sample_data.sql vì backend cũng cần cột này, cùng `encounter.appointment_end_at` và `ticket_code`.

Nếu cần giữ dữ liệu, dừng tại đây và chuẩn bị phương án chuyển đổi riêng. **Quy trình bên dưới chỉ dành cho database có dữ liệu mẫu được phép xóa: xóa toàn bộ schema public của database medical, giữ volume PostgreSQL và volume ảnh uploads_data.** Không dùng cho database có bảng khác cần giữ trong public.

```powershell
docker compose down --remove-orphans
docker compose up -d db
docker compose ps -a
```

Đợi db `healthy`, rồi tạo lại schema trống. Nếu bất kỳ lệnh nào lỗi, dừng và xem log, không tiếp tục nạp mẫu.

```powershell
docker compose exec -T db psql -U medical -d medical -v ON_ERROR_STOP=1 -c "BEGIN; DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION medical; COMMIT;"
docker compose run --rm --build --no-deps --entrypoint python backend -m backend.app.db.init_db
```

Chỉ khi khởi tạo bảng thành công, nạp mẫu và kiểm tra trước khi bật backend:

```powershell
Get-Content -Raw -Encoding UTF8 database/sample_data.sql | docker compose exec -T db psql -U medical -d medical -v ON_ERROR_STOP=1
docker compose exec -T db psql -U medical -d medical -c "SELECT 'users' AS bang, COUNT(*) AS so_ban_ghi FROM users UNION ALL SELECT 'work_schedule', COUNT(*) FROM work_schedule UNION ALL SELECT 'encounter', COUNT(*) FROM encounter;"
docker compose up -d --build --remove-orphans db backend
docker compose ps
```

Nạp thành công phải có `COMMIT` và bảng đếm 21 bảng cuối file. Trước khi bật backend: users=23, work_schedule=10, encounter=10; worker có thể tạo thêm tài khoản hệ thống sau đó. Docker Desktop chỉ còn hai container dịch vụ db/backend, đợi cả hai healthy.

Kiểm tra ngày 12/10/2026: init_db.sql và sample_data.sql hiện tại tạo đủ 20 bảng, nạp thành công trên PostgreSQL 18 tạm, users=15/work_schedule=10/encounter=10. Chưa chạy quy trình Docker trên PostgreSQL 17 của dự án; chưa kiểm tra log container người dùng, chưa reset hoặc nạp lại database dự án.

Kiểm tra bộ khởi động hai container ngày 12/10/2026: 5 test với tiến trình con thật đạt, gồm lỗi khởi tạo không bật dịch vụ, thứ tự init/seed, API thoát dừng worker, worker thoát dừng API và thoát mã 0 ngoài dự kiến vẫn báo lỗi. Chưa build/chạy Docker hoặc xác minh signal dừng trên Linux trong môi trường này.

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
