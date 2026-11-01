# NEU Medical — FE2

Bản giao diện độc lập cho bác sĩ, lễ tân và y tá/điều dưỡng. Dựa trên nhận diện, chức năng của giao diện cũ; không nhập CSS, JavaScript nghiệp vụ hoặc phiên đăng nhập từ phần cũ.

## Chạy

Từ thư mục gốc dự án, mở terminal PowerShell:

```powershell
cd frontend/fe2
npm.cmd start
```

Không cần cài thư viện, backend hoặc database. Yêu cầu Node.js 20 trở lên. Giữ terminal mở; Ctrl+C để dừng. Cổng 5500 bận thì dùng `npm.cmd start -- --port 5501`.

- Chọn vai trò: http://127.0.0.1:5500/
- Bác sĩ: http://127.0.0.1:5500/pages/doctor/home.html
- Lễ tân: http://127.0.0.1:5500/pages/reception/home.html
- Y tá: http://127.0.0.1:5500/pages/nurse/home.html

Server cũ ở cổng 3000 không phục vụ thư mục fe2. Có thể dùng VS Code Live Server với `index.html`, hoặc mở HTML trực tiếp vì bản này dùng script thường, không dùng fetch/module.

## Trang và cải tiến

| Vai trò | Trang |
| --- | --- |
| Bác sĩ | Tổng quan, lượt khám được giao, bệnh án & đơn thuốc, lịch làm việc/báo nghỉ, lịch sử khám, hồ sơ cá nhân/chuyên môn |
| Lễ tân | Tổng quan, tra cứu & check-in, tiếp nhận trực tiếp, hồ sơ bệnh nhân, điều phối ca/phòng, hồ sơ cá nhân |
| Y tá | Tổng quan, ca được phân công, danh sách hỗ trợ, hồ sơ trong ca, hồ sơ cá nhân |

Dashboard chỉ có ba chỉ số cần thiết và công việc liên quan. Gộp lịch/phòng vào trang ca làm việc; gộp bệnh nhân/lượt khám theo ca cho y tá. Lễ tân tách rõ online và trực tiếp để hạn chế nhầm tiếp nhận. Dùng mã phiếu và khung giờ thay số thứ tự. Y tá chỉ xem thông tin khám; lễ tân không xem nội dung chẩn đoán/đơn thuốc. Chỉ bác sĩ có phần chọn ảnh đại diện.

## Tương tác và phạm vi

- Tìm kiếm không dấu, lọc trạng thái/hình thức, bỏ lọc, trạng thái không có kết quả.
- Xem chi tiết trong hộp thoại; tab bệnh án/đơn thuốc/thông tin lượt khám có điều hướng bàn phím.
- Thêm/xóa dòng thuốc, xem ảnh đại diện cục bộ, nhập và xem lại thông tin tiếp nhận/điều phối.
- Menu màn hình nhỏ, Escape để đóng, giữ focus trong menu và hộp thoại.

Tên người bệnh, mã phiếu, ca và ngày **19/10/2026** là dữ liệu minh họa cố định, không phản ánh dữ liệu hiện tại. Không gọi API hoặc API giả lập; không đăng nhập, lưu storage, ghi database, cấp phiếu hay thực hiện chuyển trạng thái. Nút nghiệp vụ mở giải thích/xem trước, không thông báo thành công giả. Nội dung nhập mất khi tải lại/rời trang. Đây không phải phiên bản đã tích hợp hoặc nghiệm thu nghiệp vụ backend.

## Cấu trúc

`pages/doctor`, `pages/reception`, `pages/nurse`: điểm vào HTML cho từng trang. `css/workspace.css`: giao diện dùng chung, responsive. `js/workspace.js`: bố cục, nội dung từng vai trò và tương tác trình bày. `assets/`: bản sao logo NEU từ giao diện cũ. `serve.mjs`: server chỉ phục vụ các tài nguyên FE2.

## Kiểm tra bản bàn giao

Đã kiểm tra cú pháp JavaScript, dựng DOM của 18 trang, 251 liên kết/tài nguyên nội bộ, tìm kiếm không dấu, lọc kết hợp, bỏ lọc, trạng thái rỗng, hộp thoại chi tiết/xem trước, các tab, thêm/xóa dòng thuốc, xem lại biểu mẫu và menu thu gọn. Kiểm tra DOM dùng môi trường kiểm thử tạm, không thêm thư viện chạy vào FE2.

Máy chủ trả HTTP 200 cho 18 điểm vào và các CSS/JS/logo; từ chối truy cập file cấu hình, mã server, đường dẫn vượt thư mục và phương thức ghi. Chưa kiểm tra trực quan bằng ảnh chụp/trình duyệt thực vì phiên làm việc không có trình duyệt kết nối; cần duyệt lại responsive, cuộn bảng và hành vi focus trên trình duyệt thật. Chưa kiểm thử tích hợp API hoặc nghiệp vụ backend vì ngoài phạm vi bản giao diện.
