import { patientCreateForm } from "../core/admin_patient_form.js";
import { resources } from "../core/admin_resources.js";
import { enhanceDialogDismiss } from "../core/dialog_dismiss.js";

export function initReceptionPatientForm() {
  const button = document.querySelector("#reception-add-patient");
  const modal = document.querySelector("#reception-patient-dialog");
  const content = modal.querySelector("[data-patient-form-body]");
  enhanceDialogDismiss(modal);
  modal.querySelector("[data-patient-close]").addEventListener("click", () => modal.close());
  button.addEventListener("click", () => {
    content.innerHTML = patientCreateForm(resources.patients.fields, {}, '<div class="actions"><button type="button" class="secondary" data-patient-cancel>Hủy</button><button type="submit" disabled>Thêm bệnh nhân</button></div>');
    content.querySelector("form").addEventListener("submit", event => event.preventDefault());
    modal.showModal();
  });
  content.addEventListener("click", event => {
    if (event.target.closest("[data-patient-cancel]")) modal.close();
    const clear = event.target.closest('[data-action="clear-input"]');
    if (clear) { const input = clear.parentElement.querySelector("input"); input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); input.focus(); }
  });
  modal.addEventListener("close", () => button.focus());
}
