"""Authenticated SMTP with mandatory TLS; never log message bodies or credentials."""
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import parseaddr
from urllib.parse import urlsplit
from backend.app.core.errors import AppError


def send_email_enabled():
    # Legacy payment-demo switch, unrelated to SMTP.
    return os.environ.get('SEND_EMAIL', '0') == '1'


def settings():
    user = os.environ.get('SMTP_USER', '').strip()
    password = os.environ.get('SMTP_PASSWORD', '').replace(' ', '')
    sender = os.environ.get('MAIL_FROM', '').strip() or user
    host = os.environ.get('SMTP_HOST', 'smtp.gmail.com').strip()
    security = os.environ.get('SMTP_SECURITY', 'starttls').strip().lower()
    try:
        port = int(os.environ.get('SMTP_PORT', '587'))
        valid = (os.environ.get('EMAIL_ENABLED') == '1' and user and password and host
                 and security in ('starttls', 'ssl') and 1 <= port <= 65535
                 and parseaddr(sender)[1] == sender and '@' in sender
                 and not any(c in sender + user + host for c in '\r\n'))
    except ValueError:
        valid = False
    if not valid:
        raise AppError(503, 'EMAIL_NOT_CONFIGURED', 'Chưa cấu hình gửi email thật. Vui lòng liên hệ quản trị viên.')
    return host, port, user, password, sender, security


def website_url(path):
    base = os.environ.get('PUBLIC_SITE_URL', '').strip().rstrip('/')
    parsed = urlsplit(base)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.query or parsed.fragment or parsed.username:
        raise AppError(503, 'EMAIL_NOT_CONFIGURED', 'Chưa cấu hình địa chỉ website trong email.')
    return base + '/frontend/templates/' + path


def deliver(to_email, subject, body, *, message_id=None):
    host, port, user, password, sender, security = settings()
    if (not isinstance(to_email, str) or parseaddr(to_email)[1] != to_email
            or '@' not in to_email or any(c in to_email + subject for c in '\r\n')
            or to_email.lower().endswith(('.invalid', '.test', '.example'))):
        raise AppError(503, 'EMAIL_RECIPIENT_INVALID', 'Địa chỉ email nhận chưa hợp lệ.')
    message = EmailMessage()
    message['From'], message['To'], message['Subject'] = sender, to_email, subject
    if message_id:
        message['Message-ID'] = message_id
    message.set_content(body)
    try:
        context = ssl.create_default_context()
        client = (smtplib.SMTP_SSL(host, port, timeout=15, context=context) if security == 'ssl'
                  else smtplib.SMTP(host, port, timeout=15))
        with client as smtp:
            if security == 'starttls':
                smtp.ehlo()
                smtp.starttls(context=context)
                smtp.ehlo()
            smtp.login(user, password)
            if smtp.send_message(message):
                raise smtplib.SMTPException('Recipient rejected')
    except (smtplib.SMTPException, OSError):
        raise AppError(503, 'EMAIL_DELIVERY_FAILED', 'Chưa gửi được email. Vui lòng thử lại sau.') from None


def send_otp(to_email, otp):
    deliver(to_email, 'NEU Medical - Mã OTP đặt lại mật khẩu',
            f'Mã OTP của bạn: {otp}\nMã có hiệu lực 10 phút, chỉ dùng một lần. '
            'Không chia sẻ mã với bất kỳ ai. Nếu không yêu cầu đặt lại mật khẩu, hãy bỏ qua thư này.')


def send_sms_otp(phone, otp):
    raise AppError(503, 'SMS_NOT_CONFIGURED', 'Chưa hỗ trợ SMS thật. Vui lòng khôi phục bằng email đã đăng ký.')


def send_email_verification(to_email, token):
    from urllib.parse import quote
    link = website_url('auth/verify_email.html') + '#token=' + quote(token, safe='')
    deliver(to_email, 'NEU Medical - Xác minh email đăng ký',
            'Chào mừng bạn đến với NEU Medical.\nMở liên kết và bấm Xác minh email:\n'
            + link + '\nLiên kết có hiệu lực 24 giờ. Nếu bạn không tạo tài khoản, hãy bỏ qua thư này.')
