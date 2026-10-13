# Chạy frontend

Cần Node.js 20 trở lên. Không cần cài thư viện hoặc mở VS Code.

Từ thư mục gốc dự án:

```powershell
cd frontend
npm start
```

Mở http://127.0.0.1:3000/frontend/templates/public/home.html.
Nếu Live Preview đang giữ cổng 3000, tắt nó hoặc dùng `npm start -- --port 5500`.
Dừng frontend bằng `Ctrl+C`.

Backend và database chạy riêng qua Docker Compose, từ thư mục gốc:

```powershell
docker compose up -d --build
```

Địa chỉ API nằm trong `static/js/config.js`. Backend cho phép frontend ở cổng
3000 và 5500 trên localhost/127.0.0.1; cổng khác cần được thêm vào
`FRONTEND_ORIGINS` của backend.

Chạy kiểm thử frontend: `npm test`.
