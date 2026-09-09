from datetime import date
from functools import wraps
from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app import db
from app.models import Doctor, Schedule, Appointment

doctor_bp = Blueprint("doctor", __name__)


def require_doctor(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_doctor():
            flash("Bạn không có quyền truy cập trang này.", "danger")
            return redirect(url_for("index"))
        return f(*args, **kwargs)
    return decorated


@doctor_bp.route("/dashboard")
@login_required
@require_doctor
def dashboard():
    doctor = current_user.doctor_profile
    today = date.today()
    today_appts = (
        Appointment.query
        .filter_by(doctor_id=doctor.id)
        .filter(Appointment.appointment_date == today)
        .filter(Appointment.status.in_(["pending", "confirmed"]))
        .order_by(Appointment.appointment_time.asc())
        .all()
    )
    total = Appointment.query.filter_by(doctor_id=doctor.id).count()
    completed = Appointment.query.filter_by(doctor_id=doctor.id, status="completed").count()
    return render_template(
        "doctor/dashboard.html",
        doctor=doctor,
        today_appointments=today_appts,
        total=total,
        completed=completed,
        today=today,
    )


@doctor_bp.route("/schedule", methods=["GET", "POST"])
@login_required
@require_doctor
def schedule():
    doctor = current_user.doctor_profile
    if request.method == "POST":
        from datetime import datetime, time as dtime
        work_date_str = request.form.get("work_date")
        start_str = request.form.get("start_time")
        end_str = request.form.get("end_time")
        max_p = int(request.form.get("max_patients", 10))

        work_date = datetime.strptime(work_date_str, "%Y-%m-%d").date()
        start_time = datetime.strptime(start_str, "%H:%M").time()
        end_time = datetime.strptime(end_str, "%H:%M").time()

        if start_time >= end_time:
            flash("Giờ bắt đầu phải nhỏ hơn giờ kết thúc.", "danger")
        else:
            s = Schedule(
                doctor_id=doctor.id,
                work_date=work_date,
                start_time=start_time,
                end_time=end_time,
                max_patients=max_p,
            )
            db.session.add(s)
            db.session.commit()
            flash("Đã thêm lịch làm việc thành công!", "success")
        return redirect(url_for("doctor.schedule"))

    schedules = (
        Schedule.query
        .filter_by(doctor_id=doctor.id)
        .filter(Schedule.work_date >= date.today())
        .order_by(Schedule.work_date.asc(), Schedule.start_time.asc())
        .all()
    )
    return render_template("doctor/schedule.html", doctor=doctor, schedules=schedules)


@doctor_bp.route("/schedule/delete/<int:sid>", methods=["POST"])
@login_required
@require_doctor
def delete_schedule(sid):
    s = Schedule.query.get_or_404(sid)
    doctor = current_user.doctor_profile
    if s.doctor_id != doctor.id:
        flash("Không có quyền thực hiện.", "danger")
    else:
        db.session.delete(s)
        db.session.commit()
        flash("Đã xóa lịch.", "success")
    return redirect(url_for("doctor.schedule"))


@doctor_bp.route("/patients")
@login_required
@require_doctor
def patients():
    doctor = current_user.doctor_profile
    appts = (
        Appointment.query
        .filter_by(doctor_id=doctor.id)
        .order_by(Appointment.appointment_date.desc())
        .all()
    )
    return render_template("doctor/patients.html", appointments=appts)


@doctor_bp.route("/appointment/<int:appt_id>/update", methods=["POST"])
@login_required
@require_doctor
def update_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    doctor = current_user.doctor_profile
    if appt.doctor_id != doctor.id:
        flash("Không có quyền thực hiện.", "danger")
        return redirect(url_for("doctor.dashboard"))
    new_status = request.form.get("status")
    notes = request.form.get("notes", "")
    if new_status in ("confirmed", "cancelled", "completed"):
        appt.status = new_status
        appt.notes = notes
        db.session.commit()
        flash("Cập nhật lịch hẹn thành công!", "success")
    return redirect(url_for("doctor.dashboard"))
