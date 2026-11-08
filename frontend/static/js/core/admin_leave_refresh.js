import {getAdminLeaveRequest} from '../api/staff_leave.js';
import {leaveRequestDetails} from './admin_leave_detail.js';
import {commitForm} from './form_workflow.js';

// Only terminal server decisions replace an open review. Pending polls must not
// overwrite the administrator's decision, note, focus or unsaved input.
export function startAdminLeaveRefresh({ctx,modal,body,environment=globalThis,read=getAdminLeaveRequest}) {
  let active=true,running=false,request;
  async function refresh(){
    const form=body.querySelector('form[data-form="review"]');
    if(!active||!ctx.active||running||!modal.open||!form||form.dataset.saving==='true'||environment.document.visibilityState==='hidden')return;
    running=true;request=new AbortController();
    try{
      const result=await read(form.dataset.id,{signal:request.signal});
      if(!active||!ctx.active||!modal.open||body.querySelector('form[data-form="review"]')!==form||form.dataset.saving==='true')return;
      if(String(result.leave_request?.request_id)!==String(form.dataset.id))throw new Error('Đơn nghỉ trả về không khớp đơn đang xem.');
      if(['APPROVED','REJECTED','CANCELLED'].includes(result.leave_request.status)){
        commitForm(form);body.innerHTML=leaveRequestDetails(result,form.dataset.id);
      }
    }catch(error){
      if(active&&ctx.active&&error.code!=='CLIENT_ABORTED'&&modal.open&&body.querySelector('form[data-form="review"]')===form){
        ctx.handle(error,form.querySelector('[role="status"]'));
      }
    }finally{running=false;}
  }
  const timer=environment.setInterval(refresh,30_000);timer.unref?.();
  const cancel=()=>request?.abort();
  const stop=()=>{active=false;cancel();environment.clearInterval(timer);};
  modal.addEventListener('close',cancel);
  environment.window.addEventListener('pagehide',stop,{once:true});
  environment.window.addEventListener('neu:auth-change',stop,{once:true});
  return stop;
}
