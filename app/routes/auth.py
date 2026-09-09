from flask import Blueprint, render_template, redirect, url_for, flash, request, session
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash
from app import db
from app.models import User

auth_bp = Blueprint("auth", __name__)


# ─── Đăng nhập ─────────────────────────────────────────────────────────────────
@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return _redirect_by_role(current_user)

    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        remember = request.form.get("remember") == "on"

        user = User.query.filter_by(email=email).first()

        if user and user.check_password(password) and user.is_active:
            login_user(user, remember=remember)
            flash(f"Chào mừng, {user.full_name}!", "success")
            next_page = request.args.get("next")
            return redirect(next_page or _redirect_url_by_role(user))
        else:
            flash("Email hoặc mật khẩu không đúng.", "danger")

    return render_template("auth/login.html")


# ─── Đăng ký ───────────────────────────────────────────────────────────────────
@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return _redirect_by_role(current_user)

    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        email = request.form.get("email", "").strip().lower()
        phone = request.form.get("phone", "").strip()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")

        # Validate
        errors = []
        if not full_name:
            errors.append("Họ tên không được để trống.")
        if not email:
            errors.append("Email không được để trống.")
        if User.query.filter_by(email=email).first():
            errors.append("Email đã được sử dụng.")
        if len(password) < 6:
            errors.append("Mật khẩu phải có ít nhất 6 ký tự.")
        if password != confirm:
            errors.append("Mật khẩu xác nhận không khớp.")

        if errors:
            for e in errors:
                flash(e, "danger")
        else:
            user = User(
                full_name=full_name,
                email=email,
                phone=phone,
                role="patient",
            )
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            flash("Đăng ký thành công! Vui lòng đăng nhập.", "success")
            return redirect(url_for("auth.login"))

    return render_template("auth/register.html")


# ─── Đăng xuất ─────────────────────────────────────────────────────────────────
@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("Bạn đã đăng xuất.", "info")
    return redirect(url_for("index"))


# ─── Helper ────────────────────────────────────────────────────────────────────
def _redirect_url_by_role(user):
    if user.is_admin():
        return url_for("admin.dashboard")
    elif user.is_doctor():
        return url_for("doctor.dashboard")
    else:
        return url_for("patient.dashboard")


def _redirect_by_role(user):
    return redirect(_redirect_url_by_role(user))
