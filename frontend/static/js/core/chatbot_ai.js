// Conversation stays in this tab. No localStorage, cookies or persisted response IDs.
export function createDemoAssistant({ askAI, createBasic }) {
  const basic = createBasic();
  const history = [];
  return async message => {
    try {
      const reply = await askAI(message, history.map(item => ({ ...item })));
      if (!reply || !['ai', 'guide', 'basic'].includes(reply.mode) || typeof reply.text !== 'string' || !reply.text.trim() || !Array.isArray(reply.links)) {
        throw new Error('Invalid AI response');
      }
      if (reply.mode === 'ai' || reply.mode === 'basic') {
        history.push({ role: 'user', content: message.slice(0, 500) }, { role: 'assistant', content: reply.text.slice(0, 2000) });
        history.splice(0, Math.max(0, history.length - 6));
      }
      return { ...reply, modeLabel: reply.mode === 'basic' ? basicLabel(reply.reason) : reply.mode === 'ai' ? 'NEU Medical · AI' : 'NEU Medical · Hướng dẫn' };
    } catch (error) {
      if ([400, 413, 429].includes(error.status)) {
        return { text: error.message, links: [], modeLabel: 'NEU Medical · Thông báo' };
      }
      const reply = await basic(message);
      return { ...reply, modeLabel: basicLabel(error.code) };
    }
  };
}
function basicLabel(code) {
  const reasons = { AI_NOT_CONFIGURED: 'AI chưa cấu hình', AI_QUOTA_EXCEEDED: 'AI hết hạn mức', AI_AUTH_ERROR: 'Cần kiểm tra khóa AI' };
  return `Tra cứu cơ bản · ${reasons[code] || 'AI chưa sẵn sàng'}`;
}
