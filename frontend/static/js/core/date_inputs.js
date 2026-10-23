// Keep native ISO values and calendar validation; display dates consistently in Vietnamese order.
export function displayDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value||"")?value.split("-").reverse().join("/"):"";
}
export function parseDisplayDate(value) {
  if(!value.trim())return "";
  const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if(!match)return null;
  const iso=`${match[3]}-${match[2]}-${match[1]}`;
  const date=new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===iso?iso:null;
}
export function enhanceDateInputs(root=document) {
  for(const native of root.querySelectorAll('input[type="date"]:not([data-date-enhanced])')) {
    native.dataset.dateEnhanced="true";
    const wrap=document.createElement('span');wrap.className='date-field-control';
    native.before(wrap);wrap.append(native);
    const text=document.createElement('input');text.type='text';text.placeholder='dd/mm/yyyy';text.inputMode='numeric';text.maxLength=10;text.className='date-field-display';
    const picker=document.createElement('button');picker.type='button';picker.className='date-field-picker';picker.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="1.5"/><path d="M16 3v4M8 3v4M4 11h16"/></svg>';picker.setAttribute('aria-label','Chọn ngày');
    wrap.append(text,picker);
    text.setAttribute('aria-label',native.getAttribute('aria-label')||wrap.closest('label')?.textContent.trim()||'Ngày');
    native.classList.add('date-field-native');native.tabIndex=-1;
    const sync=()=>{text.value=displayDate(native.value);text.disabled=native.disabled;text.readOnly=native.readOnly;text.required=native.required;};
    const descriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
    Object.defineProperty(native,'value',{configurable:true,get(){return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);sync();}});
    sync();
    native.addEventListener('input',sync);native.addEventListener('change',sync);
    for(const name of ['input','change'])text.addEventListener(name,event=>{
      event.stopPropagation();
      const iso=parseDisplayDate(text.value);
      text.setCustomValidity(iso===null?'Ngày phải có dạng dd/mm/yyyy và là ngày hợp lệ.':'');
      if(iso===null)return;
      native.value=iso;
      text.setCustomValidity(native.validity.valid?'':'Ngày nằm ngoài khoảng cho phép.');
      native.dispatchEvent(new Event(name,{bubbles:true}));
    });
    picker.addEventListener('click',()=>{if(!native.disabled&&!native.readOnly)native.showPicker?.();});
    native.form?.addEventListener('reset',()=>queueMicrotask(sync));
    new MutationObserver(sync).observe(native,{attributes:true,attributeFilter:['disabled','readonly','required','min','max','value']});
  }
}
if(typeof document!=='undefined') {
  let queued=false;
  const refresh=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhanceDateInputs();});};
  new MutationObserver(refresh).observe(document.documentElement,{childList:true,subtree:true});
  refresh();
}
