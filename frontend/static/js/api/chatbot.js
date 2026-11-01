import { apiRequest } from '../core/api.js';

export function sendChatMessage(message, history = []) {
  return apiRequest('/chatbot/message', {
    method: 'POST', auth: false, timeoutMs: 25000, data: { message, history },
  });
}
