"""Create the Flask backend after database initialization and seed."""
from flask import Flask
from flasgger import Swagger
from backend.app.core.errors import register_error_handlers
from backend.app.core.security import get_secret_key
from backend.app.db.database import get_db_connection
from backend.app.routes import health_routes
from backend.app.routes.auth_routes import auth_bp
from backend.app.routes.department_routes import department_bp
from backend.app.routes.doctor_routes import doctor_bp
from backend.app.routes.nurse_assignment_routes import nurse_assignment_bp
from backend.app.routes.patient_routes import patient_bp
from backend.app.routes.room_routes import room_bp
from backend.app.routes.schedule_routes import schedule_bp
from backend.app.routes.user_admin_routes import user_admin_bp


def create_app():
    with get_db_connection() as db:
        if not db.execute("SELECT to_regclass('role') AS table_name").fetchone()['table_name']:
            raise RuntimeError('Run python -m backend.app.db.init_db first')
        if not db.execute('SELECT 1 FROM role LIMIT 1').fetchone():
            raise RuntimeError('Run python -m backend.app.db.seed_db first')
    get_secret_key()  # báo lỗi sớm nếu thiếu SECRET_KEY và mật khẩu DB
    app = Flask(__name__)
    register_error_handlers(app)
    app.register_blueprint(health_routes)
    for blueprint in (auth_bp, user_admin_bp, department_bp, room_bp, doctor_bp,
                      patient_bp, schedule_bp, nurse_assignment_bp):
        app.register_blueprint(blueprint)
    app.config['SWAGGER'] = {'title': 'Medical Booking API', 'uiversion': 3}
    Swagger(app, config={'specs_route': '/docs/'}, merge=True, template={
        'swagger': '2.0',
        'info': {'title': 'Medical Booking API', 'version': '1.0.0',
                 'description': 'Tài liệu API của dự án đăng ký và đặt lịch khám bệnh.'},
        'securityDefinitions': {'Bearer': {
            'type': 'apiKey', 'name': 'Authorization', 'in': 'header',
            'description': 'Nhập: Bearer <access_token>'}},
    })
    return app


if __name__ == '__main__':
    create_app().run(host='0.0.0.0', port=5000, debug=False)
