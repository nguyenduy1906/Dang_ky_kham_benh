from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app import db
from app.models import User, Appointment

patient_bp = Blueprint("patient", __name__)


def require_patient(f):
    """Decorator: chỉ cho phép bệnh nhân truy cập."""
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_patient():
            flash("Bạn không có quyền truy cập trang này.", "danger")
            return redirect(url_for("index"))
        return f(*args, **kwargs)

    return decorated


@patient_bp.route("/dashboard")
@login_required
@require_patient
def dashboard():
    upcoming = (
        Appointment.query
        .filter_by(patient_id=current_user.id)
        .filter(Appointment.status.in_(["pending", "confirmed"]))
        .order_by(Appointment.appointment_date.asc())
        .limit(5)
        .all()
    )
    return render_template("patient/dashboard.html", upcoming=upcoming)


@patient_bp.route("/appointments")
@login_required
@require_patient
def appointments():
    status_filter = request.args.get("status", "all")
    query = Appointment.query.filter_by(patient_id=current_user.id)
    if status_filter != "all":
        query = query.filter_by(status=status_filter)
    appts = query.order_by(Appointment.appointment_date.desc()).all()
    return render_template("patient/appointments.html", appointments=appts, status_filter=status_filter)


@patient_bp.route("/profile", methods=["GET", "POST"])
@login_required
@require_patient
def profile():
    if request.method == "POST":
        current_user.full_name = request.form.get("full_name", current_user.full_name).strip()
        current_user.phone = request.form.get("phone", current_user.phone).strip()

        new_password = request.form.get("new_password", "")
        if new_password:
            if len(new_password) < 6:
                flash("Mật khẩu mới phải có ít nhất 6 ký tự.", "danger")
                return render_template("patient/profile.html")
            current_user.set_password(new_password)

        db.session.commit()
        flash("Cập nhật hồ sơ thành công!", "success")
        return redirect(url_for("patient.profile"))

    return render_template("patient/profile.html")


@patient_bp.route("/cancel/<int:appt_id>", methods=["POST"])
@login_required
@require_patient
def cancel_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    if appt.patient_id != current_user.id:
        flash("Không có quyền thực hiện hành động này.", "danger")
        return redirect(url_for("patient.appointments"))
    if appt.status not in ("pending", "confirmed"):
        flash("Không thể hủy lịch hẹn này.", "warning")
    else:
        appt.status = "cancelled"
        db.session.commit()
        flash("Đã hủy lịch hẹn thành công.", "success")
    return redirect(url_for("patient.appointments"))
