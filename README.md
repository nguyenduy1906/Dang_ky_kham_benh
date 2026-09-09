# 🏥 Hệ Thống Đăng Ký và Lên Lịch Khám Bệnh

<div align="center">

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0.3-black?logo=flask&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Database-blue?logo=sqlite&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-Frontend-orange?logo=html5&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

**Website đặt lịch khám bệnh trực tuyến** — Kết nối bệnh nhân với bác sĩ chuyên khoa nhanh chóng và dễ dàng.

</div>

---

## 📖 Giới thiệu

**PhòngKhámOnline** là ứng dụng web quản lý đặt lịch khám bệnh được xây dựng bằng Python (Flask) với giao diện HTML/CSS/JavaScript thuần và cơ sở dữ liệu SQLite.

Hệ thống hỗ trợ **3 vai trò người dùng**:
- 🧑‍💼 **Bệnh nhân** — Đặt lịch, theo dõi và hủy lịch hẹn
- 👨‍⚕️ **Bác sĩ** — Quản lý lịch làm việc, xác nhận và cập nhật trạng thái lịch hẹn
- ⚙️ **Admin** — Quản lý toàn bộ hệ thống, bác sĩ và bệnh nhân

---

## ✨ Tính năng chính

### 🧑‍💼 Bệnh nhân
- Đăng ký / Đăng nhập tài khoản
- Tìm kiếm bác sĩ theo chuyên khoa
- Đặt lịch khám online
- Xem lịch sử khám, lọc theo trạng thái
- Hủy lịch hẹn chưa diễn ra
- Cập nhật hồ sơ cá nhân & đổi mật khẩu

### 👨‍⚕️ Bác sĩ
- Xem danh sách lịch hẹn trong ngày
- Xác nhận / Hoàn thành / Hủy lịch hẹn
- Quản lý lịch làm việc (thêm / xóa ca)
- Xem danh sách bệnh nhân đã khám
- Ghi chú sau buổi khám

### ⚙️ Admin
- Thống kê tổng quan hệ thống
- Thêm và quản lý tài khoản bác sĩ
- Kích hoạt / Vô hiệu hóa tài khoản
- Xem danh sách bệnh nhân đã đăng ký
- Theo dõi lịch hẹn toàn hệ thống

---

## 🛠️ Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Backend | Python 3.10+, Flask 3.0 |
| ORM | SQLAlchemy, Flask-SQLAlchemy |
| Authentication | Flask-Login |
| Database | SQLite |
| Frontend | HTML5, CSS3, JavaScript (thuần) |
| Template Engine | Jinja2 |

---

## 📁 Cấu trúc dự án

```
📦 Đăng ký và lên lịch khám bệnh/
├── 📄 run.py                    # Điểm khởi chạy ứng dụng
├── 📄 config.py                 # Cấu hình Flask (Secret Key, DB URI, ...)
├── 📄 requirements.txt          # Danh sách thư viện Python
│
├── 📁 app/                      # Package ứng dụng chính
│   ├── 📄 __init__.py           # Flask Application Factory
│   ├── 📄 models.py             # SQLAlchemy Models (User, Doctor, Schedule, Appointment)
│   │
│   ├── 📁 routes/               # Blueprints theo vai trò
│   │   ├── 📄 auth.py           # Đăng ký / Đăng nhập / Đăng xuất
│   │   ├── 📄 patient.py        # Dashboard và chức năng bệnh nhân
│   │   ├── 📄 doctor.py         # Dashboard và chức năng bác sĩ
│   │   ├── 📄 appointment.py    # Đặt lịch và xem chi tiết
│   │   └── 📄 admin.py          # Quản trị hệ thống
│   │
│   └── 📁 static/               # Tài nguyên tĩnh
│       ├── 📁 css/
│       │   ├── style.css        # Style toàn trang
│       │   └── dashboard.css    # Style dashboard
│       ├── 📁 js/
│       │   ├── main.js          # JavaScript chung
│       │   ├── auth.js          # Xử lý form đăng nhập/đăng ký
│       │   └── appointment.js   # Xử lý trang đặt lịch
│       └── 📁 images/           # Hình ảnh (uploads)
│
├── 📁 templates/                # HTML Templates (Jinja2)
│   ├── 📄 base.html             # Layout gốc (Navbar, Footer)
│   ├── 📄 index.html            # Trang chủ
│   ├── 📁 auth/                 # Trang đăng nhập, đăng ký
│   ├── 📁 patient/              # Trang dành cho bệnh nhân
│   ├── 📁 doctor/               # Trang dành cho bác sĩ
│   ├── 📁 appointment/          # Trang đặt lịch và chi tiết
│   └── 📁 admin/                # Trang quản trị
│
└── 📁 instance/
    └── 🗄️ clinic.db             # File SQLite Database (tự tạo khi chạy)
```

---

## ⚙️ Cài đặt và Chạy dự án

### Yêu cầu hệ thống

- **Python** 3.10 trở lên → [Tải tại python.org](https://www.python.org/downloads/)
- **pip** (đi kèm Python)
- **Git** (để clone dự án)

---

### Bước 1 — Clone dự án

```bash
git clone https://github.com/<your-username>/<your-repo-name>.git
cd "<your-repo-name>"
```

---

### Bước 2 — Tạo môi trường ảo (khuyến nghị)

```bash
# Tạo virtual environment
python -m venv venv

# Kích hoạt (Windows)
venv\Scripts\activate

# Kích hoạt (macOS / Linux)
source venv/bin/activate
```

> ✅ Khi kích hoạt thành công, bạn sẽ thấy `(venv)` ở đầu dòng lệnh.

---

### Bước 3 — Cài đặt thư viện

```bash
pip install -r requirements.txt
```

Các thư viện sẽ được cài:

| Thư viện | Phiên bản | Mục đích |
|---|---|---|
| Flask | 3.0.3 | Web framework |
| Flask-SQLAlchemy | 3.1.1 | ORM + tích hợp Flask |
| Flask-Login | 0.6.3 | Quản lý phiên đăng nhập |
| Flask-WTF | 1.2.1 | Bảo vệ form (CSRF) |
| Werkzeug | 3.0.3 | Tiện ích bảo mật (hash mật khẩu) |
| SQLAlchemy | 2.0.31 | ORM Database |
| python-dotenv | 1.0.1 | Quản lý biến môi trường |
| email-validator | 2.2.0 | Validate email |

---

### Bước 4 — Chạy ứng dụng

```bash
python run.py
```

Bạn sẽ thấy output tương tự:

```
[INFO] Default admin created: admin@clinic.vn / Admin@123
 * Running on http://127.0.0.1:5000
 * Running on http://192.168.x.x:5000
 * Debug mode: on
```

> 🗄️ Database `instance/clinic.db` sẽ **tự động được tạo** khi chạy lần đầu.

---

### Bước 5 — Truy cập website

Mở trình duyệt và vào địa chỉ:

```
http://localhost:5000
```

---

## 🔑 Tài khoản mặc định (Admin)

Khi chạy lần đầu, hệ thống tự tạo tài khoản admin:

| Thông tin | Giá trị |
|---|---|
| **Email** | `admin@clinic.vn` |
| **Mật khẩu** | `Admin@123` |

> ⚠️ **Lưu ý bảo mật**: Hãy đổi mật khẩu admin ngay sau khi triển khai thực tế!

---

## 🗺️ Các URL chính

| Trang | URL | Ai truy cập |
|---|---|---|
| Trang chủ | `/` | Tất cả |
| Đăng nhập | `/auth/login` | Tất cả |
| Đăng ký | `/auth/register` | Khách |
| Dashboard bệnh nhân | `/patient/dashboard` | Bệnh nhân |
| Lịch sử khám | `/patient/appointments` | Bệnh nhân |
| Đặt lịch khám | `/appointment/book` | Bệnh nhân |
| Dashboard bác sĩ | `/doctor/dashboard` | Bác sĩ |
| Lịch làm việc | `/doctor/schedule` | Bác sĩ |
| Dashboard admin | `/admin/dashboard` | Admin |
| Quản lý bác sĩ | `/admin/doctors` | Admin |

---

## 🗄️ Cấu trúc Database

```
users ──────────────────────────────────────────────────────────
  id | full_name | email | password_hash | phone | role | ...

doctors ─────────────────────────────────────────────────────────
  id | user_id (FK) | specialty | experience_years | bio | ...

schedules ───────────────────────────────────────────────────────
  id | doctor_id (FK) | work_date | start_time | end_time | ...

appointments ────────────────────────────────────────────────────
  id | patient_id (FK) | doctor_id (FK) | schedule_id (FK)
     | appointment_date | appointment_time | reason | status | ...
```

---

## 🤝 Đóng góp

1. Fork dự án
2. Tạo branch mới: `git checkout -b feature/ten-tinh-nang`
3. Commit thay đổi: `git commit -m "Add: mô tả thay đổi"`
4. Push lên branch: `git push origin feature/ten-tinh-nang`
5. Tạo Pull Request

---

## 📝 License

Dự án được phân phối theo giấy phép [MIT License](LICENSE).

---

<div align="center">
  Made with ❤️ for learning purposes
</div>
