import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from config import config

db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = "auth.login"
login_manager.login_message = "Vui lòng đăng nhập để tiếp tục."
login_manager.login_message_category = "warning"


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "default")

    app = Flask(
        __name__,
        template_folder="../templates",
        static_folder="static",
    )
    app.config.from_object(config[config_name])

    # Khởi tạo extensions
    db.init_app(app)
    login_manager.init_app(app)

    # Tạo thư mục instance nếu chưa có
    os.makedirs(app.instance_path, exist_ok=True)
    os.makedirs(app.config.get("UPLOAD_FOLDER", ""), exist_ok=True)

    # Đăng ký blueprints
    from app.routes.auth import auth_bp
    from app.routes.patient import patient_bp
    from app.routes.doctor import doctor_bp
    from app.routes.appointment import appointment_bp
    from app.routes.admin import admin_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(patient_bp, url_prefix="/patient")
    app.register_blueprint(doctor_bp, url_prefix="/doctor")
    app.register_blueprint(appointment_bp, url_prefix="/appointment")
    app.register_blueprint(admin_bp, url_prefix="/admin")

    # Route trang chủ
    from flask import render_template
    from app.models import Doctor

    @app.route("/")
    def index():
        doctors = Doctor.query.limit(6).all()
        return render_template("index.html", doctors=doctors)

    # Tạo bảng database
    with app.app_context():
        db.create_all()
        _seed_admin(app)

    return app


def _seed_admin(app):
    """Tạo tài khoản admin mặc định nếu chưa có."""
    from app.models import User
    from werkzeug.security import generate_password_hash

    with app.app_context():
        if not User.query.filter_by(role="admin").first():
            admin = User(
                full_name="Quản trị viên",
                email="admin@clinic.vn",
                password_hash=generate_password_hash("Admin@123"),
                phone="0900000000",
                role="admin",
            )
            db.session.add(admin)
            db.session.commit()
            print("[INFO] Default admin created: admin@clinic.vn / Admin@123")
