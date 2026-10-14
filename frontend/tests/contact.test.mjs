import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initContactInfo } from "../static/js/core/contact-info.js";
import { setAccessToken } from "../static/js/core/api.js";

class Node {
  children = []; dataset = {}; textContent = ""; value = ""; hidden = false; disabled = false; listeners = {};
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  replaceChildren(...children) { this.children = children; }
}
const tick = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
let calls, respond, nodes, fields, retry, status, root, instance = 0;
beforeEach(() => {
  calls = []; nodes = new Map(); fields = Array.from({length: 3}, () => {
    const node = new Node(); node.dataset.contactField = 'support_phone'; return node;
  });
  retry = new Node(); status = new Node();
  root = {
    querySelector: () => fields[0],
    querySelectorAll: selector => ({'[data-contact-field]': fields, '[data-contact-status]': [status],
      '[data-contact-retry]': [retry], '[data-contact-missing]': []})[selector] || [],
  };
  globalThis.window = new EventTarget();
  setAccessToken('private-token-never-sent');
  respond = () => Response.json({hospital_name: 'NEU', support_phone: '19001234', support_email: null, exam_hours: null});
  globalThis.fetch = async (url, options) => { calls.push({url: new URL(url), options}); return respond(); };
});

test('contact information updates all repeated fields without an authorization token', async () => {
  initContactInfo(root); await tick();
  assert.deepEqual(fields.map(node => node.textContent), ['19001234', '19001234', '19001234']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/contact-info');
  assert.equal(calls[0].options.headers.has('Authorization'), false);
});

test('failed contact requests clear stale data and offer a retry rather than fabricated values', async () => {
  respond = () => Response.json({error: {message: 'Backend lỗi'}}, {status: 500});
  initContactInfo(root); await tick();
  assert.equal(fields[0].textContent, 'Chưa tải được');
  assert.equal(retry.hidden, false);
  assert.match(status.textContent, /Backend lỗi/);
  respond = () => Response.json({hospital_name: 'NEU', support_phone: null, support_email: null, exam_hours: null});
  retry.listeners.click[0](); await tick();
  assert.equal(fields[0].textContent, 'Đang cập nhật');
  assert.equal(retry.hidden, true);
});

async function contactController() {
  for (const selector of ['#consultation-form', '#consultation-name', '#consultation-phone', '#consultation-status',
    '#consultation-specialty', '#consultation-specialty-status', '#consultation-specialty-retry']) nodes.set(selector, new Node());
  globalThis.document = {querySelector: selector => nodes.get(selector), querySelectorAll: () => [], createElement: () => new Node()};
  globalThis.location = new URL('http://localhost:3000/frontend/templates/public/contact.html');
  const file = new URL('../static/js/pages/contact.js', import.meta.url);
  const source = (await readFile(file, 'utf8')).replace(/from "(\.\.[^"]+)"/g, (_, path) => `from ${JSON.stringify(new URL(path, file).href)}`);
  await import(`data:text/javascript;base64,${Buffer.from(source + `\n// instance ${instance++}`).toString('base64')}`);
  await tick();
}

test('consultation specialties use actual API ids; failures retry without sample options', async () => {
  respond = () => Response.json({error: {message: 'Chưa có kết nối'}}, {status: 503});
  await contactController();
  const select = nodes.get('#consultation-specialty');
  assert.equal(select.disabled, true);
  assert.equal(select.children.length, 1);
  respond = () => Response.json({items: [{department_id: 42, name: '<b>Tim mạch</b>'}]});
  nodes.get('#consultation-specialty-retry').listeners.click[0](); await tick();
  assert.equal(select.disabled, false);
  assert.equal(select.children[1].value, '42');
  assert.equal(select.children[1].textContent, '<b>Tim mạch</b>');
  assert.equal(calls.at(-1).url.pathname, '/departments');
  assert.equal(calls.at(-1).options.headers.has('Authorization'), false);
  assert.ok(calls.every(call => call.options.method === 'GET'), 'No consultation is submitted');
});

test('empty specialties remain optional and do not invent departments', async () => {
  respond = () => Response.json({items: []}); await contactController();
  assert.equal(nodes.get('#consultation-specialty').children.length, 1);
  assert.equal(nodes.get('#consultation-specialty').disabled, true);
  assert.match(nodes.get('#consultation-specialty-status').textContent, /chưa có chuyên khoa/);
});
