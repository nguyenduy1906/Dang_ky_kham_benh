// Public directory assistant. All hospital facts come from the supplied API adapter.
export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const booking = { label: 'Đặt lịch khám', href: '../(patient)/portal.html' };
const contact = { label: 'Liên hệ nhân viên', href: 'contact.html' };
const link = (label, page, id) => ({ label, href: `${page}.html?id=${encodeURIComponent(id)}` });
const result = (text, links = []) => ({ text, links });
const contains = (text, words) => words.some(word => text.includes(word));
const fee = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
  ? `${Number(value).toLocaleString('vi-VN')} đồng` : 'Chưa cập nhật phí khám';

export function createAssistant(api) {
  let departmentId;
  return async function answer(message) {
    const q = normalize(message);
    if (!q) return result('Bạn muốn tìm hiểu thông tin gì?');
    if (contains(q, ['cap cuu', 'kho tho', 'dau nguc', 'bat tinh', 'tu tu', 'tu sat'])) {
      return result('Nếu bạn hoặc người thân đang gặp nguy hiểm, hãy nhờ người ở gần hỗ trợ và đến cơ sở cấp cứu ngay. Chatbot không thể đánh giá tình trạng khẩn cấp.', [contact]);
    }
    if (contains(q, ['trieu chung', 'chan doan', 'uong thuoc', 'dau bung', 'sot', 'benh gi', 'dieu tri'])) {
      return result('Tôi hỗ trợ thông tin khám bệnh, không chẩn đoán hoặc kê thuốc. Bạn có thể đặt khám để bác sĩ đánh giá trực tiếp.', [booking, contact]);
    }
    if (contains(q, ['ho so', 'ket qua', 'benh an', 'lich cua toi', 'mat khau', 'otp'])) {
      return result('Để bảo vệ thông tin cá nhân, hãy đăng nhập cổng bệnh nhân để xem hồ sơ và lịch hẹn. Không gửi mật khẩu, OTP hay bệnh án trong chat.', [{ label: 'Cổng bệnh nhân', href: '../(patient)/portal.html' }]);
    }
    if (contains(q, ['dat lich', 'dat kham', 'dang ky kham', 'lich trong', 'lich kham', 'huy lich', 'doi lich'])) {
      return result('Mở cổng bệnh nhân, đăng nhập và chọn người khám, chuyên khoa, bác sĩ cùng ca còn chỗ. Kiểm tra thông tin và xác nhận theo hướng dẫn trên trang. Tình trạng ca và số tiền cần thanh toán được hiển thị tại bước đặt khám.', [booking]);
    }
    if (contains(q, ['lien he', 'hotline', 'dien thoai', 'email', 'gio', 'mo cua', 'lam viec', 'dia chi'])) {
      try {
        const data = await api.contact();
        return result([data.hospital_name || 'NEU Medical', `Điện thoại: ${data.support_phone || 'Chưa cập nhật'}`, `Email: ${data.support_email || 'Chưa cập nhật'}`, `Giờ khám: ${data.exam_hours || 'Chưa cập nhật'}`, 'Xem địa chỉ và bản đồ tại trang liên hệ.'].join('\n'), [contact]);
      } catch { return unavailable(); }
    }
    if (contains(q, ['xin chao', 'chao', 'hello', 'cam on'])) return result('Xin chào! Tôi có thể giúp bạn tìm chuyên khoa, bác sĩ, phí khám, giờ làm việc và hướng dẫn đặt lịch. Bạn cần hỗ trợ gì?');
    try {
      const departments = (await api.departments()).items;
      if (!Array.isArray(departments)) throw new Error('Invalid directory');
      const matched = departments.filter(d => {
        const name = normalize(d.name).replace(/^(khoa|chuyen khoa) /, '');
        return name && (q.includes(name) || (q.length >= 3 && name.includes(q)));
      }).sort((a, b) => normalize(b.name).length - normalize(a.name).length)[0];
      if (matched) departmentId = matched.department_id;
      const wantsDoctors = contains(q, ['bac si', 'bs ', 'phi', 'gia', 'bao nhieu', 'chi phi']);
      if (wantsDoctors || (!matched && !contains(q, ['chuyen khoa', 'cac khoa', 'khoa nao']))) {
        const search = q.replace(/\b(tim|bac si|bs|phi kham|gia kham|chi phi|bao nhieu|cho toi|toi muon|xem|cua|ten|la|va|o do|khoa nay)\b/g, ' ').replace(/\s+/g, ' ').trim();
        const useContext = departmentId && (matched || !search || contains(q, ['o do', 'khoa nay']));
        const query = { page_size: 6, ...(useContext ? { department_id: departmentId } : {}) };
        const nameSearch = !matched && !useContext && search;
        let data;
        if (nameSearch) {
          // Match locally so Vietnamese names work with and without accents.
          const found = [];
          let page = 1;
          while (true) {
            const batch = await api.doctors({ page_size: 100, page });
            if (!Array.isArray(batch.items)) throw new Error('Invalid doctors');
            found.push(...batch.items.filter(d => normalize(`${d.full_name} ${d.specialization || ''}`).includes(search)));
            if (found.length >= 6 || batch.items.length < 100 || page * 100 >= batch.total) break;
            page++;
          }
          data = { items: found.slice(0, 6) };
        } else data = await api.doctors(query);
        if (!Array.isArray(data.items)) throw new Error('Invalid doctors');
        if (!data.items.length) return result('Chưa tìm thấy bác sĩ phù hợp. Bạn thử nhập tên bác sĩ hoặc tên chuyên khoa đầy đủ nhé.', [{ label: 'Xem danh sách bác sĩ', href: 'doctors.html' }]);
        return result(`Thông tin bác sĩ${useContext ? ' thuộc chuyên khoa đã chọn' : ''} từ hệ thống:\n` + data.items.map(d => `${d.full_name} — ${d.department_name || d.specialization || 'Chuyên môn đang cập nhật'}\nPhí khám: ${fee(d.consultation_fee)}`).join('\n\n') + '\n\nPhí trên là phí khám được niêm yết; xem bước đặt lịch để biết khoản thanh toán cụ thể.', [...data.items.map(d => link(d.full_name, 'doctor_detail', d.doctor_profile_id)), { label: 'Xem tất cả bác sĩ', href: 'doctors.html' }, booking]);
      }
      if (matched) return result(`${matched.name}\n${matched.description || 'Xem thông tin chi tiết chuyên khoa bên dưới.'}\n\nBạn có thể hỏi tiếp “Bác sĩ và phí khám” để xem bác sĩ của chuyên khoa này.`, [link('Chi tiết chuyên khoa', 'department_detail', matched.department_id), booking]);
      departmentId = undefined;
      return result(departments.length ? `Các chuyên khoa đang hoạt động:\n${departments.slice(0, 12).map(d => `• ${d.name}`).join('\n')}\n\nNhập tên chuyên khoa để tìm hiểu thêm.` : 'Hệ thống chưa có chuyên khoa để hiển thị.', [{ label: 'Tất cả chuyên khoa', href: 'departments.html' }]);
    } catch { return unavailable(); }
  };
}
function unavailable() {
  return result('Hiện chưa lấy được dữ liệu từ bệnh viện. Bạn vui lòng thử lại câu hỏi sau hoặc liên hệ nhân viên hỗ trợ.', [contact, booking]);
}
