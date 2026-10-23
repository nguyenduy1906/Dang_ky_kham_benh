---
name: neu-medical-project
description: Chỉnh giao diện, kết nối API và kiểm tra nghiệp vụ trong dự án NEU Medical đăng ký và lên lịch khám bệnh. Dùng khi làm việc với mã nguồn dự án này; giữ giao diện đã chốt, quyền theo vai trò và dữ liệu lịch sử khi tích hợp.
---

# Làm việc trong dự án NEU Medical

## Phạm vi và nguồn quyết định

- Xác định thư mục gốc bằng `AGENTS.md`, `frontend/`, `backend/` và `database/`; các đường dẫn bên dưới tính từ gốc dự án.
- Đọc `AGENTS.md` và phần liên quan trong `docs/BAO_CAO_NGHIEP_VU.md`, `docs/TONG_HOP_PHAN_TICH_NGHIEP_VU.txt`. Đọc `docs/HUONG_DAN_CHAY_DU_AN.md` khi làm tích hợp, cấu hình chạy hoặc database. Nếu `DANH_SACH_API_VA_PHAN_CONG_BACKEND.md` hay tài liệu được dẫn không tồn tại, nêu đúng thiếu sót; không giả định đã đọc.
- Yêu cầu mới của người dùng ưu tiên hơn tài liệu cũ. Đối chiếu schema và luồng thực thi, vì báo cáo có ghi chú lịch sử đã bị thay thế. Không biến trạng thái triển khai hiện tại thành quy tắc nghiệp vụ vĩnh viễn.
- Không tự cập nhật `docs/`. Yêu cầu tạo/cập nhật skill không phải quyền sửa ứng dụng, backend, database hoặc triển khai.
- Trước khi sửa backend/database, đối chiếu phạm vi đã được người dùng cho phép trong cuộc trao đổi. Nếu chưa có, nêu lý do và phạm vi rồi xin xác nhận theo `AGENTS.md`; không hỏi lại phạm vi đã được duyệt. Cho phép khởi tạo lại DB không đồng nghĩa yêu cầu xóa dữ liệu ngay.

## Chọn đúng việc cần làm

Trước khi sửa, xác định trang, vai trò, hành vi cần thay đổi và điều kiện nghiệm thu quan sát được. Phân biệt sửa trình bày, nối API có sẵn, bổ sung nghiệp vụ và thay schema. Khi yêu cầu rõ, thực hiện trong phạm vi đó; chỉ hỏi khi cách hiểu khác nhau sẽ thay đổi nghiệp vụ hoặc dữ liệu.

Các vai trò là ADMIN, DOCTOR, NURSE, RECEPTIONIST và USER. Không dùng endpoint quản trị để vượt giới hạn của tài khoản nhân viên.

## Giữ giao diện khi chỉnh hoặc tích hợp

- Đọc HTML, CSS, module dựng trang và thành phần dùng chung trước khi thay đổi. Khi nối API, giữ thanh tìm kiếm, bố cục, nút thao tác và hộp thoại đã được người dùng chốt, trừ khi họ yêu cầu đổi.
- Bài học đã gặp: thanh tìm phòng trên trang Điều phối phải tồn tại riêng trên trang; nối API không phải lý do thay nó bằng một select trong hộp thoại. Các khối `01 / Chọn đúng người bệnh` và `02 / Tiếp nhận khám` đã được người dùng yêu cầu bỏ khỏi trang tiếp nhận; không tự thêm lại.
- Phân biệt xóa cả một khối với chỉ bỏ số thứ tự trong tiêu đề. Dùng ảnh và mã nguồn để xác định khối được nhắc tới.
- Khi yêu cầu áp dụng cho cả bác sĩ, y tá và lễ tân, kiểm tra đủ ba template và CSS/JS dùng chung. Không suy ra tất cả đã đúng chỉ từ một trang.
- Quy ước lịch đã chốt: ca sáng và chiều làm việc cùng xanh lá; chờ duyệt nghỉ nâu cam; đã duyệt nghỉ đỏ; không có ca trắng. Chú thích chung là `Làm việc`, `Đang xin nghỉ`, `Đã duyệt nghỉ`, `Không có ca`. Đây là màu trạng thái, không thay đổi trạng thái nghiệp vụ.

Các liên kết điều hướng dạng chữ ở đầu ô nội dung (ví dụ `Quản lý lịch →`, `Xem danh sách →`) thống nhất cỡ 14px, đậm 600, màu xanh `#008349`, không gạch chân mặc định; hover/focus xanh đậm và gạch chân. Không áp dụng quy tắc này lên nút thao tác hoặc toàn bộ liên kết trong bảng.

Placeholder bộ lọc viết ngắn gọn tên dữ liệu: `Tên y tá`, `Mã ca`, `Tên chuyên khoa`, `Tên bác sĩ`; không dùng hướng dẫn `Gõ để tìm và chọn…`, `Nhập…` hoặc mã mẫu như `CA_001` trong ô lọc.

Trang quản lý Bác sĩ chỉ có bộ lọc tìm tên và chuyên khoa; không hiển thị ô Ngày làm việc theo yêu cầu ngày 24/10/2026.

Trang Bệnh nhân gộp họ tên, số điện thoại và CCCD vào một ô Tìm kiếm (tham số q đã được API hỗ trợ); không có bộ lọc số điện thoại riêng.

Trang Thanh toán không hiển thị bộ lọc Loại giao dịch theo yêu cầu ngày 24/10/2026; việc bỏ ô lọc không sửa loại giao dịch đã lưu hoặc nghiệp vụ thanh toán.

Ô tìm kiếm tổng hợp dùng nhãn `Tìm kiếm`; placeholder mô tả đúng các trường backend hỗ trợ, ví dụ `Tên tài khoản, email hoặc số điện thoại`. Không dùng danh sách trường làm nhãn dài phía trên ô; không đổi các bộ lọc riêng như ngày, vai trò, chuyên khoa thành tìm kiếm chung. Trang tài khoản không hiển thị bộ lọc Phê duyệt theo yêu cầu hiện tại; giữ cột thông tin và nghiệp vụ duyệt nếu chưa có yêu cầu bỏ.

Thanh lọc có ba ô với ô tìm kiếm chính đứng đầu dùng tỷ lệ 50% / 25% / 25% (trừ khoảng cách); màn hình nhỏ xếp dọc. Danh sách ít lựa chọn cố định như Vai trò giữ select; danh sách nhiều mục như Chuyên khoa cho gõ tìm và chọn gợi ý. Giữ định danh khi gửi API, không gửi tên hiển thị vào trường mã; giá trị chưa khớp lựa chọn phải được báo rõ, không âm thầm bỏ bộ lọc.

Ô chọn ngày dùng hiển thị và nhập `dd/mm/yyyy` trên các giao diện nhân viên; giữ giá trị ISO `yyyy-mm-dd` của input gốc để gửi API, giữ kiểm tra ngày hợp lệ và khoảng min/max. Dùng thành phần `date_inputs.js`, không chỉ đặt lang vì định dạng native còn phụ thuộc hệ điều hành.

## Thống nhất ô, thẻ và nhãn trạng thái

- Với cùng một đối tượng và cùng một trạng thái nghiệp vụ, dùng thống nhất màu nền, màu chữ, màu viền, biểu tượng nếu có và nội dung nhãn trên mọi trang, danh sách, hộp thoại, chú thích và vai trò liên quan. Không chọn màu hoặc viết lại nhãn tùy từng giao diện.
- Trước khi sửa, tìm bảng ánh xạ trạng thái, hàm dựng badge/thẻ và CSS dùng chung hiện có. Ưu tiên sửa hoặc tái sử dụng nguồn này. Nếu chưa có nguồn thống nhất, xác định ánh xạ mã trạng thái → nhãn → kiểu hiển thị cho đúng nhóm nghiệp vụ trước khi áp dụng; tránh sao chép nhiều bộ ánh xạ độc lập.
- Ví dụ trong lịch làm việc: cùng trạng thái làm việc phải có nhãn `Làm việc` và màu xanh lá ở cả ca sáng/chiều; chờ duyệt nghỉ dùng nhãn `Đang xin nghỉ` và nâu cam; nghỉ đã duyệt dùng nhãn `Đã duyệt nghỉ` và đỏ; không có ca dùng nhãn `Không có ca` và trắng. Dùng cùng nhãn trạng thái trong chú thích, ô lịch và các vị trí biểu diễn chính trạng thái đó. Thông tin bổ sung như `Vẫn làm việc trong thời gian chờ duyệt` đặt ở dòng mô tả riêng, không tạo một tên trạng thái khác.
- Phân biệt trạng thái với ngữ cảnh: `PENDING` của đơn nghỉ và `PENDING` của tài khoản là hai đối tượng khác nhau, không ép dùng cùng nhãn chỉ vì trùng mã. Tuy nhiên, đơn nghỉ đang chờ duyệt ở trang của nhân viên và trang duyệt của quản trị phải cùng cách gọi và cùng màu trạng thái đã chốt. Các mô tả hoặc thao tác được phép có thể khác theo vai trò.
- Màu trạng thái không được bị màu nhận diện vai trò, màu ca sáng/chiều, CSS riêng của trang hoặc hiệu ứng chọn/hover ghi đè thành ý nghĩa khác. Trạng thái được chọn/focus cần dấu hiệu riêng, vẫn giữ nhận diện trạng thái nghiệp vụ. Kiểm tra màu khi bình thường, hover, được chọn và vô hiệu hóa nếu có.
- Nhãn trên bảng, bộ lọc, chi tiết và chú thích phải cùng thuật ngữ đã chốt cho trạng thái tương ứng; không để cùng một trạng thái lúc ghi `Đã check-in`, lúc ghi `Đã tiếp nhận` nếu chưa xác định một cách gọi chung. Nội dung mô tả chi tiết có thể khác, nhưng không được mâu thuẫn với nhãn hoặc ý nghĩa trạng thái.
- Khi người dùng yêu cầu đổi quy ước của một trạng thái, rà soát các nơi biểu diễn cùng trạng thái đó và cập nhật trong phạm vi yêu cầu. Nếu phát hiện điểm không thống nhất ngoài phạm vi được giao, báo rõ thay vì tự sửa rộng. Không mặc định một lần sửa màu đồng nghĩa cho phép đổi nghiệp vụ hoặc toàn bộ bộ nhận diện của dự án.
- Trước bàn giao, so sánh ít nhất các vị trí đã sửa bằng cùng một trạng thái và dữ liệu tương đương. Kiểm tra cả nhãn lẫn màu thực tế sau CSS override; không chỉ kiểm tra tên class. Báo rõ trang/vai trò nào đã kiểm tra thực tế và trang nào mới đối chiếu mã nguồn.

Nhãn vai trò tài khoản (Quản trị viên, Lễ tân, Bác sĩ, Y tá, Người dùng) cùng nền xanh lá nhạt `#e3f5ec`, chữ xanh lá đậm `#047857`, bo góc 5px; dùng class `role-badge`, không đổi màu các trạng thái khác bằng cách sửa toàn bộ badge xanh dương.

Trạng thái tài khoản LOCKED / Đã khóa dùng nền đỏ nhạt `#fde5eb`, chữ đỏ `#c62850`, bo góc 5px trên danh sách và chi tiết.

Trạng thái thanh toán dùng cùng `paymentStatusBadge` trong danh sách thu tiền, lịch sử hoàn tiền và chi tiết: PENDING / Chờ thanh toán #fff5df / #a65b00; SUCCESS / Thành công #e3f5ec / #047857; FAILED / Thất bại #fde5eb / #c62850; REFUNDED / Đã hoàn tiền #e8f1ff / #0759b5. Bo góc 5px, không đánh đồng giao dịch hoàn tiền thành công với trạng thái REFUNDED của giao dịch gốc.

Trạng thái Tin tức dùng cùng badge trên bảng và chi tiết: Bản nháp nền #edf2f7 chữ #49657d; Hẹn đăng nền #fff5df chữ #a65b00; Đã xuất bản nền #e3f5ec chữ #047857. Bo góc 5px. Hiện mode chưa tách trạng thái Đã ẩn, không tự thêm trạng thái chỉ để tô màu.

### Bảng màu nhãn và kết quả đã chốt

Bảng màu dùng tông pastel nhạt theo ảnh người dùng chốt ngày 24/10/2026, thay bảng màu trước đó. Đã check in và Hoàn thành cùng xanh lá nhạt. Tất cả ô nhãn trạng thái/hình thức/kết quả dùng bo góc **5px**. Nền nhạt và chữ đậm theo bảng dưới; cùng trạng thái dùng cùng nhãn và cặp màu ở mọi trang. Dùng `frontend/static/js/core/encounter_status.js` và CSS chung khi biểu diễn trạng thái lượt khám; không tạo ánh xạ riêng cho bảng tổng quan.

| Mã/ngữ nghĩa lượt khám | Nhãn hiện tại | Nền | Chữ |
|---|---|---|---|
| Tất cả / lựa chọn chung | Tất cả | `#eaf2f1` | `#3f6868` |
| HOLDING | Chờ thanh toán | `#fff5df` | `#a65b00` |
| CONFIRMED (trước: Đã xác nhận) | Đã thanh toán | `#e8f1ff` | `#0759b5` |
| CHECKED_IN (trước: Đã tiếp nhận) | Đã check in | `#e3f5ec` | `#047857` |
| IN_PROGRESS | Đang khám | `#f1e8fc` | `#6b2eaa` |
| COMPLETED | Hoàn thành | `#e3f5ec` | `#047857` |
| CANCELLED | Đã hủy | `#fde5eb` | `#c62850` |
| NO_SHOW | Không đến | `#edf2f7` | `#49657d` |
| EXPIRED | Hết hạn | `#fff0e2` | `#c65308` |

Các kết quả tương ứng về ngữ nghĩa dùng cùng họ màu: thành công/hoàn thành xanh lá, thất bại/hủy đỏ nhạt, chờ xử lý vàng, đang xử lý tím, thông tin/xác nhận xanh dương. Không suy luận hai nghiệp vụ giống nhau chỉ từ mã. Quy ước riêng đã chốt cho lịch nghỉ vẫn giữ: đang xin nghỉ nâu cam, đã duyệt nghỉ đỏ; hình thức khám trực tuyến xanh lá và trực tiếp đỏ nhạt. Đổi nhãn hiển thị không được tự đổi trạng thái, điều kiện thanh toán hoặc API.

### Trạng thái ca trên danh sách lịch làm việc

Cột Trạng thái đứng trước Thao tác, căn giữa, bo góc 5px. Dùng `schedule_status.js` cho các ca: OPEN / Đang hoạt động nền #e6f4ea chữ #218849; FULL / Đã đầy nền #fcf3d9 chữ #a87919; CLOSED / Đã đóng nền #e8edf4 chữ #637086; UNAVAILABLE / Báo nghỉ nền #f8e8e9 chữ #c94c4c. Tất cả dùng nền #e7f3ee chữ #527b70. Đây là trạng thái mở đặt lịch của ca, khác nhãn tiến độ ca theo thời gian trên tổng quan.

### Nhãn lịch bác sĩ trên tổng quan quản trị

Đây là trạng thái ca làm việc, khác trạng thái lượt khám và màu ô lịch làm việc nhân viên. Dùng bo góc 5px, với bảng màu người dùng chốt ngày 24/10/2026:

| Nhãn | Nền | Chữ |
|---|---|---|
| Chưa đến giờ làm | `#eaf0f7` | `#55708d` |
| Đang làm | `#fcf3d9` | `#a87919` |
| Hoàn thành | `#e6f4ea` | `#218849` |
| Đang xin nghỉ | `#f9eedb` | `#ba7b13` |
| Nghỉ làm | `#f8e8e9` | `#c94c4c` |
| Đã chuyển ca | `#f0eaf8` | `#8061ad` |
| Đã đóng ca | `#e8edf4` | `#637086` |

Không đồng nhất Đã đóng ca với Nghỉ làm. Hoàn thành ca chỉ phản ánh hết giờ, không chứng minh tất cả bệnh nhân đã khám xong. Nếu thiếu API, dữ liệu, trạng thái hoặc chức năng cần thiết để đáp ứng yêu cầu, báo rõ người dùng; không chỉ thêm màu rồi khẳng định nghiệp vụ đã hoạt động. Tại thời điểm chốt mẫu, tổng quan chưa có dữ liệu đơn nghỉ đang chờ duyệt gắn vào từng ca nên nhãn Đang xin nghỉ chưa hoạt động; phải đối chiếu triển khai hiện tại trước khi sử dụng.

Trang danh sách Phân công y tá mặc định `work_date` là hôm nay ở Việt Nam; trang Lịch làm việc quản trị mặc định `from_date` và `to_date` đều hôm nay. Tính ngày khi mở trang, hiển thị đúng giá trị trên bộ lọc trước lần tải dữ liệu đầu tiên; người dùng vẫn được đổi hoặc xóa ngày để tra cứu lịch sử. Lịch tuần nhân viên giữ cách xem tuần hiện tại. Các trang danh mục như Chuyên khoa, Bác sĩ, Phòng khám, Tài khoản mặc định lấy toàn bộ dữ liệu trong phạm vi quyền, không tự giới hạn ngày; chỉ lọc ngày khi người dùng chủ động chọn.

Các trang Lượt khám, Thanh toán (cả lịch sử hoàn tiền), Đánh giá, Thống kê báo cáo và Nhật ký hoạt động quản trị mặc định lọc hôm nay tại Việt Nam. Bộ lọc hiển thị ngày ngay lần tải đầu; báo cáo chọn kỳ `Hôm nay`. Vẫn cho phép tra cứu khoảng khác. Thông báo giữ toàn bộ thời gian.

### Khoảng thời gian mặc định của trang tổng quan

- Với tổng quan quản trị, bác sĩ, y tá và lễ tân: số liệu, danh sách lượt khám và ca làm việc mặc định theo **hôm nay tại Việt Nam** (`Asia/Ho_Chi_Minh`/`Asia/Saigon`). Không mặc định toàn thời gian hoặc giữ ngày cũ từ bộ lọc của trang khác.
- Biểu đồ thống kê nếu có mặc định theo **tuần hiện tại, thứ Hai đến Chủ nhật**. Đổi tuần biểu đồ không được kéo số liệu hôm nay sang tuần đó. Bộ chọn ngày/tuần riêng vẫn hoạt động khi người dùng chủ động chọn.
- Thông báo lấy toàn bộ trong phạm vi tài khoản được phép, không giới hạn ngày hôm nay; số chưa đọc lấy đúng tổng số, không đếm riêng trang đầu.
- Lịch tháng thu nhỏ chỉ là phần hỗ trợ xem lịch; không dùng dữ liệu cả tháng để cộng vào các chỉ số ghi là hôm nay.

Tiêu đề khung nội dung dùng thống nhất 22px, đậm 600, gồm cả tiêu đề lồng trong div, khung thống kê, cấu hình, đánh giá và các vai trò nhân viên. Bỏ phụ đề chỉ giải thích công dụng khung; giữ dữ liệu định danh, số liệu động, lỗi, thông báo trạng thái và hướng dẫn thao tác cần thiết. Không dựa riêng vào tên thẻ p để xóa hàng loạt nội dung.

### Khoảng cách và tiêu đề danh sách

Giữ khoảng đầu nội dung gọn (20px), hàng nút tạo mới cách khung dưới 16px; không cộng dồn khoảng đệm lớn giữa tiêu đề khung và bộ lọc. Các trang danh sách dùng tiêu đề mô tả đúng dữ liệu như `Danh sách tài khoản`, `Danh sách bác sĩ`, `Danh sách ca làm việc`, `Danh sách phân công y tá`; không dùng tiêu đề chung `Danh sách` hoặc lấy máy móc tên trang nếu khác nội dung bảng. Áp dụng thành phần dùng chung và kiểm tra trên các vai trò liên quan.

### Bố cục bảng và nút thao tác

Căn giữa cả đầu cột và dữ liệu cho các mã ngắn (mã lượt, ca, phòng...), ngày/giờ, số liệu ngắn, trạng thái, hình thức và nhãn kết quả. Tên người, tên phòng/khoa và nội dung dài căn trái, dữ liệu thẳng với đầu cột. Không căn giữa cả bảng hoặc suy luận cột bằng thứ tự cố định; dùng nghĩa của đầu cột (`core/table_layout.js`) và kiểm tra bảng ghép nhiều dòng/colspan riêng. Cột kết hợp tên người với mã vẫn căn trái.

Thao tác trong bảng (Xem, Chi tiết, Chỉnh sửa...) dùng nút có viền, nền trắng, bo góc 5px, không gạch chân; hover/focus nền xanh nhạt hơn thanh menu (`#dff2e8`). Căn giữa nhóm nút theo cột thao tác. Không đổi liên kết mã hồ sơ thành nút hoặc tác động tới liên kết điều hướng đầu ô.

## Kết nối API thật

- Lần theo trang → module giao diện → API wrapper → route → schema → service → model. Có route hoặc bảng chưa chứng minh chức năng hoạt động đúng.
- API dùng đường dẫn trực tiếp như `/me`, `/patients`, `/encounters`, `/staff/schedules`; không thêm `/api/v1` hay `/v1`.
- Chỉ nối API khi được giao. Không tạo dữ liệu giả, phiên đăng nhập giả hoặc thông báo thành công thay cho phản hồi thật. Giữ cơ chế xác thực và kiểm tra vai trò hiện có.
- Phân biệt: thiếu endpoint; endpoint có nhưng thiếu quyền; endpoint công khai có phạm vi dữ liệu hẹp; frontend chưa gọi endpoint. Ví dụ lịch công khai của bác sĩ không thay thế API nhân viên khi cần lịch sử và ca đã đóng. Xác minh hợp đồng hiện tại trước khi kết luận.
- Kiểm tra cách phân trang từng endpoint. Vùng cuộn hoặc phân trang phải cho phép xem đầy đủ dữ liệu trong phạm vi tìm kiếm; không cắt cứng ba hoặc năm kết quả khiến phần còn lại không thể truy cập.
- Xử lý trạng thái tải, rỗng và lỗi riêng biệt. Dùng hủy yêu cầu hoặc kiểm tra phiên bản để phản hồi tìm kiếm cũ không ghi đè lựa chọn mới hay dựng lại nội dung sau khi rời trang/đổi phiên.
- Khi lưu: chống gửi lặp, giữ nội dung nhập nếu lỗi, gửi đúng các trường cho phép và kiểm tra định danh/kết quả phản hồi. Không tự thử lại thao tác ghi khi chưa biết lần trước đã thành công hay chưa.
- Đổi tên, số điện thoại hoặc nhãn hiển thị không được làm mất định danh `patient_id`, `encounter_id`, `doctor_profile_id`, `schedule_id` và `room_id`.

## Phân biệt các nghiệp vụ điều phối

| Nghiệp vụ | Điều thay đổi |
|---|---|
| Đổi phòng | Cùng bác sĩ và ca, thay phòng khám |
| Chuyển bệnh nhân | Chuyển một lượt khám sang bác sĩ/ca phù hợp khác |
| Bác sĩ thay thế | Bác sĩ mới nhận ca/phòng và các lượt khám đủ điều kiện của bác sĩ cũ |
| Hoán đổi bác sĩ | Đổi người phụ trách giữa hai ca; kiểm tra cả hai chiều |

- Không coi phòng có bác sĩ ở giờ khác là đang bị chiếm trong ca được chọn. Phòng trùng giờ cần bị chặn khi đổi phòng; thay thế/hoán đổi là nghiệp vụ riêng, không giải quyết bằng cách bỏ chặn trùng phòng.
- Đối chiếu chuyên khoa, tài khoản hoạt động, lịch nghỉ đã duyệt, khoảng giờ chồng nhau, ca đã chuyển và lịch bệnh nhân bị trùng. Quyết định cuối cùng thuộc backend, trong transaction với khóa thích hợp.
- Chuyển bệnh nhân không được loại lượt khám trực tiếp chỉ vì chưa thanh toán nếu backend cho phép trạng thái đó. Không mang điều kiện thanh toán của một luồng sang luồng khác.
- Giữ mã phiếu, phí/cọc snapshot và giờ hẹn theo đúng hợp đồng nghiệp vụ; không tính lại phí từ giá bác sĩ hiện tại một cách ngầm định. Không thay đổi quota tùy ý ở frontend.
- Với thay thế/hoán đổi, xem trước bác sĩ trước/sau và lượt khám bị ảnh hưởng, yêu cầu lý do, kiểm tra phiên bản trước khi lưu; cập nhật ca, lượt khám, lịch sử và thông báo trong cùng giao dịch.
- Hiện chức năng thay thế/hoán đổi cả ca chỉ hỗ trợ ca chưa bắt đầu và chặn ca có lượt đang khám/hoàn tất. Nếu người dùng yêu cầu thay giữa ca, cần xác định cách giữ lịch sử bác sĩ cũ và xử lý từng lượt; không chỉ gỡ điều kiện chặn.
- Không tự hủy hàng loạt lượt khám do bác sĩ nghỉ. Không ghi đè bác sĩ của các lượt đã khám để làm lịch mới trông nhất quán.

### Trạng thái lượt khám theo sự kiện và thời gian thực tế

- Đã thanh toán chỉ sau giao dịch thành công theo hợp đồng backend; không coi tới giờ là đã đến hoặc đang khám. Check-in phải là thao tác xác nhận bệnh nhân có mặt đúng ngày khám. Bắt đầu khám phải do bác sĩ phụ trách thực hiện sau check-in hợp lệ, trong ca và không trước giờ hẹn. Yêu cầu này thay quy tắc cũ cho phép gọi sớm trước giờ hẹn khi ca còn mở.
- Chưa đến hạn mà chưa check-in thì vẫn Đã thanh toán; không tự gán Không đến cho lượt tương lai. Worker tự đánh dấu Không đến sau khi hết ca cộng NO_SHOW_GRACE_MINUTES theo policy snapshot, chỉ với lượt CONFIRMED chưa có checked_in_at và ca không đóng/nghỉ. Ca đóng/nghỉ do bệnh viện cần điều phối/hủy theo nghiệp vụ, không quy lỗi bệnh nhân.
- Dữ liệu mẫu không được duy trì check-in/đang khám giả như hoạt động thực tế. Hiệu chỉnh phải có dấu nguồn mẫu, kiểm tra thao tác thật và giữ nhật ký; không xóa bệnh án hay lịch sử thanh toán để làm số liệu khớp. Báo rõ dữ liệu lịch sử mẫu nào còn giữ.
- Giao diện hiện cập nhật bằng polling khoảng 30 giây và worker chạy chu kỳ 30 giây, có thể chậm thêm do tab ẩn/đang nhập hoặc hộp thoại mở. Không gọi đây là cập nhật tức thì bằng WebSocket.

## Database và chạy dự án

- Chỉ duy trì hai file SQL: `database/init_db.sql` cho toàn bộ cấu trúc, ràng buộc, hàm, trigger; `database/sample_data.sql` cho dữ liệu mẫu. Không tách thêm file migration hoặc SQL nghiệp vụ nếu chưa có yêu cầu thay đổi quy ước.
- Khi thêm schema đã được duyệt, đặt vào định nghĩa khởi tạo phù hợp và sửa nơi nạp SQL nếu cần. Đối chiếu cả khởi tạo mới và DB đang chạy; không mặc định `CREATE TABLE IF NOT EXISTS` sẽ nâng cấp constraint của bảng cũ.
- Không chạy sample hoặc reset để kiểm thử mặc định. Sample có thể xóa dữ liệu hiện có. Ưu tiên fixture rollback hoặc schema/database tạm; bảo đảm script cleanup chỉ tác động nơi kiểm thử đã xác định.
- Phân biệt file nguồn, Docker image và container đang chạy. Sửa nguồn/build image chưa chứng minh API đang phục vụ mã mới. Nêu và kiểm tra cách áp dụng trong phạm vi đã được cho phép; không tự chạy init/seed để giải quyết lỗi frontend.

## Kiểm tra và bàn giao

- Chọn kiểm thử phù hợp thay đổi. Frontend dùng `node --test tests/*.test.mjs` trong `frontend/`; có thể chạy nhóm liên quan cho sửa nhỏ. Backend dùng Python của dự án và đọc yêu cầu môi trường của từng test; không bật test cần DB dùng một lần trên DB đang sử dụng.
- Với nghiệp vụ ghi, kiểm tra đường thành công và lỗi có ý nghĩa: sai quyền, trùng lịch, lịch nghỉ, dữ liệu cũ, sai đối tượng, giữ snapshot và rollback khi một bước lỗi. Kiểm thử đồng thời nếu thay đổi cách khóa; không gọi kiểm thử tuần tự là bằng chứng chống race.
- Kiểm tra giao diện thực khi thay đổi bố cục/tương tác. Với nhiều vai trò, xác minh thành phần dùng chung và các override riêng. Không đổi dữ liệu thật chỉ để chụp ảnh minh chứng.
- Kiểm thử API mô phỏng, Flask test client, PostgreSQL rollback và trình duyệt là các mức bằng chứng khác nhau; ghi rõ mức nào đã làm. Test cũ đạt không chứng minh luồng mới đã được kiểm thử.
- Bàn giao ngắn gọn: đã đổi gì, hành vi hiện tại, đã kiểm tra gì và còn giới hạn gì. Nếu toàn bộ suite lỗi import vì thiếu module, báo đúng; không khẳng định tất cả backend đạt chỉ vì nhóm liên quan đạt.

### Phân chia nhật ký và thông báo quản trị

Thao tác ADMIN quản lý hệ thống, phân công, duyệt nghỉ, cấu hình... ghi nhật ký, không gửi ngược hộp thông báo admin. Sự kiện bên ngoài như đăng ký, đặt/hủy lịch, thanh toán, hoàn tiền, đánh giá, gửi/rút đơn nghỉ vẫn thông báo admin. Không gửi admin các bước tác nghiệp CHECKED_IN/IN_PROGRESS/COMPLETED, ghi bệnh án/đơn thuốc, chuyển/điều phối nội bộ, nhắc lịch cá nhân hoặc bài viết admin hẹn đăng. Thông báo cho bệnh nhân/nhân viên liên quan vẫn giữ. Thông báo lịch sử cũ giữ nguyên trừ khi người dùng yêu cầu xử lý riêng; quy tắc mới áp dụng sự kiện mới. Không coi đã lọc frontend là đã chặn nguồn phát; kiểm tra cả hook và thông báo trong transaction.
