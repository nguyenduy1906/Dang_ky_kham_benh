import { createAssistant } from '../core/chatbot.js';
import { listDepartments } from '../api/catalog.js';
import { listDoctors } from '../api/doctor.js';
import { getContactInfo } from '../api/configuration.js';
import { createDemoAssistant } from '../core/chatbot_ai.js';
import { sendChatMessage } from '../api/chatbot.js';

const widget = document.createElement('aside');
widget.className = 'neu-chat';
widget.setAttribute('aria-label', 'Hỗ trợ khách hàng');
widget.innerHTML = `
  <section class="neu-chat-panel" id="neu-chat-panel" aria-labelledby="neu-chat-title" hidden>
    <header class="neu-chat-header"><span class="neu-chat-avatar" aria-hidden="true">✦</span><div><h2 id="neu-chat-title">Trợ lý NEU Medical · AI demo</h2><p>Thông tin khám bệnh & hỗ trợ đặt lịch</p></div><button type="button" class="neu-chat-close" aria-label="Đóng trò chuyện">×</button></header>
    <p class="neu-chat-notice">Khi AI hoạt động, câu hỏi và tối đa 3 lượt hội thoại được gửi tới OpenAI để trả lời. Không gửi thông tin cá nhân. AI có thể trả lời sai; không thay thế tư vấn bác sĩ.</p>
    <div class="neu-chat-messages" role="log" aria-label="Nội dung trò chuyện" aria-live="polite" aria-relevant="additions" tabindex="0"></div>
    <div class="neu-chat-prompts" aria-label="Câu hỏi gợi ý"><button type="button">Chuyên khoa</button><button type="button">Bác sĩ và phí khám</button><button type="button">Hướng dẫn đặt lịch</button><button type="button">Giờ khám và liên hệ</button></div>
    <p class="neu-chat-status" role="status"></p>
    <form class="neu-chat-form" data-workflow="ignore"><label class="neu-chat-sr" for="neu-chat-input">Câu hỏi của bạn</label><input id="neu-chat-input" maxlength="500" required autocomplete="off" placeholder="Nhập câu hỏi của bạn…"><button type="submit" aria-label="Gửi câu hỏi">➤</button></form>
    <div class="neu-chat-footer"><span>Không gửi mật khẩu, OTP hoặc bệnh án.</span><button type="button" class="neu-chat-reset">Xóa hội thoại</button></div>
  </section>
  <button type="button" class="neu-chat-launcher" aria-expanded="false" aria-controls="neu-chat-panel"><span aria-hidden="true">✦</span> Hỗ trợ trực tuyến</button>`;
document.body.append(widget);
const panel = widget.querySelector('.neu-chat-panel');
const launcher = widget.querySelector('.neu-chat-launcher');
const input = widget.querySelector('input');
const messages = widget.querySelector('.neu-chat-messages');
const status = widget.querySelector('.neu-chat-status');
const controls = [...widget.querySelectorAll('.neu-chat-form button, .neu-chat-prompts button, .neu-chat-reset')];
const api = {
  departments: () => listDepartments({}, { auth: false, timeoutMs: 8000 }),
  doctors: params => listDoctors(params, { auth: false, timeoutMs: 8000 }),
  contact: () => getContactInfo({ auth: false, timeoutMs: 8000 }),
};
const newAssistant = () => createDemoAssistant({ askAI: sendChatMessage, createBasic: () => createAssistant(api) });
let answer = newAssistant();
let busy = false;
function append(text, user = false, links = [], modeLabel = 'NEU Medical') {
  const bubble = document.createElement('div');
  bubble.className = `neu-chat-message ${user ? 'neu-chat-user' : 'neu-chat-bot'}`;
  const label = document.createElement('strong'); label.textContent = user ? 'Bạn' : modeLabel;
  const body = document.createElement('p'); body.textContent = text;
  bubble.append(label, body);
  for (const item of links) {
    const a = document.createElement('a'); a.textContent = item.label; a.href = item.href; bubble.append(a);
  }
  messages.append(bubble);
  // Keep conversation only in memory and bound its size.
  while (messages.children.length > 60) messages.firstElementChild.remove();
  messages.scrollTop = messages.scrollHeight;
}
function welcome() { append('Xin chào! Tôi là trợ lý NEU Medical. Tôi giúp bạn tra cứu chuyên khoa, bác sĩ, phí khám và hướng dẫn đặt lịch. Bạn cần hỗ trợ gì hôm nay?'); }
function toggle(open) {
  panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open));
  if (open) input.focus(); else launcher.focus();
}
launcher.addEventListener('click', () => toggle(panel.hidden));
widget.querySelector('.neu-chat-close').addEventListener('click', () => toggle(false));
widget.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); toggle(false); } });
async function send(text) {
  text = text.trim().slice(0, 500);
  if (!text || busy) return;
  busy = true; controls.forEach(node => { node.disabled = true; });
  input.value = ''; append(text, true); status.textContent = 'Đang tìm thông tin…';
  try { const reply = await answer(text); append(reply.text, false, reply.links, reply.modeLabel); }
  catch { append('Có lỗi khi xử lý câu hỏi. Bạn vui lòng thử lại.'); }
  finally { busy = false; controls.forEach(node => { node.disabled = false; }); status.textContent = ''; }
}
widget.querySelector('form').addEventListener('submit', event => { event.preventDefault(); send(input.value); });
widget.querySelectorAll('.neu-chat-prompts button').forEach(button => button.addEventListener('click', () => send(button.textContent)));
widget.querySelector('.neu-chat-reset').addEventListener('click', () => { messages.replaceChildren(); answer = newAssistant(); welcome(); input.focus(); });
welcome();
