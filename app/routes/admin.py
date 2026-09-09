from functools import wraps
from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from werkzeug.security import generate_password_hash
from app import db
from app.models import User, Doctor, Appointment

admin_bp = Blueprint("admin", __name__)


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin():
            flash("Bạn không có quyền truy cập trang quản trị.", "danger")
            return redirect(url_for("index"))
        return f(*args, **kwargs)
    return decorated


@admin_bp.route("/dashboard")
@login_required
@require_admin
def dashboard():
    total_patients = User.query.filter_by(role="patient").count()
    total_doctors = User.query.filter_by(role="doctor").count()
    total_appts = Appointment.query.count()
    pending_appts = Appointment.query.filter_by(status="pending").count()
    recent_appts = (
        Appointment.query
        .order_by(Appointment.created_at.desc())
        .limit(10)
        .all()
    )
    return render_template(
        "admin/dashboard.html",
        total_patients=total_patients,
        total_doctors=total_doctors,
        total_appts=total_appts,
        pending_appts=pending_appts,
        recent_appts=recent_appts,
    )


@admin_bp.route("/doctors")
@login_required
@require_admin
def doctors():
    all_doctors = Doctor.query.join(Doctor.user).all()
    return render_template("admin/doctors.html", doctors=all_doctors)


@admin_bp.route("/doctors/add", methods=["GET", "POST"])
@login_required
@require_admin
def add_doctor():
    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        email = request.form.get("email", "").strip().lower()
        phone = request.form.get("phone", "").strip()
        password = request.form.get("password", "")
        specialty = request.form.get("specialty", "").strip()
        experience = int(request.form.get("experience_years", 0))
        bio = request.form.get("bio", "").strip()
        fee = float(request.form.get("consultation_fee", 0))

        if User.query.filter_by(email=email).first():
            flash("Email đã tồn tại.", "danger")
        else:
            user = User(
                full_name=full_name,
                email=email,
                phone=phone,
                role="doctor",
                password_hash=generate_password_hash(password),
            )
            db.session.add(user)
            db.session.flush()  # Lấy user.id

            doctor = Doctor(
                user_id=user.id,
                specialty=specialty,
                experience_years=experience,
                bio=bio,
                consultation_fee=fee,
            )
            db.session.add(doctor)
            db.session.commit()
            flash(f"Đã thêm bác sĩ {full_name} thành công!", "success")
            return redirect(url_for("admin.doctors"))

    return render_template("admin/add_doctor.html")


@admin_bp.route("/doctors/toggle/<int:user_id>", methods=["POST"])
@login_required
@require_admin
def toggle_doctor(user_id):
    user = User.query.get_or_404(user_id)
    user.is_active = not user.is_active
    db.session.commit()
    status = "kích hoạt" if user.is_active else "vô hiệu hóa"
    flash(f"Đã {status} tài khoản bác sĩ {user.full_name}.", "success")
    return redirect(url_for("admin.doctors"))


@admin_bp.route("/patients")
@login_required
@require_admin
def patients():
    all_patients = User.query.filter_by(role="patient").order_by(User.created_at.desc()).all()
    return render_template("admin/patients.html", patients=all_patients)
