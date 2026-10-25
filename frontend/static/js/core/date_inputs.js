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
export function dateInputState(value,{min='',max=''}={}) {
  const iso=parseDisplayDate(value);
  if(iso===null)return {iso:null,error:'Ngày phải có dạng dd/mm/yyyy và là ngày hợp lệ.'};
  if(iso&&min&&iso<min)return {iso:null,error:`Ngày phải từ ${displayDate(min)} trở đi.`};
  if(iso&&max&&iso>max)return {iso:null,error:`Ngày không được sau ${displayDate(max)}.`};
  return {iso,error:''};
}
function dateScope(input){return input.closest('.panel,.admin-card,#doctor-assignment')||input.form||input.parentElement;}
function updateScope(scope){scope.toggleAttribute('data-invalid-date',Boolean(scope.querySelector('.date-field-display[aria-invalid="true"]')));}
export function enhanceDateInputs(root=document) {
  for(const native of root.querySelectorAll('input[type="date"]:not([data-date-enhanced]):not([data-native-date-picker])')) {
    native.dataset.dateEnhanced='true';
    const scope=dateScope(native),wrap=document.createElement('span');wrap.className='date-field-control';
    native.before(wrap);wrap.append(native);
    const text=document.createElement('input');text.type='text';text.placeholder='dd/mm/yyyy';text.inputMode='numeric';text.maxLength=10;text.className='date-field-display';
    const picker=document.createElement('button');picker.type='button';picker.className='date-field-picker';picker.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="1.5"/><path d="M16 3v4M8 3v4M4 11h16"/></svg>';picker.setAttribute('aria-label','Chọn ngày');
    const note=document.createElement('small');note.className='date-field-error';note.id=`date-error-${++dateSequence}`;note.setAttribute('aria-live','polite');note.hidden=true;
    wrap.append(text,picker,note);text.setAttribute('aria-describedby',note.id);
    text.setAttribute('aria-label',native.getAttribute('aria-label')||wrap.closest('label')?.textContent.trim()||'Ngày');
    native.classList.add('date-field-native');native.tabIndex=-1;
    const validate=()=>{
      const state=dateInputState(text.value,{min:native.min,max:native.max});
      text.setCustomValidity(state.error);text.setAttribute('aria-invalid',String(Boolean(state.error)));
      note.textContent=state.error;note.hidden=!state.error;updateScope(scope);return state;
    };
    const syncAttributes=()=>{text.disabled=native.disabled;text.readOnly=native.readOnly;text.required=native.required;};
    const sync=()=>{text.value=displayDate(native.value);syncAttributes();validate();};
    const descriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
    Object.defineProperty(native,'value',{configurable:true,get(){return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);sync();}});
    sync();native.addEventListener('input',sync);native.addEventListener('change',sync);
    native.addEventListener('invalid',event=>{event.preventDefault();text.reportValidity();});
    for(const name of ['input','change'])text.addEventListener(name,event=>{
      event.stopPropagation();const state=validate();if(state.error)return;
      descriptor.set.call(native,state.iso);
      native.dispatchEvent(new Event(name,{bubbles:true}));
    });
    picker.addEventListener('click',()=>{if(!native.disabled&&!native.readOnly)native.showPicker?.();});
    native.form?.addEventListener('reset',()=>queueMicrotask(sync));
    new MutationObserver(()=>{syncAttributes();validate();}).observe(native,{attributes:true,attributeFilter:['disabled','readonly','required','min','max']});
  }
}
let dateSequence=0;
if(typeof document!=='undefined') {
  // Stop filters/actions in a section with an invalid visible date. Native dates
  // keep ISO values; stale results are hidden until the displayed date is valid.
  for(const name of ['input','change','submit','click'])document.addEventListener(name,event=>{
    const target=event.target;
    if(target.matches?.('.date-field-display')||target.closest?.('.date-field-picker'))return;
    if(name==='click'&&!target.closest?.('button'))return;
    if(name==='click'&&target.closest('button')?.matches('[type="reset"],[data-dialog-dismiss],#staff-dialog-close,#calendar-dialog-close,[data-patient-cancel],[data-patient-close],[data-patient-edit-cancel],[data-schedule-cancel]'))return;
    const scope=target.closest?.('[data-invalid-date]');if(!scope)return;
    const invalid=[...scope.querySelectorAll('.date-field-display[aria-invalid="true"]')].find(input=>input.previousElementSibling!==target);
    if(!invalid)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(name==='click'||name==='submit')invalid.reportValidity();
  },true);
  let queued=false;
  const refresh=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhanceDateInputs();});};
  new MutationObserver(refresh).observe(document.documentElement,{childList:true,subtree:true});refresh();
}
