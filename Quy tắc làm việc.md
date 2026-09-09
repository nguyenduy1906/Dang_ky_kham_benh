# QUY TẮC LÀM VIỆC XÂY DỰNG WEBSITE BẰNG PYTHON & HTML

## 1. Nguyên tắc chung

- Không làm việc trực tiếp trên branch `main`.
- Mỗi thành viên làm việc trên **branch riêng cho từng chức năng/task** (trang HTML, route Python, tính năng backend...).
- Không tự ý sửa hoặc xóa code của người khác (template HTML, route, model) nếu chưa trao đổi.
- Trước khi bắt đầu code phải cập nhật code mới nhất từ `main`.
- Không commit code đang lỗi, server không chạy được (`python app.py` báo lỗi) nếu commit đó ảnh hưởng đến người khác.
- Mọi thay đổi quan trọng đưa vào `main` đều phải thông qua Pull Request (PR).
- Không tự ý merge PR của chính mình.
- Khi gặp conflict (đặc biệt ở file `requirements.txt`, template HTML dùng chung), người tạo PR có trách nhiệm xử lý và kiểm tra lại project trước khi merge.
- Luôn dùng **virtual environment** (`venv`) khi code, không cài package trực tiếp vào Python hệ thống.

---

# 2. Quy tắc Branch

## Branch chính

```text
main
```

- `main` luôn phải ở trạng thái chạy được (server khởi động thành công, trang web hiển thị đúng).
- Không push trực tiếp vào `main`.
- Chỉ merge code đã được review và kiểm tra trên trình duyệt.

## Branch chức năng

Đặt tên branch theo dạng:

```text
feature/<ten-chuc-nang>
```

Ví dụ:

```text
feature/login-page
feature/register-form
feature/homepage-ui
feature/api-user-data
feature/contact-page
```

## Bug

```text
fix/<ten-bug>
```

Ví dụ:

```text
fix/login-500-error
fix/css-not-loading
fix/form-validation
```

## Refactor

```text
refactor/<ten-noi-dung>
```

Ví dụ:

```text
refactor/flask-routes
refactor/html-templates
refactor/database-model
```

Tên branch nên **ngắn, rõ nghĩa, viết bằng tiếng Anh và dùng dấu `-` thay vì khoảng trắng**.

---

# 3. Quy trình làm việc chuẩn

```text
main
  ↓
Tạo branch mới
  ↓
Kích hoạt virtual environment
  ↓
Code (Python routes / templates HTML / CSS / JS)
  ↓
Chạy thử local (python app.py / flask run)
  ↓
Commit
  ↓
Push lên GitHub
  ↓
Pull Request
  ↓
Code Review
  ↓
Fix nếu cần
  ↓
Merge vào main
```

Ví dụ:

```bash
git checkout main
git pull origin main

git checkout -b feature/login-page

# kích hoạt môi trường ảo
source venv/bin/activate      # macOS/Linux
venv\Scripts\activate         # Windows
```

Sau khi hoàn thành (code xong, chạy thử OK):

```bash
git add .
git commit -m "feat: add login page template"
git push -u origin feature/login-page
```

Sau đó tạo Pull Request trên GitHub.

---

# 4. Quy tắc Commit

Commit phải thể hiện **một thay đổi có ý nghĩa**, không commit tất cả mọi thứ (HTML + CSS + backend + fix bug) vào một commit khổng lồ.

### Format

```text
<type>: <description>
```

Các `type` thường dùng:

```text
feat      → thêm trang/chức năng mới (route, template, form...)
fix       → sửa bug (lỗi hiển thị, lỗi server, lỗi logic Python)
refactor  → thay đổi cấu trúc code/template nhưng không thêm chức năng
style     → chỉnh CSS, format code, không đổi logic
docs      → tài liệu, README, hướng dẫn cài đặt
test      → thêm/sửa test (pytest, unittest)
chore     → cập nhật requirements.txt, cấu hình, dependency
```

### Ví dụ tốt

```text
feat: add homepage HTML template
feat: implement login route in Flask
feat: connect contact form to backend
fix: fix broken CSS link in base.html
fix: prevent server crash when form is empty
refactor: separate routes into blueprints
style: format templates with consistent indentation
docs: update README with setup instructions
chore: update requirements.txt
```

### Không nên

```text
update
fix
code
abc
sua loi
test1
final
final-final
```

**Một commit nên trả lời được câu hỏi: "Commit này đã thay đổi trang/route/logic gì?"**

---

# 5. Không commit những file không cần thiết

Không commit các file sinh ra tự động hoặc chứa thông tin cá nhân/nhạy cảm.

**File Python/web thường phải có trong `.gitignore`:**

```text
venv/
__pycache__/
*.pyc
.env
instance/
*.sqlite3
.vscode/
.idea/
node_modules/
.DS_Store
```

**Tuyệt đối không commit:**

```text
API Key
SECRET_KEY (Flask/Django)
Mật khẩu database
File .env
Thông tin đăng nhập, token
```

Nếu project cần API key/secret thì lưu trong file `.env` (không push lên Git) và trao đổi với PM để thống nhất cách chia sẻ an toàn.

---

# 6. Trước khi code

Luôn cập nhật `main` trước khi tạo branch:

```bash
git checkout main
git pull origin main
git checkout -b feature/ten-chuc-nang

# đảm bảo cài đủ package
pip install -r requirements.txt
```

Không nên tạo branch mới từ một `main` đã quá cũ hoặc thiếu package mới.

---

# 7. Trong quá trình code

Không nên code một task quá lớn (ví dụ nguyên một trang web hoàn chỉnh) rồi mới commit.

Ví dụ task:

```text
Implement Login Page
```

Có thể chia thành:

```text
feat: create login.html template
feat: add login form validation (JS)
feat: implement login route (Python/Flask)
feat: handle login error message
```

Như vậy khi có vấn đề (ví dụ route lỗi) sẽ dễ tìm và rollback hơn.

---

# 8. Trước khi Push

Trước khi push code lên GitHub:

```bash
git status
git diff
```

Kiểm tra:

- Có file nào không nên commit không (`.env`, `venv/`, `__pycache__/`)?
- Có API key/password/SECRET_KEY nào lộ trong code không?
- Có vô tình sửa template HTML hoặc route của người khác không?
- Server có chạy được không? (`python app.py`)
- Trang web có hiển thị đúng trên trình duyệt không?
- Có `print()` / `console.log()` debug thừa không?
- Đã cập nhật `requirements.txt` nếu có cài package mới chưa?

Sau đó:

```bash
pip freeze > requirements.txt   # nếu có cài thêm package
git add .
git commit -m "feat: ..."
git push
```

---

# 9. Pull Request

Mỗi PR nên:

- Có tên rõ ràng.
- Chỉ chứa **một task/chức năng chính** (một trang, một route, một tính năng).
- Không gộp nhiều thay đổi không liên quan (ví dụ sửa login + đổi CSS trang chủ) vào cùng một PR.
- Mô tả mình đã làm gì.
- Nếu có thay đổi giao diện thì nên đính kèm **screenshot trang web**.
- Người tạo PR phải tự chạy thử trên trình duyệt trước khi yêu cầu người khác review.

Ví dụ tiêu đề:

```text
feat: implement login page with Flask
```

Mô tả:

```text
## Changes
- Add login.html template
- Add /login route in Flask (GET, POST)
- Validate email/password input
- Show error message when login fails

## Testing
- Đã test đăng nhập thành công
- Đã test sai mật khẩu
- Đã test bỏ trống form
- Đã kiểm tra giao diện trên Chrome, Firefox
```

---

# 10. Code Review

Người review không chỉ kiểm tra xem **trang web có chạy hay không**, mà còn kiểm tra:

- Logic Python có đúng không? (route, xử lý dữ liệu, query database)
- Template HTML có gọn, dễ đọc, có tái sử dụng `{% include %}` / `{% extends %}` hợp lý không?
- Có duplicate code (HTML lặp lại, hàm Python trùng logic) không?
- Có cách triển khai đơn giản hơn không?
- Có bug tiềm ẩn không (thiếu validate input, lỗi bảo mật XSS/SQL injection)?
- Có ảnh hưởng đến trang/route khác không?

Khi review:

### Không nên

```text
Code này ngu vãi, viết lại đi
```

### Nên

```text
Phần xử lý form này có thể tách thành một hàm riêng để tái sử dụng cho cả trang đăng ký.
```

Review tập trung vào **code**, không công kích người viết code.

---

# 11. Quy tắc Merge

Chỉ merge khi:

- PR đã được review.
- Không còn conflict.
- Server chạy được, không lỗi 500/404 phát sinh.
- Trang web hiển thị đúng, không vỡ giao diện.
- Không có issue nghiêm trọng đang tồn tại.

Người tạo PR **không tự approve và merge PR của chính mình**.

---

# 12. Khi Main có code mới

Trong lúc đang code, nếu `main` đã có thay đổi mới (ví dụ thêm route dùng chung, thêm package mới) thì cần cập nhật branch của mình.

```bash
git fetch origin
git merge origin/main

# nếu main có thêm package mới
pip install -r requirements.txt
```

hoặc theo workflow của nhóm:

```bash
git fetch origin
git rebase origin/main
```

**Quan trọng:** cả nhóm nên thống nhất dùng `merge` hoặc `rebase`, không tự ý mỗi người một kiểu.

Nếu chưa quen Git thì nên dùng `merge` trước vì dễ hiểu và ít rủi ro hơn.

---

# 13. Xử lý Conflict

Khi xảy ra conflict (thường gặp ở `requirements.txt`, `base.html`, file route chung):

```text
<<<<<<< HEAD
code của mình
=======
code từ main
>>>>>>> main
```

Không được xóa đại một bên cho hết conflict.

Phải xem:

```text
Package/route/đoạn HTML của mình cần giữ gì?
Package/route/đoạn HTML từ main cần giữ gì?
Hai phần có thể kết hợp không?
```

Sau khi xử lý:

```bash
git add .
git commit
```

Sau đó phải **chạy lại server và kiểm tra trang web trên trình duyệt** trước khi push/merge.

---

# 14. Không dùng các lệnh nguy hiểm tùy tiện

Đặc biệt cẩn thận với:

```bash
git reset --hard
git push --force
git push --force-with-lease
git clean -fd
```

Không sử dụng nếu chưa hiểu rõ hậu quả.

Đặc biệt:

```bash
git push --force
```

**Không được dùng trên `main`.**

---

# 15. Khi đang làm mà phát hiện code người khác có vấn đề

Không tự tiện sửa một phần lớn route/template của người khác trong branch của mình.

Ví dụ đang làm trang Login nhưng phát hiện hàm kết nối database (`db.py`) có bug.

Nên:

```text
Báo cho người phụ trách phần Database
```

hoặc tạo task/issue riêng:

```text
fix: handle database connection timeout
```

Điều này giúp Git history rõ ràng và tránh việc một PR chứa quá nhiều thay đổi không liên quan.

---

# 16. Không commit kiểu "một đống thay đổi"

Không nên:

```text
feat: login + register + homepage + fix css + update requirements
```

Nên tách:

```text
feat: implement login page
feat: implement register page
feat: build homepage UI
fix: fix css not loading
chore: update requirements.txt
```

**Một commit/PR càng tập trung vào một mục đích thì càng dễ review.**

---

# 17. Quy tắc khi kết thúc task

Sau khi PR đã merge:

```bash
git checkout main
git pull origin main
```

Có thể xóa branch local:

```bash
git branch -d feature/login-page
```

Branch trên GitHub cũng nên được xóa sau khi merge nếu nhóm không có lý do giữ lại.

---

# 18. Quy tắc quan trọng nhất

### ❌ Không làm

```text
Code → git add . → git commit → git push main
```

### ✅ Nên làm

```text
Pull main
    ↓
Tạo branch
    ↓
Code (Python + HTML)
    ↓
Chạy thử local
    ↓
Commit nhỏ, rõ ràng
    ↓
Push branch
    ↓
Pull Request
    ↓
Review
    ↓
Fix
    ↓
Merge
    ↓
Delete branch
```

---

# 19. Cheat Sheet

### Bắt đầu task

```bash
git checkout main
git pull origin main
git checkout -b feature/login-page
source venv/bin/activate
```

### Lưu code

```bash
git status
git add .
git commit -m "feat: implement login page"
git push -u origin feature/login-page
```

### Cập nhật main

```bash
git checkout main
git pull origin main
```

### Cập nhật branch đang làm

```bash
git fetch origin
git merge origin/main
pip install -r requirements.txt
```

### Sau khi PR được merge

```bash
git checkout main
git pull origin main
git branch -d feature/login-page
```

---

# 20. Quy tắc ngắn gọn để cả nhóm nhớ

> **Không push trực tiếp vào `main`.**
> **Mỗi task một branch (một trang/route/tính năng).**
> **Mỗi commit một mục đích rõ ràng.**
> **PR phải được review và chạy thử trước khi merge.**
> **Luôn pull code mới và cập nhật `requirements.txt` trước khi bắt đầu task.**
> **Không commit `.env`, secret, API key, database.**
> **Không tự ý force push.**
> **Conflict phải được xử lý cẩn thận và chạy lại server để test.**
> **Code review góp ý vào code, không công kích người viết.**
