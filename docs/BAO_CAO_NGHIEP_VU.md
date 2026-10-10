# Báo cáo nghiệp vụ — Đăng ký và đặt lịch khám bệnh

GỘP D1/D2 11/10/2026: validator hồ sơ bác sĩ/phân công y tá dùng staff_schema.py; validator lượt khám/thanh toán dùng encounter_schema.py. Chuyển nguyên hàm, chỉ cập nhật import. Giảm thêm 2 file; 437 hàm/lớp/decorator giữ nguyên nội dung; 23/23 test hiện có và ca tích hợp hồ sơ bác sĩ đạt; 75 module import thành công. Không thay schema database hoặc reset dữ liệu. Chi tiết docs/BAO_CAO_GOP_MODULE_ABC.md.


GỘP A/B/C 11/10/2026: đã chuyển nguyên hàm của 7 cặp được duyệt vào user_model, auth_schema, auth_service, schedule_service, schedule_routes, medical_record_model và medical_record_schema. Giữ nguyên code hàm/decorator/SQL/quyền/transaction/endpoint; chỉ cập nhật import và đăng ký Blueprint. Giảm 7 file. Bộ kiểm thử hiện có 23/23 đạt, hai ca tích hợp bổ sung đạt, 77 module import thành công; so sánh 437 hàm/lớp trước/sau giữ nguyên. Chi tiết docs/BAO_CAO_GOP_MODULE_ABC.md. Không thay schema hoặc reset database.


GỘP MODULE 10/10/2026 theo yêu cầu chủ đồ án: bệnh án và thuốc dùng chung model/schema medical_record; lượt khám và log dùng model encounter, online/walk-in/chuyển bác sĩ dùng schema encounter. Chuyên khoa/phòng dùng catalog_* theo từng tầng. Tác vụ nền gộp trong backend/app/utils/worker.py (folder utils), vẫn chạy worker riêng và giữ transaction riêng cho từng tác vụ. Tạo admin ban đầu thống nhất qua seed_db --admin, mật khẩu 12–128 ký tự có chữ/số, không ghi đè tài khoản có sẵn và không tự xác minh email. Không thay endpoint/schema database, không cần reset dữ liệu.


**Đồng bộ tên 10/10/2026 theo yêu cầu chủ đồ án:** tác vụ nền dùng `backend/app/utils/`, nhắc lịch dùng `worker.py`; tài khoản worker dùng email `medical_booking@gmail.com`, trạng thái LOCKED và không đăng nhập. `SEND_EMAIL=1` bật log email/OTP giả lập và API kết quả thanh toán giả lập; mẫu cấu hình đặt giá trị `1`, khi thiếu biến hoặc khác `1` thì tắt. Đây là mô phỏng, chưa gửi email hoặc kết nối ngân hàng thật. Đổi tên không thay schema và không cần xóa dữ liệu.

**Cập nhật 09/10/2026:** lịch gồm hai ca sáng/chiều; chỉ đặt online ít nhất 5 giờ trước giờ bắt đầu ca, đúng mốc được nhận, sau mốc hoặc đang trong ca bị từ chối. Mốc này áp dụng khi tạo giữ chỗ, lượt HOLDING vẫn có 10 phút thanh toán. Tính theo giờ bắt đầu ca đã cấu hình (Asia/Saigon). Các đề xuất bổ sung ngoài thay đổi này được bỏ qua theo yêu cầu chủ đồ án.

**Chốt gói 3 (08/10/2026):** áp dụng [QUY_TAC_GOI_3_DA_CHOT.md](QUY_TAC_GOI_3_DA_CHOT.md): giữ chỗ 10 phút, cọc 100% giá bác sĩ, bắt buộc check-in ít nhất 30 phút trước giờ hẹn; walk-in cấp số ngay trong lúc online chờ trả tiền, không đổi số đã cấp. Những mục còn ghi “chưa chốt” bên dưới được thay thế trong phạm vi quy tắc này. Cọc 30% trong dữ liệu mẫu chỉ là snapshot lịch sử.

Cập nhật: 08/10/2026. Tài liệu ghi lại các quyết định trong cuộc trao đổi với chủ
đồ án và đối chiếu cấu trúc dự án. Đọc tài liệu này trước khi tiếp tục thay đổi
backend/database. Yêu cầu mới của người dùng có ưu tiên cao hơn ghi chú cũ;
khi có quyết định mới, cập nhật mục tương ứng, không giữ hai quy tắc mâu thuẫn.

## 1. Phạm vi và trạng thái hiện tại

- Đây là đồ án, không phải hệ thống bệnh viện triển khai thực tế.
- Hiện chỉ làm backend và database; không chỉnh frontend nếu chưa có yêu cầu mới.
- Backend: Flask, Gunicorn, psycopg; database: PostgreSQL 17; chạy Docker Compose
  bằng docker-compose.yml. Không đổi tên file cấu hình về compose.yaml.
- Đã có schema 20 bảng, ERD, dữ liệu mẫu, khởi tạo/seed và GET /health, Swagger /docs/.
- Chưa triển khai đầy đủ API nghiệp vụ. Có bảng hoặc tên API trong kế hoạch không
  có nghĩa chức năng đã hoàn thành.
- Các thay đổi schema nằm trong file; phải kiểm tra database đang chạy đã áp dụng
  bằng việc tạo mới chưa. Không mặc định database đang khớp file SQL.

## 2. Quyết định đã chốt với chủ đồ án

| Nội dung | Quy tắc |
|---|---|
| Đường dẫn API | Cả 5 gói dùng trực tiếp /auth, /me, /admin, /patients, /encounters…; không thêm tiền tố /api/v1 hoặc /v1 |
| Đăng ký công khai | Chỉ tạo USER; người đăng ký không tự chọn vai trò đặc quyền |
| Tài khoản nhân viên | ADMIN tạo DOCTOR, RECEPTIONIST, NURSE sau kiểm tra hồ sơ/hợp đồng bên ngoài |
| Hợp đồng | Không cần lưu hoặc quản lý hợp đồng trong database |
| Yêu cầu đổi vai trò | Không cần luồng USER xin vai trò nhân viên; role_request hiện có nhưng chưa sử dụng |
| Hồ sơ tài khoản | Mọi vai trò có thông tin cá nhân trong users; doctor_profile là thông tin chuyên môn bổ sung |
| Avatar | Chỉ bác sĩ có, dùng doctor_profile.avatar_url; chưa thêm avatar chung vào users |
| BHYT | Bệnh nhân cung cấp mã thẻ qua patient.health_insurance; không xử lý quyền lợi/chi trả BHYT |
| Online và trực tiếp | Hai quy trình riêng, cùng lưu trong encounter qua encounter_type; bệnh nhân walk-in không tự chọn ca; lễ tân/hệ thống gắn ca và cấp số sau lịch online của ca đó |
| Bệnh án hoàn tất | Đã chốt gói 5: bác sĩ phụ trách bổ sung/sửa cùng bệnh án, giữ COMPLETED, bắt buộc lý do/version và lưu trước-sau; lần khám mới tạo encounter mới |
| Tên lượt khám | Dùng encounter, không dùng visit trong schema/API mới |
| Thanh toán/hoàn tiền | Giả lập, không liên kết ngân hàng hay cổng thanh toán thật |
| Email/OTP | Giả lập, không tích hợp nhà cung cấp email thật |
| Mật khẩu | users.password_hash bắt buộc NOT NULL và không rỗng; lưu hash, không lưu mật khẩu rõ |
| Lưu trữ bệnh nhân | patient.archived_at ngừng sử dụng hồ sơ, giữ lịch sử |
| Điều dưỡng | Phân công theo ca trong nurse_assignment; giữ lịch sử thu hồi |
| Giá khám | Lưu giá và cọc đã chốt trên encounter; không lấy giá mới thay giá lịch sử |

Các vai trò có sẵn là USER, DOCTOR, RECEPTIONIST, NURSE, ADMIN. Vai trò có sẵn
không có nghĩa mọi tài khoản nhân viên được tự động tạo. Admin đầu tiên được
seed bằng thông tin nhập; tài khoản mẫu chỉ phục vụ minh họa.

## 3. Vai trò và phạm vi nghiệp vụ

| Vai trò | Nghiệp vụ dự kiến |
|---|---|
| USER | Quản lý hồ sơ bản thân/người thân, đặt online, xem lượt khám/kết quả, thanh toán giả lập, hủy và đánh giá |
| DOCTOR | Xem ca và lượt khám phụ trách, bắt đầu khám, ghi kết quả/đơn thuốc, hoàn tất, cập nhật hồ sơ chuyên môn/avatar |
| RECEPTIONIST | Tìm/tạo bệnh nhân, tiếp nhận walk-in, check-in online, hàng chờ, điều phối/chuyển bác sĩ, thu phí theo quyền |
| NURSE | Xem ca được giao, thông tin/hàng chờ trong phạm vi được phân công; thao tác cụ thể còn cần chốt |
| ADMIN | Tạo/quản lý tài khoản nhân viên, danh mục, ca, phân công y tá, nội dung, cấu hình và thống kê |

Kiểm tra cả vai trò và quyền trên bản ghi. USER không xem bệnh án của tài khoản
khác; bác sĩ chỉ thao tác lượt khám được giao; y tá cần phân công còn hiệu lực.
Không mặc định NURSE được sửa chẩn đoán/đơn thuốc hoặc ADMIN bỏ qua mọi kiểm tra.

## 4. Phân biệt các loại hồ sơ

- users: tài khoản đăng nhập và thông tin cá nhân của mọi vai trò.
- patient: người thực sự được khám, gồm bản thân/người thân và walk-in chưa có tài khoản.
  Một USER có thể quản lý nhiều patient. Không bắt buộc tài khoản mới có ngay patient.
- doctor_profile: hồ sơ chuyên môn của tài khoản bác sĩ, liên kết users duy nhất.
- patient.user_id NULL được phép cho walk-in chưa có tài khoản. Không tự gán hồ sơ
  cho tài khoản chỉ vì trùng số điện thoại.
- Archive patient không xóa encounter, medical_record hoặc lịch sử liên quan.

## 5. Hai quy trình tiếp nhận

### 5.1. Đặt lịch online

Luồng thiết kế dự kiến:

1. USER chọn hồ sơ bệnh nhân, bác sĩ và ca còn chỗ.
2. Tạo encounter loại ONLINE, trạng thái HOLDING; giữ quota và chốt giá/cọc.
3. Tạo payment cọc PENDING; kết quả thanh toán giả lập thành công chuyển CONFIRMED
   và dành số thứ tự trong ca cho lịch online.
4. Khi bệnh nhân đến, lễ tân check-in encounter đã có, chuyển CHECKED_IN và giữ số đã cấp.
5. Bác sĩ bắt đầu: IN_PROGRESS; ghi bệnh án/đơn thuốc; hoàn tất: COMPLETED.

HOLDING quá hạn chuyển EXPIRED và trả quota đúng một lần. Người có lịch online
đến bệnh viện không được tạo thêm WALK_IN cho cùng lần khám.

### 5.2. Đến trực tiếp tại bệnh viện

Bệnh nhân không tự chọn ca, nhưng encounter WALK_IN vẫn được gắn với ca
bởi lễ tân/hệ thống. Quy trình đã thống nhất:

1. Lễ tân tìm hoặc tạo patient; bệnh nhân không bắt buộc có tài khoản.
2. Xác định bác sĩ/phòng phù hợp và ca hiện tại còn tiếp nhận.
3. Tạo WALK_IN, gắn schedule_id và cấp số ngay sau các số online đã dành trong ca.
4. Nếu ca hiện tại đầy/đóng, xếp người mới đến vào ca tiếp theo còn tiếp nhận;
   số của họ nằm sau các số online của ca tiếp theo.
5. Check-in/tiếp nhận, bác sĩ khám rồi hoàn tất; thời điểm thu phí còn cần chốt.

Ví dụ: ca sáng đã dành số online 1–11, walk-in tiếp theo nhận 12 rồi 13.
Ca chiều đã dành số online 1–8, walk-in xếp vào ca chiều nhận số 9.
Không chèn lịch online mới vào trước các số đã cấp nếu gây thay đổi số bệnh nhân;
quy tắc nhận online muộn sau khi đã cấp số walk-in cần chốt trước khi triển khai.

Người đã nhận số nhưng chưa được khám có chuyển sang ca tiếp theo hay không vẫn
chưa rõ; không tự chuyển hàng chờ hoặc đổi số khi chưa có quy tắc.
Schema cuối cùng bắt buộc encounter.schedule_id NOT NULL cho cả online và walk-in.

### 5.3. Quy tắc dùng chung

- Các trạng thái SQL: HOLDING, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED,
  CANCELLED, NO_SHOW, EXPIRED. CHECK chỉ giới hạn giá trị, không thực thi chuyển trạng thái.
- encounter_service chịu trách nhiệm trạng thái, quota và log trong cùng transaction.
- Chống vượt quota khi nhiều người đặt đồng thời; hủy/check-in/thanh toán lặp không
  phát sinh hiệu ứng lần hai. Không cập nhật booked_count tùy ý ở module thanh toán.
- schedule_id bắt buộc; UNIQUE(schedule_id, queue_number) giới hạn số thứ tự trong ca.
- UNIQUE ngày/giờ bắt đầu của lịch chưa ngăn chồng khoảng thời gian; backend phải
  xử lý chồng ca bác sĩ/phòng, kể cả thao tác đồng thời.
- Lịch bác sĩ báo nghỉ cần xử lý lượt khám bị ảnh hưởng; không tự hủy hàng loạt.

## 6. Thanh toán, email và giá lịch sử

**Gói 4 đã chốt:** hủy từ 12 giờ trước giờ hẹn hoàn 50% cọc; dưới 12 giờ/no-show không hoàn; nguyên nhân bệnh viện/bác sĩ hoàn 100%. Giờ hẹn tại thời điểm hủy được lưu riêng; quyền ghi nguyên nhân HOSPITAL chỉ ADMIN/RECEPTIONIST hoặc hệ thống khi ca báo nghỉ. Tiền đến sau hết hạn/hủy không xác nhận lịch, được trả lại. Chi tiết: [BAO_CAO_TRIEN_KHAI_GOI_4.md](BAO_CAO_TRIEN_KHAI_GOI_4.md).

- payment có loại DEPOSIT, EXAM_FEE, REFUND và trạng thái PENDING, SUCCESS, FAILED, REFUNDED.
- Toàn bộ giao dịch trong đồ án là giả lập, kể cả khi payment_method là BANK/CARD/EWALLET.
- consultation_fee_snapshot và deposit_amount_snapshot trên encounter lưu số nguyên VND,
  được backend chốt từ giá/chính sách phía server. Cọc không âm, không vượt phí khám.
- Dữ liệu mẫu dùng cọc 30% cho online, EXAM_FEE là phần còn lại; tổng thu bằng giá chốt.
  30% là ví dụ trong dữ liệu mẫu, chưa là chính sách bắt buộc đã chốt.
- Giá lịch sử chưa biết để cả hai snapshot NULL, không coi là miễn phí hoặc tự suy ra
  từ giá hiện tại. Không thay snapshot khi đổi giá bác sĩ.
- Hoàn tiền giả lập là nghiệp vụ riêng với hủy lịch; điều kiện/mức hoàn áp dụng chính sách gói 4 ở trên.
- auth_token lưu hash mã/token, hạn dùng và thời điểm đã dùng. Chọn cách trình diễn
  email/OTP giả lập trong môi trường demo; không công khai OTP của người khác.
- notification là thông báo trong ứng dụng; reference_type của lượt khám là ENCOUNTER.

## 7. Các bảng hiện có

| Nhóm | Bảng |
|---|---|
| Tài khoản | role, users, auth_token |
| Bệnh nhân | patient |
| Danh mục và lịch | department, doctor_profile, room, work_schedule |
| Lượt khám | encounter, encounter_status_log, encounter_transfer_log |
| Tài chính | payment |
| Khám bệnh | medical_record, prescription_item |
| Phản hồi/nội dung | review, notification, article, system_configuration |
| Bổ sung | nurse_assignment, role_request |

role_request được thêm trước khi chốt cách tạo tài khoản nhân viên. Hiện chưa dùng;
không tự triển khai luồng xin quyền hoặc xóa bảng khi chưa có yêu cầu.

## 8. Phân công và phối hợp

| Gói | Trách nhiệm |
|---|---|
| 1 | Tài khoản, xác thực/quyền và nền tảng dùng chung |
| 2 | Hồ sơ bệnh nhân, BHYT, danh mục, ca, phân công y tá và avatar bác sĩ |
| 3 | Online/walk-in, check-in, hàng chờ, quota, trạng thái và điều phối |
| 4 | Thanh toán/hoàn tiền giả lập, thông báo và nhắc lịch |
| 5 | Bệnh án, thuốc, đánh giá, nội dung, cấu hình và thống kê |

Gói 1 và 2 có thể làm song song. Gói 3 có người/nhóm phụ trách riêng, làm trước
bằng dữ liệu mẫu nhưng cần tích hợp xác thực của gói 1 và hồ sơ/ca của gói 2.
Gói 4/5 gọi service của gói 3 để thay đổi trạng thái; thống nhất đầu vào/đầu ra
và transaction trước khi code. Không bắt buộc tuần tự hoàn thành từng gói.
Số người thực tế chưa được xác nhận; 5 gói là cách chia trách nhiệm, không là
quyết định nhóm phải có 5 thành viên. Chi tiết file/API/nghiệm thu xem kế hoạch backend.

## 9. Những điều còn cần chốt

1. Session hay JWT; cách logout/thu hồi phiên.
2. Mức cọc, hạn giữ chỗ và thời điểm thu phần phí còn lại.
3. Hoàn cọc đã chốt ở gói 4: hủy từ 12 giờ hoàn 50%, dưới 12 giờ/no-show không hoàn, nguyên nhân bệnh viện/bác sĩ hoàn 100%.
4. Khoảng check-in sớm/trễ, thời điểm và thời gian ân hạn để tính NO_SHOW.
5. WALK_IN được hệ thống gắn ca và cấp số sau online. Cần chốt chuyển người
   đã nhận số nhưng chưa khám sang ca sau và nhận online muộn khi đã có walk-in.
6. Y tá được xem/sửa những trường nào và được thực hiện action nào.
7. Bệnh án đã chốt: sửa/bổ sung cùng record, giữ COMPLETED, có lý do/version/lịch sử trước-sau; khám lần mới tạo encounter mới. Xem BAO_CAO_TRIEN_KHAI_GOI_5.md.
8. Chuyển bác sĩ khác giá: đề xuất giữ giá chốt, chưa chốt cách xử lý chênh lệch.
9. Danh tính ghi log cho tác vụ tự động; changed_by_id hiện bắt buộc tham chiếu users.

Không biến giá trị dữ liệu mẫu hoặc đề xuất thành yêu cầu đã được người dùng chốt.

## 10. Khởi tạo dữ liệu theo schema cuối cùng

- Người dùng chọn tạo lại database, không cần giữ lịch sử cập nhật schema.
- init_db.sql chứa toàn bộ schema 20 bảng; không sử dụng thư mục migrations.
- Chốt 09/10/2026: đã gộp 12 cột bổ sung của gói 3–5 vào đúng CREATE TABLE; bỏ toàn bộ ALTER TABLE trong schema khởi tạo. Index, cấu hình mặc định và trigger được gom riêng sau các bảng. Chủ đồ án sẽ khởi tạo lại dữ liệu từ đầu, không cần hỗ trợ nâng cấp schema cũ.
- Khi thay đổi schema, cập nhật init_db.sql, sample_data.sql, erd.html và kiểm thử;
  tạo mới database để áp dụng. Khởi động lại backend không tự nâng cấp bảng cũ.
- encounter.schedule_id bắt buộc cho ONLINE và WALK_IN.
- docker compose down -v xóa dữ liệu volume; sample_data.sql xóa dữ liệu các bảng
  rồi nạp lại. Người dùng sẽ chủ động tạo lại dữ liệu theo hướng dẫn chạy.
- Dữ liệu mẫu có 15 tài khoản dùng Demo-password-123!, lưu hash hợp lệ.

Tham khảo:

- [Hướng dẫn chạy](HUONG_DAN_CHAY_DU_AN.md).
- [API và phân công backend](DANH_SACH_API_VA_PHAN_CONG_BACKEND.md).
- [Schema](../database/init_db.sql).
- [ERD](../database/erd.html).

## 11. Cách dùng tài liệu ở các lần làm việc tiếp theo

Đọc mục 1–2 và 9 để biết phạm vi, quyết định và phần chưa chốt; đối chiếu schema/code
thực tế trước khi sửa. Cập nhật tài liệu khi có thay đổi nghiệp vụ được người dùng
xác nhận. Báo rõ chức năng đang ở mức thiết kế, schema, code hay đã kiểm thử; không
khẳng định một luồng hoàn thành chỉ vì có bảng. Nội dung tài liệu hỗ trợ nhớ bối cảnh,
không thay thế yêu cầu mới hoặc kết quả kiểm tra thực tế.

### Ghi nhận trao đổi mới nhất

Quyết định gắn ca ở mục 5.2 thay thế cách hiểu trước đó rằng walk-in không có ca.
Lịch online dành số khi xác nhận; walk-in nhận số sau số online của ca được xếp.
Người dùng cũng đã đính chính bệnh án có thể sửa/bổ sung sau hoàn tất; chưa chốt
cách mở lại lượt khám và lịch sử sửa. Các đoạn giọng nói về session/JWT, hoàn cọc,
quyền điều dưỡng, giá chuyển bác sĩ và danh tính tác vụ tự động vẫn cần xác nhận.
