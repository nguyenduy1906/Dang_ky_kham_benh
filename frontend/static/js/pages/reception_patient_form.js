import { patientCreateForm } from "../core/admin_patient_form.js";
import { resources } from "../core/admin_resources.js";
import { enhanceDialogDismiss } from "../core/dialog_dismiss.js";
import { createReceptionPatient } from "../core/reception_intake_data.js";
import { sessionError } from "../core/staff_workspace.js";

export function initReceptionPatientForm({onCreated = () => {}} = {}) {
  const button = document.querySelector("#reception-add-patient");
  const modal = document.querySelector("#reception-patient-dialog");
  const content = modal.querySelector("[data-patient-form-body]");
  let active = true, busy = false, request;
  const stop = () => {active=false;request?.abort();modal.close();content.innerHTML="";};
  window.addEventListener("pagehide",stop,{once:true});
  window.addEventListener("neu:auth-change",stop,{once:true});
  enhanceDialogDismiss(modal,{canClose:()=>!busy});
  modal.addEventListener("cancel",event=>{if(busy)event.preventDefault();});
  modal.querySelector("[data-patient-close]").addEventListener("click", () => {if(!busy)modal.close();});
  button.addEventListener("click", () => {
    if(!active || busy)return;
    content.innerHTML = patientCreateForm(resources.patients.fields, {}, '<div class="actions"><button type="button" class="secondary" data-patient-cancel>Hủy</button><button type="submit">Thêm bệnh nhân</button></div><p role="status" class="form-feedback"></p>');
    const form = content.querySelector("form");
    form.elements.dob.max = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    form.addEventListener("submit", async event => {
      event.preventDefault(); if(!active || busy || !form.reportValidity())return;
      const input = Object.fromEntries(new FormData(form));
      const feedback = form.querySelector('[role="status"]');
      busy=true;request=new AbortController();
      const controls=[...form.querySelectorAll('input, select, textarea, button')];
      const states=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);
      feedback.textContent="Đang lưu hồ sơ bệnh nhân…";feedback.dataset.error="false";
      try {
        const patient=await createReceptionPatient(input,{signal:request.signal});
        if(!active)return;
        onCreated(patient);modal.close();
      } catch(error) {
        if(active){feedback.textContent=sessionError(error);feedback.dataset.error="true";}
      } finally {
        busy=false;controls.forEach((control,index)=>control.disabled=states[index]);
      }
    });
    modal.showModal();
  });
  content.addEventListener("click", event => {
    if(busy)return;
    if (event.target.closest("[data-patient-cancel]")) modal.close();
    const clear = event.target.closest('[data-action="clear-input"]');
    if (clear) { const input = clear.parentElement.querySelector("input"); input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); input.focus(); }
  });
  modal.addEventListener("close", () => button.focus());
}
