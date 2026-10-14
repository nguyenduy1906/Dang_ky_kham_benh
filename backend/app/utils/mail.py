"""Adapter gửi email/OTP.

Chưa có nhà cung cấp email thật. Khi SEND_EMAIL=1, nội dung thư được in ra log của
backend (docker compose logs backend) để thử nghiệm. Khi SEND_EMAIL khác 1, adapter
không làm lộ mã ở bất kỳ đâu. API public không bao giờ trả OTP hay mã xác minh email.
"""
import os


def send_email_enabled():
    return os.environ.get('SEND_EMAIL', '0') == '1'


def deliver(to_email, subject, body):
    if send_email_enabled():
        print(f'[SEND MAIL] to={to_email} | {subject} | {body}', flush=True)
    else:
        print(f'[MAIL] Chưa cấu hình nhà cung cấp email, chưa gửi thư tới {to_email}', flush=True)


def send_otp(to_email, otp):
    deliver(to_email, 'Mã OTP đặt lại mật khẩu', f'OTP của bạn là {otp}')


def send_sms_otp(phone, otp):
    """SMS giả lập cho đồ án; không gửi SMS thật hoặc trả OTP qua API."""
    if os.environ.get('SEND_SMS', '0') == '1':
        print(f'[SEND SMS] to={phone} | Mã OTP đặt lại mật khẩu: {otp}', flush=True)
    else:
        print('[SMS] Chưa cấu hình nhà cung cấp SMS, chưa gửi mã', flush=True)


def send_email_verification(to_email, token):
    deliver(to_email, 'Xác minh email', f'Mã xác minh email: {token}')
