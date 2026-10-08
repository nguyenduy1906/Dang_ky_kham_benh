"""Tạo tài khoản ADMIN đầu tiên.

Cách chạy (sau khi docker compose đã chạy):
    docker compose exec backend python -m backend.app.db.create_admin admin@example.com "Quan Tri Vien"
Mật khẩu được nhập tại dấu nhắc, không lưu vào lịch sử lệnh.
"""
import getpass
import sys

from backend.app.core import constants
from backend.app.core.errors import AppError
from backend.app.core.security import hash_password
from backend.app.db.database import get_db_connection
from backend.app.models import user_model
from backend.app.schemas import auth_schema


def main():
    if len(sys.argv) != 3:
        print('Dùng: python -m backend.app.db.create_admin <email> "<Họ tên>"')
        return 2
    try:
        email = auth_schema.normalize_email(sys.argv[1])
        full_name = auth_schema.text_field({'full_name': sys.argv[2]}, 'full_name',
                                           required=True, max_len=150)
        password = auth_schema.check_password(getpass.getpass('Mật khẩu: '))
        if getpass.getpass('Nhập lại mật khẩu: ') != password:
            print('Hai mật khẩu không khớp')
            return 1
    except AppError as err:
        print(err.message)
        return 1
    with get_db_connection() as db:
        role = user_model.get_role_by_name(db, constants.ROLE_ADMIN)
        if role is None:
            print('Chưa có vai trò ADMIN, hãy chạy seed_db trước')
            return 1
        if user_model.find_identity_conflict(db, email, None):
            print('Email này đã tồn tại')
            return 1
        user_model.create_user(db, role_id=role['role_id'], full_name=full_name,
                               email=email, phone=None, password_hash=hash_password(password),
                               approval_status=constants.APPROVAL_APPROVED, email_verified=1)
    print(f'Đã tạo ADMIN {email}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
