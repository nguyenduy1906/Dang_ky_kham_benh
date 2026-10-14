> Cập nhật 12/10/2026: người dùng đã đổi sang đặt khung giờ và phát phiếu, bỏ cấp số thứ tự. Quy tắc mới có ưu tiên hơn các nội dung cũ bên dưới: [THAY_DOI_PHIEU_KHUNG_GIO_12_10_2026.md](THAY_DOI_PHIEU_KHUNG_GIO_12_10_2026.md).
> Cập nhật nghiệp vụ 12/10/2026: [THAY_DOI_TAI_KHOAN_HO_SO_12_10_2026.md](THAY_DOI_TAI_KHOAN_HO_SO_12_10_2026.md). Mục “Đăng ký khám cho ai” phải tải GET /patients, lưu/chọn patient_id riêng từng thành viên, không tạo lại hồ sơ mỗi lần. Cùng số người đặt cần xác nhận confirm_shared_phone; số khác có tài khoản riêng tự tạo/dùng lại. Quên mật khẩu hỗ trợ OTP số điện thoại. Backend đã có hợp đồng này; UI hiện vẫn preview chưa tích hợp các API trên.

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

## 8. Trang chủ giao diện — 11/10/2026

Theo yêu cầu mới, bắt đầu frontend bằng giao diện tĩnh, chưa kết nối API.
Trang đầu tiên: `frontend/templates/public/home.html`; CSS: `frontend/static/css/home.css`;
JavaScript tương tác mẫu: `frontend/static/js/pages/home.js`.
Bố cục dựa trên ảnh tham khảo: thanh xanh, nhận diện/khẩu hiệu, menu ngang,
banner ảnh lớn, bốn tiện ích và footer đơn giản. Không có thanh tìm kiếm góc phải;
các khối và nút dùng góc vuông. Ảnh lấy từ assets hiện có. Tên bệnh viện được chốt là NEU Medical,
không dùng logo bệnh viện hoặc số điện thoại chưa xác nhận.
Các mục menu mở hộp thông tin minh họa; chưa triển khai đặt lịch, đăng nhập,
tra cứu hay dữ liệu thật. Giữ nguyên thư mục theo vai trò và API backend.
Xem cục bộ bằng `.venv\Scripts\python.exe -m http.server 8080 --bind 127.0.0.1 --directory frontend`,
rồi mở `http://localhost:8080/templates/public/home.html`; không cần database.


### Bổ sung trang chủ 11/10/2026

Trang chủ tiếp tục có: chuyên khoa (hover/focus nền xanh, nút mở rộng), banner lịch khám,
tin tức (lọc theo nhóm bằng dữ liệu tĩnh), sự kiện cuộn ngang, tám ảnh bác sĩ
(cuộn/vuốt, nút trước/sau và phím mũi tên). Tất cả các khối giữ góc vuông.
Nội dung và hồ sơ bác sĩ là minh họa, chưa kết nối API. Không dùng số lượng nhân viên,
thành tích, chức danh hay tên bác sĩ của bệnh viện trong ảnh mẫu làm dữ liệu NEU Medical.
Footer chỉ có một cơ sở, địa chỉ theo yêu cầu người dùng lấy từ NEU:
207 đường Giải Phóng, phường Bạch Mai, Hà Nội, Việt Nam.
Nguồn đối chiếu: https://neu.edu.vn/lien-he/ . Chưa có hotline/email riêng của bệnh viện.
Ảnh cơ sở dùng ảnh minh họa hiện có. Đã kiểm tra đường dẫn tài nguyên;
chưa xác minh trực quan và tương tác trên trình duyệt do truy cập localhost bị chặn.

### Các trang menu và chi tiết bác sĩ — 11/10/2026

Đã tạo các giao diện tĩnh public/about.html, departments.html, doctors.html,
news.html, contact.html và (patient)/booking.html; cùng header/footer, menu thật,
breadcrumb và góc vuông. public/doctor-detail.html nhận id mẫu 1–8, liên kết từ
ảnh bác sĩ trên trang chủ và danh sách; có lịch mẫu, đào tạo/công tác đóng mở,
đánh giá trạng thái rỗng. Không bịa lịch sử đào tạo, chức danh hoặc điểm đánh giá.
Form đánh giá bị vô hiệu hóa vì chỉ được đánh giá sau lượt khám COMPLETED.
Form đặt lịch chỉ xem lại dữ liệu nhập trong bộ nhớ; không tạo lịch, giữ chỗ,
thu tiền hoặc lưu dữ liệu. Có kiểm tra trường bắt buộc và lọc bác sĩ mẫu theo khoa.
Không thêm API hay đổi đường dẫn backend. JS điều hướng/menu/hộp thông tin
chung đặt tại static/js/core/public.js; trang chủ và các trang còn lại dùng
script riêng. Header không có tìm kiếm; tìm bác sĩ chỉ nằm trong trang danh sách.
Đã kiểm tra cú pháp bốn file JS, đường dẫn tài nguyên/liên kết và ID duy nhất
trong cả tám trang; chưa kiểm thử trực quan hay tương tác thực tế trên trình duyệt.

### Bố cục mới footer và Chuyên khoa — 11/10/2026

Yêu cầu mới thay footer có ảnh cơ sở bằng footer trắng ba cột: giới thiệu,
địa chỉ/giờ khám và khối hotline; phía dưới có bản quyền và các nút thông tin.
Áp dụng cả tám trang. Địa chỉ giữ theo NEU; giờ khám/hotline chưa xác nhận
hiển thị Đang cập nhật. Không lấy giấy phép, số điện thoại hoặc cấp cứu 24/7 từ ảnh mẫu.
Trang Chuyên khoa thay bố cục cũ bằng phần giới thiệu, tìm kiếm/lọc,
lưới khoa, ba ảnh trang thiết bị minh họa và hướng dẫn cuối trang.
Danh sách dùng đúng mười khoa trong sample_data.sql; khối cận lâm sàng
chưa có dữ liệu mẫu nên hiển thị trạng thái rỗng. Khối số liệu ghi rõ dữ liệu mẫu.
Giữ góc vuông, chưa nối API. Đã kiểm tra cú pháp JS và đường dẫn cả tám trang;
chưa xác minh trực quan trên trình duyệt.

### Danh sách bác sĩ theo mẫu mới — 11/10/2026

Trang doctors.html có breadcrumb, giới thiệu, khối liên hệ hỗ trợ,
tìm tên/lọc chuyên khoa và các nút lọc nhanh; lưới bốn thẻ mỗi hàng trên desktop.
Thẻ có ảnh, chuyên khoa, tên mẫu, thông tin chuyên môn chờ cập nhật,
lịch khám chưa có dữ liệu thật và liên kết hồ sơ chi tiết. Giữ góc vuông.
Phân trang tám hồ sơ/trang; với tám hồ sơ hiện có chỉ có trang 1, nút trước/sau
bị vô hiệu hóa thay vì tạo trang trống hoặc nhân bản bác sĩ.
Script riêng static/js/pages/doctors.js; chưa gọi API.
Đã kiểm tra cú pháp script, số thẻ và đường dẫn; chưa kiểm thử trực quan/tương tác.

### Giao diện đăng ký khám ba cột — 11/10/2026

Trang (patient)/booking.html theo mẫu mới: thông tin người khám/cơ sở/ngày/ca/BHYT
bên trái, tìm và chọn bác sĩ ở giữa, tóm tắt bên phải. Giữ header/footer NEU,
góc vuông và tông xanh lá. Một cơ sở, tám bác sĩ minh họa; giá chưa có dữ liệu thật
không coi là miễn phí. Có tìm/lọc, chọn bác sĩ từ URL, tóm tắt ngày/ca và kiểm tra
trường bắt buộc. BHYT chỉ nhập mã thẻ, không tính quyền lợi. Ngày tối thiểu theo
Asia/Saigon. Ca, quota, giá và giới hạn 5 giờ chưa được xác minh bởi backend.
Script riêng booking.js; thao tác xem lại không tạo lịch, gửi dữ liệu hoặc thanh toán.
Đã kiểm tra cú pháp JS và đường dẫn/ID/số thẻ, chưa kiểm thử trình duyệt thực tế.

### Header thu gọn và thêm người thân — 11/10/2026

Cả tám trang dùng thanh header thu gọn khi cuộn qua header gốc và bật đăng nhập mẫu.
Nút Thử đăng nhập mẫu/Thoát đăng nhập mẫu ở topbar; trạng thái boolean lưu sessionStorage
để xem xuyên trang trong cùng tab. Đây không phải xác thực hoặc cơ chế phân quyền.
Thanh hiện NEU Medical và TÀI KHOẢN MẪU; không dùng tên/thông tin cá nhân từ ảnh tham khảo.
Trang đặt khám có dialog thêm người thân với các trường phù hợp schema patient:
họ tên, điện thoại, ngày sinh, giới tính, quan hệ, CCCD, BHYT và địa chỉ.
Không thêm nghề nghiệp/dân tộc/ngày cấp giấy tờ ngoài schema chỉ vì có trên ảnh.
Hồ sơ giữ trong bộ nhớ, tự chọn sau khi thêm, cập nhật tên và BHYT; mất khi tải lại.
Nút thêm ghi rõ bản xem trước, không thông báo đã lưu database.
Kiểm tra cú pháp JS, tài nguyên dùng chung, liên kết và ID đạt; chưa kiểm thử trình duyệt.

### Bộ lọc ngày, thông tin BHYT và khung giờ khám — 12/10/2026

Ngày bắt đầu/kết thúc ở sidebar chỉ lọc bác sĩ có lịch trong khoảng, không phải ngày
đặt lịch. Chọn bác sĩ mở lịch ngay trong thẻ, chọn ngày mẫu và giờ sáng/chiều,
rồi cập nhật tóm tắt. Lịch mẫu tạo trong 60 ngày tới, không lấy từ database.
Theo yêu cầu: khám ngoài 15 phút, khoa nặng như tim/phổi 30 phút mỗi lượt trong ca.
Cấu hình FE mẫu: Da liễu/Tai Mũi Họng/Mắt/Răng Hàm Mặt 15 phút; Nội tổng quát,
Tim mạch/Nhi/Sản phụ khoa tạm 30 phút. Danh mục chưa có khoa Phổi, không tự thêm.
Ca nghiệp vụ vẫn là sáng/chiều; khung 15/30 phút là lượt hẹn bên trong ca.
Giờ mẫu 08:00–12:00, 13:30–17:00 chỉ phục vụ bố cục, chưa áp dụng backend,
quota, số thứ tự hay kiểm tra trước ca 5 giờ. Quy tắc thời lượng cần đồng bộ khi nối API.
Chọn Có BHYT mở dialog nhập từ CCCD hoặc thẻ, họ tên, giới tính, ngày sinh.
Chỉ kiểm tra định dạng; không truy vấn xác thực hoặc kết luận quyền lợi bảo hiểm.
Tóm tắt có ảnh bác sĩ, ngày/giờ, cơ sở và vấn đề sức khỏe; nút xác nhận ghi rõ mẫu,
không tạo lượt khám/giữ chỗ/thu tiền. Dữ liệu cá nhân giữ trong bộ nhớ.
Đã kiểm tra cú pháp JS, ID và đường dẫn tài nguyên; chưa kiểm thử trình duyệt thực tế.
