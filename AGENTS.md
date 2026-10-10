# Quy tắc làm việc trong dự án

- Trước khi thay đổi bất kỳ phần nào, đọc và đối chiếu các báo cáo, tài liệu nghiệp vụ trong `docs/`, đặc biệt `BAO_CAO_NGHIEP_VU.md`, `TONG_HOP_PHAN_TICH_NGHIEP_VU.txt` và `DANH_SACH_API_VA_PHAN_CONG_BACKEND.md`. Đọc thêm `HUONG_DAN_CHAY_DU_AN.md` khi liên quan cấu hình chạy, database hoặc tích hợp.
- Xác định yêu cầu nghiệp vụ và tiêu chí nghiệm thu liên quan trước khi sửa; đối chiếu code/schema thực tế với tài liệu, không coi chức năng đã hoàn thành chỉ vì có file, bảng hoặc route.
- Sau khi sửa, kiểm thử phù hợp với các quy tắc nghiệp vụ và tiêu chí nghiệm thu trong `docs/`. Báo rõ phần đã kiểm thử và phần chưa thể xác minh; không khẳng định hoàn thành nếu còn kiểm tra bắt buộc chưa thực hiện.
- Yêu cầu mới của người dùng có ưu tiên cao hơn tài liệu cũ. Khi người dùng chốt thay đổi nghiệp vụ, cập nhật tài liệu tương ứng để tránh quy tắc mâu thuẫn.
- Cả 5 gói API dùng đường dẫn trực tiếp như `/auth/login`, `/me`, `/admin/users`, `/patients`, `/encounters`; không thêm tiền tố `/api/v1` hoặc `/v1`.
