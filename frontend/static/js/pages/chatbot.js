import { createAssistant } from '../core/chatbot.js';
import { listDepartments } from '../api/catalog.js';
import { listDoctors } from '../api/doctor.js';
import { getContactInfo } from '../api/configuration.js';
import { createDemoAssistant } from '../core/chatbot_ai.js';
import { sendChatMessage } from '../api/chatbot.js';
import { hasSession } from '../core/session.js';

import { CONVERSATION_KEY, loadConversation, saveConversation, clearConversation, emptyConversation, conversationHistory } from '../core/chatbot_conversation.js';
import { pause, revealText } from '../core/chatbot_typing.js';
import { chatLayout, isChatPage, LAUNCHER_SIZE } from '../core/chatbot_position.js';

if (isChatPage(location.href) && !document.querySelector('.neu-chat')) mountChatbot();

function mountChatbot() {
  const publicBase = new URL('../../../templates/public/', import.meta.url);
  const logo = new URL('../../assets/bieu_trung_neu.png', import.meta.url).href;
  const widget = document.createElement('aside');
  widget.className = 'neu-chat';
  widget.setAttribute('aria-label', 'Hỗ trợ khách hàng');
  widget.innerHTML = `
    <section class="neu-chat-panel" id="neu-chat-panel" aria-labelledby="neu-chat-title" hidden>
      <header class="neu-chat-header"><span class="neu-chat-avatar" aria-hidden="true">✦</span><div><h2 id="neu-chat-title">Trợ lý NEU Medical</h2><p>Tìm nơi khám & hỗ trợ đặt lịch</p></div><button type="button" class="neu-chat-close" aria-label="Đóng trò chuyện">×</button></header>
      <div class="neu-chat-messages" role="log" aria-label="Nội dung trò chuyện" aria-live="polite" aria-relevant="additions" tabindex="0"></div>
      <p class="neu-chat-status" role="status"></p>
      <form class="neu-chat-form" data-workflow="ignore"><label class="neu-chat-sr" for="neu-chat-input">Câu hỏi của bạn</label><input id="neu-chat-input" maxlength="500" required autocomplete="off" placeholder="Nhập câu hỏi của bạn…"><button type="submit" aria-label="Gửi câu hỏi">➤</button></form>
      <div class="neu-chat-footer"><button type="button" class="neu-chat-reset">Xóa hội thoại</button></div>
    </section>
    <button type="button" class="neu-chat-launcher" aria-label="Hỗ trợ trực tuyến" title="Hỗ trợ trực tuyến · Kéo để di chuyển" aria-expanded="false" aria-controls="neu-chat-panel"><img src="${logo}" alt="" draggable="false"></button>`;
  document.body.append(widget);
  const panel = widget.querySelector('.neu-chat-panel');
  const launcher = widget.querySelector('.neu-chat-launcher');
  const input = widget.querySelector('input');
  const messages = widget.querySelector('.neu-chat-messages');
  const status = widget.querySelector('.neu-chat-status');
  const controls = [...widget.querySelectorAll('.neu-chat-form button, .neu-chat-reset')];
  const api = {
    departments: params => listDepartments(params, { auth: false, timeoutMs: 8000 }),
    doctors: params => listDoctors(params, { auth: false, timeoutMs: 8000 }),
    contact: () => getContactInfo({ auth: false, timeoutMs: 8000 }),
  };
  let storage;
  try { window.localStorage.removeItem(CONVERSATION_KEY); } catch { /* Remove legacy history. */ }
  try { storage = window.sessionStorage; } catch { /* Storage may be disabled. */ }
  hasSession(); // Expired sign-ins must clear history before it can be restored.
  let conversation = loadConversation(storage);
  let storageFailed = false;
  function persist() { storageFailed = !saveConversation(storage, conversation); }
  function rememberMessage(text, user = false, links = [], modeLabel = 'NEU Medical') {
    conversation.messages.push({ role: user ? 'user' : 'assistant', text, links, modeLabel });
    persist();
  }
  const newAssistant = () => createDemoAssistant({ askAI: sendChatMessage, createBasic: () => createAssistant(api), initialHistory: conversationHistory(conversation.messages) });
  let answer = newAssistant();
  let busy = false;
  let conversationVersion = 0;
  function append(text, user = false, links = [], modeLabel = 'NEU Medical') {
    const bubble = document.createElement('div');
    bubble.className = `neu-chat-message ${user ? 'neu-chat-user' : 'neu-chat-bot'}`;
    const label = document.createElement('strong'); label.textContent = user ? 'Bạn' : modeLabel;
    const body = document.createElement('p'); body.textContent = text;
    bubble.append(label, body);
    appendLinks(bubble, links);
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
    return { bubble, body };
  }
  function appendLinks(bubble, links = []) {
    for (const item of links) {
      const url = new URL(item.href, publicBase);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      const a = document.createElement('a'); a.textContent = item.label; a.href = url.href;
      if (item.href.startsWith('https://')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      bubble.append(a);
    }
  }
  function setThinking(active) {
    status.replaceChildren();
    status.classList.toggle('neu-chat-thinking', active);
    if (!active) return;
    status.append(document.createTextNode('AI đang suy nghĩ'));
    const dots = document.createElement('span');
    dots.className = 'neu-chat-thinking-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.innerHTML = '<i></i><i></i><i></i>';
    status.append(dots);
  }
  async function showReply(reply, version) {
    setThinking(false);
    status.textContent = 'AI đang trả lời…';
    messages.setAttribute('aria-busy', 'true');
    const { bubble, body } = append('', false, [], reply.modeLabel);
    bubble.classList.add('neu-chat-typing');
    try {
      await revealText(reply.text, {
        instant: () => version !== conversationVersion || panel.hidden || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches,
        write: text => {
          if (version !== conversationVersion) return;
          // Follow new text only while the reader is already near the bottom.
          const follow = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 64;
          body.textContent = text;
          if (follow) messages.scrollTop = messages.scrollHeight;
        },
      });
      if (version !== conversationVersion) return;
      appendLinks(bubble, reply.links);
      if (messages.scrollHeight - messages.scrollTop - messages.clientHeight < 100) messages.scrollTop = messages.scrollHeight;
    } finally {
      bubble.classList.remove('neu-chat-typing');
      messages.setAttribute('aria-busy', 'false');
    }
  }
  function welcome() { append('Chào bạn! Bạn đang cần tìm nơi khám, tìm bác sĩ hay hỏi cách đặt lịch? Cứ mô tả theo cách của bạn, tôi sẽ hỏi thêm nếu cần.', false, [], 'Trợ lý NEU Medical'); }
  function toggle(open) {
    panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open));
    positionWidget();
    conversation.open = open; persist();
    if (open) input.focus({ preventScroll: true }); else launcher.focus({ preventScroll: true });
  }
  // Launcher position remains a separate UI preference.
  const positionKey = 'neu-medical.chat-position';
  let position = { x: innerWidth - LAUNCHER_SIZE - 24, y: innerHeight - LAUNCHER_SIZE - 22 };
  try {
    const saved = JSON.parse(sessionStorage.getItem(positionKey));
    if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) position = saved;
  } catch { /* The widget also works when storage is disabled. */ }
  function positionWidget() {
    const layout = chatLayout(position, innerWidth, innerHeight);
    position = { x: layout.x, y: layout.y };
    widget.style.left = `${layout.x}px`;
    widget.style.top = `${layout.y}px`;
    panel.style.left = `${layout.panelLeft}px`;
    panel.style.top = `${layout.panelTop}px`;
    panel.style.width = `${layout.panelWidth}px`;
    panel.style.height = `${layout.panelHeight}px`;
  }
  function rememberPosition() {
    try { sessionStorage.setItem(positionKey, JSON.stringify(position)); } catch { /* Optional preference. */ }
  }
  let drag = null;
  let suppressClick = false;
  launcher.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: position.x, y: position.y, moved: false };
    launcher.setPointerCapture(event.pointerId);
  });
  launcher.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    widget.classList.add('neu-chat-dragging');
    position = { x: drag.x + dx, y: drag.y + dy };
    positionWidget();
  });
  function finishDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    suppressClick = drag.moved;
    // Ignore only the click generated by this drag, not the next deliberate click.
    window.setTimeout(() => { suppressClick = false; }, 0);
    drag = null;
    widget.classList.remove('neu-chat-dragging');
    if (launcher.hasPointerCapture(event.pointerId)) launcher.releasePointerCapture(event.pointerId);
    rememberPosition();
  }
  launcher.addEventListener('pointerup', finishDrag);
  launcher.addEventListener('pointercancel', finishDrag);
  launcher.addEventListener('lostpointercapture', finishDrag);
  launcher.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
    suppressClick = false;
    toggle(panel.hidden);
  });
  window.addEventListener('resize', positionWidget);
  window.visualViewport?.addEventListener('resize', positionWidget);
  positionWidget();
  widget.querySelector('.neu-chat-close').addEventListener('click', () => toggle(false));
  widget.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); toggle(false); } });
  async function send(text) {
    text = text.trim().slice(0, 500);
    if (!text || busy) return;
    const version = conversationVersion;
    busy = true; controls.forEach(node => { node.disabled = true; });
    input.value = ''; conversation.draft = ''; conversation.pending = text;
    rememberMessage(text, true); append(text, true); setThinking(true);
    try {
      // Minimum thinking time runs alongside the request, never adds to a slow API call.
      const [reply] = await Promise.all([answer(text), pause(700)]);
      if (version !== conversationVersion) return;
      // Save the complete answer before animating so navigation cannot lose its tail.
      conversation.pending = null;
      rememberMessage(reply.text, false, reply.links, reply.modeLabel);
      await showReply(reply, version);
    }
    catch {
      if (version !== conversationVersion) return;
      const error = 'Có lỗi khi xử lý câu hỏi. Bạn vui lòng thử lại.';
      conversation.pending = null; rememberMessage(error); append(error);
    }
    finally { if (version === conversationVersion) { busy = false; controls.forEach(node => { node.disabled = false; }); setThinking(false);
      if (storageFailed) status.textContent = 'Trình duyệt chưa lưu được hội thoại. Tin nhắn có thể mất khi chuyển trang.';
    } }
  }
  widget.querySelector('form').addEventListener('submit', event => { event.preventDefault(); send(input.value); });
  input.addEventListener('input', () => { conversation.draft = input.value; persist(); });
  widget.querySelector('.neu-chat-reset').addEventListener('click', () => {
    const open = !panel.hidden;
    conversationVersion++;
    const cleared = clearConversation(storage);
    conversation = emptyConversation(); conversation.open = open;
    messages.replaceChildren(); answer = newAssistant(); input.value = ''; welcome();
    persist();
    status.textContent = !cleared && storageFailed ? 'Trình duyệt chưa xóa được dữ liệu đã lưu. Vui lòng thử lại.' : '';
    input.focus();
  });
  function restoreConversation() {
    hasSession();
    conversationVersion++;
    conversation = loadConversation(storage);
    busy = false; controls.forEach(node => { node.disabled = false; });
    setThinking(false); messages.replaceChildren(); messages.setAttribute('aria-busy', 'false');
    answer = newAssistant();
    if (conversation.messages.length) {
      for (const item of conversation.messages) append(item.text, item.role === 'user', item.links, item.modeLabel);
    } else welcome();
    input.value = conversation.draft || conversation.pending || '';
    panel.hidden = !conversation.open;
    launcher.setAttribute('aria-expanded', String(conversation.open));
    if (conversation.pending) status.textContent = 'Câu hỏi trước chưa có phản hồi khi chuyển trang. Bạn có thể gửi lại để tiếp tục.';
    positionWidget();
  }
  // Browser Back may restore an old DOM; always reconcile it with the saved conversation.
  window.addEventListener('pageshow', event => { if (event.persisted) restoreConversation(); });
  window.addEventListener('storage', event => {
    if (event.storageArea === storage && (event.key === CONVERSATION_KEY || event.key === null)) restoreConversation();
  });
  window.addEventListener('neu:auth-change', restoreConversation);
  // Detect expiry even while the user leaves the chat open without an API request.
  let sessionCheck = window.setInterval(() => hasSession(), 1000);
  window.addEventListener('pagehide', () => {
    conversationVersion++;
    window.clearInterval(sessionCheck);
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) sessionCheck = window.setInterval(() => hasSession(), 1000);
  });
  restoreConversation();
}
