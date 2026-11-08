export const CONVERSATION_KEY = 'neu-medical.chat-conversation';

// Clear both the current tab and the persistent store used by older versions.
export function clearBrowserConversation() {
  for (const name of ['sessionStorage', 'localStorage']) {
    try { clearConversation(globalThis[name]); } catch { /* Storage may be disabled. */ }
  }
}

export function emptyConversation() {
  return { version: 1, messages: [], pending: null, open: false, draft: '' };
}

export function loadConversation(storage) {
  try {
    const value = JSON.parse(storage.getItem(CONVERSATION_KEY));
    if (value?.version !== 1 || !Array.isArray(value.messages)) return emptyConversation();
    const messages = value.messages.filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.text === 'string').map(item => ({
      role: item.role, text: item.text,
      modeLabel: typeof item.modeLabel === 'string' ? item.modeLabel : 'NEU Medical',
      links: Array.isArray(item.links) ? item.links.filter(link => link && typeof link.label === 'string' && typeof link.href === 'string') : [],
    }));
    return { version: 1, messages, pending: typeof value.pending === 'string' ? value.pending : null, open: value.open === true, draft: typeof value.draft === 'string' ? value.draft.slice(0, 500) : '' };
  } catch { return emptyConversation(); }
}

export function saveConversation(storage, conversation) {
  try { storage.setItem(CONVERSATION_KEY, JSON.stringify(conversation)); return true; }
  catch { return false; }
}

export function clearConversation(storage) {
  try { storage.removeItem(CONVERSATION_KEY); return true; }
  catch { return false; }
}

// Keep the complete visible transcript, but send only six completed exchanges to AI.
export function conversationHistory(messages) {
  const history = [];
  let user;
  for (const message of messages) {
    if (message.role === 'user') user = message.text;
    else if (user !== undefined) {
      history.push({ role: 'user', content: user.slice(0, 500) }, { role: 'assistant', content: message.text.slice(0, 6000) });
      user = undefined;
    }
  }
  return history.slice(-12);
}
