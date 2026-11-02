import { apiRequest } from '../core/api.js';

export function sendChatMessage(message, history = []) {
  return apiRequest('/chatbot/message', {
    method: 'POST', auth: false, timeoutMs: 45000, data: { message, history },
  });
}
