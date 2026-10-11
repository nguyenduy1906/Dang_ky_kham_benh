"""Lưu ảnh đại diện: xác minh và giải mã ảnh, giới hạn dung lượng, đặt tên ngẫu nhiên.

Thư mục lưu nằm trong volume Docker (uploads_data) nên không mất khi tạo lại container.
"""
import os
import re
import uuid
import warnings
from io import BytesIO

from PIL import Image, UnidentifiedImageError

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
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as picture:
                ext = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp'}.get(picture.format)
                if ext is None:
                    return None
                picture.verify()
            # verify kiểm tra cấu trúc; load buộc giải mã pixel và từ chối ảnh bị cắt cụt.
            with Image.open(BytesIO(data)) as picture:
                for frame in range(getattr(picture, 'n_frames', 1)):
                    picture.seek(frame)
                    picture.load()
            return ext
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
            Image.DecompressionBombError, Image.DecompressionBombWarning):
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
