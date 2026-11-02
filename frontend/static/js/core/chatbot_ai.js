// The page supplies restored context; AI requests remain limited to six completed exchanges.
export function createDemoAssistant({ askAI, createBasic, initialHistory = [] }) {
  const basic = createBasic();
  const history = initialHistory.slice(-12).map(item => ({ ...item }));
  return async message => {
    try {
      const reply = await askAI(message, history.map(item => ({ ...item })));
      if (!reply || !['ai', 'guide', 'basic'].includes(reply.mode) || typeof reply.text !== 'string' || !reply.text.trim() || !Array.isArray(reply.links)) {
        throw new Error('Invalid AI response');
      }
      const answer = reply.mode === 'basic' ? { ...await basic(message), mode:'basic', reason:reply.reason } : reply;
      remember(message, answer.text);
      return { ...answer, modeLabel: reply.mode === 'basic' ? basicLabel(reply.reason) : reply.mode === 'ai' ? `NEU Medical · ${reply.provider === 'gemini' ? 'Gemini' : 'AI'}` : 'NEU Medical · Hướng dẫn' };
    } catch (error) {
      if ([400, 413, 429].includes(error.status)) {
        return { text: error.message, links: [], modeLabel: 'NEU Medical · Thông báo' };
      }
      const reply = await basic(message);
      remember(message, reply.text);
      return { ...reply, modeLabel: basicLabel(error.code) };
    }
  };
  function remember(message, text) {
    history.push({ role:'user', content:message.slice(0,500) }, { role:'assistant', content:text.slice(0,1200) });
    history.splice(0, Math.max(0, history.length-12));
  }
}
function basicLabel(code) {
  const reasons = { AI_NOT_CONFIGURED: 'AI chưa cấu hình', AI_QUOTA_EXCEEDED: 'AI hết hạn mức hoặc chưa bật thanh toán', AI_AUTH_ERROR: 'Cần kiểm tra khóa AI', AI_MODEL_UNAVAILABLE: 'Model AI chưa khả dụng', AI_CONFIG_ERROR: 'Cần kiểm tra cấu hình AI', AI_RATE_LIMIT: 'AI đang giới hạn lượt hỏi', AI_TIMEOUT: 'AI phản hồi chậm' };
  return `Tra cứu cơ bản · ${reasons[code] || 'AI chưa sẵn sàng'}`;
}
