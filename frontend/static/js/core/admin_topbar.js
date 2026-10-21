import {adminFunctions,searchAdminFunctions,adminFunctionUrl} from './admin_function_search.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function focusAdminFunction(id=new URL(location.href).searchParams.get('admin_function')){
  const item=adminFunctions.find(row=>row.id===id);
  if(!item||new URL(location.href).pathname!==adminFunctionUrl(item).pathname)return false;
  if(item.tab)document.querySelector(`[data-report-tab="${item.tab}"]`)?.click();
  const target=document.querySelector(item.selector)||document.querySelector('#page-body');if(!target)return false;
  target.scrollIntoView({block:'start',behavior:'instant'});
  const hadTabindex=target.hasAttribute('tabindex');if(!hadTabindex)target.setAttribute('tabindex','-1');
  target.focus({preventScroll:true});target.classList.add('admin-function-target');
  setTimeout(()=>{target.classList.remove('admin-function-target');if(!hadTabindex)target.removeAttribute('tabindex');},3500);
  return true;
}
export function initAdminTopbar(){
  const host=document.querySelector('#staff-topbar .staff-topbar-right');if(!host||host.querySelector('.admin-global-search'))return;
  const notifications=new URL('../../../templates/(admin)/notifications.html',import.meta.url);
  host.insertAdjacentHTML('afterbegin',`<div class="admin-global-search" role="search" aria-label="Tìm chức năng quản trị"><label class="visually-hidden" for="admin-function-query">Tìm chức năng quản trị</label><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="admin-function-query" type="search" role="combobox" autocomplete="off" aria-autocomplete="list" aria-expanded="false" aria-controls="admin-function-options" placeholder="Tìm chức năng…" maxlength="150"><div id="admin-function-options" class="admin-function-options" role="listbox" aria-label="Chức năng quản trị" hidden></div><span class="visually-hidden" role="status" id="admin-function-status"></span></div><a class="admin-topbar-bell" href="${esc(notifications.href)}" aria-label="Thông báo" title="Thông báo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4"/></svg><span class="admin-topbar-unread" aria-hidden="true" hidden></span></a>`);
  const root=host.querySelector('.admin-global-search'),input=root.querySelector('input'),list=root.querySelector('[role="listbox"]'),status=root.querySelector('[role="status"]');
  let items=[],selected=-1;
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');selected=-1;};
  function select(index){
    selected=index;list.querySelectorAll('[role="option"]').forEach((node,i)=>node.setAttribute('aria-selected',String(i===index)));
    const option=list.querySelector(`#admin-function-option-${index}`);if(option){input.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}
  }
  function show(){
    items=searchAdminFunctions(input.value);selected=-1;
    list.innerHTML=items.length?items.map((item,i)=>`<a role="option" aria-selected="false" id="admin-function-option-${i}" data-function-id="${esc(item.id)}" href="${esc(adminFunctionUrl(item).href)}" tabindex="-1"><strong>${esc(item.title)}</strong><small>${esc(item.section)}</small></a>`).join(''):'<p class="admin-function-empty">Không tìm thấy chức năng phù hợp.</p>';
    list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');status.textContent=`${items.length} gợi ý chức năng`;
  }
  function navigate(item){
    const url=adminFunctionUrl(item);close();input.value='';
    if(url.pathname===location.pathname){const current=new URL(location.href);current.searchParams.set('admin_function',item.id);history.replaceState(history.state,'',current);focusAdminFunction(item.id);}else location.assign(url.href);
  }
  input.addEventListener('input',event=>{if(!event.isComposing)show();});input.addEventListener('compositionend',show);input.addEventListener('focus',show);
  input.addEventListener('keydown',event=>{
    if(event.isComposing)return;
    if(event.key==='Escape'){event.preventDefault();close();}
    else if(event.key==='Tab')close();
    else if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();if(list.hidden)show();if(items.length)select((selected+(event.key==='ArrowDown'?1:-1)+items.length)%items.length);
    }else if(event.key==='Enter'){
      event.preventDefault();if(list.hidden)show();if(items.length)navigate(items[selected<0?0:selected]);
    }
  });
  list.addEventListener('pointerdown',event=>event.preventDefault());
  list.addEventListener('click',event=>{const link=event.target.closest('[data-function-id]');if(!link)return;if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();const item=items.find(row=>row.id===link.dataset.functionId);if(item)navigate(item);});
  const outside=event=>{if(!root.contains(event.target))close();};document.addEventListener('pointerdown',outside);
  input.addEventListener('blur',close);
  const stop=()=>{document.removeEventListener('pointerdown',outside);close();};
  window.addEventListener('pagehide',stop,{once:true});window.addEventListener('neu:auth-change',stop,{once:true});
}
