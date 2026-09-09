from datetime import datetime
from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app import db
from app.models import Doctor, Schedule, Appointment

appointment_bp = Blueprint("appointment", __name__)


@appointment_bp.route("/book", methods=["GET", "POST"])
@login_required
def book():
    if not current_user.is_patient():
        flash("Chỉ bệnh nhân mới có thể đặt lịch khám.", "warning")
        return redirect(url_for("index"))

    # Danh sách bác sĩ và chuyên khoa
    specialty = request.args.get("specialty", "")
    doctors_query = Doctor.query.join(Doctor.user)
    if specialty:
        doctors_query = doctors_query.filter(Doctor.specialty == specialty)
    doctors = doctors_query.all()

    # Lấy danh sách chuyên khoa để filter
    specialties = db.session.query(Doctor.specialty).distinct().all()
    specialties = [s[0] for s in specialties]

    selected_doctor_id = request.args.get("doctor_id", type=int)
    schedules = []
    selected_doctor = None
    if selected_doctor_id:
        selected_doctor = Doctor.query.get(selected_doctor_id)
        from datetime import date
        schedules = (
            Schedule.query
            .filter_by(doctor_id=selected_doctor_id, is_available=True)
            .filter(Schedule.work_date >= date.today())
            .order_by(Schedule.work_date.asc())
            .all()
        )
        # Lọc chỉ lịch còn slot
        schedules = [s for s in schedules if s.has_slots()]

    if request.method == "POST":
        doctor_id = int(request.form.get("doctor_id"))
        schedule_id = request.form.get("schedule_id", type=int)
        appointment_date_str = request.form.get("appointment_date")
        appointment_time_str = request.form.get("appointment_time")
        reason = request.form.get("reason", "").strip()

        appointment_date = datetime.strptime(appointment_date_str, "%Y-%m-%d").date()
        appointment_time = datetime.strptime(appointment_time_str, "%H:%M").time()

        # Kiểm tra trùng lịch
        existing = Appointment.query.filter_by(
            patient_id=current_user.id,
            doctor_id=doctor_id,
            appointment_date=appointment_date,
        ).filter(Appointment.status.in_(["pending", "confirmed"])).first()

        if existing:
            flash("Bạn đã có lịch hẹn với bác sĩ này vào ngày này rồi.", "warning")
        else:
            appt = Appointment(
                patient_id=current_user.id,
                doctor_id=doctor_id,
                schedule_id=schedule_id,
                appointment_date=appointment_date,
                appointment_time=appointment_time,
                reason=reason,
                status="pending",
            )
            db.session.add(appt)
            db.session.commit()
            flash("Đặt lịch khám thành công! Vui lòng chờ xác nhận.", "success")
            return redirect(url_for("patient.appointments"))

    return render_template(
        "appointment/book.html",
        doctors=doctors,
        specialties=specialties,
        selected_doctor=selected_doctor,
        schedules=schedules,
        specialty=specialty,
    )


@appointment_bp.route("/detail/<int:appt_id>")
@login_required
def detail(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    # Chỉ bệnh nhân, bác sĩ liên quan hoặc admin mới xem được
    if not (
        current_user.id == appt.patient_id
        or (current_user.is_doctor() and current_user.doctor_profile.id == appt.doctor_id)
        or current_user.is_admin()
    ):
        flash("Không có quyền xem thông tin này.", "danger")
        return redirect(url_for("index"))
    return render_template("appointment/detail.html", appointment=appt)
