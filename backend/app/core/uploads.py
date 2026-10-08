"""Lưu ảnh đại diện: kiểm tra nội dung thật (magic bytes), giới hạn dung lượng, đặt tên ngẫu nhiên.

Thư mục lưu nằm trong volume Docker (uploads_data) nên không mất khi tạo lại container.
"""
import os
import re
import uuid

from backend.app.core.errors import bad_request

MAX_AVATAR_BYTES = 2 * 1024 * 1024
URL_PREFIX = '/uploads/avatars/'
FILENAME_RE = re.compile(r'^[0-9a-f]{32}\.(jpg|png|webp)$')


def avatar_dir():
    root = os.environ.get('UPLOAD_DIR', '/app/uploads')
    path = os.path.join(root, 'avatars')
    os.makedirs(path, exist_ok=True)
    return path


def detect_image_type(data):
    if data.startswith(b'\xff\xd8\xff'):
        return 'jpg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'webp'
    return None


def save_avatar(file_storage):
    data = file_storage.stream.read(MAX_AVATAR_BYTES + 1)
    if not data:
        raise bad_request('File rỗng', 'EMPTY_FILE')
    if len(data) > MAX_AVATAR_BYTES:
        raise bad_request('Ảnh tối đa 2 MB', 'FILE_TOO_LARGE')
    ext = detect_image_type(data)
    if ext is None:
        raise bad_request('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP', 'INVALID_IMAGE')
    filename = f'{uuid.uuid4().hex}.{ext}'
    with open(os.path.join(avatar_dir(), filename), 'wb') as handle:
        handle.write(data)
    return URL_PREFIX + filename


def delete_avatar(url):
    if not url or not url.startswith(URL_PREFIX):
        return
    filename = url[len(URL_PREFIX):]
    if not FILENAME_RE.match(filename):
        return
    try:
        os.remove(os.path.join(avatar_dir(), filename))
    except OSError:
        pass
