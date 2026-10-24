# Rà soát giao diện admin — 24/10/2026

## Phạm vi và mức bằng chứng

Kiểm kê đủ **18 mục điều hướng admin**, gồm trang hồ sơ cá nhân dùng chung; `templates/(admin)/profile.html` là trang chuyển hướng tới `components/profile.html?role=admin`. Đã mở các trang trên Chrome tại `localhost:3000`, đối chiếu nguồn frontend, route/schema/service/model và đọc API của container backend đang phục vụ. Ngày mặc định quan sát được: **24/10/2026**, giờ Việt Nam.

Các nút lặp trên nhiều hàng được kiểm tra theo **loại chức năng**, không bấm sửa từng bản ghi. Những nút có tác dụng ghi dữ liệu chỉ được kiểm tra form/handler và các test cô lập tương ứng; không gửi lệnh ghi vào database đang dùng. Mở thông báo có thể đánh dấu đã đọc nên không bấm vào thông báo thật. Không lưu bản nháp tin tức, không duyệt nghỉ, không hoàn tiền, không đổi mật khẩu hoặc phân công thật trong lần rà soát này.

Ký hiệu trong ma trận: **UI** = đã mở/thao tác trình bày trên trình duyệt; **GET** = đã đối chiếu API đọc thực tế; **CODE** = đã lần theo xử lý và hợp đồng API; **TEST** = có kiểm thử chạy trong lần này. Có CODE không đồng nghĩa đã xác minh lưu thành công từ trình duyệt.

Tài liệu đã đối chiếu: `docs/BAO_CAO_NGHIEP_VU.md`, `docs/TONG_HOP_PHAN_TICH_NGHIEP_VU.txt`, `docs/HUONG_DAN_CHAY_DU_AN.md` và skill dự án. Không tìm thấy `docs/DANH_SACH_API_VA_PHAN_CONG_BACKEND.md`; không giả định đã đọc tài liệu này. Không sửa `docs/`.

## Kết quả chính và việc còn thiếu

| Mã | Vị trí | Phát hiện có bằng chứng | Ảnh hưởng / việc cần làm |
|---|---|---|---|
| A01 | Bác sĩ → Thêm hồ sơ bác sĩ | Ô Tài khoản bác sĩ gợi ý đủ 14 tài khoản đã có hồ sơ. SELECT xác nhận hiện có **0** tài khoản DOCTOR hoạt động/đã duyệt chưa có hồ sơ. Backend chặn trùng bằng `DUPLICATE_DOCTOR_PROFILE`. | Nút đã nối API nhưng mọi lựa chọn hiện có sẽ trùng hồ sơ. Cần lọc tài khoản chưa có hồ sơ và thông báo tạo tài khoản trước khi danh sách rỗng. Nguồn: `admin_workspace.js` → `references(doctorUsers)`; `doctor_service.create_doctor`. |
| A02 | Tài khoản → Chỉnh sửa | Chi tiết có “Quan hệ với người liên hệ”, nhưng `resources.users.fields` thiếu `emergency_contact_relationship`. | Không sửa được trường này từ form quản trị mặc dù API hỗ trợ trường hồ sơ. Đây là thiếu trường frontend, không thiếu endpoint. |
| A03 | Tài khoản → Phê duyệt | Có cột Phê duyệt và API PATCH nhận `approval_status`, nhưng form quản trị không có lựa chọn duyệt/từ chối tài khoản. Tạo mới mặc định APPROVED. | Khả năng backend chưa được đưa lên UI cho tài khoản đang chờ. Cần quyết định giữ nghiệp vụ duyệt theo quy tắc hiện tại; việc đã bỏ bộ lọc Phê duyệt không tự đồng nghĩa bỏ chức năng duyệt. |
| A04 | Tổng quan → Lịch làm việc bác sĩ | `loadAdminOverview/loadOverviewSchedules` chỉ đọc ca, không đọc đơn nghỉ đang chờ; `overviewShiftStatus` cũng chưa có nhánh PENDING leave. | Nhãn “Đang xin nghỉ” chưa được nối dữ liệu tại từng ca trên tổng quan. Trang Lịch làm việc vẫn đọc/xét duyệt đơn nghỉ được. |
| A05 | Bệnh nhân → Lịch sử khám | Danh sách lấy đầy đủ các trang nhưng giữ thứ tự API theo thời điểm tạo. Quan sát BN_009: LK_070 và LK_061 ngày 22/10 đứng trước LK_210 ngày 24/10. | Nếu mong đợi lần khám gần nhất ở đầu thì cần sắp theo ngày/giờ khám; dữ liệu không bị mất và nút Xem hồ sơ vẫn hoạt động. |
| A06 | Hồ sơ cá nhân admin → Đổi mật khẩu | Nút đóng form vẫn ghi **“Đóng ×”** trên trình duyệt, khác các hộp thoại admin chính đã dùng “Đóng”. | Lệch quy ước trình bày; form và API đổi mật khẩu đã có. Không thực hiện đổi mật khẩu thật. |
| A07 | Phân công lễ tân | Có **20 khu vực**, **6 lễ tân** gồm 5 tài khoản vừa thêm, nhưng **0 phân công** trên toàn database. | Danh sách phân công và lịch làm việc lễ tân trống là thiếu bản ghi phân ca thực tế, không phải chưa nối API. Chưa có dữ liệu thật để bấm Chi tiết/Sửa/Thu hồi trên trang này; các luồng này có test cô lập. |
| A08 | 5 tài khoản lễ tân mới | Cả 5 chưa có số điện thoại, ngày sinh, giới tính và liên hệ khẩn cấp; có email đăng nhập và tên. | Dữ liệu tài khoản mới ở mức mẫu tối thiểu. Chưa đủ hồ sơ nhân viên chi tiết; không tự bịa bổ sung thông tin cá nhân. |
| A09 | Thanh toán, hoàn tiền, đánh giá, báo cáo hôm nay | Ngày 24/10 không có giao dịch thanh toán/hoàn tiền và không có đánh giá; database có **240 giao dịch**, **24 đánh giá**, trong đó **14 giao dịch REFUND**. Đổi khoảng ngày trên UI đọc được chi tiết. | Trống do bộ lọc hôm nay. Không cần nối lại API hoặc thêm dữ liệu chỉ để làm số liệu khác 0. |
| A10 | Thanh toán, đánh giá, thông báo, báo cáo, phân công y tá | Nhiều bộ lọc/phân trang thực hiện sau khi frontend tải toàn bộ các trang API. Ví dụ thanh toán tải 12 trang ×20 cho 240 giao dịch; tham số ngày của `/admin/payments` không tự lọc tại BE. | Đã nối và hiện đúng với lượng dữ liệu hiện tại, nhưng tải nặng khi dữ liệu tăng. Khi tối ưu phải bổ sung hợp đồng lọc BE hoặc giữ cơ chế lấy đủ dữ liệu; không đơn thuần bỏ vòng phân trang. |
| A11 | Kiểm thử backend | 32 test được chọn: **28 đạt**, **2 fail**, **2 error**. Ba ca trong `test_admin_completion` vẫn kỳ vọng admin nhận sự kiện quản trị/bài hẹn đăng/nhắc lịch theo quy tắc cũ. Test cấu hình đọc đường dẫn tuyệt đối `/tmp/configuration-check/database/sample_data.sql` không tồn tại. | Cần cập nhật test theo chính sách thông báo mới và làm đường dẫn fixture độc lập môi trường. Không dùng kết quả này để khẳng định mọi thao tác ghi admin đạt. Không sửa test hoặc BE trong yêu cầu chỉ rà soát. |

Không phát hiện mục menu admin nào hoàn toàn chỉ dựng dữ liệu giả frontend hoặc hoàn toàn chưa gọi API. Kết luận này chỉ nói về đường đọc chính và các handler đã đối chiếu; không phải chứng nhận mọi nhánh ghi đều đạt.

## Dữ liệu hiện có

| Nhóm | Toàn phạm vi DB | Phạm vi mặc định trên UI |
|---|---:|---|
| Tài khoản | 45 | 45, 10 hàng/trang |
| Hồ sơ bác sĩ | 14 | 14, 10 hàng/trang |
| Chuyên khoa | 10 | 10 |
| Phòng khám | 14 | 14, 12 hàng/trang |
| Ca bác sĩ | 934 | 28 ca hôm nay |
| Phân công y tá | 269 gồm lịch sử thu hồi | 26 bản ghi hôm nay |
| Khu vực lễ tân | 20 | Nạp vào ô chọn khu vực của form phân công |
| Phân công lễ tân | 0 | 0 |
| Bệnh nhân | 10 | 9 hoạt động; 1 đã lưu trữ nên không ở bộ lọc mặc định |
| Lượt khám | 221 | 30 hôm nay; 16 CONFIRMED, 14 EXPIRED |
| Thanh toán | 240 | 0 hôm nay |
| Đánh giá | 24 | 0 hôm nay |
| Bệnh án | 52 | Xem theo lượt trong lịch sử bệnh nhân |
| Tin tức | 35 | Có dữ liệu; tất cả `is_active=1` tại thời điểm kiểm tra |
| Đơn nghỉ | 6 | 4 đơn PENDING trong danh sách mặc định |
| Cấu hình | 15 API trả về | UI hiển thị 14; `MAX_REVIEW_RATING` bị loại có chủ đích trong hàm dựng UI |
| Nhật ký admin | 27 | 25 hôm nay |
| Thông báo admin đang đăng nhập | 196 | 186 chưa đọc; không giới hạn ngày |

Dữ liệu đọc từ API/DB gồm dữ liệu mẫu đã lưu, không đồng nghĩa tất cả là hoạt động bệnh viện thực tế. Không chạy lại sample/reset. Database không có lượt HOLDING/CHECKED_IN/IN_PROGRESS tại thời điểm kiểm tra; vì vậy các nhánh dựa vào những trạng thái này không thể được xác minh chỉ bằng dữ liệu UI hiện tại.

Các số liệu trên là ảnh chụp ở đầu lần rà soát, không khóa dữ liệu. Ở lần kiểm tra chi tiết ca sau cùng, worker đã tự chuyển các lượt sáng quá hạn sang Không đến và giảm chỗ đã đặt; đó là tác vụ nền chạy bình thường, không phải lệnh ghi từ lần rà soát. Không dùng các con số trạng thái ở hai thời điểm khác nhau để kết luận mất dữ liệu.

## Ma trận từng chức năng và nhóm nút

### 1. Thành phần dùng chung trên mọi trang

| Nút/chức năng | Đường xử lý / API | Bằng chứng và giới hạn |
|---|---|---|
| Từng mục menu, logo, Hồ sơ cá nhân | `admin_navigation.js`, `adminPageHref` | UI: đã mở đủ 18 đích. |
| Tìm chức năng quản trị, chọn gợi ý | `admin_topbar.js`, `admin_function_search.js` | CODE + TEST frontend: điều hướng theo danh mục; không cần API tìm riêng. |
| Thu gọn/mở menu, backdrop mobile, kéo độ rộng | `sidebar_collapse.js`, handler trong `pages/admin.js` | CODE; không thay cấu hình chiều rộng của người dùng để thử. |
| Chuông thông báo, số chưa đọc | `/notifications/unread-count`, `/notifications` | UI + GET: 186; không đếm riêng trang đầu. |
| Tìm kiếm, xóa nội dung ô, chọn gợi ý, chọn ngày | `live_search.js`, `date_inputs.js`, reference list API của từng trang | UI mở ô và đổi ngày ở trang đánh giá/thanh toán; CODE + TEST các helper. Nút × trong input là xóa nội dung, khác nút đóng bảng. |
| Trang trước / Trang sau | API pagination hoặc phân trang tập dữ liệu đã tải | UI hiện đúng tổng/trạng thái disabled; CODE các handler. Không tuyên bố đã bấm mọi trang của mọi danh sách. |
| Đóng, Hủy, Escape, bấm ngoài | `dialog_dismiss.js`, `admin_form_dialog.js`, handler từng form | UI đóng nhiều form bằng nút; CODE xử lý backdrop/Escape và chặn đóng khi bận. Chưa thử backdrop ở mọi loại modal. |
| Thử lại / tải lại khi API lỗi | `createAdminContext`, handler retry của từng form | CODE + TEST lỗi ở helper; không cố ý tắt server thật. |
| Đăng xuất | POST `/auth/logout` + xóa session cục bộ | CODE; chưa bấm để giữ phiên admin đang dùng cho rà soát. |

### 2. Tổng quan

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Các chỉ số hôm nay | GET `/admin/statistics/encounters`, `/admin/statistics/payments` | UI + GET: 30 lượt, 0 hoàn tất, thu ròng 0. |
| Biểu đồ tuần; tuần trước, tuần sau, Tuần này | GET thống kê lượt khám theo khoảng ngày | UI dữ liệu tuần 19–25/10; CODE + TEST thay tuần độc lập chỉ số hôm nay. |
| Xem danh sách lượt khám | `encounters.html` | UI đích đã mở, CODE liên kết. |
| Chọn ngày lịch bác sĩ | GET `/admin/schedules?from_date=...&to_date=...` | UI 28 ca hôm nay; còn thiếu gắn đơn nghỉ chờ duyệt (A04). |
| Quản lý lịch | `schedule.html` | UI đích đã mở. |
| Cuộn danh sách ca/thông báo | Cuộn tập dữ liệu API đã nạp đủ | UI có dữ liệu, CODE không cắt theo phần đang nhìn. |
| Chọn một thông báo | PATCH `/notifications/{id}/read`, mở chi tiết | CODE; chưa bấm thông báo thật vì sẽ đổi trạng thái đã đọc. |

### 3. Tài khoản & phân quyền

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm kiếm, vai trò, trạng thái | GET `/admin/users`, `/admin/roles` | UI + GET 45 tài khoản, 5 vai trò; CODE filter. |
| Chi tiết | GET `/admin/users/{id}` | UI + GET đủ nhóm cá nhân, quyền, liên hệ khẩn cấp, thời điểm. |
| Tạo tài khoản → Tạo mới | POST `/admin/users` | UI form; CODE + TEST cô lập gọi tạo được trước khi test kỳ vọng thông báo cũ fail. Chỉ gợi ý DOCTOR/NURSE/RECEPTIONIST khi tạo mới. |
| Chỉnh sửa → Lưu thay đổi thông tin/vai trò | PATCH `/admin/users/{id}` | UI form; CODE + TEST frontend thay đổi/no-op, lỗi một phần. Thiếu trường quan hệ liên hệ (A02). |
| Khóa/mở tài khoản trong form sửa | PATCH `/admin/users/{id}/account-status` | UI select + CODE + TEST frontend, chặn tự khóa. Chưa khóa người dùng thật. |
| Phê duyệt | PATCH nhận `approval_status` | Có API, chưa có điều khiển trên form hiện tại (A03). |
| Hủy/Đóng/xóa từng ô | Không gửi API ghi | UI đóng; CODE xóa nội dung cục bộ. |

### 4. Bác sĩ

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm kiếm, chọn chuyên khoa, phân trang | GET `/doctors`, `/departments` | UI + GET 14 bác sĩ. |
| Chi tiết | GET `/doctors/{id}` và `/admin/users/{id}` | UI đã mở đủ thông tin chuyên môn/tài khoản/giới thiệu. |
| Thêm hồ sơ → Tạo hồ sơ bác sĩ | POST `/admin/doctors` | UI + CODE + TEST cô lập tạo hồ sơ; danh sách tài khoản chưa lọc hồ sơ đã tồn tại (A01). |
| Chỉnh sửa chuyên môn, phí, kinh nghiệm, giới thiệu → Lưu | PATCH `/admin/doctors/{id}` | UI + CODE + TEST frontend và thao tác cập nhật cô lập trong nhóm completion. |
| Trạng thái tài khoản trong form sửa | PATCH `/admin/users/{id}/account-status` | UI + CODE + TEST frontend báo lỗi một phần nếu chỉ lưu chuyên môn được. |
| Hủy/Đóng/xóa nội dung | Cục bộ | UI + CODE. |

### 5. Phân công y tá

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Lọc y tá/mã ca/ngày và phân trang | GET `/admin/nurse-assignments`; ngày lọc ở FE sau khi tải đủ trang | UI hôm nay 26; CODE + TEST frontend. |
| Chi tiết | GET `/admin/nurse-assignments/{id}` | UI có dữ liệu thật và lịch sử phân công/thu hồi. |
| Chỉnh sửa y tá, ca, ghi chú, trạng thái | GET detail + GET lịch từ hôm nay; PATCH `/admin/nurse-assignments/{id}` | UI form, CODE `expected_version`; kiểm tra frontend đạt. Chưa thử lưu thực tế trong lần này. |
| Thu hồi qua chọn trạng thái rồi Lưu | PATCH cùng endpoint với `assignment_status=REVOKED` | CODE; không phải nút xóa dữ liệu. Không gửi lệnh thu hồi thật. |
| Phân công y tá → thời gian, buổi, thứ trong tuần | GET danh sách ca thực tế | UI form; CODE + TEST dựng/lọc ca. |
| Chọn y tá/chuyên khoa/phòng | GET users, departments, schedules và đơn nghỉ đã duyệt | UI form; CODE + TEST gợi ý, trùng lịch, nghỉ đã duyệt. |
| Chọn từng ca / Chọn tất cả | Trạng thái chọn cục bộ, ca bị chặn không chọn | CODE + TEST frontend. |
| Phân công các ca đã chọn | POST `/admin/nurse-assignments` từng ca | CODE + TEST frontend xử lý thành công một phần, lỗi mạng không tự thử lại. Chưa chạy POST từ browser. |
| Hủy/Đóng/Thử lại | Cục bộ hoặc tải lại GET | UI đóng + CODE. |

### 6. Phân công lễ tân

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm tên/khu vực, chọn ngày, phân trang | GET `/admin/reception-assignments` | UI + GET: 0 toàn thời gian. |
| Mở Phân công; chọn thời gian/buổi/thứ | Dự kiến cục bộ; chưa phải bản ghi đã lưu | UI form + CODE + TEST. |
| Chọn lễ tân/khu vực, gõ khu vực mới | GET `/admin/users`, `/admin/reception-workstations` | UI form + GET: 6 lễ tân, 20 sảnh. Không dùng phòng lâm sàng. |
| Chọn từng ca/Chọn tất cả, ghi chú | Cục bộ; kiểm tra trùng lịch/nghỉ | CODE + TEST. |
| Phân công | POST `/admin/reception-assignments` một batch transaction | CODE + 16 TEST tích hợp đạt, gồm rollback, concurrency và thông báo đúng người. |
| Chi tiết | GET `/admin/reception-assignments/{id}` | CODE + TEST; không có hàng thật để bấm trên UI. |
| Chỉnh sửa → Lưu | PATCH `/admin/reception-assignments/{id}` | CODE + TEST phiên bản/no-op/chuyển người/chuyển sảnh. |
| Thu hồi → xác nhận lý do | POST `/admin/reception-assignments/{id}/revoke` | CODE + TEST giữ lịch sử, bỏ khỏi lịch làm việc. |
| Hủy/Đóng/Thử lại tải lựa chọn | Cục bộ / GET lại | UI đóng + CODE. |

### 7. Chuyên khoa

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm kiếm, gợi ý tên, phân trang | GET `/departments?include_inactive=true` | UI + GET 10; mọi khoa có overview và ảnh bìa trong DB. |
| Chi tiết | GET `/departments/{id}` và nhóm thành viên | CODE; có lần đọc hộp thoại quá sớm còn “Đang tải”, nên không dùng snapshot đó làm bằng chứng hoàn tất. Các nhóm nội dung/thành viên đã xác minh trong form sửa. |
| Thêm chuyên khoa → Tạo mới | POST `/admin/departments` | UI form + CODE; kiểm thử frontend tạo kèm ảnh đạt. |
| Chỉnh sửa → Lưu thay đổi | PATCH `/admin/departments/{id}` | UI + CODE `expected_version`. |
| Tải ảnh chuyên khoa / Chọn ảnh thư viện | POST `/admin/departments/{id}/images` rồi PATCH thông tin | CODE + TEST frontend định dạng/dung lượng, giữ ID khi upload lỗi; chưa upload ảnh thật. |
| Nội dung giới thiệu chuyên khoa → Quay lại | Chuyển phần trong cùng draft | UI đã bấm, giữ form. |
| Thêm mục/Bỏ mục ở thư viện ảnh và mục nội dung | Cục bộ; được serialize khi Lưu | UI hiện các nút + CODE + TEST serialize; không lưu sửa thật. |
| Thành viên khoa | GET `/admin/departments/{id}/members` và `/leadership` | UI đã mở, có trưởng/phó và lịch sử. |
| Chọn bác sĩ/chức vụ → Thêm thành viên | POST `/admin/departments/{id}/members` hoặc PUT `/leadership` khi đổi chức vụ thành viên hiện có | CODE + TEST frontend giới hạn phó khoa, không trùng trưởng, optimistic version. Chưa gửi từ UI. |
| Thu hồi quyền | POST `/admin/departments/{id}/members/{doctorId}/revoke-role` | UI có nút + CODE; không bấm thu hồi thật. |
| Quay lại từ thành viên / Hủy / Đóng | Cục bộ | UI đóng + CODE giữ draft. |

### 8. Phòng khám

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm kiếm, chuyên khoa, phân trang | GET `/rooms` | UI + GET 14 phòng. |
| Chi tiết | Dùng hàng API đã tải | UI có tên/khoa/mô tả. Không cần endpoint GET riêng để gọi là đã kết nối. |
| Thêm phòng → Tạo mới | POST `/admin/rooms` | UI + CODE; chưa thử ghi trong lần này. |
| Chỉnh sửa/trạng thái hoạt động → Lưu | PATCH `/admin/rooms/{id}` | UI + CODE; chưa thử ngừng phòng thật. |
| Hủy/Đóng | Cục bộ | UI. |

### 9. Lịch làm việc và đơn nghỉ

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm khoa/bác sĩ/phòng, từ/đến ngày, trạng thái | GET `/admin/schedules` và helper tìm kiếm | UI + GET 28 ca hôm nay; CODE + TEST frontend. |
| Chi tiết | Dữ liệu ca đã tải | UI đã đọc CA_031. |
| Xem chi tiết (cột riêng) | GET `/encounters` theo ca qua helper | UI đã mở CA_031, hiển thị 3 lượt thuộc ca và quay lại danh sách thành công. CODE: Trang trước/sau, Thử lại và Chi tiết từng lượt; chưa bấm mọi nhánh lỗi/phân trang. |
| Chỉnh sửa → Lưu | PATCH `/admin/schedules/{id}` | UI khóa phòng/ngày/giờ/slot khi có lượt đặt; sức chứa và trạng thái còn sửa. CODE endpoint. |
| Tạo ca → chọn khoảng/buổi/thứ/khoa/bác sĩ/phòng | GET doctor/room/schedule, sinh draft cục bộ | UI form + CODE + TEST frontend. |
| Chọn từng ca/Chọn tất cả → Tạo ca | POST `/admin/schedules` từng ca | CODE + TEST frontend xử lý batch/conflict; chưa POST từ browser. |
| Quay lại/Đóng | Cục bộ | UI đóng + CODE. |
| Xem đơn, lọc trạng thái/mã nhân viên | GET `/admin/leave-requests` | UI 4 đơn chờ; API toàn trạng thái 6. |
| Xem/xét duyệt, hoặc Chi tiết đơn đã xử lý | GET `/admin/leave-requests/{id}` | UI thấy người gửi, ngày, lý do, số ca/lượt ảnh hưởng. |
| Chọn Duyệt nghỉ/Từ chối, nhập ý kiến → Xác nhận xét duyệt | POST `/admin/leave-requests/{id}/review` | UI form + CODE; TEST lễ tân duyệt nghỉ thu hồi đúng ca và gửi thông báo đạt. Chưa duyệt đơn thật. |
| Phân trang đơn, Hủy/Đóng | GET/cục bộ | CODE + UI đóng. |

### 10. Lượt khám

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm tên/mã/ngày/hình thức/trạng thái, phân trang | GET `/encounters` qua helper tìm kiếm | UI + GET 30 hôm nay; CODE + TEST tìm kiếm. |
| Chi tiết | GET `/encounters/{id}` | UI dữ liệu bác sĩ/phòng/triệu chứng/phí/mã phiếu. |
| Giao dịch của lượt khám | `payments.html?encounter_id={id}` | CODE có liên kết; trang thanh toán hiểu ID nhưng vẫn giữ ngày giao dịch mặc định hôm nay. Giao dịch trả trước ở ngày cũ có thể không hiện cho tới khi đổi khoảng ngày. |
| Đóng | Cục bộ | UI. |

### 11. Bệnh nhân

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm tên/số điện thoại/CCCD, trạng thái hoạt động, phân trang | GET `/patients`, `include_archived` khi cần | UI 9 hoạt động, DB 1 lưu trữ. |
| Chi tiết | GET `/patients/{id}`, tài khoản và hồ sơ cùng tài khoản | UI có nhóm cá nhân/liên hệ/khẩn cấp/tài khoản/người thân. |
| Thêm bệnh nhân → Thêm bệnh nhân | POST `/patients` | UI form đủ trường + CODE; test frontend tạo/save có kiểm tra lỗi. |
| Chỉnh sửa bệnh nhân/người thân → Lưu | PATCH `/patients/{id}` theo từng hồ sơ; có thể PATCH trạng thái tài khoản | UI + CODE + TEST frontend chống sửa nhầm hồ sơ/lỗi một phần. Điện thoại liên kết đang readonly theo triển khai hiện tại. |
| Lịch sử khám | GET `/patients/{id}/encounters` đủ các trang | UI đã mở; còn thứ tự A05. |
| Xem hồ sơ từng lượt | GET encounter, medical-record, prescription-items, `/admin/audit/encounters` | UI đã mở LK_070: có giao dịch, không có bệnh án của lượt này được báo đúng; không tự dựng kết quả khám. |
| ← Lịch sử khám | GET lại lịch sử đúng bệnh nhân | UI hiện nút + CODE. |
| Hủy/Đóng/xóa nội dung | Cục bộ | UI + CODE. |

### 12. Thanh toán và hoàn tiền

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm giao dịch/lượt/trạng thái/từ/đến ngày, phân trang | GET `/admin/payments` đủ trang, lọc ở FE | UI trống hôm nay; đổi từ ngày 01/09 xem được lịch sử. |
| Chi tiết thanh toán | GET `/encounters/{id}/payments`, `/encounters/{id}`, `/departments/{id}` | UI đã mở TT_240 có giao dịch/lượt/người xử lý/thời điểm. |
| Hoàn tiền từ chi tiết | Mở cùng form hoàn tiền có chọn sẵn giao dịch | CODE; nút có điều kiện thành công/chưa hoàn. Chưa gửi hoàn tiền thật. |
| Yêu cầu hoàn tiền | GET toàn giao dịch, lượt và phòng liên quan | UI mở form; CODE xử lý lỗi/tải. |
| Chọn phòng/ngày/ca/tìm người bệnh | Lọc dữ liệu đủ điều kiện | UI hiện ô + CODE + TEST frontend. |
| Chọn từng giao dịch/Chọn tất cả | Cục bộ; chặn giao dịch đang chưa rõ kết quả | CODE + TEST frontend. |
| Nhóm lý do/lý do → Xác nhận hoàn tiền | POST `/admin/payments/{id}/refund` theo từng giao dịch | CODE + TEST frontend tính điều kiện, không thử lại mù khi lỗi mạng. Không gọi cổng thanh toán thật trong rà soát. |
| Lịch sử hoàn tiền: tìm kiếm/ngày/phân trang/Chi tiết | Lọc REFUND từ `/admin/payments`, đọc ngữ cảnh giao dịch | CODE + GET có 14 REFUND lịch sử; chưa mở từng chi tiết REFUND trên browser. |
| Xem giao dịch gốc / liên kết lượt nếu xuất hiện | Điều hướng qua mã ID backend | CODE; chưa bấm mọi liên kết theo trạng thái. |
| Đóng/Hủy | Cục bộ, khóa khi đang gửi | UI + CODE. |

### 13. Tin tức

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm nội dung/danh mục/trạng thái, phân trang | GET `/admin/articles` đủ trang | UI + GET 35 bài. |
| Chi tiết | GET danh sách admin theo ID, dựng nội dung từ API | UI đã mở bài. |
| Viết bài mới / Chỉnh sửa | Form draft cục bộ, chỉnh sửa nạp bài từ API | UI đã mở cả hai. |
| Chọn ảnh đại diện / Chọn ảnh mục | File local, chỉ upload khi xác nhận | CODE + TEST frontend; chưa upload thật. |
| Bỏ ảnh đại diện / Bỏ ảnh mục | Xóa khỏi draft, lưu khi xác nhận | CODE; chưa lưu. |
| Chọn Bản nháp/Hẹn đăng/Đăng ngay, thời điểm đăng | Mapping `is_active`, `published_at` | UI form + CODE + TEST serialization. Dữ liệu hiện tại không có bài inactive để kiểm tra nhánh draft lịch sử. |
| Nội dung bài viết → Quay lại; header Quay lại | Chuyển vùng trong cùng form | UI đã vào nội dung; CODE quay lại giữ draft. |
| Thêm mục / Xóa mục | Cục bộ, đánh số lại mục | UI đã thêm rồi bỏ mục trong draft, không lưu. |
| Xem trước bài viết | Cục bộ, kiểm tra trường rồi dựng preview | UI đã bấm, hiển thị nội dung và nút Xác nhận cập nhật. |
| Quay lại chỉnh sửa từ preview | Khôi phục các node form cũ | CODE + TEST giữ sections. |
| Xác nhận tạo bài / Xác nhận cập nhật | POST `/admin/articles` hoặc PATCH `/admin/articles/{id}`; upload `/admin/articles/images` nếu có file | CODE + TEST frontend; chưa xác nhận ghi bài thật. |
| Đóng | Cục bộ | UI. |

### 14. Đánh giá

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm kiếm/số sao/khoảng ngày/phân trang | GET `/admin/reviews` đầy đủ trang, lọc FE | UI mặc định 0; đổi khoảng ngày thấy dữ liệu. |
| Chi tiết | GET `/admin/reviews?review_id={id}` | UI đã mở DG_024. |
| Ẩn → xác nhận Ẩn đánh giá | PATCH `/admin/reviews/{id}/visibility` | UI đã mở xác nhận rồi Hủy; CODE + TEST tích hợp ẩn/public aggregate đạt. |
| Hiện lại đánh giá đang ẩn | PATCH cùng endpoint `is_hidden=false` | CODE + TEST tích hợp; không sửa trạng thái thật. |
| Hủy/Đóng | Cục bộ | UI. |

### 15. Thông báo

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm kiếm/loại/đã đọc/khoảng ngày/phân trang | GET `/notifications` của tài khoản, đủ trang | UI + GET 196; 186 chưa đọc. |
| Chi tiết thông báo | PATCH `/notifications/{id}/read` rồi dựng chi tiết | CODE + TEST frontend; không bấm làm thay đổi thông báo thật. |
| Xem nội dung liên quan | Mapping reference type sang trang admin và ID | CODE + TEST frontend; một số reference như khu vực lễ tân không có trang quản lý riêng theo giao diện đã chốt. |
| Đóng | Cục bộ | CODE dùng hộp thoại chung. |
| Thông báo lịch sử không còn phù hợp quy tắc mới | Dữ liệu DB cũ, không bị xóa | UI còn sự kiện không đến/tác nghiệp cũ; không coi đó là bằng chứng nguồn phát mới vẫn sai. Nhóm test quy tắc loại admin đạt 6/6. |

### 16. Thống kê & báo cáo

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Hôm nay/Tuần này/Tháng này/30 ngày/Tùy chọn; từ/đến ngày/chuyên khoa | GET schedules/doctors/encounters/payments và statistics endpoints | UI mặc định hôm nay; CODE + TEST range/invalid range/late response. |
| Tổng hợp | Các nguồn trên | UI có số liệu/chart. |
| Lượt khám | Tập encounter API, nhóm ngày | UI đã bấm, 30 lượt ngày 24/10. |
| Chuyên khoa | Departments + doctors + schedules + encounters | UI đã bấm, có đủ 10 khoa. |
| Bác sĩ | Doctors + schedules + encounters | UI đã bấm, 14 bác sĩ. |
| Thanh toán | `/admin/statistics/payments` và history | UI đã bấm, 0 hôm nay. |
| Công suất | Schedules, `booked_count`, `max_quota` | UI đã bấm, 28 ca, 252 chỗ, 16 đã đặt. |
| Đánh giá | `/admin/statistics/reviews` nhóm ngày/khoa/bác sĩ | UI đã bấm, 0 hôm nay. |
| Trang trước/sau bảng chi tiết | Phân trang dữ liệu đã nạp | CODE + TEST. |
| Xuất CSV mục hiện tại | CSV từ kết quả API đã nạp, không cần endpoint export | CODE + TEST BOM/escape/chống công thức và khóa khi kết quả không khớp bộ lọc. Chưa tải file trên browser trong lần này. |

### 17. Cấu hình hệ thống

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tải tất cả cấu hình | GET `/admin/configurations` | UI 14 mục, API 15 (mục điểm tối đa bị ẩn). |
| Lưu Tên cơ sở | PATCH `/admin/configurations/HOSPITAL_NAME` | UI có giá trị; CODE. |
| Lưu Điện thoại hỗ trợ | PATCH `/admin/configurations/SUPPORT_PHONE` | UI + CODE. |
| Lưu Email hỗ trợ | PATCH `/admin/configurations/SUPPORT_EMAIL` | UI + CODE. |
| Lưu giờ khám (4 mốc giờ) | PATCH `/admin/configurations/EXAM_HOURS` | UI 07:00–12:00, 13:30–16:30; CODE + TEST frontend chống giờ sai/trùng. Đây là giờ công khai, khác ca bác sĩ đã lập. |
| Lưu Tiếp nhận trực tiếp | PATCH `ALLOW_WALK_IN` | UI + CODE. |
| Lưu Nhắc lịch trước giờ khám | PATCH `REMINDER_BEFORE_HOURS` | UI + CODE. |
| Lưu Thời gian giữ chỗ | PATCH `APPOINTMENT_HOLD_MINUTES` | UI + CODE + TEST validation. |
| Lưu Đến trước giờ hẹn | PATCH `CHECKIN_EARLY_MINUTES` | UI + CODE + TEST validation. |
| Lưu Thời gian tiếp nhận muộn | PATCH `CHECKIN_LATE_MINUTES` | UI + CODE + TEST validation. |
| Lưu Thời gian chờ sau ca | PATCH `NO_SHOW_GRACE_MINUTES` | UI + CODE + TEST validation. |
| Lưu Tỷ lệ đặt cọc | PATCH `DEFAULT_DEPOSIT_PERCENT` | UI + CODE + TEST validation/snapshot. |
| Lưu Mốc hủy lịch được hoàn cọc | PATCH `CANCEL_HOURS_LIMIT` | UI + CODE + TEST validation/snapshot. |
| Lưu Tỷ lệ hoàn cọc | PATCH `CANCEL_REFUND_PERCENT` | UI + CODE + TEST validation/snapshot. |
| Lưu Không hoàn cọc khi không đến | PATCH `NO_SHOW_FORFEIT_DEPOSIT` | UI + CODE + TEST validation. |

Không bấm Lưu 14 thiết lập thật. Test tích hợp chính sách chưa chạy xong do đường dẫn fixture (A11), nên không khẳng định tất cả hiệu lực cấu hình đã được xác minh trong lần này.

### 18. Nhật ký hoạt động

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tìm log/người/nội dung, hành động, đối tượng, ngày | GET `/admin/activity-logs` | UI + GET 25 hôm nay, 27 toàn phạm vi. |
| Trang trước/sau | GET pagination 12 hàng | CODE, UI tổng trang đúng. |
| Chi tiết thay đổi | GET `/admin/activity-logs/{id}` | UI mở NK_027, xem trước/sau từng trường. |
| Xem đầy đủ dữ liệu dài | `<details>` cục bộ | CODE + TEST escape dữ liệu. |
| Đóng | Cục bộ | UI. |

### 19. Hồ sơ cá nhân admin (đích của mục menu thứ 18)

| Nút/chức năng | API | Kết quả |
|---|---|---|
| Tải thông tin tài khoản hiện tại | GET `/me` | UI + GET đầy đủ thông tin admin. |
| Thay đổi thông tin | Mở edit trên cùng trang | UI đã bấm. |
| Lưu thông tin cá nhân và liên hệ khẩn cấp | PATCH `/me` | CODE `staff_profile.js`, `profileChanges`; TEST frontend. Không lưu thật. Các trường ngoài danh sách được phép sửa vẫn readonly. |
| Hủy | Bỏ draft về giá trị cũ | UI đã bấm. |
| Chọn ảnh đại diện | POST `/me/avatar`, tải ảnh `/uploads/avatars/{file}` | UI có ảnh/nút; CODE validation JPEG/PNG/WebP ≤2MB và trạng thái lỗi. Chưa upload thật. |
| Đổi mật khẩu | Mở dialog | UI đã bấm, có ba ô mật khẩu. |
| Xác nhận đổi mật khẩu | POST `/me/change-password` | CODE; không nhập mật khẩu hoặc đổi credential thật. |
| Đóng đổi mật khẩu | Cục bộ | UI đã bấm; nhãn còn × (A06). |

## Các API có nhưng chưa được đưa thành chức năng trên UI admin hiện tại

Đây là đối chiếu khả năng, không phải đề nghị tự thêm mọi nút:

- Phê duyệt tài khoản qua `approval_status` và trường quan hệ liên hệ khẩn cấp: xem A02/A03.
- `MAX_REVIEW_RATING`: API trả về và cho sửa, nhưng `configurationMarkup` loại khỏi UI.
- POST `/notifications/read-all`: API có, trang admin hiện chỉ có đọc từng thông báo; không có nút đánh dấu tất cả đã đọc.
- DELETE `/admin/users/{id}` và POST `/patients/{id}/archive`: API có; `rowActions` hiện chỉ dựng Chi tiết/Chỉnh sửa. Handler archive còn trong nguồn nhưng không có nút dẫn tới từ danh sách. Không coi việc không cho xóa là lỗi nếu giao diện được chủ động giới hạn.
- API tạo/sửa khu vực lễ tân có nhưng không có trang quản lý khu vực riêng; hiện dùng ô chọn/gõ khu vực trong phân công theo yêu cầu đã chốt.
- API ảnh tài khoản/bác sĩ quản trị có wrapper, nhưng các form danh sách tài khoản/bác sĩ không có nút upload tương ứng. Hồ sơ cá nhân vẫn upload ảnh của chính mình được.

## Kiểm thử đã chạy và giới hạn

1. **Frontend:** `node --test frontend/tests/*.test.mjs`: **299 đạt, 0 fail, 0 skip**. Bao gồm adapter API, form/data helper, lỗi mạng, lọc, phân trang, snapshot, CSV, optimistic version và batch. Đây không phải 299 lượt click trình duyệt.
2. **Backend:** PostgreSQL 17 tạm riêng `codex-admin-audit-test`, DB `reception_assignment_test`, cổng 55441; mỗi nhóm tích hợp tạo schema riêng và cleanup. Chạy 6 module `test_admin_completion`, `test_admin_activity`, `test_admin_reviews`, `test_admin_notifications`, `test_configuration_policy`, `test_reception_assignments`: **32 ca, 28 đạt, 2 fail, 2 error**. Chi tiết A11. Riêng **16/16 phân công lễ tân**, **6/6 quy tắc thông báo admin**, test audit, test ẩn đánh giá và validation cấu hình đạt.
3. **API đang chạy:** 25 GET list/profile/statistics đã gọi qua HTTP trong container và đều 200. Các tổng bản ghi đã đối chiếu ở bảng dữ liệu. Không dùng kết quả GET để kết luận POST/PATCH đạt.
4. **Trình duyệt:** đã tải đủ 18 đích menu; mở các form tạo/sửa/chi tiết của tài khoản, bác sĩ, y tá, lễ tân, khoa, phòng, lịch, bệnh nhân, bài viết; xem xét duyệt nghỉ, lịch sử và hồ sơ từng lượt, giao dịch, đánh giá, xác nhận ẩn (rồi hủy), chi tiết log, sửa hồ sơ cá nhân (rồi hủy), đổi mật khẩu (rồi đóng); bấm 7 tab báo cáo và preview bài viết. Những nút ghi/tải ảnh/xuất file hoặc nhánh không có dữ liệu được ghi rõ trong ma trận.
5. **Chưa xác minh end-to-end từ browser:** tạo/sửa/khóa người dùng, POST ca/phân công, thu hồi/duyệt nghỉ, thay lãnh đạo, upload ảnh, xác nhận bài viết, hoàn tiền, lưu cấu hình, đổi mật khẩu, đọc thông báo thật, xuất file tải về. Không gọi tất cả đã hoàn tất.

Không có thay đổi ứng dụng/backend/schema/dữ liệu thật trong lần rà soát. Chỉ thêm báo cáo này và cập nhật quy trình trong skill dự án. Các thay đổi có sẵn trong workspace từ các yêu cầu trước được giữ nguyên.
