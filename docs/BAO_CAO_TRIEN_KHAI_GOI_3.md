# Triển khai gói 3 — 08/10/2026

Đã viết đủ 14 API theo danh sách backend, trực tiếp không có tiền tố phiên bản:

| Method | Đường dẫn | Chức năng |
|---|---|---|
| POST | /encounters/online | Đặt ít nhất 5 giờ trước ca; HOLDING 10 phút, snapshot cọc 100%, giữ quota |
| GET | /encounters | Danh sách theo quyền, lọc, phân trang |
| GET | /encounters/{id} | Chi tiết theo quyền |
| POST | /encounters/{id}/cancel | Hủy, hoàn quota một lần |
| GET | /encounters/{id}/status-history | Lịch sử trạng thái |
| GET | /encounters/{id}/transfer-history | Lịch sử điều phối |
| POST | /staff/encounters/walk-in | Tự chọn ca, CHECKED_IN, cấp số ngay |
| POST | /staff/encounters/{id}/check-in | Hạn ít nhất 30 phút trước giờ hẹn |
| GET | /staff/queues | Hàng chờ theo ca/quyền, giữ số đã cấp |
| GET | /staff/encounters/{id}/transfer-options | Bác sĩ khác cùng khoa còn chỗ |
| POST | /staff/encounters/{id}/transfer | Chuyển, giữ snapshot, khóa cả hai ca |
| POST | /staff/encounters/{id}/no-show | Vắng mặt sau kết thúc ca + 15 phút |
| GET | /staff/schedules/{id}/affected-encounters | Các lượt cần điều phối |
| POST | /doctor/encounters/{id}/start | Bác sĩ phụ trách bắt đầu khám |

Swagger có schema/parameter cho cả 14 API. Worker hết hạn chạy riêng trong Docker Compose, tài khoản SYSTEM không đăng nhập được. Database thêm last_queue_number, ERD đã cập nhật. Khóa ca theo ID tăng dần, thao tác quota/trạng thái/log cùng transaction. Quyền NURSE phụ thuộc phân công chưa thu hồi.

Adapter tích hợp: `confirm_paid_online(db, encounter_id, actor_id)` cho gói 4; `complete_with_medical_record(db, actor, encounter_id)` cho gói 5. Bên gọi khóa ca/lượt bằng locked_context trước khi ghi payment/bệnh án và dùng cùng connection/transaction. Không có endpoint thanh toán hay bệnh án của gói 4/5 trong phạm vi này.

Quy tắc đã chốt: [QUY_TAC_GOI_3_DA_CHOT.md](QUY_TAC_GOI_3_DA_CHOT.md). Từ 09/10/2026, mọi cột đã gộp vào schema khởi tạo mới; tạo lại database và chạy backend/worker bằng Docker Compose theo hướng dẫn chạy dự án, không dùng init_db để nâng cấp bảng cũ.

## Tình trạng xác minh

Cập nhật 09/10/2026: đã sửa hạn tạo online từ 30 phút sang ít nhất 5 giờ trước giờ bắt đầu ca sáng/chiều; đúng mốc được nhận, sau mốc và trong ca bị từ chối. Swagger và tài liệu đã cập nhật. Lượt đã HOLDING vẫn được thanh toán trong 10 phút. Chưa chạy kiểm thử hay rebuild cho thay đổi này theo yêu cầu trước đó của người dùng; kết quả 17 kiểm thử dưới đây không xác minh quy tắc mới.

Trước khi người dùng yêu cầu dừng kiểm thử, 17 kiểm thử tự động trên PostgreSQL riêng đã đạt, gồm gói 1/2 và quyền, workflow, quota/concurrency, rollback, hết hạn/thanh toán muộn, check-in/no-show, điều phối của gói 3. Một phần thao tác Try it out trên Swagger đã được thực hiện. Chưa nghiệm thu toàn bộ 14 API qua giao diện. Sau yêu cầu “chỉ code”, đã dừng kiểm thử; adapter hoàn tất bệnh án và chặn đăng nhập SYSTEM bổ sung cuối chưa kiểm thử lại. Không coi đây là kết quả nghiệm thu cuối.

Code cuối chưa rebuild lên backend đang chạy localhost:5000. Không seed/đổi dữ liệu chính khi kiểm thử.
