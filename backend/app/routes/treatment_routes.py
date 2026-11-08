from flask import Blueprint, jsonify, request
from backend.app.core.security import login_required,current_user
from backend.app.schemas.treatment_schema import validate_plan
from backend.app.utils.validation import int_arg, optional_int_arg
from backend.app.core.errors import bad_request
from backend.app.services import treatment_service as service

treatment_bp=Blueprint('treatment',__name__)


@treatment_bp.post('/encounters/<int:encounter_id>/treatment-appointments')
@login_required
def create(encounter_id):
    result,created=service.create(current_user(),encounter_id,validate_plan(request.get_json(silent=True)))
    return jsonify(result),201 if created else 200


@treatment_bp.get('/treatment-appointments')
@login_required
def listing():
    page=int_arg(request.args,'page',1,1,100000)
    size=int_arg(request.args,'page_size',20,1,100)
    view=request.args.get('view') or None
    if view not in (None,'upcoming','history'):
        raise bad_request('Mục lịch hẹn phải là upcoming hoặc history')
    patient_id=optional_int_arg(request.args,'patient_id')
    if patient_id is not None and patient_id < 1:
        raise bad_request('Mã người khám phải là số nguyên dương')
    return jsonify(service.listing(current_user(),page,size,view=view,patient_id=patient_id))
