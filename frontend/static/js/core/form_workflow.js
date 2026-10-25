// One unsaved-change policy for real editors; readers and filters stay lightweight.
const drafts=new Map();
const excluded=/filter|search|lookup|directory|overview/i;
export function isEditor(form){
 return Boolean(form&&(form.tagName==='FORM'||form.dataset?.workflowEditor==='true')&&form.method!=='dialog'&&form.dataset?.workflow!=='ignore'
  &&!excluded.test(form.id||'')&&!form.matches?.('[role="search"],.admin-toolbar,.staff-toolbar,.directory-filter,.news-search'));
}
function fields(form){return Array.from(form.querySelectorAll('input,select,textarea')).filter(n=>!['button','submit','reset','hidden','search'].includes(n.type)&&!n.readOnly&&!n.disabled&&!n.matches?.('[data-workflow-ignore]'));}
function value(n){return n.type==='file'?Array.from(n.files||[]).map(f=>`${f.name}:${f.size}:${f.lastModified}`).join('|'):['checkbox','radio'].includes(n.type)?n.checked:String(n.value??'');}
export function captureForm(form,refresh=false){if(!isEditor(form)||(drafts.has(form)&&(!refresh||drafts.get(form).touched)))return;drafts.set(form,{values:new Map(fields(form).map(n=>[n,value(n)])),structural:false,touched:false,owner:form.closest?.("dialog")});}
export function markFormChanged(form){captureForm(form);const state=drafts.get(form);if(state){state.structural=true;state.touched=true;if(form.dataset)form.dataset.workflowDirty="true";}}
export function commitForm(form){if(form){drafts.delete(form);if(form.dataset)delete form.dataset.workflowDirty;}}
export function hasUnsavedChanges(scope){
 for(const [form,state]of drafts){
  if(form.isConnected===false&&!form.dataset?.workflowRetain){drafts.delete(form);continue;}
  if(scope&&scope!==form&&!scope.contains?.(form)&&state.owner!==scope)continue;
  if(state.touched&&(state.structural||[...state.values].some(([n,before])=>n.isConnected===false||value(n)!==before)))return true;
 }
 return false;
}
function discard(scope){
 for(const [form,state]of drafts){
  if(scope&&scope!==form&&!scope.contains?.(form)&&state.owner!==scope)continue;
  for(const [n,before]of state.values){
   if(n.isConnected===false)continue;
   if(n.type==='file')n.value='';else if(['checkbox','radio'].includes(n.type))n.checked=before;else n.value=before;
   n.setCustomValidity?.('');
  }
  commitForm(form);
  form.dispatchEvent?.(new CustomEvent('neu:discard-changes',{bubbles:true}));
 }
}
export function confirmDiscard(scope,confirm=globalThis.window?.confirm?.bind(globalThis.window)){
 if(!hasUnsavedChanges(scope))return true;
 if(!confirm?.('Bạn có dữ liệu chưa lưu. Thoát và xóa các thay đổi đã nhập?'))return false;
 discard(scope);return true;
}
let pendingDiscard=false;
export async function confirmDiscardAsync(scope,doc=globalThis.document,win=globalThis.window){
 if(!hasUnsavedChanges(scope))return true;
 if(pendingDiscard)return false;
 if(!doc?.createElement||!doc.head)return confirmDiscard(scope,win.confirm.bind(win));
 pendingDiscard=true;
 const modal=doc.createElement('dialog');modal.className='workflow-discard-dialog';modal.setAttribute('aria-labelledby','workflow-discard-title');
 modal.innerHTML='<h2 id="workflow-discard-title">Bỏ thay đổi chưa lưu?</h2><p>Dữ liệu bạn vừa nhập chưa được lưu. Nếu thoát, các thay đổi này sẽ bị xóa.</p><div class="workflow-discard-actions"><button type="button" data-workflow-stay>Tiếp tục nhập</button><button type="button" data-workflow-leave>Thoát và bỏ thay đổi</button></div>';
 doc.body.append(modal);
 return new Promise(resolve=>{
  let done=false;
  const finish=accepted=>{if(done)return;done=true;if(accepted)discard(scope);modal.close();modal.remove();pendingDiscard=false;resolve(accepted);};
  modal.querySelector('[data-workflow-stay]').addEventListener('click',()=>finish(false));
  modal.querySelector('[data-workflow-leave]').addEventListener('click',()=>finish(true));
  modal.addEventListener('cancel',e=>{e.preventDefault();finish(false);});
  modal.addEventListener('close',()=>finish(false));
  modal.showModal();modal.querySelector('[data-workflow-stay]').focus();
 });
}
export function clearDrafts(scope){discard(scope);}
export function workflowBusy(scope){
 if(scope?.workflowCanClose?.()===false)return true;
 if(!scope&&Array.from(globalThis.document?.querySelectorAll?.("dialog[open]")||[]).some(modal=>modal.workflowCanClose?.()===false))return true;
 if(!scope&&globalThis.document?.querySelector?.('[data-saving="true"],[data-workflow-busy="true"],form[data-busy="true"],form[aria-busy="true"],dialog[aria-busy="true"],dialog [data-busy="true"]'))return true;
 for(const [form,state]of drafts)if((!scope||scope===form||scope.contains?.(form))&&state.touched&&state.values.size&&[...state.values.keys()].every(n=>n.disabled))return true;
 return Boolean(scope?.matches?.('[data-busy="true"],[data-saving="true"],[aria-busy="true"]')||scope?.querySelector?.('[data-busy="true"],[data-saving="true"],[aria-busy="true"]'));}
export function installFormWorkflow(doc=globalThis.document,win=globalThis.window){
 if(!doc?.addEventListener||!win?.addEventListener||doc.documentElement?.dataset.workflowInstalled)return;
 if(doc.documentElement)doc.documentElement.dataset.workflowInstalled='true';
 if(doc.head&&doc.createElement){const css=doc.createElement('link');css.rel='stylesheet';css.href=new URL('../../css/form_workflow.css',import.meta.url).href;doc.head.append(css);}
 const ask=scope=>confirmDiscard(scope,win.confirm.bind(win));
 const editor=target=>target.closest?.('[data-workflow-editor]')||target.closest?.('form');
 const prevent=e=>{e.preventDefault();e.stopImmediatePropagation();};
 doc.addEventListener('focusin',e=>captureForm(editor(e.target),true),true);
 const changed=e=>{
  const form=editor(e.target);captureForm(form);const state=drafts.get(form);if(!state)return;
  if(e.target.readOnly||e.target.disabled||e.target.type==='hidden')return;
  state.touched=true;
  if(form.dataset){if(hasUnsavedChanges(form))form.dataset.workflowDirty='true';else delete form.dataset.workflowDirty;}
 };
 doc.addEventListener('input',changed,true);
 doc.addEventListener('change',changed,true);
 doc.addEventListener('reset',e=>commitForm(e.target),true);
 doc.addEventListener('click',e=>{
  if(e.defaultPrevented||e.button>0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
  const target=e.target.closest?.('a,button,input[type="reset"]');if(!target||target.disabled)return;
  if(target.matches('a[href]')){
   if(target.target&&target.target!=='_self'||target.hasAttribute('download'))return;
   const url=new URL(target.href,win.location.href);
   if(!['http:','https:','file:'].includes(url.protocol))return;
   if(url.pathname===win.location.pathname&&url.search===win.location.search)return;
   if(workflowBusy()){prevent(e);return;}
   if(hasUnsavedChanges()){prevent(e);void confirmDiscardAsync(undefined,doc,win).then(allowed=>{if(allowed)target.click();});}
   return;
  }
  const text=(target.textContent||'').trim();
  const accessibleClose=/^Đóng(?:\s|$)/u.test(target.getAttribute?.('aria-label')||'');
  const close=accessibleClose||target.matches('[data-dialog-dismiss],[data-cancel],[data-patient-cancel],[data-action="close-dialog"],#staff-profile-cancel,#profile-cancel,[type="reset"]')||/^(Đóng(?:\s|×|$)|Hủy$|Hủy bỏ$|Quay lại$|Đăng xuất$)/u.test(text);
  if(!close)return;
  const scope=/^Đăng xuất$/u.test(text)?undefined:target.closest('dialog')||target.closest('form');
  if(!scope&&text!=='Đăng xuất')return;
  if(workflowBusy(scope)){prevent(e);return;}
  if(hasUnsavedChanges(scope)){if(!doc.createElement){if(!ask(scope))prevent(e);return;}prevent(e);void confirmDiscardAsync(scope,doc,win).then(allowed=>{if(allowed)target.click();});}
 },true);
 doc.addEventListener('neu:navigate',e=>{if(workflowBusy()){prevent(e);return;}if(hasUnsavedChanges()){prevent(e);void confirmDiscardAsync(undefined,doc,win).then(allowed=>{if(allowed)doc.dispatchEvent(new CustomEvent('neu:navigate',{detail:e.detail,cancelable:true}));});}},true);
 doc.addEventListener('cancel',e=>{if(e.target.tagName!=='DIALOG'||e.target.classList?.contains('workflow-discard-dialog'))return;if(workflowBusy(e.target)){prevent(e);return;}if(hasUnsavedChanges(e.target)){if(!doc.createElement){if(!ask(e.target))prevent(e);return;}prevent(e);void confirmDiscardAsync(e.target,doc,win).then(allowed=>{if(allowed)e.target.close();});}},true);
 // Backdrop clicks must ask before the normal dismissal listener runs.
 doc.addEventListener('click',e=>{
  if(e.target.tagName!=='DIALOG'||!hasUnsavedChanges(e.target))return;
  const r=e.target.getBoundingClientRect();
  if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)return;
  if(!doc.createElement){if(workflowBusy(e.target)||!ask(e.target))prevent(e);return;}
  prevent(e);
  if(!workflowBusy(e.target))void confirmDiscardAsync(e.target,doc,win).then(allowed=>{if(allowed)e.target.close();});
 },true);
 doc.addEventListener('close',e=>{
  if(e.target.tagName!=='DIALOG')return;
  discard(e.target);
  for(const form of e.target.querySelectorAll('form')){commitForm(form);form.reset();}
 },true);
 win.addEventListener('beforeunload',e=>{if(hasUnsavedChanges()||workflowBusy()){e.preventDefault();e.returnValue='';}});
 win.addEventListener('pagehide',()=>{discard();drafts.clear();});
 win.addEventListener('neu:auth-change',()=>{drafts.clear();doc.querySelector?.('.workflow-discard-dialog[open]')?.close();});
}
if(typeof document!=='undefined')installFormWorkflow();
