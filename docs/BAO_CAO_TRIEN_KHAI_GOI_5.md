# Triển khai gói 5 — 09/10/2026

Đã viết code cho đủ 18 API bệnh án, thuốc, đánh giá, bài viết, cấu hình, thống kê và đối soát theo danh sách backend. Đã đăng ký Blueprint/Swagger, không thêm tiền tố /v1. Theo yêu cầu người dùng, chưa chạy kiểm thử, chưa thử /docs, chưa rebuild hoặc áp dụng schema lên database đang chạy.

## Danh sách API

| Method | Đường dẫn | Quyền/chức năng |
|---|---|---|
| GET | /encounters/{id}/medical-record | USER sở hữu, DOCTOR phụ trách, NURSE theo ca chưa thu hồi, ADMIN |
| PUT | /doctor/encounters/{id}/medical-record | Chỉ bác sĩ phụ trách, IN_PROGRESS hoặc bổ sung sau COMPLETED |
| GET | /medical-records/{id}/prescription-items | Cùng quyền bệnh án, phân trang, trả version |
| PUT | /doctor/medical-records/{id}/prescription-items | Bác sĩ phụ trách, thay toàn bộ danh sách thuốc |
| POST | /doctor/encounters/{id}/complete | Bác sĩ phụ trách, qua service gói 3 |
| POST | /encounters/{id}/review | USER sở hữu, lượt COMPLETED có bệnh án |
| GET | /doctors/{id}/reviews | Công khai, không trả danh tính/hồ sơ/bệnh án bệnh nhân |
| GET | /articles | Công khai bài đã xuất bản, phân trang/tìm kiếm/category |
| GET | /articles/{slug} | Công khai chi tiết bài đã xuất bản |
| GET | /admin/articles | ADMIN xem cả nháp, nội dung, lọc article_id/is_active |
| POST | /admin/articles | ADMIN tạo bài, tác giả từ tài khoản đăng nhập |
| PATCH | /admin/articles/{id} | ADMIN sửa/ẩn/xuất bản/lên lịch bài |
| GET | /admin/configurations | ADMIN xem cấu hình, read_only và effective_value |
| PATCH | /admin/configurations/{key} | ADMIN cập nhật khóa được hỗ trợ |
| GET | /admin/statistics/encounters | ADMIN, số lượt theo ngày ca/bác sĩ/khoa/trạng thái |
| GET | /admin/statistics/payments | ADMIN, dòng tiền thu/hoàn/ròng |
| GET | /admin/statistics/reviews | ADMIN, số đánh giá, trung bình, phân bố điểm |
| GET | /admin/audit/encounters | ADMIN, đối soát dữ liệu và lịch sử |

## Bệnh án và đơn thuốc

Người dùng đã đồng ý: bệnh án hoàn tất được bác sĩ phụ trách bổ sung/sửa trên cùng bệnh án, giữ COMPLETED, bắt buộc lý do và lưu lịch sử trước/sau. Khi quay lại khám lần mới thì tạo encounter mới, không mở lại lượt cũ để thu tiền/giữ quota lần nữa. NURSE chỉ xem theo phân công còn hiệu lực, không sửa. RECEPTIONIST không xem nội dung bệnh án/thuốc.

Khóa ca → encounter → medical_record trong cùng connection/transaction; UNIQUE(encounter_id) giữ một bệnh án mỗi lượt. API PUT bệnh án nhận diagnosis bắt buộc, treatment, doctor_notes; trường bỏ qua trở thành null theo nghĩa thay toàn bộ nội dung PUT. examined_at do server ghi khi tạo, không nhận từ client.

version dùng chung cho cả nội dung bệnh án và đơn thuốc. Khi ghi đang khám, expected_version tùy chọn; khi sửa sau COMPLETED bắt buộc expected_version và reason. Version khác hiện tại trả 409 để tránh ghi đè từ màn hình cũ. Mỗi thay đổi thực tế tăng version; không đổi nội dung thì không tạo revision mới. revision_history JSONB lưu người sửa, lý do, thời gian và snapshot trước/sau cả bệnh án và thuốc, cùng transaction với thay đổi. Dữ liệu cũ mặc định version=0/history=[]; không tự tạo lịch sử giả. Lịch sử không trả ở API bệnh án thông thường, ADMIN xem qua đối soát.

PUT đơn thuốc nhận items tối đa 100 thuốc; quantity là số nguyên dương, không nhận ID/tên người kê từ client. items=[] là không kê thuốc; thay toàn bộ đơn thuốc và lưu snapshot cũ trong revision_history. Khi đọc, version và các thuốc lấy trong phạm vi khóa đọc cùng bệnh án để tránh trả version mới kèm thuốc cũ.

Hoàn tất cần bệnh án có chẩn đoán và examined_at, chỉ chuyển từ IN_PROGRESS qua adapter gói 3. Gọi lại ở COMPLETED trả kết quả cũ, không ghi log/thông báo lần hai. Không tự đổi booked_count hoặc thu tiền khi sửa bệnh án; gói 3/4 vẫn sở hữu trạng thái/quota/thanh toán.

Ví dụ PUT /doctor/encounters/{id}/medical-record khi đang khám:

```json
{"diagnosis":"Nội dung bác sĩ ghi nhận","treatment":"Hướng điều trị","doctor_notes":"Ghi chú","expected_version":0}
```

Đọc version thực tế từ phản hồi. Khi bổ sung sau hoàn tất, gửi version hiện tại và thêm reason. PUT đơn thuốc dùng:

```json
{"items":[{"medication_name":"Tên thuốc do bác sĩ nhập","dosage":"Liều do bác sĩ nhập","quantity":1,"instructions":"Hướng dẫn do bác sĩ nhập"}],"expected_version":1}
```

Các ví dụ là cấu trúc dữ liệu, không tạo dữ liệu khám vào database khi viết code.

## Đánh giá và bài viết

Một review cho mỗi bệnh án/lượt COMPLETED; USER chỉ đánh giá lượt mình sở hữu. Rating 1–5. Gửi lại cùng nội dung trả review cũ; nội dung khác trả 409, không ghi đè. Đánh giá công khai trả review_id/rating/comment/created_at, không JOIN patient hay trả record_id/encounter_id/danh tính/chẩn đoán. Điểm trung bình tính từ toàn bộ tập review cùng bộ lọc, không chỉ trang hiện tại.

Article do ADMIN quản lý. slug duy nhất, chữ thường không dấu/số/gạch nối. Công khai chỉ is_active=true, published_at không null và đã đến thời điểm. published_at=null giữ nháp; ngày tương lai lên lịch xuất bản. Tạo bài active không truyền thời điểm thì xuất bản ngay; bật lại bài chưa có thời điểm cũng dùng thời điểm hiện tại. Nội dung là văn bản/Markdown, frontend cần render như nội dung, không chèn HTML thô. ADMIN đọc bản nháp qua danh sách và article_id, không phải dùng URL công khai. thumbnail_url chỉ HTTP(S) hoặc /uploads/.

## Cấu hình có tác dụng

ALLOW_WALK_IN=true/false tác động lần tiếp nhận mới; không hủy người đã tiếp nhận. REMINDER_BEFORE_HOURS từ 1 đến 168 được worker đọc mỗi chu kỳ, mặc định 24. HOSPITAL_NAME/SUPPORT_PHONE là metadata có thể cập nhật. Không tạo tùy ý khóa hoặc ghi giá trị sai kiểu.

Các chính sách người dùng đã chốt (10 phút giữ chỗ, 100% cọc, hạn check-in 30 phút, no-show kết thúc + 15 phút, hủy từ 12 giờ hoàn 50%, rating tối đa 5) là read_only trong API cấu hình tổng quát. effective_value trả giá trị thực thi ngay cả khi DB cũ còn cấu hình demo khác; không đổi quy tắc mà chủ đồ án đã chốt. Dữ liệu mẫu đã cập nhật mô tả check-in và thêm khóa 12 giờ/50%/no-show grace. Những khóa cũ chưa được hỗ trợ chỉnh được hiển thị read_only.

## Thống kê và đối soát

Thống kê hỗ trợ from_date/to_date, doctor_profile_id, department_id, encounter_id, encounter_status/type, group_by=day/doctor/department và phân trang nhóm. Tổng/điểm trung bình tính toàn tập, độc lập trang. Các query trong cùng báo cáo dùng snapshot REPEATABLE READ READ ONLY để tránh các phần báo cáo mâu thuẫn khi có giao dịch đồng thời.

- Lượt khám lọc theo work_date của ca, trạng thái hiện tại.
- Tiền lọc theo ngày paid_at (hoặc created_at nếu chưa thanh toán) ở Asia/Saigon. Thu gốc = DEPOSIT/EXAM_FEE SUCCESS hoặc REFUNDED; hoàn = REFUND SUCCESS; thu ròng = thu gốc trừ hoàn. Hoàn 50% không loại toàn bộ giao dịch gốc. Khoản hoàn sang ngày khác thuộc dòng tiền ngày hoàn, nên thu ròng một ngày có thể âm.
- Đánh giá lọc theo ngày tạo review, trả số lượng/trung bình/phân bố điểm. Bác sĩ/khoa là bác sĩ phụ trách và khoa hiện tại; không suy ra khoa lịch sử từ snapshot không tồn tại.
- Audit so booked_count với lượt chiếm quota (kể cả COMPLETED), kiểm tra hoàn tất thiếu bệnh án/chẩn đoán, snapshot thiếu, thu vượt giá, hoàn vượt thu, cọc online chưa đủ. Đây là phát hiện dữ liệu lệch, không tự sửa database.
- Lọc encounter_id để xem tối đa 100 mục lịch sử gần nhất mỗi loại: trạng thái, chuyển bác sĩ, payment và sửa bệnh án. Có history_limit và medical_revision_count; không tuyên bố lịch sử dài hơn 100 mục đã được trả đầy đủ.

## Schema và trạng thái bàn giao

Schema thống nhất 09/10/2026 vẫn 20 bảng; version và revision_history nằm ngay trong CREATE TABLE medical_record, không còn ALTER TABLE nâng cấp bảng cũ. ERD và dữ liệu mẫu đồng bộ. init_db khởi tạo các cấu hình mặc định bằng ON CONFLICT DO NOTHING để khởi động lại cùng schema không ghi đè cấu hình đã lưu. Người dùng chọn tạo lại database từ đầu theo hướng dẫn chạy; lần sửa này chưa thực hiện reset hay rebuild.

Chưa xác minh bằng kiểm thử: quyền bệnh án/thuốc, thu hồi NURSE, bệnh án/thuốc/complete đồng thời, version và rollback revision, review trùng/của người khác, bài nháp/xuất bản tương lai, cấu hình có tác dụng, thống kê hoàn 50%/100%, boundary timezone/ngày, migration và hồi quy gói 1–4. Đây là bàn giao code, chưa nghiệm thu chức năng.
