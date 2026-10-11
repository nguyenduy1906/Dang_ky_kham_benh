const panels = {
  privacy: [
    "Chính sách bảo mật",
    "<p>Nội dung chính sách chính thức sẽ được bổ sung. Bản xem trước hiện chưa gửi dữ liệu đến hệ thống.</p>",
  ],
  terms: [
    "Điều khoản sử dụng",
    "<p>Điều khoản sử dụng chính thức sẽ được bổ sung trước khi hệ thống đưa vào sử dụng.</p>",
  ],
  insurance: [
    "Bảo hiểm y tế",
    "<p>Hồ sơ người được khám có thể cung cấp mã thẻ BHYT. Đồ án chưa xử lý quyền lợi hoặc chi trả bảo hiểm.</p>",
  ],
  about: [
    "Giới thiệu",
    "<p>Website hỗ trợ tìm hiểu bác sĩ, chuyên khoa và đăng ký khám cho bản thân hoặc người thân.</p>",
  ],
  departments: [
    "Chuyên khoa",
    "<p>Các chuyên khoa minh họa cho giao diện:</p><ul><li>Nội khoa</li><li>Ngoại khoa</li><li>Nha khoa</li></ul>",
  ],
  doctors: [
    "Đội ngũ bác sĩ",
    "<p>Trang danh sách bác sĩ sẽ trình bày ảnh, thông tin chuyên môn và lịch khám của từng bác sĩ.</p>",
  ],
  booking: [
    "Đặt lịch khám",
    "<p>Luồng giao diện dự kiến:</p><ol><li>Chọn hồ sơ người được khám.</li><li>Chọn bác sĩ và ca khám.</li><li>Nhập triệu chứng và kiểm tra thông tin.</li><li>Thanh toán giả lập để xác nhận lịch.</li></ol><p>Chức năng đặt lịch chưa được triển khai trong bản xem trước này.</p>",
  ],
  news: [
    "Tin tức sức khỏe",
    "<p>Khu vực tin tức sẽ hiển thị các bài viết và thông tin hoạt động của cơ sở khám bệnh.</p>",
  ],
  guide: [
    "Hướng dẫn khám bệnh",
    "<ul><li>Chuẩn bị giấy tờ cá nhân và thông tin người được khám.</li><li>Mang theo kết quả khám trước đây nếu có.</li><li>Với lịch online, đến check-in ít nhất 30 phút trước giờ hẹn.</li></ul>",
  ],
  contact: [
    "Liên hệ hỗ trợ",
    "<p>Số điện thoại, địa chỉ và thời gian hỗ trợ sẽ được bổ sung khi có thông tin chính thức của cơ sở khám bệnh.</p>",
  ],
};
const dialog = document.querySelector("#info-dialog");
document.querySelectorAll("[data-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    const [title, content] = panels[button.dataset.panel];
    document.querySelector("#dialog-title").textContent = title;
    document.querySelector("#dialog-content").innerHTML =
      content + '<p class="preview-note">Bản xem trước giao diện · Chưa kết nối API.</p>';
    dialog.showModal();
  });
});
document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  }
});
const toggle = document.querySelector(".menu-toggle");
toggle.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(open));
  document.querySelector("#main-nav").classList.toggle("open", open);
});

// Preview sign-in state only; this is not authentication or an access check.
const previewSessionKey = "neu-medical-preview-signed-in";
let previewSignedIn = false;
try {
  previewSignedIn = sessionStorage.getItem(previewSessionKey) === "true";
} catch {}
const pageHeader = document.querySelector("body > header");
const previewLoginButton = document.createElement("button");
previewLoginButton.type = "button";
previewLoginButton.className = "preview-login-toggle";
const compactAccountHeader = document.createElement("div");
compactAccountHeader.className = "compact-account-header";
compactAccountHeader.hidden = true;
const compactHospitalLink = document.createElement("a");
const currentHomeLink = document.querySelector(".brand");
compactHospitalLink.href = currentHomeLink.getAttribute("href");
compactHospitalLink.textContent = "BỆNH VIỆN NEU MEDICAL";
const compactGreeting = document.createElement("span");
compactGreeting.className = "compact-account-greeting";
compactGreeting.textContent = "Xin chào, TÀI KHOẢN MẪU";
const previewBadge = document.createElement("small");
previewBadge.textContent = "Đăng nhập mô phỏng";
compactGreeting.append(previewBadge);
compactAccountHeader.append(compactHospitalLink, compactGreeting);
document.body.append(compactAccountHeader);
document.querySelector(".topbar-inner > div").prepend(previewLoginButton);
function updateCompactAccountHeader() {
  const show = previewSignedIn && pageHeader.getBoundingClientRect().bottom <= 0;
  compactAccountHeader.hidden = !show;
  document.body.classList.toggle("has-compact-account-header", show);
}
function updatePreviewSession() {
  previewLoginButton.textContent = previewSignedIn ? "Thoát đăng nhập mẫu" : "Thử đăng nhập mẫu";
  previewLoginButton.setAttribute("aria-pressed", String(previewSignedIn));
  updateCompactAccountHeader();
}
previewLoginButton.addEventListener("click", () => {
  previewSignedIn = !previewSignedIn;
  try {
    sessionStorage.setItem(previewSessionKey, String(previewSignedIn));
  } catch {}
  updatePreviewSession();
});
window.addEventListener("scroll", updateCompactAccountHeader, { passive: true });
window.addEventListener("resize", updateCompactAccountHeader);
updatePreviewSession();
