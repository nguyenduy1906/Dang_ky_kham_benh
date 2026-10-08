from backend.app.core.errors import bad_request
from backend.app.schemas.auth_schema import ensure_object, text_field
from backend.app.schemas.common_schema import int_field


def validate_review(data):
    data = ensure_object(data)
    if set(data) - {'rating', 'comment'}:
        raise bad_request('Chỉ nhận rating và comment')
    return {'rating': int_field(data, 'rating', required=True, minimum=1, maximum=5),
            'comment': text_field(data, 'comment', max_len=3000)}
