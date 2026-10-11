"""Public account serialization without password hashes."""

def _iso(value):
    return value.isoformat() if value is not None else None


def to_public(user):
    """Chuyển một dòng users thành dict an toàn để trả về API (không có password_hash)."""
    return {
        'user_id': user['user_id'],
        'role_id': user['role_id'],
        'role_name': user['role_name'],
        'full_name': user['full_name'],
        'phone': user['phone'],
        'email': user['email'],
        'approval_status': user['approval_status'],
        'account_status': user['account_status'],
        'email_verified': bool(user['email_verified']),
        'is_deleted': user['deleted_at'] is not None,
        'created_at': _iso(user['created_at']),
        'updated_at': _iso(user['updated_at']),
    }
