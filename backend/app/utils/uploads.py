"""Lưu avatar mọi vai trò và ảnh bài viết, kiểm tra nội dung ảnh thực tế.

Docker gắn backend/uploads vào /app/uploads; ảnh không mất khi tạo lại container.
"""
import os
import re
import uuid
import warnings
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from backend.app.core.errors import bad_request

MAX_AVATAR_BYTES = 2 * 1024 * 1024
MAX_ARTICLE_BYTES = 5 * 1024 * 1024
URL_PREFIX = '/uploads/avatars/'
ARTICLE_URL_PREFIX = '/uploads/articles/'
FILENAME_RE = re.compile(r'^[0-9a-f]{32}\.(jpg|png|webp)\Z')
def _image_dir(folder):
    root = os.environ.get('UPLOAD_DIR', str(Path(__file__).resolve().parents[2] / 'uploads'))
    path = os.path.join(root, folder)
    os.makedirs(path, exist_ok=True)
    return path


def avatar_dir():
    return _image_dir('avatars')


def article_dir():
    return _image_dir('articles')


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


def _save_image(file_storage, maximum, folder, prefix):
    if file_storage is None or not file_storage.filename:
        raise bad_request("Thiếu file ảnh (trường form 'file')", 'MISSING_FILE')
    data = file_storage.stream.read(maximum + 1)
    if not data:
        raise bad_request('File rỗng', 'EMPTY_FILE')
    if len(data) > maximum:
        raise bad_request(f'Ảnh tối đa {maximum // (1024 * 1024)} MB', 'FILE_TOO_LARGE')
    ext = detect_image_type(data)
    if ext is None:
        raise bad_request('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP', 'INVALID_IMAGE')
    filename = f'{uuid.uuid4().hex}.{ext}'
    with open(os.path.join(_image_dir(folder), filename), 'xb') as handle:
        handle.write(data)
    return prefix + filename


def save_avatar(file_storage):
    return _save_image(file_storage, MAX_AVATAR_BYTES, 'avatars', URL_PREFIX)


def save_article_image(file_storage):
    return _save_image(file_storage, MAX_ARTICLE_BYTES, 'articles', ARTICLE_URL_PREFIX)


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
