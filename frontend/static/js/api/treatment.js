import {apiRequest,pathSegment} from '../core/api.js';
export function listTreatmentAppointments(params={},options={}) {
  return apiRequest('/treatment-appointments',{...options,method:'GET',params});
}
export function createTreatmentAppointments(encounterId,data,options={}) {
  return apiRequest(`/encounters/${pathSegment(encounterId)}/treatment-appointments`,{...options,method:'POST',data});
}
