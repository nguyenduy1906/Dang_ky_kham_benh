# Phân công frontend theo vai trò

Cập nhật: 08/10/2026. Thay thế kế hoạch chia FE theo gói nghiệp vụ trước đó.
Đối chiếu báo cáo nghiệp vụ, mục XXXII trong TONG_HOP_PHAN_TICH_NGHIEP_VU.txt,
kế hoạch API backend và cấu trúc frontend hiện có. Đây là kế hoạch, chưa triển khai FE.

## 1. Giữ cấu trúc thư mục của dự án

```text
frontend/
├── templates/
│   ├── public/
│   ├── auth/
│   ├── (patient)/
│   ├── (doctor)/
│   ├── (reception)/
│   ├── (nurse)/
│   ├── (admin)/
│   ├── components/
│   └── errors/
└── static/
    ├── assets/
    ├── css/
    └── js/
        ├── api/
        ├── core/
        ├── pages/
        └── utils/
```

Giữ nguyên tên có dấu ngoặc. (patient) là khu vực USER quản lý người được khám,
không đồng nghĩa mỗi patient có tài khoản. Không đổi sang cách chia theo gói backend.
Đề xuất CSS và js/pages có thư mục con public, auth, patient, doctor, reception,
nurse, admin khi triển khai để tách quyền sở hữu. Chưa tạo thư mục hoặc file mới.
Các phần nhỏ bên dưới là task; không bắt buộc tạo thêm thư mục cho mỗi task.

## 2. Phân người theo khu vực

Mỗi khu vực có một chủ phụ trách HTML, CSS, JS trang và tích hợp API.
Chưa biết số thành viên; không bắt buộc một khu vực bằng một người.

| Khu vực | Thư mục HTML | Phần CSS/JS trang đề xuất |
|---|---|---|
| Public | templates/public/ | css/public/ và js/pages/public/ |
| Auth | templates/auth/ | css/auth/ và js/pages/auth/ |
| Patient | templates/(patient)/ | css/patient/ và js/pages/patient/ |
| Doctor | templates/(doctor)/ | css/doctor/ và js/pages/doctor/ |
| Reception | templates/(reception)/ | css/reception/ và js/pages/reception/ |
| Nurse | templates/(nurse)/ | css/nurse/ và js/pages/nurse/ |
| Admin | templates/(admin)/ | css/admin/ và js/pages/admin/ |

Nếu có 5 người, phương án tham khảo:

| Người | Phần phụ trách |
|---|---|
| Người 1, tích hợp FE | Auth và nền tảng dùng chung |
| Người 2 | Public và Patient |
| Người 3 | Doctor |
| Người 4 | Reception và Nurse |
| Người 5 | Admin |

Patient/Admin thường nhiều việc; cân đối theo tiến độ. Nếu giao task con cho người
khác, xác định rõ chủ file trước, không để hai người cùng sửa một trang.

## 3. Task nhỏ, theo thứ tự trong từng khu vực

### Public

1. Trang chủ và điều hướng.
2. Danh sách chuyên khoa.
3. Danh sách/chi tiết bác sĩ.
4. Lịch làm việc và lịch còn trống.
5. Tin tức và chi tiết bài viết.

Đăng ký/đăng nhập thuộc Auth; đặt lịch chuyển sang Patient, không làm lại ở Public.

### Auth

1. Đăng nhập và điều hướng theo vai trò.
2. Đăng ký USER, không có chọn vai trò nhân viên.
3. Quên mật khẩu → nhập OTP → đặt lại mật khẩu.
4. Yêu cầu/xác nhận email.
5. Đăng xuất và xử lý phiên hết hạn theo cơ chế nhóm chốt.

### Patient

1. Hồ sơ tài khoản và đổi mật khẩu (/me).
2. Hồ sơ người được khám, BHYT, bản thân/người thân, thêm/sửa/archive.
3. Đặt lịch bản thân/người thân: hồ sơ → khoa/bác sĩ → ca → triệu chứng.
4. Lịch khám, chi tiết encounter, hủy và lịch sử trạng thái.
5. Thanh toán giả lập và lịch sử giao dịch.
6. Lịch sử khám, kết quả bệnh án và đơn thuốc.
7. Đánh giá sau hoàn tất; thông báo của tài khoản.

users khác patient. Archive không xóa lịch sử. Backend quyết định giá, cọc, số,
quota và trạng thái; Patient không tự tính rồi ghi đè dữ liệu backend.

### Doctor

1. Dashboard; hồ sơ chuyên môn/avatar.
2. Ca làm việc và báo nghỉ.
3. Danh sách encounter/bệnh nhân được giao.
4. Bắt đầu và thực hiện khám.
5. Bệnh án, đơn thuốc và hoàn tất khám.
6. Lịch sử khám; sửa/bổ sung sau hoàn tất chờ quy trình được chốt.

Chỉ bác sĩ có avatar. Không cho xem/sửa lượt khám ngoài quyền được giao.

### Reception

1. Dashboard, tra cứu patient và encounter.
2. Tạo patient cho người chưa có tài khoản.
3. Tiếp nhận WALK_IN: lễ tân/hệ thống gắn ca, nhận số backend cấp.
4. Check-in ONLINE trên encounter đã có, không tạo WALK_IN trùng.
5. Hàng chờ và tình trạng tiếp nhận.
6. Chuyển bác sĩ, no-show theo quyền và quy tắc đã chốt.
7. Điều phối ca/phòng theo nghiệp vụ; thu phí giả lập nếu quyền/thời điểm đã chốt.

Reception điều phối lượt khám; Admin quản lý danh mục/ca. Không làm trùng CRUD
của Admin trong Reception.

### Nurse

1. Dashboard.
2. Ca được phân công và phạm vi hỗ trợ.
3. Bệnh nhân và encounter thuộc ca được giao.
4. Hỗ trợ khám/cập nhật thông tin theo quyền được chốt.

Làm trang đọc trước; task 4 chờ xác nhận action/API. Không tự cho sửa chẩn đoán,
đơn thuốc, hoặc coi action mô phỏng là đã hoàn thành.

### Admin

1. Quản lý users, danh sách role, tạo nhân viên, khóa/mở và xóa mềm.
2. Quản lý patient.
3. Quản lý chuyên khoa, bác sĩ và phòng.
4. Quản lý ca; phân công/thu hồi phân công y tá.
5. Quản lý bài viết và cấu hình.
6. Giao dịch/hoàn tiền giả lập theo quyền và điều kiện được chốt.
7. Thống kê encounter, ONLINE/WALK_IN, no-show, hủy, payment, review và audit.

Không mặc định có CRUD role: API kế hoạch chỉ có danh sách vai trò có sẵn.
Không làm luồng xin quyền nhân viên hoặc lưu hợp đồng. Dashboard nếu cần chỉ
hiển thị dữ liệu API hỗ trợ, không tự đặt chỉ số nghiệp vụ.

## 4. Chủ sở hữu phần dùng chung

| Phần | Chủ sở hữu | Quy tắc |
|---|---|---|
| templates/components/, templates/errors/, layout nền tảng | Người tích hợp FE | Header, form, bảng, dialog, lỗi chung; sửa qua PR phối hợp |
| Layout/menu riêng vai trò | Chủ khu vực | Trong khu vực mình, dùng component chung |
| js/core/, js/utils/, config và CSS nền tảng | Người tích hợp FE | HTTP, phiên, lỗi, format VND/thời gian; các trang dùng lại |
| js/api/ | Một chủ cho từng nhóm API | Chốt người phụ trách trước khi viết; không ai tự sửa toàn bộ thư mục |
| assets/ | Chủ tài nguyên/người tích hợp | Tên riêng theo khu vực; không ghi đè logo/ảnh chung |
| Route trang, đăng ký ứng dụng, dependency/Docker | Người tích hợp FE phối hợp backend | PR cấu hình riêng; URL trang không trùng endpoint JSON |

Chia helper API theo nhóm backend: auth/users; patient/catalog/schedule; encounter;
payment/notification; clinical/content/statistics. Điền tên chủ từng nhóm trước khi
bắt đầu. Các vai trò cùng dùng API patient thì import chung helper, không viết
ba bản khác nhau hoặc cùng sửa một helper. Chưa cần chốt tên từng file.

Các trang cùng dữ liệu nhưng khác vai trò có trang riêng: Patient đọc kết quả,
Doctor nhập bệnh án; Reception tiếp nhận, Nurse hỗ trợ; Public xem bác sĩ, Admin
quản lý bác sĩ. Chia sẻ helper/component, backend giữ nghiệp vụ. Hồ sơ tài khoản
cho các vai trò dùng component chung nếu phù hợp, không sửa trang của vai trò khác.
CSS giới hạn theo role/page, không sửa selector toàn cục từ CSS trang. Không dồn
logic vào base/config hoặc format toàn repo trong PR một trang.

## 5. Thứ tự làm của cả nhóm

| Đợt | Việc cần làm |
|---|---|
| 0 | Chốt người sở hữu khu vực/helper, cách chạy, URL trang/API, layout và hợp đồng dữ liệu; đọc docs, kiểm tra API thực tế |
| 1 | Nền tảng chung và Auth đăng nhập; merge master rồi cả nhóm tạo nhánh từ nền tảng đó |
| 2 | Song song: Public danh mục; Patient hồ sơ; Doctor hồ sơ/ca; Reception tra cứu; Nurse phân công; Admin tài khoản/danh mục/ca |
| 3 | Patient đặt lịch; Reception walk-in/check-in/hàng chờ; Doctor danh sách/bắt đầu khám khi API patient/ca/encounter sẵn sàng |
| 4 | Patient thanh toán/kết quả; Doctor bệnh án/thuốc/hoàn tất; thông báo/đánh giá/hoàn tiền theo quyền khi API sẵn sàng |
| 5 | Public/Admin bài viết, cấu hình/thống kê; responsive và kiểm thử xuyên vai trò |

Chỉ nền tảng cần bàn giao trước; không chờ hoàn thành toàn bộ một vai trò mới làm
vai trò tiếp theo. Chưa có API dùng mock riêng và ghi rõ; có endpoint trong kế hoạch
không nghĩa đã có API chạy. Mỗi đợt review/merge PR nhỏ lần lượt.

## 6. Quy trình Git

master là nhánh tích hợp hiện tại (tài liệu quy tắc cũ dùng main). Không có cách
đảm bảo tuyệt đối không conflict; một chủ file, thư mục riêng, PR nhỏ và cập nhật
thường xuyên giúp giảm. Merge sạch vẫn phải kiểm tra chạy chung.

Bắt đầu task khi working tree sạch:

```powershell
git checkout master
git pull --ff-only origin master
git checkout -b feature/fe-patient-booking
```

Chỉ add đường dẫn thuộc task. PowerShell cần dấu nháy với đường dẫn có ngoặc;
CSS/JS đề xuất bên dưới chỉ add khi đã tạo:

```powershell
git status
git diff
git add "frontend/templates/(patient)" "frontend/static/js/pages/patient" "frontend/static/css/patient"
git commit -m "feat: add patient booking flow"
git push -u origin feature/fe-patient-booking
```

Cùng task tiếp tục commit/push trên cùng nhánh. Task mới sau khi PR merge tạo
nhánh mới từ master cập nhật. Push nhánh riêng → PR vào master → người khác review
→ người tích hợp merge lần lượt. Người khác push nhánh riêng chưa đưa code vào master.

Khi master có code mới, commit phần đang làm rồi trên nhánh task:

```powershell
git fetch origin
git merge origin/master
```

Nếu conflict, sửa cùng chủ file, không chọn đại Current/Incoming; lưu, git add các
file giải quyết, git commit nếu cần hoàn tất merge, kiểm thử rồi push. Không push
trực tiếp master hoặc force push để né conflict. Thay đổi helper/component/cấu hình
chung tách PR phối hợp; không trộn sửa backend/database vào task FE.

Git không lưu thư mục rỗng. Người tích hợp đưa cấu trúc lên master với nội dung
nền tảng thực tế hoặc placeholder .gitkeep nếu cần; không tự xóa placeholder của
khu vực khác. Kế hoạch này chưa tạo các placeholder.

## 7. Đối chiếu và nghiệm thu

API dùng trực tiếp, không thêm /api/v1 hoặc /v1. Không hardcode cọc 30%, hoàn tiền
24 giờ, mốc no-show, quyền Nurse hay quy trình sửa bệnh án khi chưa chốt. Giá NULL
không coi là miễn phí. Thanh toán/email giả lập; không nối ngân hàng thật.
Ẩn menu không thay thế quyền backend. Hiển thị VND và thời gian Asia/Saigon.

| Khu vực | Kiểm tra bắt buộc |
|---|---|
| Public | Danh sách/chi tiết/lịch rỗng/lỗi; điều hướng; không lộ bệnh án |
| Auth | Đăng ký không nâng quyền; sai mật khẩu/khóa/xóa; OTP hết hạn/dùng lại; xác minh email; logout/phiên hết hạn theo cơ chế chốt; không lộ OTP người khác |
| Patient | Đúng chủ patient; BHYT/archive; ca hết chỗ; thanh toán lặp/muộn sau EXPIRED; kết quả/thông báo của mình; review sau COMPLETED |
| Doctor | Đúng lượt được giao; báo nghỉ xử lý lỗi; thuốc số lượng dương; bắt đầu/hoàn tất qua API; giới hạn sửa sau hoàn tất |
| Reception | Walk-in không tài khoản có ca/số; online không trùng; action lặp; chuyển ca đầy; quyền điều phối/thu phí |
| Nurse | Đúng ca; thu hồi phân công bị chặn; không sửa ngoài quyền |
| Admin | USER bị chặn; tạo nhân viên/khóa/xóa mềm; ca chồng/quota; đúng NURSE; hoàn tiền theo quyền; thống kê không cộng trùng |

Mỗi task bàn giao phạm vi trang, API, mock/thật, ảnh và kết quả kiểm tra. Kiểm tra
mobile/desktop, bàn phím/label, loading/rỗng/lỗi, 401/403/404/409 và submit lặp.
Luồng chung: Auth → Patient hồ sơ/đặt online/cọc → Reception check-in → Doctor
khám/thuốc/hoàn tất → Patient kết quả/review. Kiểm tra thêm walk-in, Nurse và Admin.
Phần chưa chốt hoặc chưa kiểm thử ghi rõ, không đánh dấu hoàn thành.
