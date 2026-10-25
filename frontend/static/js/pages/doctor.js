import {renderDoctorOverview} from '../core/doctor_overview.js';
import { observeOverviewEncounters } from "../core/doctor_encounter_list.js";
import { loadClinicalProfile, loadClinicalRows } from "../core/doctor_clinical_profile.js";
import { initNurseRecords as initDoctorPatientRecords } from "../core/nurse_records.js";
import { renderClinicalDesign } from "../core/doctor_clinical_design.js";
import { initTodayOverview } from "../core/staff_overview.js";
import { staffReady } from "../core/staff_workspace.js";
import { initEncounterList } from "../core/staff_encounters.js";
import { $, today, bindDialog, run } from "../core/staff_ui.js";

const user = await staffReady;
if (user) {
  bindDialog({ dismissible: document.body.dataset.page === "records" });
  const page = document.body.dataset.page;
  if (page === "overview") await run(overview);
  if (page === "schedule" || page === "encounters") await assignedWorkspace();
  if (page === "history") await initEncounterList({ role: "doctor", completed: page === "history", compact: true });
  if (page === "clinical") await run(clinical);
  if (page === "records") await run(initDoctorPatientRecords);
}

async function overview() {
  observeOverviewEncounters($('#page-body'));
  await initTodayOverview(renderDoctorOverview);
}
async function assignedWorkspace() {
  document.body.classList.add("doctor-assigned-workspace");
  await initEncounterList({ role: "doctor", compact: true });
}
async function clinical() {
  const params = new URLSearchParams(location.search);
  const requested = params.get("encounter_id");
  if (!requested) {
    const profiles = await loadClinicalRows(today());
    renderClinicalDesign({profiles,loadDay:loadClinicalRows,loadProfile:loadClinicalProfile});
    return;
  }
  if (!/^\d+$/.test(requested)) throw new Error("Mã lượt khám không hợp lệ.");
  const profile = await loadClinicalProfile(requested);
  renderClinicalDesign({profiles:[profile],initialId:profile.id,mode:params.get("mode"),loadDay:loadClinicalRows,loadProfile:loadClinicalProfile});
}
