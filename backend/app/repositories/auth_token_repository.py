"""Truy vấn SQL cho bảng auth_token (OTP, token đặt lại mật khẩu, token xác minh email)."""


def invalidate_unused(db, user_id, token_type):
    db.execute('UPDATE auth_token SET used_at = CURRENT_TIMESTAMP '
               'WHERE user_id = %s AND token_type = %s AND used_at IS NULL',
               (user_id, token_type))


def create_token(db, user_id, token_type, token_hash, ttl_minutes):
    db.execute('INSERT INTO auth_token (user_id, token_type, token_hash, expires_at) '
               'VALUES (%s, %s, %s, CURRENT_TIMESTAMP + make_interval(mins => %s::int))',
               (user_id, token_type, token_hash, ttl_minutes))


def consume_by_hash(db, token_type, token_hash):
    """Đánh dấu đã dùng nếu token còn hạn và chưa dùng (một câu lệnh nên không dùng lại được)."""
    row = db.execute('UPDATE auth_token SET used_at = CURRENT_TIMESTAMP '
                     'WHERE token_type = %s AND token_hash = %s AND used_at IS NULL '
                     'AND expires_at > CURRENT_TIMESTAMP RETURNING user_id',
                     (token_type, token_hash)).fetchone()
    return row['user_id'] if row else None


def consume_otp(db, user_id, token_hash):
    row = db.execute("UPDATE auth_token SET used_at = CURRENT_TIMESTAMP "
                     "WHERE user_id = %s AND token_type = 'OTP' AND token_hash = %s "
                     "AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP "
                     "RETURNING token_id", (user_id, token_hash)).fetchone()
    return row is not None
