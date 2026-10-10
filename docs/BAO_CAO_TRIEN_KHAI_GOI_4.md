# Triển khai gói 4 — Thanh toán giả lập và thông báo

Code đã triển khai đủ 10 API theo kế hoạch backend. Chưa chạy kiểm thử hoặc rebuild backend theo yêu cầu người dùng chỉ viết code.

**Đồng bộ và kiểm thử 10/10/2026:** theo tên mới của chủ đồ án, route/service thanh toán và log email/OTP dùng `SEND_EMAIL`; task nhắc lịch dùng `utils/worker.py`. Toàn bộ bộ test backend hiện có đạt 19/19 trên PostgreSQL 17 tạm, gồm hai test bổ sung xác minh API kết quả thanh toán bật khi `SEND_EMAIL=1`, tắt khi thiếu biến/giá trị `0`, và thanh toán lặp không tăng tiền/quota/log xác nhận. Kết quả này xác minh thay đổi tên và các ca hồi quy hiện có, chưa bao phủ đầy đủ mọi tiêu chí gói 4 ở cuối báo cáo. Không reset database dự án hoặc rebuild dịch vụ chính trong lần này.

## API và quyền

| Method | Đường dẫn | Quyền và hành vi |
|---|---|---|
| GET | /encounters/{id}/payments | USER sở hữu, ADMIN/RECEPTIONIST; page/page_size |
| GET | /payments/{id} | Cùng phạm vi tài nguyên; DOCTOR/NURSE không xem tiền |
| POST | /encounters/{id}/payment-intents | USER sở hữu, online HOLDING; body payment_method |
| POST | /demo/payments/{id}/result | Chỉ SEND_EMAIL=1, USER sở hữu hoặc ADMIN; result SUCCESS/FAILED |
| POST | /staff/encounters/{id}/exam-fees | ADMIN/RECEPTIONIST, từ CHECKED_IN; thu phần còn lại |
| POST | /admin/payments/{id}/refund | ADMIN, giao dịch thu thành công, body reason; server tính tiền hoàn |
| GET | /notifications | Chỉ thông báo mình, page/page_size/unread_only |
| GET | /notifications/unread-count | Số thông báo chưa đọc của mình |
| PATCH | /notifications/{id}/read | Đánh dấu thông báo mình, lặp an toàn |
| POST | /notifications/read-all | Chỉ cập nhật thông báo mình |

Các route được đăng ký Blueprint và có mô tả Swagger. Không dùng tiền tố /api/v1 hay /v1. Mọi phương thức CASH/BANK/EWALLET/CARD đều giả lập, không kết nối dịch vụ tài chính thật.

## Quy tắc hoàn tiền người dùng chốt

- Cọc online vẫn là 100% giá bác sĩ. Bệnh nhân hủy cách giờ hẹn từ 12 giờ trở lên: hoàn 50% tiền cọc. Đúng 12 giờ được nhận. Hủy dưới 12 giờ hoặc no-show: không hoàn cọc.
- Lý do thuộc bệnh viện/bác sĩ: hoàn toàn bộ tiền cọc, không phụ thuộc mốc 12 giờ. ADMIN/RECEPTIONIST ghi nhận cancel_origin=HOSPITAL và reason tại API hủy. USER không được tự khai HOSPITAL; nếu ca đã UNAVAILABLE thì hệ thống tự ghi nguyên nhân bệnh viện khi hủy.
- Hủy và hoàn là hai thao tác riêng: hủy hoàn quota trước, ADMIN xử lý refund sau. Bệnh viện hủy walk-in đã thu phí cũng được hoàn phí đã thu. Không đổi encounter/quota tại API refund.
- Giờ tham chiếu là estimated_exam_at tại thời điểm hủy, lưu refund_reference_at để không đổi chính sách khi lịch thay đổi. Dữ liệu cũ không có giờ hủy/hẹn trả 409, không đoán.
- Thanh toán đến sau EXPIRED/CANCELLED là khoản thu không thể nhận giữ chỗ: ghi nhận và tự hoàn 100% cùng giao dịch; không xác nhận lại ca. Ca đóng/báo nghỉ trong lúc HOLDING được gói 3 hủy với nguyên nhân bệnh viện và gói 4 hoàn đầy đủ.
- Số tiền nguyên VND; 50% dùng chia nguyên, làm tròn xuống đồng. Số tiền hoàn 0 đồng không tạo giao dịch hoàn tiền.
- Mỗi giao dịch thu có tối đa một REFUND liên kết original_payment_id. Gọi lại trả giao dịch hoàn cũ. Giao dịch thu đổi REFUNDED khi đã xử lý hoàn theo chính sách, kể cả hoàn 50%; số tiền hoàn thực tế nằm ở REFUND.amount, không suy ra toàn bộ tiền đã hoàn chỉ từ trạng thái REFUNDED.
- Đối soát/thống kê: tổng thu gốc = DEPOSIT/EXAM_FEE trạng thái SUCCESS hoặc REFUNDED; tiền hoàn = REFUND SUCCESS; thu ròng = tổng thu gốc trừ tiền hoàn. Không cộng REFUND vào doanh thu, không loại toàn bộ tiền thu gốc khi chỉ hoàn 50%.

## Thu tiền và tích hợp gói 3

Server chốt mọi amount từ snapshot. Phiên cọc PENDING cùng phương thức được dùng lại; không tạo hai phiên đang chờ. Kết quả cuối SUCCESS/FAILED không đổi sang kết quả trái ngược. Phiên bị hệ thống đánh FAILED vì hết hạn/hủy được phân biệt bằng failure_reason và result_received_at; kết quả SUCCESS đến muộn được ghi nhận/hoàn, không hồi sinh encounter.

Khóa ca, lượt khám, payment theo thứ tự chung. Payment SUCCESS và confirm_paid_online dùng cùng connection/transaction; lỗi ghi log/thông báo rollback cả thanh toán và xác nhận. Hết hạn/hủy đánh FAILED các phiên cọc PENDING trong cùng giao dịch gói 3. Nếu intent hết hạn ngay khi gọi, commit EXPIRED/quota/log rồi mới trả 409.

EXAM_FEE bằng consultation_fee_snapshot trừ các khoản DEPOSIT/EXAM_FEE đã thu. Online đã cọc đủ 100% trả amount_due=0, không thu thêm; walk-in deposit=0 thu toàn bộ snapshot. Snapshot NULL trả 409, không lấy giá mới của bác sĩ. Gọi thu phí lặp sau khi đủ tiền không tạo giao dịch mới.

## Thông báo và worker

Thông báo trạng thái gói 3, thanh toán thất bại, thu phí và hoàn tiền được lưu trong cùng transaction; reference_type=ENCOUNTER. Hồ sơ walk-in không có user không tạo thông báo cho tài khoản khác. event_key cùng user_id là duy nhất để chống lặp; API không nhận user_id từ client.

encounter-worker gọi job nhắc lịch mỗi chu kỳ 30 giây. ONLINE CONFIRMED trong 24 giờ tới, còn hơn 30 phút trước giờ hẹn, ca OPEN/FULL được nhắc. Một thông báo cho mỗi lượt/giờ hẹn/người nhận; check-in/hủy/no-show/báo nghỉ không nhắc. Chuyển sang giờ hẹn mới có khóa nhắc mới. Chỉ thông báo trong ứng dụng, không gửi email thật; không thêm scheduler trong Gunicorn.

## Nâng cấp và ví dụ

Từ 09/10/2026, các cột audit/link refund, event_key thông báo, cancel_origin/refund_reference_at nằm ngay trong CREATE TABLE của schema 20 bảng. Người dùng chọn khởi tạo lại từ đầu; không còn ALTER TABLE nâng cấp bảng cũ. ERD đã đồng bộ. Dữ liệu mẫu giữ snapshot 30% lịch sử, cấu hình DEFAULT_DEPOSIT_PERCENT là 100% cho đặt mới.

`docker compose up -d --build` cập nhật backend và worker. Bật SEND_EMAIL=1 trong backend/.env chỉ khi cần mô phỏng kết quả. Không có thay đổi .env hoặc dữ liệu đang chạy trong lần viết code này.

Ví dụ với ID thực tế lấy từ phản hồi API:

1. USER tạo online, lấy encounter_id.
2. POST /encounters/{id}/payment-intents với `{"payment_method":"EWALLET"}`, lấy payment_id.
3. POST /demo/payments/{payment_id}/result với `{"result":"SUCCESS"}` (SEND_EMAIL=1).
4. Khi hủy do bác sĩ, ADMIN/RECEPTIONIST POST /encounters/{id}/cancel với `{"cancel_origin":"HOSPITAL","reason":"Bác sĩ báo nghỉ"}`.
5. ADMIN POST /admin/payments/{payment_id}/refund với `{"reason":"Hoàn tiền theo nguyên nhân hủy đã ghi nhận"}`.

Chưa xác minh bằng kiểm thử: đồng thời intent/result/refund; boundary 12 giờ; số tiền hoàn 50%/100%; gọi lặp và late result; quyền USER/notification; reminder chạy nhiều worker; migration database cũ và hồi quy gói 3. Không khẳng định đã nghiệm thu.
