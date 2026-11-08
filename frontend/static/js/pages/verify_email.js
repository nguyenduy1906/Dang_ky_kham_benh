import { apiRequest } from '../core/api.js';
let token = new URLSearchParams(location.hash.slice(1)).get('token');
history.replaceState(null, '', location.pathname);
const button = document.querySelector('#verify-email');
const status = document.querySelector('#verification-status');
if (!token || token.length > 200) {
  token = null;
  button.hidden = true;
  status.textContent = 'Liên kết xác minh không hợp lệ. Vui lòng mở lại liên kết trong email.';
}
button.addEventListener('click', async () => {
  if (!token || button.disabled) return;
  button.disabled = true;
  status.textContent = 'Đang xác minh email…';
  try {
    const result = await apiRequest('/auth/email-verification/confirm', {method: 'POST', auth: false, data: {token}});
    status.textContent = result.message;
    token = null;
    button.hidden = true;
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
});
