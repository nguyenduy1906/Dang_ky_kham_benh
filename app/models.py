from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app import db, login_manager


# ─── User Loader ───────────────────────────────────────────────────────────────
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# ─── Model: User ───────────────────────────────────────────────────────────────
class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    phone = db.Column(db.String(15), nullable=True)
    role = db.Column(db.String(20), nullable=False, default="patient")  # patient | doctor | admin
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    doctor_profile = db.relationship("Doctor", backref="user", uselist=False, lazy=True)
    appointments_as_patient = db.relationship(
        "Appointment", foreign_keys="Appointment.patient_id", backref="patient", lazy=True
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def is_patient(self):
        return self.role == "patient"

    def is_doctor(self):
        return self.role == "doctor"

    def is_admin(self):
        return self.role == "admin"

    def __repr__(self):
        return f"<User {self.email} [{self.role}]>"


# ─── Model: Doctor ─────────────────────────────────────────────────────────────
class Doctor(db.Model):
    __tablename__ = "doctors"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    specialty = db.Column(db.String(100), nullable=False)
    experience_years = db.Column(db.Integer, default=0)
    bio = db.Column(db.Text, nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)
    consultation_fee = db.Column(db.Float, default=0)

    # Relationships
    schedules = db.relationship("Schedule", backref="doctor", lazy=True, cascade="all, delete-orphan")
    appointments = db.relationship(
        "Appointment", foreign_keys="Appointment.doctor_id", backref="doctor", lazy=True
    )

    def __repr__(self):
        return f"<Doctor {self.user.full_name} - {self.specialty}>"


# ─── Model: Schedule ───────────────────────────────────────────────────────────
class Schedule(db.Model):
    __tablename__ = "schedules"

    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=False)
    work_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    max_patients = db.Column(db.Integer, default=10)
    is_available = db.Column(db.Boolean, default=True)

    # Relationships
    appointments = db.relationship("Appointment", backref="schedule", lazy=True)

    def booked_count(self):
        return Appointment.query.filter_by(
            schedule_id=self.id,
            status="confirmed"
        ).count()

    def has_slots(self):
        return self.is_available and self.booked_count() < self.max_patients

    def __repr__(self):
        return f"<Schedule doctor_id={self.doctor_id} date={self.work_date}>"


# ─── Model: Appointment ────────────────────────────────────────────────────────
class Appointment(db.Model):
    __tablename__ = "appointments"

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=False)
    schedule_id = db.Column(db.Integer, db.ForeignKey("schedules.id"), nullable=True)
    appointment_date = db.Column(db.Date, nullable=False)
    appointment_time = db.Column(db.Time, nullable=False)
    reason = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default="pending")  # pending | confirmed | cancelled | completed
    notes = db.Column(db.Text, nullable=True)  # Ghi chú của bác sĩ
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    STATUS_LABELS = {
        "pending": ("Chờ xác nhận", "warning"),
        "confirmed": ("Đã xác nhận", "success"),
        "cancelled": ("Đã hủy", "danger"),
        "completed": ("Hoàn thành", "info"),
    }

    def status_label(self):
        return self.STATUS_LABELS.get(self.status, ("Không rõ", "secondary"))

    def __repr__(self):
        return f"<Appointment patient={self.patient_id} doctor={self.doctor_id} date={self.appointment_date}>"
