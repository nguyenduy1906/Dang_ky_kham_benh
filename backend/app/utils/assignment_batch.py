"""Identify one explicit administrator assignment submission, never a time window."""
from uuid import UUID, uuid4
from flask import g, has_request_context, request

PATHS = {'/admin/schedules', '/admin/nurse-assignments', '/admin/reception-assignments'}
def current_batch():
    if not has_request_context() or request.method != 'POST' or request.path not in PATHS:
        return None
    actor = getattr(g, 'current_user', None) or {}
    if actor.get('role_name') != 'ADMIN':
        return None
    if hasattr(g, 'assignment_batch'):
        return g.assignment_batch
    raw = request.headers.get('X-Assignment-Batch')
    if raw:
        try: value = str(UUID(raw))
        except (ValueError, AttributeError):
            from backend.app.core.errors import bad_request
            raise bad_request('Mã nhóm phân công không hợp lệ')
    else:
        body = request.get_json(silent=True) or {}
        value = str(uuid4()) if request.path == '/admin/reception-assignments' and len(body.get('shifts', [])) > 1 else None
    g.assignment_batch = value
    return value
