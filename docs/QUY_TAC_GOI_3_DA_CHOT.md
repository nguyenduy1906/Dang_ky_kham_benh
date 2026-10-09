# Quy tắc gói 3 đã chốt ngày 08/10/2026

Quyết định của người dùng thay thế phương án demo/chưa chốt trong tài liệu cũ.

- Cập nhật 09/10/2026: lịch gồm hai ca sáng và chiều. Chỉ tạo đặt ONLINE khi còn ít nhất 5 giờ trước giờ bắt đầu ca (`work_date` + `start_time`, Asia/Saigon). Đúng mốc 5 giờ được nhận; sau mốc này, kể cả đang trong ca, trả 409/SCHEDULE_TOO_LATE. Ví dụ ca sáng 08:00: hạn đặt 03:00 cùng ngày; ca chiều 13:30: hạn đặt 08:30 cùng ngày. Tính theo giờ ca đã cấu hình, không ấn định giờ ca mới. Đây là hạn tạo HOLDING; lượt đã giữ chỗ vẫn có 10 phút thanh toán. Quyết định này thay mốc ngừng đặt 30 phút cũ và đề xuất 12 giờ trước đó.
- ONLINE giữ chỗ 10 phút và giữ quota ở HOLDING, chưa cấp số. Cọc 100% giá bác sĩ, snapshot khi đặt: giá 100.000 đồng thì cọc 100.000 đồng.
- Gói 4 lưu DEPOSIT SUCCESS và gọi `confirm_paid_online(connection, encounter_id, actor_id)` trong cùng transaction. Đủ tiền, chưa hết hạn mới CONFIRMED và cấp số. Adapter trả False nếu đã hết hạn; bên gọi phải commit EXPIRED và xử lý tiền muộn riêng.
- Walk-in cấp số ngay trong lúc ONLINE còn HOLDING. Online trả tiền sau walk-in nhận số sau người đó. Người đã có số giữ số, không bị dời bởi walk-in đến sau.
- Walk-in bị lễ tân hủy trước khi khám: bỏ qua số đã hủy khi gọi, giữ nguyên số các người còn lại, không nén số.
- Online bắt buộc check-in ít nhất 30 phút trước `estimated_exam_at`. Đúng mốc 30 phút được nhận, muộn hơn bị từ chối. Giờ hẹn ban đầu là giờ bắt đầu ca; không giới hạn check-in sớm. Ca đóng/báo nghỉ không check-in. Hạn đặt online là ít nhất 5 giờ trước ca, tách khỏi hạn check-in.
- ADMIN/RECEPTIONIST đánh dấu NO_SHOW sau kết thúc ca + 15 phút, chỉ cho CONFIRMED chưa check-in. Không có job tự động no-show.
- Walk-in chọn ca còn chỗ sớm nhất của bác sĩ từ hiện tại trở đi; đầy/đóng/báo nghỉ thì xét ca tiếp theo. Đi thẳng CHECKED_IN, không giữ chỗ/cọc online.
- Chuyển bác sĩ khác cùng khoa còn chỗ cho CONFIRMED/CHECKED_IN; giữ giá/cọc và trạng thái, cấp số ca mới, ghi log và cập nhật hai quota trong cùng transaction.
- Không tự chuyển người đang chờ sang ca sau; ca đóng/báo nghỉ điều phối thủ công qua affected-encounters.
- Hủy/hết hạn/no-show hoàn quota một lần; thao tác lặp cùng trạng thái không thêm log/quota/số. `last_queue_number` giữ số lớn nhất đã cấp kể cả khi chuyển khỏi ca.
- Worker hết hạn process riêng, chu kỳ 30 giây, tài khoản SYSTEM riêng LOCKED với mật khẩu ngẫu nhiên, không đăng nhập. Không chạy scheduler trong Gunicorn.

Gói 3 có 14 API trực tiếp, không tiền tố `/v1`. API thanh toán/hoàn tiền thuộc gói 4, bệnh án/hoàn tất thuộc gói 5. Không mở API xác nhận thanh toán tùy ý. Gói 4 không thu lại toàn bộ giá sau cọc 100%.

Gói 4 đã bổ sung chính sách hủy/hoàn: bệnh nhân hủy từ 12 giờ trước giờ hẹn hoàn 50% cọc, dưới 12 giờ/no-show không hoàn; lỗi bệnh viện/bác sĩ hoàn 100%. API hủy lưu cancel_origin/refund_reference_at; ADMIN/RECEPTIONIST ghi HOSPITAL có lý do, USER không tự khai. Hủy và hoàn riêng. Chi tiết: [BAO_CAO_TRIEN_KHAI_GOI_4.md](BAO_CAO_TRIEN_KHAI_GOI_4.md).

Schema thống nhất 09/10/2026 đã có bộ đếm ngay trong CREATE TABLE. Khởi tạo lại database theo [hướng dẫn chạy](HUONG_DAN_CHAY_DU_AN.md); init_db không nâng cấp cấu trúc bảng cũ. Worker có thể chạy thủ công `python -m backend.app.jobs.encounter_jobs --once` hoặc bỏ `--once` để chạy liên tục.

Tiêu chí nghiệm thu: đặt online trước/đúng mốc 5 giờ được nhận nếu còn chỗ, sau mốc hoặc trong ca bị từ chối cho cả ca sáng/chiều; tranh chỗ cuối chỉ một thành công; lỗi log rollback quota/encounter; cọc 100%; walk-in nhận số trước HOLDING; thao tác lặp an toàn; check-in đúng/sai mốc 30 phút; no-show đúng/sai mốc kết thúc + 15 phút; chuyển cùng khoa giữ snapshot/quota; quyền USER/DOCTOR/NURSE theo tài nguyên; worker hết hạn và thanh toán muộn không tái giữ quota.
