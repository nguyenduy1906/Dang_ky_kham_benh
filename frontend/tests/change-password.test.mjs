import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
class Node {
  value = ""; disabled = false; listeners = {}; dataset = {}; textContent = ""; validation = "";
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  setCustomValidity(value) { this.validation = value; }
  focus() {}
  showModal() { this.open = true; }
  close() { if (!this.open) return; this.open = false; this.listeners.close?.forEach(fn => fn()); }
}
let nodes, stored, calls, reply, instance = 0;
const tick = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setImmediate(r)); };
const fire = (id, event = "click") => nodes.get(id).listeners[event][0]({ preventDefault() {} });
beforeEach(() => {
  nodes = new Map(); calls = []; stored = new Map();
  for (const id of ["change-password-dialog", "change-password-form", "profile-change-password", "change-password-close", "change-password-submit", "password-current", "password-new", "password-confirm", "change-password-status", "profile-password-message"]) nodes.set(id, new Node());
  nodes.get("change-password-form").reportValidity = () => ["password-current", "password-new", "password-confirm"].every(id => nodes.get(id).value && !nodes.get(id).validation);
  globalThis.document = { querySelector: selector => nodes.get(selector.slice(1)) };
  globalThis.window = new EventTarget(); globalThis.location = new URL("http://localhost:3000/frontend/templates/(patient)/profile.html");
  globalThis.sessionStorage = { getItem: key => stored.get(key) || null, setItem: (k,v) => stored.set(k,v), removeItem: k => stored.delete(k) };
  stored.set("neu-medical.auth", JSON.stringify({ token: "password-test", expiresAt: Date.now() + 60000 }));
  reply = () => Response.json({ access_token: "updated-token", token_type: "Bearer", expires_in: 7200 });
  globalThis.fetch = async (url, options) => { calls.push({ path: new URL(url).pathname, options }); return new URL(url).pathname === "/me" ? Response.json({ user: { user_id: 1, role_name: "USER" } }) : reply(); };
});
async function controller() {
  const file = new URL("../static/js/pages/change_password.js", import.meta.url);
  const source = (await readFile(file,"utf8")).replace(/from "(\.\.[^"]+)"/g, (_,p)=>`from ${JSON.stringify(new URL(p,file).href)}`);
  await import(`data:text/javascript;base64,${Buffer.from(source+`\n//${instance++}`).toString("base64")}`);
  await fire("profile-change-password"); await tick();
}
function passwords(a="Old-password-123",b="New-password-123",c=b) { nodes.get("password-current").value=a;nodes.get("password-new").value=b;nodes.get("password-confirm").value=c; }
test("password confirmation mismatch never sends a change request", async()=>{
  await controller(); passwords(undefined,undefined,"Mismatch-123"); await fire("change-password-form","submit");
  assert.match(nodes.get("password-confirm").validation,/chưa khớp/); assert.equal(calls.some(c=>c.path==="/me/change-password"),false);
});
test("successful password change blocks duplicate submits, rotates token and clears secrets",async()=>{
  await controller(); passwords(); let finish; reply=()=>new Promise(resolve=>{finish=resolve;});
  fire("change-password-form","submit"); fire("change-password-form","submit"); await tick();
  assert.equal(calls.filter(c=>c.path==="/me/change-password").length,1);
  assert.deepEqual(JSON.parse(calls.at(-1).options.body),{current_password:"Old-password-123",new_password:"New-password-123"});
  finish(Response.json({access_token:"new-token",token_type:"Bearer",expires_in:7200})); await tick();
  assert.equal(JSON.parse(stored.get("neu-medical.auth")).token,"new-token");
  assert.equal(nodes.get("password-current").value,""); assert.equal(nodes.get("password-new").value,"");
  assert.match(nodes.get("profile-password-message").textContent,/thành công/);
});
test("wrong current password keeps the dialog open with the backend error",async()=>{
  await controller(); passwords(); reply=()=>Response.json({error:{message:"Mật khẩu hiện tại không đúng",code:"WRONG_PASSWORD"}},{status:400});
  await fire("change-password-form","submit");
  assert.match(nodes.get("change-password-status").textContent,/hiện tại không đúng/);
  assert.equal(nodes.get("change-password-dialog").open,true); assert.equal(nodes.get("change-password-submit").disabled,false);
  assert.equal(JSON.parse(stored.get("neu-medical.auth")).token,"password-test");
});
