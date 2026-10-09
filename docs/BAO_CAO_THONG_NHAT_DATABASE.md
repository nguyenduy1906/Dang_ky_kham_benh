# Thống nhất schema khởi tạo mới — 09/10/2026

Theo yêu cầu chủ đồ án, database sẽ được tạo lại từ đầu. `database/init_db.sql` là schema duy nhất cho cả 5 gói API; không giữ các đoạn ALTER TABLE nâng cấp bảng cũ.

## Các cột đã gộp vào định nghĩa bảng

| Bảng | Cột |
|---|---|
| work_schedule | last_queue_number |
| encounter | cancel_origin, refund_reference_at |
| payment | original_payment_id, created_by_id, processed_by_id, reason, failure_reason, result_received_at |
| medical_record | version, revision_history |
| notification | event_key |

Tổng cộng 12 cột bổ sung nằm ngay trong CREATE TABLE. Giữ đủ 20 bảng, 193 cột, các khóa ngoại, CHECK, UNIQUE, 34 index khai báo riêng và 13 trigger updated_at. Index chống hoàn tiền/thông báo/phân công lặp vẫn được giữ; index, cấu hình mặc định và trigger được gom sau phần định nghĩa bảng.

IF NOT EXISTS phục vụ khởi động lại cùng schema; không tự nâng cấp cấu trúc bảng đã tồn tại. Role_request chưa sử dụng vẫn được giữ theo phạm vi đã chốt. Không thêm bảng hoặc thay chính sách nghiệp vụ trong lần thống nhất này.

## Dữ liệu mẫu và ERD

- sample_data.sql ghi rõ last_queue_number cho từng ca, khớp số đã cấp trong encounter.
- Các cột nullable chưa phát sinh trong dữ liệu mẫu dùng NULL; bệnh án mẫu dùng version=0, revision_history=[] theo mặc định. Không tạo lịch sử sửa/audit giả.
- Dữ liệu mẫu tháng 09/2026 giữ snapshot cọc 30% lịch sử. Lượt đặt mới áp dụng cọc 100%, giữ chỗ 10 phút, đặt online ít nhất 5 giờ trước ca như quyết định hiện tại.
- ERD khớp toàn bộ cột schema và bổ sung quan hệ payment tự tham chiếu/giao dịch với người tạo, người xử lý.
- Hướng dẫn chạy đã chuyển về tạo lại database, khởi động worker sau khi nạp mẫu.

## Phần đã đối chiếu

Đối chiếu tĩnh trên file: tên bảng/cột giữa 20 định nghĩa SQL và 20 thực thể ERD; tên cột của 21 khối INSERT dữ liệu mẫu; mục tiêu khóa ngoại; danh sách cột ghi của 8 model; số giá trị trên mỗi dòng INSERT và bộ đếm số ca. Không phát hiện sai lệch trong các đối chiếu này. Schema không còn ALTER TABLE.

Chưa thực thi SQL trên PostgreSQL mới, chưa nạp dữ liệu mẫu, chưa kiểm thử API hay rebuild. Đối chiếu tĩnh không thay thế kiểm tra khởi tạo SQL và luồng API thực tế. Database đang chạy chưa được thay đổi.

Tạo lại database theo [HUONG_DAN_CHAY_DU_AN.md](HUONG_DAN_CHAY_DU_AN.md), mục 2. Lệnh down -v trong hướng dẫn xóa cả volume PostgreSQL và uploads_data; đây là bước chủ đồ án sẽ thực hiện khi sẵn sàng khởi tạo lại.
