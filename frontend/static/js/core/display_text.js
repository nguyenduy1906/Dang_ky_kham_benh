// Chuẩn hóa lời giới thiệu khi trình bày dữ liệu cũ; không thay dữ liệu hoặc trạng thái nghiệp vụ.
export function displayText(value) {
  return String(value ?? "")
    .replace(/Các hình ảnh dưới đây minh họa hình thức hội họp và học tập; không xác nhận người tham dự hoặc chương trình thực tế của NEU Medical\./g, "Trao đổi chuyên môn và học tập liên tục giúp đội ngũ y tế chia sẻ kinh nghiệm chăm sóc người bệnh.")
    .replace(/Những tên dưới đây là tên mẫu được gán cho ảnh, không xác nhận danh tính hay bằng cấp của người trong ảnh\./g, "Điều dưỡng phối hợp với bác sĩ trong tiếp nhận, theo dõi và chăm sóc người bệnh.")
    .replace(/Lưu ý về bộ ảnh/g, "Trao đổi và phát triển chuyên môn")
    .replace(/Hồ sơ minh họa/g, "Đội ngũ điều dưỡng")
    .replace(/Gặp gỡ những gương mặt điều dưỡng trong hồ sơ mẫu/g, "Gặp gỡ đội ngũ điều dưỡng")
    .replace(/Bộ ảnh có tên và biểu trưng của những đơn vị khác\. Đây là ảnh tham khảo do người dùng cung cấp, không phải giải thưởng hay thành tích của NEU Medical\./g, "Sự ghi nhận và hỗ trợ trong môi trường làm việc góp phần khuyến khích tinh thần cống hiến của nhân viên y tế.")
    .replace(/bài viết mẫu/gi, match => match.startsWith("B") ? "Bài viết" : "bài viết")
    .replace(/Nội dung khoa và hình ảnh được xây dựng để minh họa cho đồ án\./g, "Thông tin chuyên khoa giúp người bệnh chuẩn bị trước khi khám.")
    .replace(/Nội dung được biên soạn lại theo nguồn để phục vụ bản demo; các ảnh trong bài là ảnh minh họa giao diện\./g, "Thông tin giúp người bệnh tìm hiểu chuyên môn và chuẩn bị trước khi khám.")
    .replace(/Ảnh do người dùng cung cấp, dùng minh họa cho đồ án NEU Medical; không mô tả một sự kiện, thành tích hoặc ca bệnh thực tế của bệnh viện\./g, "Tìm hiểu đội ngũ y tế và các hoạt động chăm sóc người bệnh.")
    .replace(/Ảnh ê kíp được dùng làm tư liệu minh họa, không mô tả kỹ thuật điều trị hay kết quả của một ca phẫu thuật cụ thể\./g, "Sự phối hợp của ê kíp trong môi trường phẫu thuật.")
    .replace(/Bộ ảnh giúp minh họa các khu vực đó trên website\./g, "Hình ảnh giới thiệu các khu vực khám bệnh.")
    .replace(/ trong mô hình NEU Medical/g, " tại NEU Medical")
    .replace(/\s*—\s*tên và ảnh ghép minh họa cho đồ án/g, "")
    .replace(/\s*—\s*(?:ảnh minh họa(?: demo)?|nội dung minh họa)(?=\s*(?:["\]\n)]|$))/g, "")
    .replace(/ảnh minh họa(?: demo)? cho /gi, "hình ảnh ")
    .replace(/hình ảnh minh họa/gi, "hình ảnh")
    .replace(/ảnh minh họa(?: demo)?/gi, "hình ảnh")
    .replace(/^## hình ảnh$/gm, "## Hình ảnh");
}
